from contextlib import contextmanager
from collections.abc import Iterator

from fastapi.testclient import TestClient
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.api.routes.auth import _serialize_access_context
from app.core.database import get_db
from app.main import app
from app.services.workspace_access import authenticate_workspace_user, issue_workspace_auth_tokens


@contextmanager
def _borrow_test_db_session() -> Iterator[Session]:
    override = app.dependency_overrides.get(get_db)
    if override is None:
        raise AssertionError("get_db override is required before issuing test auth tokens.")

    generator = override()
    try:
        yield next(generator)
    finally:
        generator.close()


def issue_workspace_console_auth(
    client: TestClient,
    *,
    email: str,
    password: str,
) -> dict[str, object]:
    with _borrow_test_db_session() as db:
        access_context = authenticate_workspace_user(db, email=email, password=password)
        tokens = issue_workspace_auth_tokens(access_context)
        response_body = jsonable_encoder(_serialize_access_context(access_context, tokens=tokens))
        db.commit()

    cookie_contract = response_body["cookie_contract"]
    assert isinstance(cookie_contract, dict)
    client.cookies.set(str(cookie_contract["access_token_cookie_name"]), str(response_body["access_token"]))
    client.cookies.set(str(cookie_contract["refresh_token_cookie_name"]), str(response_body["refresh_token"]))
    client.cookies.set(str(cookie_contract["csrf_token_cookie_name"]), str(response_body["csrf_token"]))
    return response_body
