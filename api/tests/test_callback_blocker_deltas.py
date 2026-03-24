from datetime import UTC, datetime

from app.schemas.sensitive_access import SensitiveResourceItem
from app.services.callback_blocker_deltas import (
    CallbackBlockerScopedSnapshot,
    CallbackBlockerSnapshot,
    build_bulk_callback_blocker_delta_summary,
    build_callback_blocker_delta_summary,
)


def _build_resource(resource_id: str, label: str) -> SensitiveResourceItem:
    created_at = datetime(2026, 3, 25, 6, 0, tzinfo=UTC)
    return SensitiveResourceItem(
        id=resource_id,
        label=label,
        description=f"{label} description",
        sensitivity_level="L3",
        source="credential",
        metadata={},
        credential_governance=None,
        created_at=created_at,
        updated_at=created_at,
    )


def test_callback_blocker_delta_summary_prefers_after_primary_resource() -> None:
    before = CallbackBlockerSnapshot(
        operator_status_kinds=("external_callback_pending",),
        operator_status_labels=("waiting external callback",),
        recommended_action_label="Wait for callback result",
        primary_resource=_build_resource("resource-before", "Legacy callback credential"),
    )
    after = CallbackBlockerSnapshot(
        operator_status_kinds=("approval_pending",),
        operator_status_labels=("approval pending",),
        recommended_action_label="Handle approval here first",
        primary_resource=_build_resource("resource-after", "OpenAI Prod Key"),
    )

    summary = build_callback_blocker_delta_summary(before=before, after=after)

    assert summary is not None
    assert summary.primary_resource is not None
    assert summary.primary_resource.id == "resource-after"
    assert summary.primary_resource.label == "OpenAI Prod Key"


def test_bulk_callback_blocker_delta_summary_prefers_still_blocked_primary_resource() -> None:
    cleared_before = CallbackBlockerScopedSnapshot(
        run_id="run-cleared",
        node_run_id="node-cleared",
        snapshot=CallbackBlockerSnapshot(
            operator_status_kinds=("external_callback_pending",),
            operator_status_labels=("waiting external callback",),
            recommended_action_label="Wait for callback result",
            primary_resource=_build_resource("resource-cleared", "Webhook callback"),
        ),
    )
    cleared_after = CallbackBlockerScopedSnapshot(
        run_id="run-cleared",
        node_run_id="node-cleared",
        snapshot=CallbackBlockerSnapshot(
            operator_status_kinds=(),
            operator_status_labels=(),
            recommended_action_label=None,
            primary_resource=None,
        ),
    )
    blocked_before = CallbackBlockerScopedSnapshot(
        run_id="run-blocked",
        node_run_id="node-blocked",
        snapshot=CallbackBlockerSnapshot(
            operator_status_kinds=("approval_pending",),
            operator_status_labels=("approval pending",),
            recommended_action_label="Handle approval here first",
            primary_resource=_build_resource("resource-before", "Legacy approval credential"),
        ),
    )
    blocked_after = CallbackBlockerScopedSnapshot(
        run_id="run-blocked",
        node_run_id="node-blocked",
        snapshot=CallbackBlockerSnapshot(
            operator_status_kinds=("approval_pending",),
            operator_status_labels=("approval pending",),
            recommended_action_label="Retry notification here first",
            primary_resource=_build_resource("resource-after", "Anthropic Prod Key"),
        ),
    )

    summary = build_bulk_callback_blocker_delta_summary(
        [cleared_before, blocked_before],
        [cleared_after, blocked_after],
    )

    assert summary is not None
    assert summary.still_blocked_scope_count == 1
    assert summary.primary_resource is not None
    assert summary.primary_resource.id == "resource-after"
    assert summary.primary_resource.label == "Anthropic Prod Key"
