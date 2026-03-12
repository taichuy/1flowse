def publishable_definition(
    *,
    answer: str = "done",
    workflow_version: str | None = "0.1.0",
    alias: str | None = None,
    path: str | None = None,
    auth_mode: str = "internal",
    endpoint_id: str = "native-chat",
    endpoint_name: str = "Native Chat",
    protocol: str = "native",
    streaming: bool = False,
    rate_limit: dict | None = None,
    cache: dict | None = None,
) -> dict:
    endpoint: dict[str, object] = {
        "id": endpoint_id,
        "name": endpoint_name,
        "protocol": protocol,
        "authMode": auth_mode,
        "streaming": streaming,
        "inputSchema": {"type": "object"},
    }
    if alias is not None:
        endpoint["alias"] = alias
    if path is not None:
        endpoint["path"] = path
    if workflow_version is not None:
        endpoint["workflowVersion"] = workflow_version
    if rate_limit is not None:
        endpoint["rateLimit"] = rate_limit
    if cache is not None:
        endpoint["cache"] = cache

    return {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {
                "id": "tool",
                "type": "tool",
                "name": "Tool",
                "config": {"mock_output": {"answer": answer}},
            },
            {"id": "output", "type": "output", "name": "Output", "config": {}},
        ],
        "edges": [
            {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "tool"},
            {"id": "e2", "sourceNodeId": "tool", "targetNodeId": "output"},
        ],
        "publish": [endpoint],
    }


def waiting_agent_publishable_definition(
    *,
    alias: str,
    path: str,
    endpoint_id: str,
    endpoint_name: str,
    protocol: str = "openai",
) -> dict:
    return {
        "nodes": [
            {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
            {
                "id": "agent",
                "type": "llm_agent",
                "name": "Agent",
                "config": {
                    "assistant": {"enabled": False},
                    "toolPolicy": {"allowedToolIds": ["native.search"]},
                    "mockPlan": {
                        "toolCalls": [
                            {
                                "toolId": "native.search",
                                "inputs": {"query": "wait-for-callback"},
                            }
                        ]
                    },
                },
            },
            {"id": "output", "type": "output", "name": "Output", "config": {}},
        ],
        "edges": [
            {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
            {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
        ],
        "publish": [
            {
                "id": endpoint_id,
                "name": endpoint_name,
                "alias": alias,
                "path": path,
                "protocol": protocol,
                "authMode": "internal",
                "streaming": False,
                "inputSchema": {"type": "object"},
            }
        ],
    }
