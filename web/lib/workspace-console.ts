import {
  canManageWorkspaceMembers,
  type ConsoleAccessLevel,
  type WorkspaceContextResponse,
  type WorkspaceMemberRole
} from "@/lib/workspace-access";

export const WORKSPACE_TEAM_SETTINGS_HREF = "/workspace/settings/team";
export const WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF = "/workspace/settings/providers";
export const LEGACY_WORKSPACE_TEAM_SETTINGS_HREF = "/admin/members";

export type WorkspaceConsoleNavKey = "workspace" | "workflows" | "runs" | "starters" | "team";
export type WorkspaceConsolePageKey = "login" | WorkspaceConsoleNavKey;
export type WorkspaceShellNavigationMode = "all" | "core" | "studio";

export type WorkspaceConsolePagePermission = {
  key: WorkspaceConsolePageKey;
  href: string;
  label: string;
  accessLevel: ConsoleAccessLevel;
  description: string;
};

const workspaceConsolePagePermissions: WorkspaceConsolePagePermission[] = [
  {
    key: "login",
    href: "/login",
    label: "登录",
    accessLevel: "guest",
    description: "访客通过本地管理员登录进入 workspace console。"
  },
  {
    key: "workspace",
    href: "/workspace",
    label: "工作台",
    accessLevel: "authenticated",
    description: "应用目录、快速新建与团队 workspace 扫描入口。"
  },
  {
    key: "workflows",
    href: "/workflows",
    label: "编排",
    accessLevel: "authenticated",
    description: "workflow library、create 与 studio surface 的作者入口。"
  },
  {
    key: "starters",
    href: "/workspace-starters",
    label: "模板",
    accessLevel: "authenticated",
    description: "团队 starter 模板与治理基线入口。"
  },
  {
    key: "runs",
    href: "/runs",
    label: "运行",
    accessLevel: "authenticated",
    description: "运行追踪、日志排查与 operator follow-up 入口。"
  },
  {
    key: "team",
    href: WORKSPACE_TEAM_SETTINGS_HREF,
    label: "团队",
    accessLevel: "manager",
    description: "workspace settings 下的成员与权限入口；后续 provider settings 继续在此扩展。"
  }
];

const workspaceShellNavigationByMode = {
  all: ["workspace", "workflows", "starters", "runs", "team"],
  core: ["workspace", "workflows", "team"],
  studio: ["workspace", "workflows", "runs", "team"]
} satisfies Record<WorkspaceShellNavigationMode, WorkspaceConsoleNavKey[]>;

export function getConsoleAccessLevelForRole(
  userRole: WorkspaceMemberRole | null | undefined
): ConsoleAccessLevel {
  if (!userRole) {
    return "guest";
  }

  return canManageWorkspaceMembers(userRole) ? "manager" : "authenticated";
}

function hasRequiredAccessLevel(
  currentLevel: ConsoleAccessLevel,
  requiredLevel: ConsoleAccessLevel
) {
  const rankByLevel = {
    guest: 0,
    authenticated: 1,
    manager: 2
  } satisfies Record<ConsoleAccessLevel, number>;

  return rankByLevel[currentLevel] >= rankByLevel[requiredLevel];
}

export function getWorkspaceConsolePagePermission(page: WorkspaceConsolePageKey) {
  return workspaceConsolePagePermissions.find((item) => item.key === page) ?? null;
}

export function getWorkspaceConsolePageHref(page: WorkspaceConsolePageKey) {
  return getWorkspaceConsolePagePermission(page)?.href ?? "/workspace";
}

export function getWorkspaceConsoleNavigationItems() {
  return workspaceConsolePagePermissions.filter(
    (item) => item.key !== "login"
  ) as Array<WorkspaceConsolePagePermission & { key: WorkspaceConsoleNavKey }>;
}

export function canAccessConsolePage(
  page: WorkspaceConsolePageKey,
  workspaceContext:
    | { current_member: Pick<WorkspaceContextResponse["current_member"], "role"> }
    | null
) {
  const requiredAccessLevel =
    getWorkspaceConsolePagePermission(page)?.accessLevel ?? "authenticated";
  const currentAccessLevel = getConsoleAccessLevelForRole(
    workspaceContext?.current_member.role
  );

  return hasRequiredAccessLevel(currentAccessLevel, requiredAccessLevel);
}

export function canViewConsoleNavItem(item: WorkspaceConsoleNavKey, userRole: WorkspaceMemberRole) {
  const requiredAccessLevel =
    getWorkspaceConsolePagePermission(item)?.accessLevel ?? "authenticated";
  return hasRequiredAccessLevel(
    getConsoleAccessLevelForRole(userRole),
    requiredAccessLevel
  );
}

export function getWorkspaceShellNavigationKeys(mode: WorkspaceShellNavigationMode) {
  return workspaceShellNavigationByMode[mode];
}

export function getDefaultWorkspaceNavigationMode(layout: "default" | "focused" | "editor") {
  if (layout === "editor") {
    return "studio" satisfies WorkspaceShellNavigationMode;
  }

  if (layout === "focused") {
    return "core" satisfies WorkspaceShellNavigationMode;
  }

  return "all" satisfies WorkspaceShellNavigationMode;
}
