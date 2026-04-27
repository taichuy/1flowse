use anyhow::Result;
use async_trait::async_trait;
use control_plane::ports::{
    AppendCapabilityInvocationInput, AppendContextProjectionInput, AppendRunEventInput,
    AppendRuntimeEventInput, AppendRuntimeItemInput, AppendRuntimeSpanInput,
    AppendUsageLedgerInput, CompleteCallbackTaskInput, CompleteFlowRunInput, CompleteNodeRunInput,
    CreateCallbackTaskInput, CreateCheckpointInput, CreateFlowRunInput, CreateNodeRunInput,
    OrchestrationRuntimeRepository, UpdateFlowRunInput, UpdateNodeRunInput,
    UpsertCompiledPlanInput,
};
use sqlx::{postgres::PgRow, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::{
    mappers::orchestration_runtime_mapper::{
        PgOrchestrationRuntimeMapper, StoredApplicationRunSummaryRow, StoredCallbackTaskRow,
        StoredCapabilityInvocationRow, StoredCheckpointRow, StoredCompiledPlanRow,
        StoredContextProjectionRow, StoredFlowRunRow, StoredNodeRunRow, StoredRunEventRow,
        StoredRuntimeEventRow, StoredRuntimeItemRow, StoredRuntimeSpanRow, StoredUsageLedgerRow,
    },
    repositories::PgControlPlaneStore,
};

#[async_trait]
impl OrchestrationRuntimeRepository for PgControlPlaneStore {
    async fn upsert_compiled_plan(
        &self,
        input: &UpsertCompiledPlanInput,
    ) -> Result<domain::CompiledPlanRecord> {
        let row = sqlx::query(
            r#"
            insert into flow_compiled_plans (
                id,
                flow_id,
                flow_draft_id,
                schema_version,
                document_updated_at,
                plan,
                created_by
            ) values ($1, $2, $3, $4, $5, $6, $7)
            on conflict (flow_draft_id) do update
            set flow_id = excluded.flow_id,
                schema_version = excluded.schema_version,
                document_updated_at = excluded.document_updated_at,
                plan = excluded.plan,
                created_by = excluded.created_by,
                updated_at = now()
            returning
                id,
                flow_id,
                flow_draft_id,
                schema_version,
                document_updated_at,
                plan,
                created_by,
                created_at,
                updated_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_id)
        .bind(input.flow_draft_id)
        .bind(&input.schema_version)
        .bind(input.document_updated_at)
        .bind(&input.plan)
        .bind(input.actor_user_id)
        .fetch_one(self.pool())
        .await?;

        map_compiled_plan_record(row)
    }

    async fn get_compiled_plan(
        &self,
        compiled_plan_id: Uuid,
    ) -> Result<Option<domain::CompiledPlanRecord>> {
        let row = sqlx::query(
            r#"
            select
                id,
                flow_id,
                flow_draft_id,
                schema_version,
                document_updated_at,
                plan,
                created_by,
                created_at,
                updated_at
            from flow_compiled_plans
            where id = $1
            "#,
        )
        .bind(compiled_plan_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_compiled_plan_record).transpose()
    }

    async fn create_flow_run(&self, input: &CreateFlowRunInput) -> Result<domain::FlowRunRecord> {
        let row = sqlx::query(
            r#"
            insert into flow_runs (
                id,
                application_id,
                flow_id,
                flow_draft_id,
                compiled_plan_id,
                run_mode,
                target_node_id,
                status,
                input_payload,
                created_by,
                started_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            returning
                id,
                application_id,
                flow_id,
                flow_draft_id,
                compiled_plan_id,
                run_mode,
                target_node_id,
                status,
                input_payload,
                output_payload,
                error_payload,
                created_by,
                started_at,
                finished_at,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.application_id)
        .bind(input.flow_id)
        .bind(input.flow_draft_id)
        .bind(input.compiled_plan_id)
        .bind(input.run_mode.as_str())
        .bind(input.target_node_id.as_deref())
        .bind(input.status.as_str())
        .bind(&input.input_payload)
        .bind(input.actor_user_id)
        .bind(input.started_at)
        .fetch_one(self.pool())
        .await?;

        map_flow_run_record(row)
    }

    async fn get_flow_run(
        &self,
        application_id: Uuid,
        flow_run_id: Uuid,
    ) -> Result<Option<domain::FlowRunRecord>> {
        fetch_flow_run_for_application(self, application_id, flow_run_id).await
    }

    async fn create_node_run(&self, input: &CreateNodeRunInput) -> Result<domain::NodeRunRecord> {
        let row = sqlx::query(
            r#"
            insert into node_runs (
                id,
                flow_run_id,
                node_id,
                node_type,
                node_alias,
                status,
                input_payload,
                started_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning
                id,
                flow_run_id,
                node_id,
                node_type,
                node_alias,
                status,
                input_payload,
                output_payload,
                error_payload,
                metrics_payload,
                started_at,
                finished_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(&input.node_id)
        .bind(&input.node_type)
        .bind(&input.node_alias)
        .bind(input.status.as_str())
        .bind(&input.input_payload)
        .bind(input.started_at)
        .fetch_one(self.pool())
        .await?;

        map_node_run_record(row)
    }

    async fn update_node_run(&self, input: &UpdateNodeRunInput) -> Result<domain::NodeRunRecord> {
        let row = sqlx::query(
            r#"
            update node_runs
            set status = $2,
                output_payload = $3,
                error_payload = $4,
                metrics_payload = $5,
                finished_at = $6
            where id = $1
            returning
                id,
                flow_run_id,
                node_id,
                node_type,
                node_alias,
                status,
                input_payload,
                output_payload,
                error_payload,
                metrics_payload,
                started_at,
                finished_at
            "#,
        )
        .bind(input.node_run_id)
        .bind(input.status.as_str())
        .bind(&input.output_payload)
        .bind(&input.error_payload)
        .bind(&input.metrics_payload)
        .bind(input.finished_at)
        .fetch_one(self.pool())
        .await?;

        map_node_run_record(row)
    }

    async fn complete_node_run(
        &self,
        input: &CompleteNodeRunInput,
    ) -> Result<domain::NodeRunRecord> {
        self.update_node_run(&UpdateNodeRunInput {
            node_run_id: input.node_run_id,
            status: input.status,
            output_payload: input.output_payload.clone(),
            error_payload: input.error_payload.clone(),
            metrics_payload: input.metrics_payload.clone(),
            finished_at: Some(input.finished_at),
        })
        .await
    }

    async fn update_flow_run(&self, input: &UpdateFlowRunInput) -> Result<domain::FlowRunRecord> {
        let row = sqlx::query(
            r#"
            update flow_runs
            set status = $2,
                output_payload = $3,
                error_payload = $4,
                finished_at = $5
            where id = $1
            returning
                id,
                application_id,
                flow_id,
                flow_draft_id,
                compiled_plan_id,
                run_mode,
                target_node_id,
                status,
                input_payload,
                output_payload,
                error_payload,
                created_by,
                started_at,
                finished_at,
                created_at
            "#,
        )
        .bind(input.flow_run_id)
        .bind(input.status.as_str())
        .bind(&input.output_payload)
        .bind(&input.error_payload)
        .bind(input.finished_at)
        .fetch_one(self.pool())
        .await?;

        map_flow_run_record(row)
    }

    async fn complete_flow_run(
        &self,
        input: &CompleteFlowRunInput,
    ) -> Result<domain::FlowRunRecord> {
        self.update_flow_run(&UpdateFlowRunInput {
            flow_run_id: input.flow_run_id,
            status: input.status,
            output_payload: input.output_payload.clone(),
            error_payload: input.error_payload.clone(),
            finished_at: Some(input.finished_at),
        })
        .await
    }

    async fn get_checkpoint(
        &self,
        flow_run_id: Uuid,
        checkpoint_id: Uuid,
    ) -> Result<Option<domain::CheckpointRecord>> {
        let row = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                node_run_id,
                status,
                reason,
                locator_payload,
                variable_snapshot,
                external_ref_payload,
                created_at
            from flow_run_checkpoints
            where flow_run_id = $1
              and id = $2
            "#,
        )
        .bind(flow_run_id)
        .bind(checkpoint_id)
        .fetch_optional(self.pool())
        .await?;

        Ok(row.map(fetch_checkpoint_record))
    }

    async fn create_checkpoint(
        &self,
        input: &CreateCheckpointInput,
    ) -> Result<domain::CheckpointRecord> {
        let row = sqlx::query(
            r#"
            insert into flow_run_checkpoints (
                id,
                flow_run_id,
                node_run_id,
                status,
                reason,
                locator_payload,
                variable_snapshot,
                external_ref_payload
            ) values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning
                id,
                flow_run_id,
                node_run_id,
                status,
                reason,
                locator_payload,
                variable_snapshot,
                external_ref_payload,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(&input.status)
        .bind(&input.reason)
        .bind(&input.locator_payload)
        .bind(&input.variable_snapshot)
        .bind(&input.external_ref_payload)
        .fetch_one(self.pool())
        .await?;

        Ok(map_checkpoint_record(row))
    }

    async fn create_callback_task(
        &self,
        input: &CreateCallbackTaskInput,
    ) -> Result<domain::CallbackTaskRecord> {
        let row = sqlx::query(
            r#"
            insert into flow_run_callback_tasks (
                id,
                flow_run_id,
                node_run_id,
                callback_kind,
                status,
                request_payload,
                external_ref_payload
            ) values ($1, $2, $3, $4, 'pending', $5, $6)
            returning
                id,
                flow_run_id,
                node_run_id,
                callback_kind,
                status,
                request_payload,
                response_payload,
                external_ref_payload,
                created_at,
                completed_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(&input.callback_kind)
        .bind(&input.request_payload)
        .bind(&input.external_ref_payload)
        .fetch_one(self.pool())
        .await?;

        map_callback_task_record(row)
    }

    async fn complete_callback_task(
        &self,
        input: &CompleteCallbackTaskInput,
    ) -> Result<domain::CallbackTaskRecord> {
        let row = sqlx::query(
            r#"
            update flow_run_callback_tasks
            set status = 'completed',
                response_payload = $2,
                completed_at = $3
            where id = $1
            returning
                id,
                flow_run_id,
                node_run_id,
                callback_kind,
                status,
                request_payload,
                response_payload,
                external_ref_payload,
                created_at,
                completed_at
            "#,
        )
        .bind(input.callback_task_id)
        .bind(&input.response_payload)
        .bind(input.completed_at)
        .fetch_one(self.pool())
        .await?;

        map_callback_task_record(row)
    }

    async fn append_run_event(
        &self,
        input: &AppendRunEventInput,
    ) -> Result<domain::RunEventRecord> {
        let mut tx = self.pool().begin().await?;
        let next_sequence = next_event_sequence(&mut tx, input.flow_run_id).await?;
        let row = sqlx::query(
            r#"
            insert into flow_run_events (
                id,
                flow_run_id,
                node_run_id,
                sequence,
                event_type,
                payload
            ) values ($1, $2, $3, $4, $5, $6)
            returning
                id,
                flow_run_id,
                node_run_id,
                sequence,
                event_type,
                payload,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(next_sequence)
        .bind(&input.event_type)
        .bind(&input.payload)
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(map_run_event_record(row))
    }

    async fn append_runtime_span(
        &self,
        input: &AppendRuntimeSpanInput,
    ) -> Result<domain::RuntimeSpanRecord> {
        let row = sqlx::query(
            r#"
            insert into runtime_spans (
                id,
                flow_run_id,
                node_run_id,
                parent_span_id,
                kind,
                name,
                status,
                capability_id,
                input_ref,
                output_ref,
                error_payload,
                metadata,
                started_at,
                finished_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            returning
                id,
                flow_run_id,
                node_run_id,
                parent_span_id,
                kind,
                name,
                status,
                capability_id,
                input_ref,
                output_ref,
                error_payload,
                metadata,
                started_at,
                finished_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(input.parent_span_id)
        .bind(input.kind.as_str())
        .bind(&input.name)
        .bind(input.status.as_str())
        .bind(input.capability_id.as_deref())
        .bind(input.input_ref.as_deref())
        .bind(input.output_ref.as_deref())
        .bind(&input.error_payload)
        .bind(&input.metadata)
        .bind(input.started_at)
        .bind(input.finished_at)
        .fetch_one(self.pool())
        .await?;

        map_runtime_span_record(row)
    }

    async fn append_runtime_event(
        &self,
        input: &AppendRuntimeEventInput,
    ) -> Result<domain::RuntimeEventRecord> {
        let mut tx = self.pool().begin().await?;
        let next_sequence = next_runtime_event_sequence(&mut tx, input.flow_run_id).await?;
        let row = sqlx::query(
            r#"
            insert into runtime_events (
                id,
                flow_run_id,
                node_run_id,
                span_id,
                parent_span_id,
                sequence,
                event_type,
                layer,
                source,
                trust_level,
                item_id,
                ledger_ref,
                payload,
                visibility,
                durability
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            returning
                id,
                flow_run_id,
                node_run_id,
                span_id,
                parent_span_id,
                sequence,
                event_type,
                layer,
                source,
                trust_level,
                item_id,
                ledger_ref,
                payload,
                visibility,
                durability,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(input.span_id)
        .bind(input.parent_span_id)
        .bind(next_sequence)
        .bind(&input.event_type)
        .bind(input.layer.as_str())
        .bind(input.source.as_str())
        .bind(input.trust_level.as_str())
        .bind(input.item_id)
        .bind(input.ledger_ref.as_deref())
        .bind(&input.payload)
        .bind(input.visibility.as_str())
        .bind(input.durability.as_str())
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;

        map_runtime_event_record(row)
    }

    async fn append_runtime_item(
        &self,
        input: &AppendRuntimeItemInput,
    ) -> Result<domain::RuntimeItemRecord> {
        let row = sqlx::query(
            r#"
            insert into runtime_items (
                id,
                flow_run_id,
                span_id,
                kind,
                status,
                source_event_id,
                input_ref,
                output_ref,
                usage_ledger_id,
                trust_level
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            returning
                id,
                flow_run_id,
                span_id,
                kind,
                status,
                source_event_id,
                input_ref,
                output_ref,
                usage_ledger_id,
                trust_level,
                created_at,
                updated_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.span_id)
        .bind(input.kind.as_str())
        .bind(input.status.as_str())
        .bind(input.source_event_id)
        .bind(input.input_ref.as_deref())
        .bind(input.output_ref.as_deref())
        .bind(input.usage_ledger_id)
        .bind(input.trust_level.as_str())
        .fetch_one(self.pool())
        .await?;

        map_runtime_item_record(row)
    }

    async fn append_context_projection(
        &self,
        input: &AppendContextProjectionInput,
    ) -> Result<domain::ContextProjectionRecord> {
        let row = sqlx::query(
            r#"
            insert into runtime_context_projections (
                id,
                flow_run_id,
                node_run_id,
                llm_turn_span_id,
                projection_kind,
                merge_stage_ref,
                source_transcript_ref,
                source_item_refs,
                compaction_event_id,
                summary_version,
                model_input_ref,
                model_input_hash,
                compacted_summary_ref,
                previous_projection_id,
                token_estimate,
                provider_continuation_metadata
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            returning
                id,
                flow_run_id,
                node_run_id,
                llm_turn_span_id,
                projection_kind,
                merge_stage_ref,
                source_transcript_ref,
                source_item_refs,
                compaction_event_id,
                summary_version,
                model_input_ref,
                model_input_hash,
                compacted_summary_ref,
                previous_projection_id,
                token_estimate,
                provider_continuation_metadata,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(input.llm_turn_span_id)
        .bind(&input.projection_kind)
        .bind(input.merge_stage_ref.as_deref())
        .bind(input.source_transcript_ref.as_deref())
        .bind(&input.source_item_refs)
        .bind(input.compaction_event_id)
        .bind(input.summary_version.as_deref())
        .bind(&input.model_input_ref)
        .bind(&input.model_input_hash)
        .bind(input.compacted_summary_ref.as_deref())
        .bind(input.previous_projection_id)
        .bind(input.token_estimate)
        .bind(&input.provider_continuation_metadata)
        .fetch_one(self.pool())
        .await?;

        Ok(map_context_projection_record(row))
    }

    async fn append_usage_ledger(
        &self,
        input: &AppendUsageLedgerInput,
    ) -> Result<domain::UsageLedgerRecord> {
        let row = sqlx::query(
            r#"
            insert into runtime_usage_ledger (
                id,
                flow_run_id,
                node_run_id,
                span_id,
                failover_attempt_id,
                provider_instance_id,
                gateway_route_id,
                model_id,
                upstream_model_id,
                upstream_request_id,
                input_tokens,
                cached_input_tokens,
                output_tokens,
                reasoning_output_tokens,
                total_tokens,
                cache_read_tokens,
                cache_write_tokens,
                price_snapshot,
                cost_snapshot,
                usage_status,
                raw_usage,
                normalized_usage
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            returning
                id,
                flow_run_id,
                node_run_id,
                span_id,
                failover_attempt_id,
                provider_instance_id,
                gateway_route_id,
                model_id,
                upstream_model_id,
                upstream_request_id,
                input_tokens,
                cached_input_tokens,
                output_tokens,
                reasoning_output_tokens,
                total_tokens,
                cache_read_tokens,
                cache_write_tokens,
                price_snapshot,
                cost_snapshot,
                usage_status,
                raw_usage,
                normalized_usage,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.node_run_id)
        .bind(input.span_id)
        .bind(input.failover_attempt_id)
        .bind(input.provider_instance_id)
        .bind(input.gateway_route_id)
        .bind(input.model_id.as_deref())
        .bind(input.upstream_model_id.as_deref())
        .bind(input.upstream_request_id.as_deref())
        .bind(input.input_tokens)
        .bind(input.cached_input_tokens)
        .bind(input.output_tokens)
        .bind(input.reasoning_output_tokens)
        .bind(input.total_tokens)
        .bind(input.cache_read_tokens)
        .bind(input.cache_write_tokens)
        .bind(&input.price_snapshot)
        .bind(&input.cost_snapshot)
        .bind(input.usage_status.as_str())
        .bind(&input.raw_usage)
        .bind(&input.normalized_usage)
        .fetch_one(self.pool())
        .await?;

        map_usage_ledger_record(row)
    }

    async fn append_capability_invocation(
        &self,
        input: &AppendCapabilityInvocationInput,
    ) -> Result<domain::CapabilityInvocationRecord> {
        let row = sqlx::query(
            r#"
            insert into capability_invocations (
                id,
                flow_run_id,
                span_id,
                capability_id,
                requested_by_span_id,
                requester_kind,
                arguments_ref,
                authorization_status,
                authorization_reason,
                result_ref,
                normalized_result,
                started_at,
                finished_at,
                error_payload
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            returning
                id,
                flow_run_id,
                span_id,
                capability_id,
                requested_by_span_id,
                requester_kind,
                arguments_ref,
                authorization_status,
                authorization_reason,
                result_ref,
                normalized_result,
                started_at,
                finished_at,
                error_payload,
                created_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.flow_run_id)
        .bind(input.span_id)
        .bind(&input.capability_id)
        .bind(input.requested_by_span_id)
        .bind(&input.requester_kind)
        .bind(input.arguments_ref.as_deref())
        .bind(&input.authorization_status)
        .bind(input.authorization_reason.as_deref())
        .bind(input.result_ref.as_deref())
        .bind(&input.normalized_result)
        .bind(input.started_at)
        .bind(input.finished_at)
        .bind(&input.error_payload)
        .fetch_one(self.pool())
        .await?;

        Ok(map_capability_invocation_record(row))
    }

    async fn list_runtime_spans(
        &self,
        flow_run_id: Uuid,
    ) -> Result<Vec<domain::RuntimeSpanRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                node_run_id,
                parent_span_id,
                kind,
                name,
                status,
                capability_id,
                input_ref,
                output_ref,
                error_payload,
                metadata,
                started_at,
                finished_at
            from runtime_spans
            where flow_run_id = $1
            order by started_at asc, id asc
            "#,
        )
        .bind(flow_run_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_runtime_span_record).collect()
    }

    async fn list_runtime_events(
        &self,
        flow_run_id: Uuid,
        after_sequence: i64,
    ) -> Result<Vec<domain::RuntimeEventRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                node_run_id,
                span_id,
                parent_span_id,
                sequence,
                event_type,
                layer,
                source,
                trust_level,
                item_id,
                ledger_ref,
                payload,
                visibility,
                durability,
                created_at
            from runtime_events
            where flow_run_id = $1
              and sequence > $2
            order by sequence asc, id asc
            "#,
        )
        .bind(flow_run_id)
        .bind(after_sequence)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_runtime_event_record).collect()
    }

    async fn list_runtime_items(
        &self,
        flow_run_id: Uuid,
    ) -> Result<Vec<domain::RuntimeItemRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                span_id,
                kind,
                status,
                source_event_id,
                input_ref,
                output_ref,
                usage_ledger_id,
                trust_level,
                created_at,
                updated_at
            from runtime_items
            where flow_run_id = $1
            order by created_at asc, id asc
            "#,
        )
        .bind(flow_run_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_runtime_item_record).collect()
    }

    async fn list_context_projections(
        &self,
        flow_run_id: Uuid,
    ) -> Result<Vec<domain::ContextProjectionRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                node_run_id,
                llm_turn_span_id,
                projection_kind,
                merge_stage_ref,
                source_transcript_ref,
                source_item_refs,
                compaction_event_id,
                summary_version,
                model_input_ref,
                model_input_hash,
                compacted_summary_ref,
                previous_projection_id,
                token_estimate,
                provider_continuation_metadata,
                created_at
            from runtime_context_projections
            where flow_run_id = $1
            order by created_at asc, id asc
            "#,
        )
        .bind(flow_run_id)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(map_context_projection_record)
            .collect())
    }

    async fn list_usage_ledger(&self, flow_run_id: Uuid) -> Result<Vec<domain::UsageLedgerRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                node_run_id,
                span_id,
                failover_attempt_id,
                provider_instance_id,
                gateway_route_id,
                model_id,
                upstream_model_id,
                upstream_request_id,
                input_tokens,
                cached_input_tokens,
                output_tokens,
                reasoning_output_tokens,
                total_tokens,
                cache_read_tokens,
                cache_write_tokens,
                price_snapshot,
                cost_snapshot,
                usage_status,
                raw_usage,
                normalized_usage,
                created_at
            from runtime_usage_ledger
            where flow_run_id = $1
            order by created_at asc, id asc
            "#,
        )
        .bind(flow_run_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_usage_ledger_record).collect()
    }

    async fn list_capability_invocations(
        &self,
        flow_run_id: Uuid,
    ) -> Result<Vec<domain::CapabilityInvocationRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                flow_run_id,
                span_id,
                capability_id,
                requested_by_span_id,
                requester_kind,
                arguments_ref,
                authorization_status,
                authorization_reason,
                result_ref,
                normalized_result,
                started_at,
                finished_at,
                error_payload,
                created_at
            from capability_invocations
            where flow_run_id = $1
            order by created_at asc, id asc
            "#,
        )
        .bind(flow_run_id)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(map_capability_invocation_record)
            .collect())
    }

    async fn list_application_runs(
        &self,
        application_id: Uuid,
    ) -> Result<Vec<domain::ApplicationRunSummary>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                run_mode,
                status,
                target_node_id,
                started_at,
                finished_at
            from flow_runs
            where application_id = $1
            order by started_at desc, id desc
            "#,
        )
        .bind(application_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_application_run_summary).collect()
    }

    async fn get_application_run_detail(
        &self,
        application_id: Uuid,
        flow_run_id: Uuid,
    ) -> Result<Option<domain::ApplicationRunDetail>> {
        let Some(flow_run) =
            fetch_flow_run_for_application(self, application_id, flow_run_id).await?
        else {
            return Ok(None);
        };

        Ok(Some(domain::ApplicationRunDetail {
            node_runs: list_node_runs_for_flow_run(self, flow_run.id).await?,
            checkpoints: list_checkpoints_for_flow_run(self, flow_run.id).await?,
            callback_tasks: list_callback_tasks_for_flow_run(self, flow_run.id).await?,
            events: list_events_for_flow_run(self, flow_run.id).await?,
            flow_run,
        }))
    }

    async fn get_latest_node_run(
        &self,
        application_id: Uuid,
        node_id: &str,
    ) -> Result<Option<domain::NodeLastRun>> {
        let latest = sqlx::query(
            r#"
            select
                nr.id as node_run_id,
                fr.id as flow_run_id
            from node_runs nr
            join flow_runs fr on fr.id = nr.flow_run_id
            where fr.application_id = $1
              and nr.node_id = $2
            order by nr.started_at desc, nr.id desc
            limit 1
            "#,
        )
        .bind(application_id)
        .bind(node_id)
        .fetch_optional(self.pool())
        .await?;

        let Some(latest) = latest else {
            return Ok(None);
        };
        let flow_run_id: Uuid = latest.get("flow_run_id");
        let node_run_id: Uuid = latest.get("node_run_id");
        let flow_run = fetch_flow_run_for_application(self, application_id, flow_run_id)
            .await?
            .expect("joined flow_run must exist");
        let node_run = fetch_node_run(self, node_run_id)
            .await?
            .expect("joined node_run must exist");

        Ok(Some(domain::NodeLastRun {
            checkpoints: list_checkpoints_for_node_run(self, node_run.id).await?,
            events: list_events_for_node_context(self, flow_run.id, node_run.id).await?,
            flow_run,
            node_run,
        }))
    }
}

async fn next_event_sequence(tx: &mut Transaction<'_, Postgres>, flow_run_id: Uuid) -> Result<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "select coalesce(max(sequence), 0) + 1 from flow_run_events where flow_run_id = $1",
    )
    .bind(flow_run_id)
    .fetch_one(&mut **tx)
    .await?)
}

async fn next_runtime_event_sequence(
    tx: &mut Transaction<'_, Postgres>,
    flow_run_id: Uuid,
) -> Result<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "select coalesce(max(sequence), 0) + 1 from runtime_events where flow_run_id = $1",
    )
    .bind(flow_run_id)
    .fetch_one(&mut **tx)
    .await?)
}

async fn fetch_flow_run_for_application(
    store: &PgControlPlaneStore,
    application_id: Uuid,
    flow_run_id: Uuid,
) -> Result<Option<domain::FlowRunRecord>> {
    let row = sqlx::query(
        r#"
        select
            id,
            application_id,
            flow_id,
            flow_draft_id,
            compiled_plan_id,
            run_mode,
            target_node_id,
            status,
            input_payload,
            output_payload,
            error_payload,
            created_by,
            started_at,
            finished_at,
            created_at
        from flow_runs
        where application_id = $1
          and id = $2
        "#,
    )
    .bind(application_id)
    .bind(flow_run_id)
    .fetch_optional(store.pool())
    .await?;

    row.map(map_flow_run_record).transpose()
}

async fn fetch_node_run(
    store: &PgControlPlaneStore,
    node_run_id: Uuid,
) -> Result<Option<domain::NodeRunRecord>> {
    let row = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_id,
            node_type,
            node_alias,
            status,
            input_payload,
            output_payload,
            error_payload,
            metrics_payload,
            started_at,
            finished_at
        from node_runs
        where id = $1
        "#,
    )
    .bind(node_run_id)
    .fetch_optional(store.pool())
    .await?;

    row.map(map_node_run_record).transpose()
}

async fn list_node_runs_for_flow_run(
    store: &PgControlPlaneStore,
    flow_run_id: Uuid,
) -> Result<Vec<domain::NodeRunRecord>> {
    let rows = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_id,
            node_type,
            node_alias,
            status,
            input_payload,
            output_payload,
            error_payload,
            metrics_payload,
            started_at,
            finished_at
        from node_runs
        where flow_run_id = $1
        order by started_at asc, id asc
        "#,
    )
    .bind(flow_run_id)
    .fetch_all(store.pool())
    .await?;

    rows.into_iter().map(map_node_run_record).collect()
}

async fn list_checkpoints_for_flow_run(
    store: &PgControlPlaneStore,
    flow_run_id: Uuid,
) -> Result<Vec<domain::CheckpointRecord>> {
    let rows = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_run_id,
            status,
            reason,
            locator_payload,
            variable_snapshot,
            external_ref_payload,
            created_at
        from flow_run_checkpoints
        where flow_run_id = $1
        order by created_at asc, id asc
        "#,
    )
    .bind(flow_run_id)
    .fetch_all(store.pool())
    .await?;

    Ok(rows.into_iter().map(map_checkpoint_record).collect())
}

async fn list_checkpoints_for_node_run(
    store: &PgControlPlaneStore,
    node_run_id: Uuid,
) -> Result<Vec<domain::CheckpointRecord>> {
    let rows = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_run_id,
            status,
            reason,
            locator_payload,
            variable_snapshot,
            external_ref_payload,
            created_at
        from flow_run_checkpoints
        where node_run_id = $1
        order by created_at asc, id asc
        "#,
    )
    .bind(node_run_id)
    .fetch_all(store.pool())
    .await?;

    Ok(rows.into_iter().map(map_checkpoint_record).collect())
}

async fn list_events_for_flow_run(
    store: &PgControlPlaneStore,
    flow_run_id: Uuid,
) -> Result<Vec<domain::RunEventRecord>> {
    let rows = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_run_id,
            sequence,
            event_type,
            payload,
            created_at
        from flow_run_events
        where flow_run_id = $1
        order by sequence asc, id asc
        "#,
    )
    .bind(flow_run_id)
    .fetch_all(store.pool())
    .await?;

    Ok(rows.into_iter().map(map_run_event_record).collect())
}

async fn list_callback_tasks_for_flow_run(
    store: &PgControlPlaneStore,
    flow_run_id: Uuid,
) -> Result<Vec<domain::CallbackTaskRecord>> {
    let rows = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_run_id,
            callback_kind,
            status,
            request_payload,
            response_payload,
            external_ref_payload,
            created_at,
            completed_at
        from flow_run_callback_tasks
        where flow_run_id = $1
        order by created_at asc, id asc
        "#,
    )
    .bind(flow_run_id)
    .fetch_all(store.pool())
    .await?;

    rows.into_iter().map(map_callback_task_record).collect()
}

async fn list_events_for_node_context(
    store: &PgControlPlaneStore,
    flow_run_id: Uuid,
    node_run_id: Uuid,
) -> Result<Vec<domain::RunEventRecord>> {
    let rows = sqlx::query(
        r#"
        select
            id,
            flow_run_id,
            node_run_id,
            sequence,
            event_type,
            payload,
            created_at
        from flow_run_events
        where flow_run_id = $1
          and (node_run_id is null or node_run_id = $2)
        order by sequence asc, id asc
        "#,
    )
    .bind(flow_run_id)
    .bind(node_run_id)
    .fetch_all(store.pool())
    .await?;

    Ok(rows.into_iter().map(map_run_event_record).collect())
}

fn map_compiled_plan_record(row: PgRow) -> Result<domain::CompiledPlanRecord> {
    Ok(PgOrchestrationRuntimeMapper::to_compiled_plan_record(
        StoredCompiledPlanRow {
            id: row.get("id"),
            flow_id: row.get("flow_id"),
            flow_draft_id: row.get("flow_draft_id"),
            schema_version: row.get("schema_version"),
            document_updated_at: row.get("document_updated_at"),
            plan: row.get("plan"),
            created_by: row.get("created_by"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        },
    ))
}

fn map_flow_run_record(row: PgRow) -> Result<domain::FlowRunRecord> {
    PgOrchestrationRuntimeMapper::to_flow_run_record(StoredFlowRunRow {
        id: row.get("id"),
        application_id: row.get("application_id"),
        flow_id: row.get("flow_id"),
        flow_draft_id: row.get("flow_draft_id"),
        compiled_plan_id: row.get("compiled_plan_id"),
        run_mode: row.get("run_mode"),
        target_node_id: row.get("target_node_id"),
        status: row.get("status"),
        input_payload: row.get("input_payload"),
        output_payload: row.get("output_payload"),
        error_payload: row.get("error_payload"),
        created_by: row.get("created_by"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
        created_at: row.get("created_at"),
    })
}

fn map_node_run_record(row: PgRow) -> Result<domain::NodeRunRecord> {
    PgOrchestrationRuntimeMapper::to_node_run_record(StoredNodeRunRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_id: row.get("node_id"),
        node_type: row.get("node_type"),
        node_alias: row.get("node_alias"),
        status: row.get("status"),
        input_payload: row.get("input_payload"),
        output_payload: row.get("output_payload"),
        error_payload: row.get("error_payload"),
        metrics_payload: row.get("metrics_payload"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
    })
}

fn map_checkpoint_record(row: PgRow) -> domain::CheckpointRecord {
    PgOrchestrationRuntimeMapper::to_checkpoint_record(StoredCheckpointRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        status: row.get("status"),
        reason: row.get("reason"),
        locator_payload: row.get("locator_payload"),
        variable_snapshot: row.get("variable_snapshot"),
        external_ref_payload: row.get("external_ref_payload"),
        created_at: row.get("created_at"),
    })
}

fn fetch_checkpoint_record(row: PgRow) -> domain::CheckpointRecord {
    PgOrchestrationRuntimeMapper::to_checkpoint_record(StoredCheckpointRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        status: row.get("status"),
        reason: row.get("reason"),
        locator_payload: row.get("locator_payload"),
        variable_snapshot: row.get("variable_snapshot"),
        external_ref_payload: row.get("external_ref_payload"),
        created_at: row.get("created_at"),
    })
}

fn map_callback_task_record(row: PgRow) -> Result<domain::CallbackTaskRecord> {
    PgOrchestrationRuntimeMapper::to_callback_task_record(StoredCallbackTaskRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        callback_kind: row.get("callback_kind"),
        status: row.get("status"),
        request_payload: row.get("request_payload"),
        response_payload: row.get("response_payload"),
        external_ref_payload: row.get("external_ref_payload"),
        created_at: row.get("created_at"),
        completed_at: row.get("completed_at"),
    })
}

fn map_run_event_record(row: PgRow) -> domain::RunEventRecord {
    PgOrchestrationRuntimeMapper::to_run_event_record(StoredRunEventRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        sequence: row.get("sequence"),
        event_type: row.get("event_type"),
        payload: row.get("payload"),
        created_at: row.get("created_at"),
    })
}

fn map_runtime_span_record(row: PgRow) -> Result<domain::RuntimeSpanRecord> {
    PgOrchestrationRuntimeMapper::to_runtime_span_record(StoredRuntimeSpanRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        parent_span_id: row.get("parent_span_id"),
        kind: row.get("kind"),
        name: row.get("name"),
        status: row.get("status"),
        capability_id: row.get("capability_id"),
        input_ref: row.get("input_ref"),
        output_ref: row.get("output_ref"),
        error_payload: row.get("error_payload"),
        metadata: row.get("metadata"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
    })
}

fn map_runtime_event_record(row: PgRow) -> Result<domain::RuntimeEventRecord> {
    PgOrchestrationRuntimeMapper::to_runtime_event_record(StoredRuntimeEventRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        span_id: row.get("span_id"),
        parent_span_id: row.get("parent_span_id"),
        sequence: row.get("sequence"),
        event_type: row.get("event_type"),
        layer: row.get("layer"),
        source: row.get("source"),
        trust_level: row.get("trust_level"),
        item_id: row.get("item_id"),
        ledger_ref: row.get("ledger_ref"),
        payload: row.get("payload"),
        visibility: row.get("visibility"),
        durability: row.get("durability"),
        created_at: row.get("created_at"),
    })
}

fn map_runtime_item_record(row: PgRow) -> Result<domain::RuntimeItemRecord> {
    PgOrchestrationRuntimeMapper::to_runtime_item_record(StoredRuntimeItemRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        span_id: row.get("span_id"),
        kind: row.get("kind"),
        status: row.get("status"),
        source_event_id: row.get("source_event_id"),
        input_ref: row.get("input_ref"),
        output_ref: row.get("output_ref"),
        usage_ledger_id: row.get("usage_ledger_id"),
        trust_level: row.get("trust_level"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn map_context_projection_record(row: PgRow) -> domain::ContextProjectionRecord {
    PgOrchestrationRuntimeMapper::to_context_projection_record(StoredContextProjectionRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        llm_turn_span_id: row.get("llm_turn_span_id"),
        projection_kind: row.get("projection_kind"),
        merge_stage_ref: row.get("merge_stage_ref"),
        source_transcript_ref: row.get("source_transcript_ref"),
        source_item_refs: row.get("source_item_refs"),
        compaction_event_id: row.get("compaction_event_id"),
        summary_version: row.get("summary_version"),
        model_input_ref: row.get("model_input_ref"),
        model_input_hash: row.get("model_input_hash"),
        compacted_summary_ref: row.get("compacted_summary_ref"),
        previous_projection_id: row.get("previous_projection_id"),
        token_estimate: row.get("token_estimate"),
        provider_continuation_metadata: row.get("provider_continuation_metadata"),
        created_at: row.get("created_at"),
    })
}

fn map_usage_ledger_record(row: PgRow) -> Result<domain::UsageLedgerRecord> {
    PgOrchestrationRuntimeMapper::to_usage_ledger_record(StoredUsageLedgerRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        node_run_id: row.get("node_run_id"),
        span_id: row.get("span_id"),
        failover_attempt_id: row.get("failover_attempt_id"),
        provider_instance_id: row.get("provider_instance_id"),
        gateway_route_id: row.get("gateway_route_id"),
        model_id: row.get("model_id"),
        upstream_model_id: row.get("upstream_model_id"),
        upstream_request_id: row.get("upstream_request_id"),
        input_tokens: row.get("input_tokens"),
        cached_input_tokens: row.get("cached_input_tokens"),
        output_tokens: row.get("output_tokens"),
        reasoning_output_tokens: row.get("reasoning_output_tokens"),
        total_tokens: row.get("total_tokens"),
        cache_read_tokens: row.get("cache_read_tokens"),
        cache_write_tokens: row.get("cache_write_tokens"),
        price_snapshot: row.get("price_snapshot"),
        cost_snapshot: row.get("cost_snapshot"),
        usage_status: row.get("usage_status"),
        raw_usage: row.get("raw_usage"),
        normalized_usage: row.get("normalized_usage"),
        created_at: row.get("created_at"),
    })
}

fn map_capability_invocation_record(row: PgRow) -> domain::CapabilityInvocationRecord {
    PgOrchestrationRuntimeMapper::to_capability_invocation_record(StoredCapabilityInvocationRow {
        id: row.get("id"),
        flow_run_id: row.get("flow_run_id"),
        span_id: row.get("span_id"),
        capability_id: row.get("capability_id"),
        requested_by_span_id: row.get("requested_by_span_id"),
        requester_kind: row.get("requester_kind"),
        arguments_ref: row.get("arguments_ref"),
        authorization_status: row.get("authorization_status"),
        authorization_reason: row.get("authorization_reason"),
        result_ref: row.get("result_ref"),
        normalized_result: row.get("normalized_result"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
        error_payload: row.get("error_payload"),
        created_at: row.get("created_at"),
    })
}

fn map_application_run_summary(row: PgRow) -> Result<domain::ApplicationRunSummary> {
    PgOrchestrationRuntimeMapper::to_application_run_summary(StoredApplicationRunSummaryRow {
        id: row.get("id"),
        run_mode: row.get("run_mode"),
        status: row.get("status"),
        target_node_id: row.get("target_node_id"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
    })
}
