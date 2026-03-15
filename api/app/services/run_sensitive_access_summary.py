from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sensitive_access import (
    SensitiveAccessRequestRecord,
    SensitiveResourceRecord,
)

__all__ = ["SENSITIVITY_RANK", "resolve_highest_run_sensitivity"]


SENSITIVITY_RANK = {
    "L0": 0,
    "L1": 1,
    "L2": 2,
    "L3": 3,
}


def resolve_highest_run_sensitivity(db: Session, *, run_id: str) -> str | None:
    statement = (
        select(SensitiveResourceRecord)
        .join(
            SensitiveAccessRequestRecord,
            SensitiveAccessRequestRecord.resource_id == SensitiveResourceRecord.id,
        )
        .where(SensitiveAccessRequestRecord.run_id == run_id)
        .order_by(SensitiveAccessRequestRecord.created_at.desc())
    )
    resources = db.scalars(statement).all()
    if not resources:
        return None

    highest_rank = -1
    highest_level: str | None = None
    for resource in resources:
        rank = SENSITIVITY_RANK.get(resource.sensitivity_level, 0)
        if rank > highest_rank:
            highest_rank = rank
            highest_level = resource.sensitivity_level
    return highest_level
