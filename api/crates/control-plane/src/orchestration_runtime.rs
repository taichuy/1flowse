use std::collections::{BTreeMap, BTreeSet};

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use plugin_framework::{
    provider_contract::{ProviderInvocationInput, ProviderStreamEvent},
    provider_package::ProviderPackage,
    ProviderConfigField,
};
use serde_json::{json, Value};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

use crate::{
    capability_plugin_runtime::{CapabilityPluginRuntimePort, ExecuteCapabilityNodeInput},
    errors::ControlPlaneError,
    flow::FlowService,
    plugin_lifecycle::reconcile_installation_snapshot,
    ports::{
        AppendRunEventInput, ApplicationRepository, CompleteCallbackTaskInput,
        CompleteFlowRunInput, CompleteNodeRunInput, CreateCallbackTaskInput, CreateCheckpointInput,
        CreateFlowRunInput, CreateNodeRunInput, FlowRepository, ModelProviderRepository,
        NodeContributionRepository, OrchestrationRuntimeRepository, PluginRepository,
        ProviderRuntimePort, UpdateFlowRunInput, UpdateNodeRunInput, UpsertCompiledPlanInput,
    },
    state_transition::{ensure_flow_run_transition, ensure_node_run_transition},
};

pub struct StartNodeDebugPreviewCommand {
    pub actor_user_id: Uuid,
    pub application_id: Uuid,
    pub node_id: String,
    pub input_payload: serde_json::Value,
}

pub struct StartFlowDebugRunCommand {
    pub actor_user_id: Uuid,
    pub application_id: Uuid,
    pub input_payload: serde_json::Value,
}

pub struct ResumeFlowRunCommand {
    pub actor_user_id: Uuid,
    pub application_id: Uuid,
    pub flow_run_id: Uuid,
    pub checkpoint_id: Uuid,
    pub input_payload: serde_json::Value,
}

pub struct CompleteCallbackTaskCommand {
    pub actor_user_id: Uuid,
    pub application_id: Uuid,
    pub callback_task_id: Uuid,
    pub response_payload: serde_json::Value,
}

struct WaitingNodeResumeUpdate {
    node_run_id: Uuid,
    from_status: domain::NodeRunStatus,
    output_payload: Value,
}

struct PersistFlowDebugOutcomeInput<'a> {
    application_id: Uuid,
    flow_run: &'a domain::FlowRunRecord,
    outcome: &'a orchestration_runtime::execution_state::FlowDebugExecutionOutcome,
    trigger_event_type: &'a str,
    trigger_event_payload: Value,
    base_started_at: OffsetDateTime,
    waiting_node_resume: Option<WaitingNodeResumeUpdate>,
}

#[derive(Clone)]
struct RuntimeProviderInvoker<R, H> {
    repository: R,
    runtime: H,
    workspace_id: Uuid,
    provider_secret_master_key: String,
}

#[derive(Debug, Clone)]
struct ProviderInstanceSelectionCandidate {
    instance: domain::ModelProviderInstanceRecord,
    available_models: BTreeSet<String>,
}

pub struct OrchestrationRuntimeService<R, H> {
    repository: R,
    runtime: H,
    provider_secret_master_key: String,
}

impl<R, H> OrchestrationRuntimeService<R, H>
where
    R: ApplicationRepository
        + FlowRepository
        + OrchestrationRuntimeRepository
        + ModelProviderRepository
        + NodeContributionRepository
        + PluginRepository
        + Clone,
    H: ProviderRuntimePort + CapabilityPluginRuntimePort + Clone,
{
    pub fn new(repository: R, runtime: H, provider_secret_master_key: impl Into<String>) -> Self {
        Self {
            repository,
            runtime,
            provider_secret_master_key: provider_secret_master_key.into(),
        }
    }

    fn runtime_invoker(&self, workspace_id: Uuid) -> RuntimeProviderInvoker<R, H> {
        RuntimeProviderInvoker {
            repository: self.repository.clone(),
            runtime: self.runtime.clone(),
            workspace_id,
            provider_secret_master_key: self.provider_secret_master_key.clone(),
        }
    }

    async fn build_compile_context(
        &self,
        workspace_id: Uuid,
    ) -> Result<orchestration_runtime::compiler::FlowCompileContext> {
        let instances = self.repository.list_instances(workspace_id).await?;
        let contributions = self
            .repository
            .list_node_contributions(workspace_id)
            .await?;
        let mut provider_families = BTreeMap::new();
        let mut node_contributions = BTreeMap::new();
        let mut provider_candidates =
            BTreeMap::<String, Vec<ProviderInstanceSelectionCandidate>>::new();

        for instance in instances {
            let available_models = self
                .repository
                .get_catalog_cache(instance.id)
                .await?
                .and_then(|cache| cache.models_json.as_array().cloned())
                .unwrap_or_default()
                .into_iter()
                .filter_map(|model| {
                    model
                        .get("model_id")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
                .collect::<BTreeSet<_>>();

            provider_candidates
                .entry(instance.provider_code.clone())
                .or_default()
                .push(ProviderInstanceSelectionCandidate {
                    instance,
                    available_models,
                });
        }

        for (provider_code, candidates) in provider_candidates {
            let Some(candidate) = select_effective_provider_candidate(&candidates) else {
                continue;
            };
            provider_families.insert(
                provider_code.clone(),
                orchestration_runtime::compiler::FlowCompileProviderFamily {
                    effective_instance_id: candidate.instance.id.to_string(),
                    provider_code,
                    protocol: candidate.instance.protocol.clone(),
                    is_ready: candidate.instance.status
                        == domain::ModelProviderInstanceStatus::Ready,
                    available_models: candidate.available_models.clone(),
                    allow_custom_models: allow_custom_models(&candidate.instance.config_json),
                },
            );
        }

        for entry in contributions {
            let key = node_contribution_lookup_key(
                &entry.plugin_id,
                &entry.plugin_version,
                &entry.contribution_code,
                &entry.node_shell,
                &entry.schema_version,
            );
            node_contributions.insert(
                key,
                orchestration_runtime::compiler::FlowCompileNodeContribution {
                    installation_id: entry.installation_id,
                    plugin_id: entry.plugin_id,
                    plugin_version: entry.plugin_version,
                    contribution_code: entry.contribution_code,
                    node_shell: entry.node_shell,
                    schema_version: entry.schema_version,
                    dependency_status: entry.dependency_status.as_str().to_string(),
                },
            );
        }

        Ok(orchestration_runtime::compiler::FlowCompileContext {
            provider_families,
            node_contributions,
        })
    }

    pub async fn start_node_debug_preview(
        &self,
        command: StartNodeDebugPreviewCommand,
    ) -> Result<domain::NodeDebugPreviewResult> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        let editor_state = FlowService::new(self.repository.clone())
            .get_or_create_editor_state(command.actor_user_id, command.application_id)
            .await?;
        let application = self
            .repository
            .get_application(actor.current_workspace_id, command.application_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("application"))?;
        let compile_context = self.build_compile_context(application.workspace_id).await?;

        let compiled_plan = orchestration_runtime::compiler::FlowCompiler::compile(
            editor_state.flow.id,
            &editor_state.draft.id.to_string(),
            &editor_state.draft.document,
            &compile_context,
        )?;
        ensure_compiled_plan_runnable(&compiled_plan)?;
        let invoker = self.runtime_invoker(application.workspace_id);
        let preview = orchestration_runtime::preview_executor::run_node_preview(
            &compiled_plan,
            &command.node_id,
            &command.input_payload,
            &invoker,
        )
        .await?;
        let started_at = OffsetDateTime::now_utc();
        let compiled_record = self
            .repository
            .upsert_compiled_plan(&build_compiled_plan_input(
                command.actor_user_id,
                &editor_state,
                &compiled_plan,
            )?)
            .await?;
        let flow_run = self
            .repository
            .create_flow_run(&build_flow_run_input(
                command.actor_user_id,
                command.application_id,
                &editor_state,
                &compiled_record,
                &command,
                started_at,
            ))
            .await?;
        let node_run = self
            .repository
            .create_node_run(&build_node_run_input(
                flow_run.id,
                &compiled_plan,
                &command.node_id,
                &preview,
                started_at,
            )?)
            .await?;
        let events =
            persist_preview_events(&self.repository, &flow_run, &node_run, &preview).await?;
        let finished_at = OffsetDateTime::now_utc();
        ensure_node_run_transition(
            node_run.status,
            if preview.is_failed() {
                domain::NodeRunStatus::Failed
            } else {
                domain::NodeRunStatus::Succeeded
            },
            "complete_node_debug_preview",
        )?;
        let node_run = self
            .repository
            .complete_node_run(&build_complete_node_run_input(
                &node_run,
                &preview,
                finished_at,
            ))
            .await?;
        ensure_flow_run_transition(
            flow_run.status,
            if preview.is_failed() {
                domain::FlowRunStatus::Failed
            } else {
                domain::FlowRunStatus::Succeeded
            },
            "complete_flow_debug_preview",
        )?;
        let flow_run = self
            .repository
            .complete_flow_run(&build_complete_flow_run_input(
                &flow_run,
                &preview,
                finished_at,
            ))
            .await?;

        Ok(domain::NodeDebugPreviewResult {
            flow_run,
            node_run,
            events,
            preview_payload: preview.as_payload(),
        })
    }

    pub async fn start_flow_debug_run(
        &self,
        command: StartFlowDebugRunCommand,
    ) -> Result<domain::ApplicationRunDetail> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        let editor_state = FlowService::new(self.repository.clone())
            .get_or_create_editor_state(command.actor_user_id, command.application_id)
            .await?;
        let application = self
            .repository
            .get_application(actor.current_workspace_id, command.application_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("application"))?;
        let compile_context = self.build_compile_context(application.workspace_id).await?;
        let compiled_plan = orchestration_runtime::compiler::FlowCompiler::compile(
            editor_state.flow.id,
            &editor_state.draft.id.to_string(),
            &editor_state.draft.document,
            &compile_context,
        )?;
        ensure_compiled_plan_runnable(&compiled_plan)?;
        let invoker = self.runtime_invoker(application.workspace_id);
        let outcome = orchestration_runtime::execution_engine::start_flow_debug_run(
            &compiled_plan,
            &command.input_payload,
            &invoker,
        )
        .await?;
        let compiled_record = self
            .repository
            .upsert_compiled_plan(&build_compiled_plan_input(
                command.actor_user_id,
                &editor_state,
                &compiled_plan,
            )?)
            .await?;
        let flow_run = self
            .repository
            .create_flow_run(&CreateFlowRunInput {
                actor_user_id: command.actor_user_id,
                application_id: command.application_id,
                flow_id: editor_state.flow.id,
                flow_draft_id: editor_state.draft.id,
                compiled_plan_id: compiled_record.id,
                run_mode: domain::FlowRunMode::DebugFlowRun,
                target_node_id: None,
                status: domain::FlowRunStatus::Running,
                input_payload: command.input_payload.clone(),
                started_at: OffsetDateTime::now_utc(),
            })
            .await?;

        self.persist_flow_debug_outcome(PersistFlowDebugOutcomeInput {
            application_id: command.application_id,
            flow_run: &flow_run,
            outcome: &outcome,
            trigger_event_type: "flow_run_started",
            trigger_event_payload: json!({
                "run_mode": domain::FlowRunMode::DebugFlowRun.as_str(),
                "input_payload": command.input_payload,
            }),
            base_started_at: OffsetDateTime::now_utc(),
            waiting_node_resume: None,
        })
        .await
    }

    pub async fn resume_flow_run(
        &self,
        command: ResumeFlowRunCommand,
    ) -> Result<domain::ApplicationRunDetail> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        let flow_run = self
            .repository
            .get_flow_run(command.application_id, command.flow_run_id)
            .await?
            .ok_or_else(|| anyhow!("flow run not found"))?;
        let checkpoint = self
            .repository
            .get_checkpoint(command.flow_run_id, command.checkpoint_id)
            .await?
            .ok_or_else(|| anyhow!("checkpoint not found"))?;
        let current_detail = self
            .repository
            .get_application_run_detail(command.application_id, command.flow_run_id)
            .await?
            .ok_or_else(|| anyhow!("flow run detail not found"))?;
        let application = self
            .repository
            .get_application(actor.current_workspace_id, command.application_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("application"))?;
        let compiled_record = self
            .repository
            .get_compiled_plan(flow_run.compiled_plan_id)
            .await?
            .ok_or_else(|| anyhow!("compiled plan not found"))?;
        let compiled_plan: orchestration_runtime::compiled_plan::CompiledPlan =
            serde_json::from_value(compiled_record.plan.clone())?;
        let snapshot = checkpoint_snapshot_from_record(&checkpoint)?;
        let waiting_node_id = checkpoint_node_id(&checkpoint)?;
        let resume_patch = command
            .input_payload
            .as_object()
            .and_then(|payload| payload.get(&waiting_node_id))
            .cloned()
            .ok_or_else(|| anyhow!("resume payload is missing node input for {waiting_node_id}"))?;
        let outcome = orchestration_runtime::execution_engine::resume_flow_debug_run(
            &compiled_plan,
            &snapshot,
            &command.input_payload,
            &self.runtime_invoker(application.workspace_id),
        )
        .await?;
        let waiting_node_resume = if let Some(node_run_id) = checkpoint.node_run_id {
            let waiting_node = current_detail
                .node_runs
                .iter()
                .find(|record| record.id == node_run_id)
                .ok_or_else(|| anyhow!("waiting node run not found for checkpoint"))?;
            Some(WaitingNodeResumeUpdate {
                node_run_id,
                from_status: waiting_node.status,
                output_payload: resume_patch,
            })
        } else {
            None
        };

        self.persist_flow_debug_outcome(PersistFlowDebugOutcomeInput {
            application_id: command.application_id,
            flow_run: &flow_run,
            outcome: &outcome,
            trigger_event_type: "flow_run_resumed",
            trigger_event_payload: json!({
                "checkpoint_id": checkpoint.id,
                "input_payload": command.input_payload,
            }),
            base_started_at: next_node_started_at(&current_detail),
            waiting_node_resume,
        })
        .await
    }

    pub async fn complete_callback_task(
        &self,
        command: CompleteCallbackTaskCommand,
    ) -> Result<domain::ApplicationRunDetail> {
        let actor = self
            .repository
            .load_actor_context_for_user(command.actor_user_id)
            .await?;
        let callback_task = self
            .repository
            .complete_callback_task(&CompleteCallbackTaskInput {
                callback_task_id: command.callback_task_id,
                response_payload: command.response_payload.clone(),
                completed_at: OffsetDateTime::now_utc(),
            })
            .await?;
        let detail = self
            .repository
            .get_application_run_detail(command.application_id, callback_task.flow_run_id)
            .await?
            .ok_or_else(|| anyhow!("flow run not found for callback task"))?;
        let application = self
            .repository
            .get_application(actor.current_workspace_id, command.application_id)
            .await?
            .ok_or(ControlPlaneError::NotFound("application"))?;
        let checkpoint = detail
            .checkpoints
            .iter()
            .rev()
            .find(|record| record.node_run_id == Some(callback_task.node_run_id))
            .cloned()
            .ok_or_else(|| anyhow!("checkpoint not found for callback task"))?;
        let flow_run = detail.flow_run.clone();
        let compiled_record = self
            .repository
            .get_compiled_plan(flow_run.compiled_plan_id)
            .await?
            .ok_or_else(|| anyhow!("compiled plan not found"))?;
        let compiled_plan: orchestration_runtime::compiled_plan::CompiledPlan =
            serde_json::from_value(compiled_record.plan.clone())?;
        let snapshot = checkpoint_snapshot_from_record(&checkpoint)?;
        let waiting_node_id = checkpoint_node_id(&checkpoint)?;
        let resume_payload = json!({
            waiting_node_id.clone(): command.response_payload.clone()
        });
        let outcome = orchestration_runtime::execution_engine::resume_flow_debug_run(
            &compiled_plan,
            &snapshot,
            &resume_payload,
            &self.runtime_invoker(application.workspace_id),
        )
        .await?;

        let waiting_node = detail
            .node_runs
            .iter()
            .find(|record| record.id == callback_task.node_run_id)
            .ok_or_else(|| anyhow!("waiting node run not found for callback task"))?;

        self.persist_flow_debug_outcome(PersistFlowDebugOutcomeInput {
            application_id: command.application_id,
            flow_run: &flow_run,
            outcome: &outcome,
            trigger_event_type: "flow_run_resumed",
            trigger_event_payload: json!({
                "callback_task_id": callback_task.id,
                "response_payload": command.response_payload,
            }),
            base_started_at: next_node_started_at(&detail),
            waiting_node_resume: Some(WaitingNodeResumeUpdate {
                node_run_id: callback_task.node_run_id,
                from_status: waiting_node.status,
                output_payload: callback_task.response_payload.clone().ok_or_else(|| {
                    anyhow!("completed callback task is missing response payload")
                })?,
            }),
        })
        .await
    }

    async fn persist_flow_debug_outcome(
        &self,
        input: PersistFlowDebugOutcomeInput<'_>,
    ) -> Result<domain::ApplicationRunDetail> {
        let PersistFlowDebugOutcomeInput {
            application_id,
            flow_run,
            outcome,
            trigger_event_type,
            trigger_event_payload,
            base_started_at,
            waiting_node_resume,
        } = input;
        self.repository
            .append_run_event(&AppendRunEventInput {
                flow_run_id: flow_run.id,
                node_run_id: waiting_node_resume.as_ref().map(|value| value.node_run_id),
                event_type: trigger_event_type.to_string(),
                payload: trigger_event_payload,
            })
            .await?;

        if let Some(waiting_node_resume) = waiting_node_resume {
            ensure_node_run_transition(
                waiting_node_resume.from_status,
                domain::NodeRunStatus::Succeeded,
                "resume_waiting_node",
            )?;
            self.repository
                .update_node_run(&UpdateNodeRunInput {
                    node_run_id: waiting_node_resume.node_run_id,
                    status: domain::NodeRunStatus::Succeeded,
                    output_payload: waiting_node_resume.output_payload,
                    error_payload: None,
                    metrics_payload: json!({ "resumed": true }),
                    finished_at: Some(OffsetDateTime::now_utc()),
                })
                .await?;
        }

        let waiting_node_run =
            persist_flow_debug_node_traces(&self.repository, flow_run.id, outcome, base_started_at)
                .await?;

        match &outcome.stop_reason {
            orchestration_runtime::execution_state::ExecutionStopReason::WaitingHuman(wait) => {
                let snapshot = outcome
                    .checkpoint_snapshot
                    .as_ref()
                    .ok_or_else(|| anyhow!("waiting_human outcome is missing checkpoint"))?;
                let waiting_node_run = waiting_node_run
                    .ok_or_else(|| anyhow!("waiting_human outcome is missing node run"))?;
                self.repository
                    .create_checkpoint(&CreateCheckpointInput {
                        flow_run_id: flow_run.id,
                        node_run_id: Some(waiting_node_run.id),
                        status: "waiting_human".to_string(),
                        reason: "等待人工输入".to_string(),
                        locator_payload: json!({
                            "node_id": wait.node_id,
                            "next_node_index": snapshot.next_node_index,
                        }),
                        variable_snapshot: Value::Object(snapshot.variable_pool.clone()),
                        external_ref_payload: Some(json!({ "prompt": wait.prompt })),
                    })
                    .await?;
                self.repository
                    .update_flow_run(&UpdateFlowRunInput {
                        flow_run_id: flow_run.id,
                        status: {
                            ensure_flow_run_transition(
                                flow_run.status,
                                domain::FlowRunStatus::WaitingHuman,
                                "persist_flow_waiting_human",
                            )?;
                            domain::FlowRunStatus::WaitingHuman
                        },
                        output_payload: json!({}),
                        error_payload: None,
                        finished_at: None,
                    })
                    .await?;
            }
            orchestration_runtime::execution_state::ExecutionStopReason::WaitingCallback(wait) => {
                let snapshot = outcome
                    .checkpoint_snapshot
                    .as_ref()
                    .ok_or_else(|| anyhow!("waiting_callback outcome is missing checkpoint"))?;
                let waiting_node_run = waiting_node_run
                    .ok_or_else(|| anyhow!("waiting_callback outcome is missing node run"))?;
                self.repository
                    .create_checkpoint(&CreateCheckpointInput {
                        flow_run_id: flow_run.id,
                        node_run_id: Some(waiting_node_run.id),
                        status: "waiting_callback".to_string(),
                        reason: "等待 callback 回填".to_string(),
                        locator_payload: json!({
                            "node_id": wait.node_id,
                            "next_node_index": snapshot.next_node_index,
                        }),
                        variable_snapshot: Value::Object(snapshot.variable_pool.clone()),
                        external_ref_payload: Some(wait.request_payload.clone()),
                    })
                    .await?;
                self.repository
                    .create_callback_task(&CreateCallbackTaskInput {
                        flow_run_id: flow_run.id,
                        node_run_id: waiting_node_run.id,
                        callback_kind: wait.callback_kind.clone(),
                        request_payload: wait.request_payload.clone(),
                        external_ref_payload: Some(wait.request_payload.clone()),
                    })
                    .await?;
                self.repository
                    .update_flow_run(&UpdateFlowRunInput {
                        flow_run_id: flow_run.id,
                        status: {
                            ensure_flow_run_transition(
                                flow_run.status,
                                domain::FlowRunStatus::WaitingCallback,
                                "persist_flow_waiting_callback",
                            )?;
                            domain::FlowRunStatus::WaitingCallback
                        },
                        output_payload: json!({}),
                        error_payload: None,
                        finished_at: None,
                    })
                    .await?;
            }
            orchestration_runtime::execution_state::ExecutionStopReason::Completed => {
                ensure_flow_run_transition(
                    flow_run.status,
                    domain::FlowRunStatus::Succeeded,
                    "persist_flow_completed",
                )?;
                self.repository
                    .update_flow_run(&UpdateFlowRunInput {
                        flow_run_id: flow_run.id,
                        status: domain::FlowRunStatus::Succeeded,
                        output_payload: final_flow_output_payload(outcome),
                        error_payload: None,
                        finished_at: Some(OffsetDateTime::now_utc()),
                    })
                    .await?;
                self.repository
                    .append_run_event(&AppendRunEventInput {
                        flow_run_id: flow_run.id,
                        node_run_id: None,
                        event_type: "flow_run_completed".to_string(),
                        payload: final_flow_output_payload(outcome),
                    })
                    .await?;
            }
            orchestration_runtime::execution_state::ExecutionStopReason::Failed(failure) => {
                ensure_flow_run_transition(
                    flow_run.status,
                    domain::FlowRunStatus::Failed,
                    "persist_flow_failed",
                )?;
                self.repository
                    .update_flow_run(&UpdateFlowRunInput {
                        flow_run_id: flow_run.id,
                        status: domain::FlowRunStatus::Failed,
                        output_payload: final_flow_output_payload(outcome),
                        error_payload: Some(failure.error_payload.clone()),
                        finished_at: Some(OffsetDateTime::now_utc()),
                    })
                    .await?;
                self.repository
                    .append_run_event(&AppendRunEventInput {
                        flow_run_id: flow_run.id,
                        node_run_id: None,
                        event_type: "flow_run_failed".to_string(),
                        payload: failure.error_payload.clone(),
                    })
                    .await?;
            }
        }

        self.repository
            .get_application_run_detail(application_id, flow_run.id)
            .await?
            .ok_or_else(|| anyhow!("persisted flow run detail not found"))
    }
}

#[async_trait]
impl<R, H> orchestration_runtime::execution_engine::ProviderInvoker for RuntimeProviderInvoker<R, H>
where
    R: ModelProviderRepository + PluginRepository + Clone + Send + Sync,
    H: ProviderRuntimePort + Clone + Send + Sync,
{
    async fn invoke_llm(
        &self,
        runtime: &orchestration_runtime::compiled_plan::CompiledLlmRuntime,
        mut input: ProviderInvocationInput,
    ) -> Result<orchestration_runtime::execution_engine::ProviderInvocationOutput> {
        let instance = self.resolve_llm_instance(runtime).await?;
        let installation =
            reconcile_installation_snapshot(&self.repository, instance.installation_id).await?;
        let assigned = self
            .repository
            .list_assignments(self.workspace_id)
            .await?
            .into_iter()
            .any(|assignment| assignment.installation_id == installation.id);
        if !assigned
            || matches!(
                installation.desired_state,
                domain::PluginDesiredState::Disabled
            )
        {
            return Err(ControlPlaneError::InvalidInput("provider_code").into());
        }
        if installation.availability_status != domain::PluginAvailabilityStatus::Available {
            return Err(ControlPlaneError::Conflict("plugin_installation_unavailable").into());
        }

        let package = load_provider_package(&installation.installed_path)?;
        input.provider_config = build_provider_runtime_config(
            &self.repository,
            &self.provider_secret_master_key,
            &package,
            &instance,
        )
        .await?;

        self.runtime
            .invoke_stream(&installation, input)
            .await
            .map(
                |output| orchestration_runtime::execution_engine::ProviderInvocationOutput {
                    events: output.events,
                    result: output.result,
                },
            )
    }
}

impl<R, H> RuntimeProviderInvoker<R, H>
where
    R: ModelProviderRepository + PluginRepository + Clone + Send + Sync,
    H: ProviderRuntimePort + Clone + Send + Sync,
{
    async fn resolve_llm_instance(
        &self,
        runtime: &orchestration_runtime::compiled_plan::CompiledLlmRuntime,
    ) -> Result<domain::ModelProviderInstanceRecord> {
        if let Ok(provider_instance_id) = Uuid::parse_str(&runtime.provider_instance_id) {
            if let Some(instance) = self
                .repository
                .get_instance(self.workspace_id, provider_instance_id)
                .await?
            {
                if instance.status == domain::ModelProviderInstanceStatus::Ready
                    && instance.provider_code == runtime.provider_code
                {
                    return Ok(instance);
                }
            }
        }

        let instances = self.repository.list_instances(self.workspace_id).await?;
        let matching_instances = instances
            .into_iter()
            .filter(|instance| instance.provider_code == runtime.provider_code)
            .collect::<Vec<_>>();
        let Some(instance) = select_effective_provider_instance(&matching_instances) else {
            return Err(ControlPlaneError::InvalidInput("provider_code").into());
        };
        if instance.status != domain::ModelProviderInstanceStatus::Ready {
            return Err(ControlPlaneError::InvalidInput("provider_code").into());
        }

        Ok(instance.clone())
    }
}

#[async_trait]
impl<R, H> orchestration_runtime::execution_engine::CapabilityInvoker
    for RuntimeProviderInvoker<R, H>
where
    R: PluginRepository + Clone + Send + Sync,
    H: ProviderRuntimePort + CapabilityPluginRuntimePort + Clone + Send + Sync,
{
    async fn invoke_capability_node(
        &self,
        runtime: &orchestration_runtime::compiled_plan::CompiledPluginRuntime,
        config_payload: Value,
        input_payload: Value,
    ) -> Result<orchestration_runtime::execution_engine::CapabilityInvocationOutput> {
        let installation =
            reconcile_installation_snapshot(&self.repository, runtime.installation_id).await?;
        let assigned = self
            .repository
            .list_assignments(self.workspace_id)
            .await?
            .into_iter()
            .any(|assignment| assignment.installation_id == installation.id);
        if !assigned
            || matches!(
                installation.desired_state,
                domain::PluginDesiredState::Disabled
            )
        {
            return Err(ControlPlaneError::InvalidInput("installation_id").into());
        }
        if installation.availability_status != domain::PluginAvailabilityStatus::Available {
            return Err(ControlPlaneError::Conflict("plugin_installation_unavailable").into());
        }

        let output = self
            .runtime
            .execute_node(ExecuteCapabilityNodeInput {
                installation,
                contribution_code: runtime.contribution_code.clone(),
                config_payload,
                input_payload,
            })
            .await?;

        Ok(
            orchestration_runtime::execution_engine::CapabilityInvocationOutput {
                output_payload: output.output_payload,
            },
        )
    }
}

fn build_compiled_plan_input(
    actor_user_id: Uuid,
    editor_state: &domain::FlowEditorState,
    compiled_plan: &orchestration_runtime::compiled_plan::CompiledPlan,
) -> Result<UpsertCompiledPlanInput> {
    Ok(UpsertCompiledPlanInput {
        actor_user_id,
        flow_id: editor_state.flow.id,
        flow_draft_id: editor_state.draft.id,
        schema_version: compiled_plan.schema_version.clone(),
        document_updated_at: editor_state.draft.updated_at,
        plan: serde_json::to_value(compiled_plan)?,
    })
}

fn build_flow_run_input(
    actor_user_id: Uuid,
    application_id: Uuid,
    editor_state: &domain::FlowEditorState,
    compiled_record: &domain::CompiledPlanRecord,
    command: &StartNodeDebugPreviewCommand,
    started_at: OffsetDateTime,
) -> CreateFlowRunInput {
    CreateFlowRunInput {
        actor_user_id,
        application_id,
        flow_id: editor_state.flow.id,
        flow_draft_id: editor_state.draft.id,
        compiled_plan_id: compiled_record.id,
        run_mode: domain::FlowRunMode::DebugNodePreview,
        target_node_id: Some(command.node_id.clone()),
        status: domain::FlowRunStatus::Running,
        input_payload: command.input_payload.clone(),
        started_at,
    }
}

fn build_node_run_input(
    flow_run_id: Uuid,
    compiled_plan: &orchestration_runtime::compiled_plan::CompiledPlan,
    target_node_id: &str,
    preview: &orchestration_runtime::preview_executor::NodePreviewOutcome,
    started_at: OffsetDateTime,
) -> Result<CreateNodeRunInput> {
    let node = compiled_plan
        .nodes
        .get(target_node_id)
        .ok_or_else(|| anyhow!("target node not found in compiled plan: {target_node_id}"))?;

    Ok(CreateNodeRunInput {
        flow_run_id,
        node_id: node.node_id.clone(),
        node_type: node.node_type.clone(),
        node_alias: node.alias.clone(),
        status: domain::NodeRunStatus::Running,
        input_payload: json!(preview.resolved_inputs),
        started_at,
    })
}

fn build_complete_node_run_input(
    node_run: &domain::NodeRunRecord,
    preview: &orchestration_runtime::preview_executor::NodePreviewOutcome,
    finished_at: OffsetDateTime,
) -> CompleteNodeRunInput {
    CompleteNodeRunInput {
        node_run_id: node_run.id,
        status: if preview.is_failed() {
            domain::NodeRunStatus::Failed
        } else {
            domain::NodeRunStatus::Succeeded
        },
        output_payload: preview.as_payload(),
        error_payload: preview.error_payload.clone(),
        metrics_payload: json!({
            "output_contract_count": preview.output_contract.len(),
            "provider_events": preview.provider_events.len(),
            "runtime": preview.metrics_payload,
        }),
        finished_at,
    }
}

fn build_complete_flow_run_input(
    flow_run: &domain::FlowRunRecord,
    preview: &orchestration_runtime::preview_executor::NodePreviewOutcome,
    finished_at: OffsetDateTime,
) -> CompleteFlowRunInput {
    CompleteFlowRunInput {
        flow_run_id: flow_run.id,
        status: if preview.is_failed() {
            domain::FlowRunStatus::Failed
        } else {
            domain::FlowRunStatus::Succeeded
        },
        output_payload: preview.as_payload(),
        error_payload: preview.error_payload.clone(),
        finished_at,
    }
}

fn ensure_compiled_plan_runnable(
    compiled_plan: &orchestration_runtime::compiled_plan::CompiledPlan,
) -> Result<()> {
    if let Some(issue) = compiled_plan.compile_issues.first() {
        let field = match issue.code {
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingProviderInstance
            | orchestration_runtime::compiled_plan::CompileIssueCode::ProviderInstanceNotFound
            | orchestration_runtime::compiled_plan::CompileIssueCode::ProviderInstanceNotReady => {
                "provider_code"
            }
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingModel
            | orchestration_runtime::compiled_plan::CompileIssueCode::ModelNotAvailable => "model",
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingPluginId => "plugin_id",
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingPluginVersion => {
                "plugin_version"
            }
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingContributionCode => {
                "contribution_code"
            }
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingNodeShell => {
                "node_shell"
            }
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingSchemaVersion => {
                "schema_version"
            }
            orchestration_runtime::compiled_plan::CompileIssueCode::MissingPluginContribution
            | orchestration_runtime::compiled_plan::CompileIssueCode::PluginContributionDependencyNotReady =>
                "contribution_code",
        };
        return Err(ControlPlaneError::InvalidInput(field).into());
    }

    Ok(())
}

fn node_contribution_lookup_key(
    plugin_id: &str,
    plugin_version: &str,
    contribution_code: &str,
    node_shell: &str,
    schema_version: &str,
) -> String {
    format!("{plugin_id}::{plugin_version}::{contribution_code}::{node_shell}::{schema_version}")
}

async fn append_provider_stream_events<R>(
    repository: &R,
    flow_run_id: Uuid,
    node_run_id: Option<Uuid>,
    events: &[ProviderStreamEvent],
) -> Result<Vec<domain::RunEventRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let mut records = Vec::with_capacity(events.len());
    for event in events {
        records.push(
            repository
                .append_run_event(&AppendRunEventInput {
                    flow_run_id,
                    node_run_id,
                    event_type: provider_stream_event_type(event).to_string(),
                    payload: serde_json::to_value(event)?,
                })
                .await?,
        );
    }
    Ok(records)
}

fn provider_stream_event_type(event: &ProviderStreamEvent) -> &'static str {
    match event {
        ProviderStreamEvent::TextDelta { .. } => "text_delta",
        ProviderStreamEvent::ReasoningDelta { .. } => "reasoning_delta",
        ProviderStreamEvent::ToolCallDelta { .. } => "tool_call_delta",
        ProviderStreamEvent::ToolCallCommit { .. } => "tool_call_commit",
        ProviderStreamEvent::McpCallDelta { .. } => "mcp_call_delta",
        ProviderStreamEvent::McpCallCommit { .. } => "mcp_call_commit",
        ProviderStreamEvent::UsageDelta { .. } => "usage_delta",
        ProviderStreamEvent::UsageSnapshot { .. } => "usage_snapshot",
        ProviderStreamEvent::Finish { .. } => "finish",
        ProviderStreamEvent::Error { .. } => "error",
    }
}

async fn persist_preview_events<R>(
    repository: &R,
    flow_run: &domain::FlowRunRecord,
    node_run: &domain::NodeRunRecord,
    preview: &orchestration_runtime::preview_executor::NodePreviewOutcome,
) -> Result<Vec<domain::RunEventRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let mut events = Vec::new();
    let started = repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: Some(node_run.id),
            event_type: "node_preview_started".to_string(),
            payload: json!({
                "target_node_id": preview.target_node_id,
                "input_payload": flow_run.input_payload,
            }),
        })
        .await?;
    events.push(started);
    events.extend(
        append_provider_stream_events(
            repository,
            flow_run.id,
            Some(node_run.id),
            &preview.provider_events,
        )
        .await?,
    );
    let completed = repository
        .append_run_event(&AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: Some(node_run.id),
            event_type: if preview.is_failed() {
                "node_preview_failed".to_string()
            } else {
                "node_preview_completed".to_string()
            },
            payload: preview.as_payload(),
        })
        .await?;
    events.push(completed);

    Ok(events)
}

async fn persist_flow_debug_node_traces<R>(
    repository: &R,
    flow_run_id: Uuid,
    outcome: &orchestration_runtime::execution_state::FlowDebugExecutionOutcome,
    base_started_at: OffsetDateTime,
) -> Result<Option<domain::NodeRunRecord>>
where
    R: OrchestrationRuntimeRepository,
{
    let waiting_node_id = match &outcome.stop_reason {
        orchestration_runtime::execution_state::ExecutionStopReason::WaitingHuman(wait) => {
            Some((wait.node_id.as_str(), domain::NodeRunStatus::WaitingHuman))
        }
        orchestration_runtime::execution_state::ExecutionStopReason::WaitingCallback(wait) => {
            Some((
                wait.node_id.as_str(),
                domain::NodeRunStatus::WaitingCallback,
            ))
        }
        orchestration_runtime::execution_state::ExecutionStopReason::Failed(failure) => {
            Some((failure.node_id.as_str(), domain::NodeRunStatus::Failed))
        }
        orchestration_runtime::execution_state::ExecutionStopReason::Completed => None,
    };
    let mut waiting_node_run = None;

    for (index, trace) in outcome.node_traces.iter().enumerate() {
        let started_at = base_started_at + Duration::seconds(index as i64);
        let node_run = repository
            .create_node_run(&CreateNodeRunInput {
                flow_run_id,
                node_id: trace.node_id.clone(),
                node_type: trace.node_type.clone(),
                node_alias: trace.node_alias.clone(),
                status: domain::NodeRunStatus::Running,
                input_payload: trace.input_payload.clone(),
                started_at,
            })
            .await?;
        let (status, finished_at) = match waiting_node_id {
            Some((waiting_id, waiting_status)) if waiting_id == trace.node_id => {
                if waiting_status == domain::NodeRunStatus::Failed {
                    (waiting_status, Some(started_at))
                } else {
                    (waiting_status, None)
                }
            }
            _ => (domain::NodeRunStatus::Succeeded, Some(started_at)),
        };
        ensure_node_run_transition(
            domain::NodeRunStatus::Running,
            status,
            "persist_flow_debug_node_trace",
        )?;
        let node_run = repository
            .update_node_run(&UpdateNodeRunInput {
                node_run_id: node_run.id,
                status,
                output_payload: trace.output_payload.clone(),
                error_payload: trace.error_payload.clone(),
                metrics_payload: trace.metrics_payload.clone(),
                finished_at,
            })
            .await?;
        append_provider_stream_events(
            repository,
            flow_run_id,
            Some(node_run.id),
            &trace.provider_events,
        )
        .await?;

        if finished_at.is_none() && status != domain::NodeRunStatus::Failed {
            waiting_node_run = Some(node_run);
        }
    }

    Ok(waiting_node_run)
}

async fn build_provider_runtime_config<R>(
    repository: &R,
    master_key: &str,
    package: &ProviderPackage,
    instance: &domain::ModelProviderInstanceRecord,
) -> Result<Value>
where
    R: ModelProviderRepository,
{
    let secret_json = repository
        .get_secret_json(instance.id, master_key)
        .await?
        .unwrap_or_else(empty_object);
    validate_required_fields(
        &package.provider.form_schema,
        &instance.config_json,
        &secret_json,
    )?;
    merge_json_object(&instance.config_json, &secret_json)
}

fn allow_custom_models(config_json: &Value) -> bool {
    config_json
        .get("validate_model")
        .and_then(Value::as_bool)
        .map(|value| !value)
        .unwrap_or(false)
}

fn select_effective_provider_candidate<'a>(
    candidates: &'a [ProviderInstanceSelectionCandidate],
) -> Option<&'a ProviderInstanceSelectionCandidate> {
    candidates.iter().max_by_key(|candidate| {
        (
            candidate.instance.status == domain::ModelProviderInstanceStatus::Ready,
            candidate.instance.last_validated_at,
            candidate.instance.updated_at,
            candidate.instance.id,
        )
    })
}

fn select_effective_provider_instance<'a>(
    instances: &'a [domain::ModelProviderInstanceRecord],
) -> Option<&'a domain::ModelProviderInstanceRecord> {
    instances.iter().max_by_key(|instance| {
        (
            instance.status == domain::ModelProviderInstanceStatus::Ready,
            instance.last_validated_at,
            instance.updated_at,
            instance.id,
        )
    })
}

fn validate_required_fields(
    form_schema: &[ProviderConfigField],
    public_config: &Value,
    secret_config: &Value,
) -> Result<()> {
    let public_object = public_config
        .as_object()
        .ok_or(ControlPlaneError::InvalidInput("config_json"))?;
    let secret_object = secret_config
        .as_object()
        .ok_or(ControlPlaneError::InvalidInput("config_json"))?;
    for field in form_schema {
        if !field.required {
            continue;
        }
        let value = if is_secret_field(&field.field_type) {
            secret_object.get(&field.key)
        } else {
            public_object.get(&field.key)
        };
        if value.is_none()
            || value == Some(&Value::Null)
            || value == Some(&Value::String(String::new()))
        {
            return Err(ControlPlaneError::InvalidInput("config_json").into());
        }
    }
    Ok(())
}

fn merge_json_object(base: &Value, patch: &Value) -> Result<Value> {
    let mut merged = base
        .as_object()
        .cloned()
        .ok_or(ControlPlaneError::InvalidInput("config_json"))?;
    let patch_object = patch
        .as_object()
        .ok_or(ControlPlaneError::InvalidInput("config_json"))?;
    for (key, value) in patch_object {
        merged.insert(key.clone(), value.clone());
    }
    Ok(Value::Object(merged))
}

fn empty_object() -> Value {
    Value::Object(serde_json::Map::new())
}

fn is_secret_field(field_type: &str) -> bool {
    field_type.trim().eq_ignore_ascii_case("secret")
}

fn load_provider_package(path: &str) -> Result<ProviderPackage> {
    ProviderPackage::load_from_dir(path)
        .map_err(|_| ControlPlaneError::InvalidInput("provider_package").into())
}

fn checkpoint_snapshot_from_record(
    checkpoint: &domain::CheckpointRecord,
) -> Result<orchestration_runtime::execution_state::CheckpointSnapshot> {
    Ok(orchestration_runtime::execution_state::CheckpointSnapshot {
        next_node_index: checkpoint
            .locator_payload
            .get("next_node_index")
            .and_then(Value::as_u64)
            .ok_or_else(|| anyhow!("checkpoint is missing next_node_index"))?
            as usize,
        variable_pool: checkpoint
            .variable_snapshot
            .as_object()
            .cloned()
            .ok_or_else(|| anyhow!("checkpoint variable_snapshot must be an object"))?,
    })
}

fn checkpoint_node_id(checkpoint: &domain::CheckpointRecord) -> Result<String> {
    checkpoint
        .locator_payload
        .get("node_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| anyhow!("checkpoint is missing node_id"))
}

fn final_flow_output_payload(
    outcome: &orchestration_runtime::execution_state::FlowDebugExecutionOutcome,
) -> Value {
    outcome
        .node_traces
        .last()
        .map(|trace| trace.output_payload.clone())
        .unwrap_or_else(|| json!({}))
}

fn next_node_started_at(detail: &domain::ApplicationRunDetail) -> OffsetDateTime {
    detail
        .node_runs
        .iter()
        .map(|record| record.started_at)
        .max()
        .map(|value| value + Duration::seconds(1))
        .unwrap_or_else(OffsetDateTime::now_utc)
}


#[cfg(test)]
#[path = "_tests/orchestration_runtime/support.rs"]
mod test_support;
