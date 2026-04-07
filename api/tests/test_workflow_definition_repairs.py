from app.services.workflow_definition_repairs import (
    repair_compiled_blueprint_payload,
    repair_workflow_definition_payload,
)


def test_repair_workflow_definition_payload_updates_legacy_start_end_nodes() -> None:
    payload = {
        "nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "name": "Trigger",
                "config": {
                    "contextAccess": {
                        "readableNodeIds": ["trigger", "output"],
                        "readableArtifacts": [{"nodeId": "output", "artifactType": "json"}],
                    }
                },
            },
            {
                "id": "reference",
                "type": "referenceNode",
                "name": "Reference",
                "config": {
                    "reference": {"sourceNodeId": "output", "artifactType": "json"},
                    "query": {
                        "type": "authorized_context",
                        "sourceNodeIds": ["trigger", "output"],
                    },
                },
                "runtimePolicy": {
                    "join": {
                        "mode": "all",
                        "requiredNodeIds": ["trigger", "output"],
                    }
                },
            },
            {
                "id": "output",
                "type": "output",
                "name": "Output",
                "config": {},
            },
        ],
        "edges": [
            {
                "id": "edge_trigger_output",
                "sourceNodeId": "trigger",
                "targetNodeId": "output",
            }
        ],
    }

    result = repair_workflow_definition_payload(payload)

    assert result.changed is True
    assert result.payload == {
        "nodes": [
            {
                "id": "startNode",
                "type": "startNode",
                "name": "startNode",
                "config": {
                    "contextAccess": {
                        "readableNodeIds": ["startNode", "endNode"],
                        "readableArtifacts": [
                            {"nodeId": "endNode", "artifactType": "json"}
                        ],
                    }
                },
            },
            {
                "id": "reference",
                "type": "referenceNode",
                "name": "Reference",
                "config": {
                    "reference": {"sourceNodeId": "endNode", "artifactType": "json"},
                    "query": {
                        "type": "authorized_context",
                        "sourceNodeIds": ["startNode", "endNode"],
                    },
                },
                "runtimePolicy": {
                    "join": {
                        "mode": "all",
                        "requiredNodeIds": ["startNode", "endNode"],
                    }
                },
            },
            {
                "id": "endNode",
                "type": "endNode",
                "name": "endNode",
                "config": {},
            },
        ],
        "edges": [
            {
                "id": "edge_startNode_endNode",
                "sourceNodeId": "startNode",
                "targetNodeId": "endNode",
            }
        ],
    }


def test_repair_compiled_blueprint_payload_updates_legacy_start_end_nodes() -> None:
    payload = {
        "workflow_id": "wf-legacy",
        "workflow_version": "0.1.0",
        "trigger_node_id": "trigger",
        "output_node_ids": ["output"],
        "ordered_nodes": [
            {
                "id": "trigger",
                "type": "trigger",
                "name": "Trigger",
                "config": {},
                "runtime_policy": {},
                "input_schema": None,
                "output_schema": None,
            },
            {
                "id": "output",
                "type": "output",
                "name": "Output",
                "config": {},
                "runtime_policy": {},
                "input_schema": None,
                "output_schema": None,
            },
        ],
        "incoming_nodes": {"output": ["trigger"]},
        "outgoing_edges": {
            "trigger": [
                {
                    "id": "edge_trigger_output",
                    "source_node_id": "trigger",
                    "target_node_id": "output",
                    "channel": "control",
                    "condition": None,
                    "condition_expression": None,
                    "mapping": [],
                }
            ]
        },
    }

    result = repair_compiled_blueprint_payload(payload)

    assert result.changed is True
    assert result.payload == {
        "workflow_id": "wf-legacy",
        "workflow_version": "0.1.0",
        "trigger_node_id": "startNode",
        "output_node_ids": ["endNode"],
        "ordered_nodes": [
            {
                "id": "startNode",
                "type": "startNode",
                "name": "startNode",
                "config": {},
                "runtime_policy": {},
                "input_schema": None,
                "output_schema": None,
            },
            {
                "id": "endNode",
                "type": "endNode",
                "name": "endNode",
                "config": {},
                "runtime_policy": {},
                "input_schema": None,
                "output_schema": None,
            },
        ],
        "incoming_nodes": {"endNode": ["startNode"]},
        "outgoing_edges": {
            "startNode": [
                {
                    "id": "edge_startNode_endNode",
                    "source_node_id": "startNode",
                    "target_node_id": "endNode",
                    "channel": "control",
                    "condition": None,
                    "condition_expression": None,
                    "mapping": [],
                }
            ]
        },
    }
