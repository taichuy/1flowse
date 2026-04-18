import { useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';
import { Alert, Result, Typography } from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import { SectionPageLayout } from '../../../shared/ui/section-page-layout/SectionPageLayout';
import { ApiDocsPanel } from '../components/ApiDocsPanel';
import { MemberManagementPanel } from '../components/MemberManagementPanel';
import { RolePermissionPanel } from '../components/RolePermissionPanel';
import { ModelProviderCatalogPanel } from '../components/model-providers/ModelProviderCatalogPanel';
import { ModelProviderInstanceDrawer } from '../components/model-providers/ModelProviderInstanceDrawer';
import { ModelProviderInstancesTable } from '../components/model-providers/ModelProviderInstancesTable';
import {
  getVisibleSettingsSections,
  type SettingsSectionKey
} from '../lib/settings-sections';
import {
  createSettingsModelProviderInstance,
  deleteSettingsModelProviderInstance,
  fetchSettingsModelProviderCatalog,
  fetchSettingsModelProviderInstances,
  refreshSettingsModelProviderModels,
  settingsModelProviderCatalogQueryKey,
  settingsModelProviderInstancesQueryKey,
  settingsModelProviderOptionsQueryKey,
  updateSettingsModelProviderInstance,
  validateSettingsModelProviderInstance
} from '../api/model-providers';
import '../components/model-providers/model-provider-panel.css';

function hasAnyPermission(permissions: string[], candidates: string[]) {
  return candidates.some((permission) => permissions.includes(permission));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function ModelProvidersSection({
  canManage
}: {
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [drawerState, setDrawerState] = useState<
    | { mode: 'create'; installationId: string | null }
    | { mode: 'edit'; instanceId: string }
    | null
  >(null);

  const catalogQuery = useQuery({
    queryKey: settingsModelProviderCatalogQueryKey,
    queryFn: fetchSettingsModelProviderCatalog
  });
  const instancesQuery = useQuery({
    queryKey: settingsModelProviderInstancesQueryKey,
    queryFn: fetchSettingsModelProviderInstances
  });

  const instances = instancesQuery.data ?? [];
  const catalogEntries = catalogQuery.data ?? [];
  const editingInstance =
    drawerState?.mode === 'edit'
      ? instances.find((instance) => instance.id === drawerState.instanceId) ?? null
      : null;
  const drawerCatalogEntry =
    drawerState?.mode === 'create'
      ? catalogEntries.find((entry) => entry.installation_id === drawerState.installationId) ??
        catalogEntries[0] ??
        null
      : editingInstance
        ? catalogEntries.find(
            (entry) => entry.installation_id === editingInstance.installation_id
          ) ?? null
        : null;

  async function invalidateModelProviderQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: settingsModelProviderInstancesQueryKey
      }),
      queryClient.invalidateQueries({
        queryKey: settingsModelProviderOptionsQueryKey
      })
    ]);
  }

  const createMutation = useMutation({
    mutationFn: async (input: { installationId: string; display_name: string; config: Record<string, unknown> }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return createSettingsModelProviderInstance(
        {
          installation_id: input.installationId,
          display_name: input.display_name,
          config: input.config
        },
        csrfToken
      );
    },
    onSuccess: async () => {
      setDrawerState(null);
      await invalidateModelProviderQueries();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { instanceId: string; display_name: string; config: Record<string, unknown> }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return updateSettingsModelProviderInstance(
        input.instanceId,
        {
          display_name: input.display_name,
          config: input.config
        },
        csrfToken
      );
    },
    onSuccess: async () => {
      setDrawerState(null);
      await invalidateModelProviderQueries();
    }
  });

  const validateMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return validateSettingsModelProviderInstance(instanceId, csrfToken);
    },
    onSuccess: invalidateModelProviderQueries
  });

  const refreshMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return refreshSettingsModelProviderModels(instanceId, csrfToken);
    },
    onSuccess: invalidateModelProviderQueries
  });

  const deleteMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }

      return deleteSettingsModelProviderInstance(instanceId, csrfToken);
    },
    onSuccess: invalidateModelProviderQueries
  });

  const errorMessage =
    getErrorMessage(catalogQuery.error) ??
    getErrorMessage(instancesQuery.error) ??
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(validateMutation.error) ??
    getErrorMessage(refreshMutation.error) ??
    getErrorMessage(deleteMutation.error);

  return (
    <div className="model-provider-panel">
      <div className="model-provider-panel__header">
        <Typography.Title level={4}>模型供应商</Typography.Title>
        <Typography.Paragraph type="secondary">
          管理当前 workspace 下可用的 provider instances。只有 ready 实例会进入 agentFlow
          的模型选项。
        </Typography.Paragraph>
        {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
      </div>

      <div className="model-provider-panel__layout">
        <ModelProviderCatalogPanel
          entries={catalogEntries}
          loading={catalogQuery.isLoading}
          canManage={canManage}
          onCreate={(entry) => {
            setDrawerState({
              mode: 'create',
              installationId: entry.installation_id
            });
          }}
        />

        <ModelProviderInstancesTable
          catalogEntries={catalogEntries}
          instances={instances}
          loading={instancesQuery.isLoading}
          canManage={canManage}
          onCreate={() => {
            setDrawerState({
              mode: 'create',
              installationId: catalogEntries[0]?.installation_id ?? null
            });
          }}
          onEdit={(instance) => {
            setDrawerState({
              mode: 'edit',
              instanceId: instance.id
            });
          }}
          onValidate={(instance) => {
            validateMutation.mutate(instance.id);
          }}
          onRefreshModels={(instance) => {
            refreshMutation.mutate(instance.id);
          }}
          onDelete={(instance) => {
            deleteMutation.mutate(instance.id);
          }}
        />
      </div>

      <ModelProviderInstanceDrawer
        open={drawerState !== null}
        mode={drawerState?.mode ?? 'create'}
        catalogEntry={drawerCatalogEntry}
        instance={editingInstance}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => setDrawerState(null)}
        onSubmit={async (values) => {
          if (drawerState?.mode === 'edit' && editingInstance) {
            await updateMutation.mutateAsync({
              instanceId: editingInstance.id,
              display_name: values.display_name,
              config: values.config
            });
            return;
          }

          if (!drawerCatalogEntry) {
            throw new Error('missing provider catalog entry');
          }

          await createMutation.mutateAsync({
            installationId: drawerCatalogEntry.installation_id,
            display_name: values.display_name,
            config: values.config
          });
        }}
      />
    </div>
  );
}

export function SettingsPage({
  requestedSectionKey
}: {
  requestedSectionKey?: SettingsSectionKey;
}) {
  const actor = useAuthStore((state) => state.actor);
  const me = useAuthStore((state) => state.me);
  const permissionSet = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);
  const permissions = me?.permissions ?? [];
  const isRoot = actor?.effective_display_role === 'root';
  const canManageMembers = isRoot || permissionSet.has('user.manage.all');
  const canManageRoles = isRoot || permissionSet.has('role_permission.manage.all');
  const canManageModelProviders =
    isRoot || hasAnyPermission(permissions, ['state_model.manage.all', 'state_model.manage.own']);
  const visibleSections = getVisibleSettingsSections({
    isRoot,
    permissions
  });
  const fallbackSection = visibleSections[0];
  const activeSection = visibleSections.find((section) => section.key === requestedSectionKey);

  if (!fallbackSection) {
    return (
      <SectionPageLayout
        pageTitle="设置"
        pageDescription="系统管理域包含文档、成员和权限相关配置。"
        navItems={[]}
        activeKey=""
        contentWidth="wide"
        emptyState={<Result status="info" title="当前账号暂无可访问内容" />}
      >
        {null}
      </SectionPageLayout>
    );
  }

  if (!requestedSectionKey || !activeSection) {
    return <Navigate to={fallbackSection.to} replace />;
  }

  return (
    <SectionPageLayout
      pageTitle="设置"
      pageDescription="系统管理域包含文档、成员和权限相关配置。"
      navItems={visibleSections}
      activeKey={activeSection.key}
      contentWidth="wide"
    >
      <>
        {activeSection?.key === 'members' ? (
          <MemberManagementPanel
            canManageMembers={canManageMembers}
            canManageRoleBindings={canManageRoles}
          />
        ) : activeSection?.key === 'model-providers' ? (
          <ModelProvidersSection canManage={canManageModelProviders} />
        ) : activeSection?.key === 'roles' ? (
          <RolePermissionPanel canManageRoles={canManageRoles} />
        ) : (
          <ApiDocsPanel />
        )}
      </>
    </SectionPageLayout>
  );
}
