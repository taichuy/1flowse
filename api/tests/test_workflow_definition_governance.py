from app.schemas.plugin import PluginToolItem
from app.schemas.workflow import WorkflowLegacyAuthGovernanceSummary
from app.services.workflow_definition_governance import (
    collect_workflow_definition_tool_ids,
    count_workflow_nodes,
    resolve_primary_workflow_definition_issue,
    summarize_workflow_definition_tool_governance,
)


def test_count_workflow_nodes_returns_zero_for_invalid_definitions() -> None:
    assert count_workflow_nodes(None) == 0
    assert count_workflow_nodes({"nodes": {}}) == 0


def test_collect_workflow_definition_tool_ids_includes_tool_nodes_and_tool_policy() -> None:
    definition = {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {
                "id": "tool",
                "type": "tool",
                "name": "Tool",
                "config": {
                    "tool": {
                        "toolId": "native.research",
                        "ecosystem": "native",
                    }
                },
            },
            {
                "id": "agent",
                "type": "llm_agent",
                "name": "Agent",
                "config": {
                    "toolPolicy": {
                        "allowedToolIds": [
                            "native.research",
                            "native.approval",
                            "native.research",
                            " ",
                        ]
                    }
                },
            },
        ]
    }

    assert collect_workflow_definition_tool_ids(definition) == [
        "native.research",
        "native.approval",
    ]


def test_summarize_workflow_definition_tool_governance_counts_governed_strong_and_missing() -> None:
    definition = {
        "nodes": [
            {
                "id": "tool",
                "type": "tool",
                "name": "Tool",
                "config": {
                    "tool": {
                        "toolId": "native.research",
                        "ecosystem": "native",
                    }
                },
            },
            {
                "id": "agent",
                "type": "llm_agent",
                "name": "Agent",
                "config": {
                    "toolPolicy": {
                        "allowedToolIds": ["native.approval", "native.missing"]
                    }
                },
            },
        ]
    }
    tool_index = {
        "native.research": PluginToolItem(
            id="native.research",
            name="Research",
            ecosystem="native",
            description="Research tool.",
            source="native",
            callable=True,
            supported_execution_classes=["inline", "sandbox"],
            default_execution_class="sandbox",
            sensitivity_level="L2",
        ),
        "native.approval": PluginToolItem(
            id="native.approval",
            name="Approval",
            ecosystem="native",
            description="Approval tool.",
            source="native",
            callable=True,
            supported_execution_classes=["inline", "microvm"],
            default_execution_class="microvm",
            sensitivity_level="L3",
        ),
    }

    summary = summarize_workflow_definition_tool_governance(
        definition,
        tool_index=tool_index,
    )

    assert summary.referenced_tool_ids == [
        "native.research",
        "native.approval",
        "native.missing",
    ]
    assert summary.missing_tool_ids == ["native.missing"]
    assert summary.governed_tool_count == 2
    assert summary.strong_isolation_tool_count == 2


def test_resolve_primary_workflow_definition_issue_prioritizes_legacy_publish_auth() -> None:
    issue = resolve_primary_workflow_definition_issue(
        tool_governance={
            "referenced_tool_ids": ["native.catalog-gap"],
            "missing_tool_ids": ["native.catalog-gap"],
            "governed_tool_count": 0,
            "strong_isolation_tool_count": 0,
        },
        legacy_auth_governance=WorkflowLegacyAuthGovernanceSummary(
            binding_count=1,
            draft_candidate_count=0,
            published_blocker_count=1,
            offline_inventory_count=0,
        ),
    )

    assert issue == "legacy_publish_auth"


def test_resolve_primary_definition_issue_returns_missing_tool_without_legacy_auth() -> None:
    issue = resolve_primary_workflow_definition_issue(
        tool_governance={
            "referenced_tool_ids": ["native.catalog-gap"],
            "missing_tool_ids": ["native.catalog-gap"],
            "governed_tool_count": 0,
            "strong_isolation_tool_count": 0,
        },
        legacy_auth_governance={
            "binding_count": 0,
            "draft_candidate_count": 0,
            "published_blocker_count": 0,
            "offline_inventory_count": 0,
        },
    )

    assert issue == "missing_tool"
