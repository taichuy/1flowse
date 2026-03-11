from datetime import datetime

from pydantic import BaseModel


class WorkflowPublishedEndpointItem(BaseModel):
    id: str
    workflow_id: str
    workflow_version_id: str
    workflow_version: str
    target_workflow_version_id: str
    target_workflow_version: str
    compiled_blueprint_id: str
    endpoint_id: str
    endpoint_name: str
    protocol: str
    auth_mode: str
    streaming: bool
    input_schema: dict
    output_schema: dict | None = None
    created_at: datetime
    updated_at: datetime
