from sqlalchemy.orm import Session

from app.models.skill import SkillRecord, SkillReferenceRecord
from app.services.skill_catalog import SkillCatalogError, SkillCatalogService


def test_build_prompt_docs_limits_budget_and_selected_reference_bodies(
    sqlite_session: Session,
) -> None:
    sqlite_session.add(
        SkillRecord(
            id="skill-research-brief",
            workspace_id="default",
            name="Research Brief",
            description="Produce a concise, auditable brief.",
            body="A" * 72,
        )
    )
    sqlite_session.add(
        SkillReferenceRecord(
            id="ref-handoff",
            skill_id="skill-research-brief",
            name="Operator Handoff",
            description="Close with next actions.",
            body="B" * 72,
        )
    )
    sqlite_session.add(
        SkillReferenceRecord(
            id="ref-budget",
            skill_id="skill-research-brief",
            name="Budget Control",
            description="Should remain summary only.",
            body="C" * 72,
        )
    )
    sqlite_session.commit()

    service = SkillCatalogService()
    docs = service.build_prompt_docs(
        sqlite_session,
        skill_ids=["skill-research-brief"],
        selected_reference_ids_by_skill={"skill-research-brief": ["ref-handoff"]},
        prompt_budget_chars=90,
    )

    assert len(docs) == 1
    doc = docs[0]
    references_by_id = {reference.id: reference for reference in doc.references}

    assert len(doc.body) + len(references_by_id["ref-handoff"].body or "") <= 90
    assert references_by_id["ref-handoff"].body is not None
    assert references_by_id["ref-budget"].body is None
    assert doc.body.endswith("…") or (references_by_id["ref-handoff"].body or "").endswith("…")


def test_build_prompt_docs_rejects_missing_selected_reference(
    sqlite_session: Session,
) -> None:
    sqlite_session.add(
        SkillRecord(
            id="skill-research-brief",
            workspace_id="default",
            name="Research Brief",
            description="Produce a concise, auditable brief.",
            body="Summarize findings.",
        )
    )
    sqlite_session.commit()

    service = SkillCatalogService()

    try:
        service.build_prompt_docs(
            sqlite_session,
            skill_ids=["skill-research-brief"],
            selected_reference_ids_by_skill={"skill-research-brief": ["ref-missing"]},
        )
    except SkillCatalogError as exc:
        assert "Missing skill references" in str(exc)
    else:
        raise AssertionError("Expected missing selected skill reference to fail fast.")
