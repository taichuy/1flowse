from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

WorkspaceMemberRole = str
ConsoleAccessLevel = Literal["guest", "authenticated", "manager"]


class ConsoleAuthCookieContract(BaseModel):
    access_token_cookie_name: str
    refresh_token_cookie_name: str
    csrf_token_cookie_name: str
    csrf_header_name: str
    same_site: Literal["lax", "strict", "none"]
    secure: bool
    use_host_prefix: bool
    access_token_http_only: bool = True
    refresh_token_http_only: bool = True
    csrf_token_http_only: bool = False


class ConsoleRoutePermissionItem(BaseModel):
    route: str
    access_level: ConsoleAccessLevel
    methods: list[str]
    csrf_protected_methods: list[str] = Field(default_factory=list)
    description: str


class WorkspaceItem(BaseModel):
    id: str
    name: str
    slug: str


class UserAccountItem(BaseModel):
    id: str
    email: str
    display_name: str
    status: str
    last_login_at: datetime | None = None


class WorkspaceMemberItem(BaseModel):
    id: str
    role: WorkspaceMemberRole
    user: UserAccountItem
    invited_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class AuthSessionResponse(BaseModel):
    token_type: str = "bearer"
    token: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    csrf_token: str | None = None
    workspace: WorkspaceItem
    current_user: UserAccountItem
    current_member: WorkspaceMemberItem
    available_roles: list[WorkspaceMemberRole]
    expires_at: datetime
    access_expires_at: datetime | None = None
    cookie_contract: ConsoleAuthCookieContract
    route_permissions: list[ConsoleRoutePermissionItem]


class WorkspaceContextResponse(BaseModel):
    workspace: WorkspaceItem
    current_user: UserAccountItem
    current_member: WorkspaceMemberItem
    available_roles: list[WorkspaceMemberRole]
    can_manage_members: bool
    cookie_contract: ConsoleAuthCookieContract
    route_permissions: list[ConsoleRoutePermissionItem]


class AuthRefreshRequest(BaseModel):
    refresh_token: str | None = None


class WorkspaceMemberCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=6, max_length=128)
    role: WorkspaceMemberRole = Field(default="viewer")


class WorkspaceMemberRoleUpdateRequest(BaseModel):
    role: WorkspaceMemberRole


class WorkspaceLogoutResponse(BaseModel):
    ok: bool = True
