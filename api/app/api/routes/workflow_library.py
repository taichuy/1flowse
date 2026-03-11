from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.workflow_library import WorkflowLibrarySnapshot
from app.services.workflow_library import get_workflow_library_service

router = APIRouter(prefix="/workflow-library", tags=["workflow-library"])


@router.get("", response_model=WorkflowLibrarySnapshot)
def get_workflow_library_snapshot(
    workspace_id: str = Query(default="default", min_length=1, max_length=64),
    db: Session = Depends(get_db),
) -> WorkflowLibrarySnapshot:
    return get_workflow_library_service().build_snapshot(db, workspace_id=workspace_id)
