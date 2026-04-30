import { useEffect, useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Flex, message } from 'antd';

import { useAuthStore } from '../../../../state/auth-store';
import {
  createSettingsDataModel,
  createSettingsDataModelField,
  deleteSettingsDataModelField,
  fetchSettingsDataModelAdvisorFindings,
  fetchSettingsDataModelRecordPreview,
  fetchSettingsDataModelScopeGrants,
  fetchSettingsDataModels,
  fetchSettingsDataSourceInstances,
  settingsDataModelAdvisorFindingsQueryKey,
  settingsDataModelRecordPreviewQueryKey,
  settingsDataModelsQueryKey,
  settingsDataModelScopeGrantsQueryKey,
  settingsDataSourcesQueryKey,
  updateSettingsDataModel,
  updateSettingsDataModelApiExposure,
  updateSettingsDataModelField,
  updateSettingsDataModelScopeGrant,
  updateSettingsDataSourceDefaults,
  type CreateSettingsDataModelFieldInput,
  type CreateSettingsDataModelInput,
  type SettingsDataModel,
  type SettingsDataModelField,
  type SettingsDataModelScopeGrant,
  type SettingsDataSourceInstance,
  type UpdateSettingsDataModelApiExposureInput,
  type UpdateSettingsDataModelFieldInput,
  type UpdateSettingsDataModelInput,
  type UpdateSettingsDataModelScopeGrantInput
} from '../../api/data-models';
import { DataModelDetail } from '../../components/data-models/DataModelDetail';
import { DataModelTable } from '../../components/data-models/DataModelTable';
import { DataSourcePanel } from '../../components/data-models/DataSourcePanel';
import '../../components/data-models/data-model-panel.css';
import { SettingsSectionSurface } from '../../components/SettingsSectionSurface';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

const emptySources: SettingsDataSourceInstance[] = [];
const emptyModels: SettingsDataModel[] = [];

export function SettingsDataModelsSection({
  canManage
}: {
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: settingsDataSourcesQueryKey,
    queryFn: fetchSettingsDataSourceInstances
  });

  const sources = sourcesQuery.data ?? emptySources;
  const effectiveSourceId = selectedSourceId ?? sources[0]?.id ?? null;

  useEffect(() => {
    if (!selectedSourceId && sources[0]) {
      setSelectedSourceId(sources[0].id);
    }
  }, [selectedSourceId, sources]);

  const modelsQuery = useQuery({
    queryKey: settingsDataModelsQueryKey(effectiveSourceId ?? ''),
    queryFn: () => fetchSettingsDataModels(effectiveSourceId ?? ''),
    enabled: Boolean(effectiveSourceId)
  });

  const models = modelsQuery.data ?? emptyModels;
  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId]
  );
  const selectedSource = useMemo(
    () =>
      sources.find((source) => source.id === effectiveSourceId) ??
      sources[0] ??
      null,
    [effectiveSourceId, sources]
  );

  useEffect(() => {
    setSelectedModelId(null);
  }, [effectiveSourceId]);

  const scopeGrantsQuery = useQuery({
    queryKey: settingsDataModelScopeGrantsQueryKey(selectedModel?.id ?? ''),
    queryFn: () => fetchSettingsDataModelScopeGrants(selectedModel?.id ?? ''),
    enabled: Boolean(selectedModel)
  });

  const advisorQuery = useQuery({
    queryKey: settingsDataModelAdvisorFindingsQueryKey(selectedModel?.id ?? ''),
    queryFn: () => fetchSettingsDataModelAdvisorFindings(selectedModel?.id ?? ''),
    enabled: Boolean(selectedModel)
  });

  const recordPreviewQuery = useQuery({
    queryKey: settingsDataModelRecordPreviewQueryKey(selectedModel?.code ?? ''),
    queryFn: () => fetchSettingsDataModelRecordPreview(selectedModel?.code ?? ''),
    enabled: Boolean(selectedModel)
  });

  const updateDefaultsMutation = useMutation({
    mutationFn: ({
      source,
      patch
    }: {
      source: SettingsDataSourceInstance;
      patch: Pick<
        SettingsDataSourceInstance,
        'default_data_model_status' | 'default_api_exposure_status'
      >;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return updateSettingsDataSourceDefaults(source.id, patch, csrfToken);
    },
    onSuccess: async () => {
      message.success('默认状态已保存');
      await queryClient.invalidateQueries({ queryKey: settingsDataSourcesQueryKey });
    }
  });

  const updateModelMutation = useMutation({
    mutationFn: ({
      model,
      input
    }: {
      model: SettingsDataModel;
      input: UpdateSettingsDataModelInput;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return updateSettingsDataModel(model.id, input, csrfToken);
    },
    onSuccess: async () => {
      message.success('Data Model 已保存');
      if (effectiveSourceId) {
        await queryClient.invalidateQueries({
          queryKey: settingsDataModelsQueryKey(effectiveSourceId)
        });
      }
    }
  });

  const createModelMutation = useMutation({
    mutationFn: (input: CreateSettingsDataModelInput) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return createSettingsDataModel(input, csrfToken);
    },
    onSuccess: async (model) => {
      message.success('Data Model 已创建');
      setSelectedModelId(model.id);
      if (effectiveSourceId) {
        await queryClient.invalidateQueries({
          queryKey: settingsDataModelsQueryKey(effectiveSourceId)
        });
      }
    }
  });

  const updateApiExposureMutation = useMutation({
    mutationFn: ({
      model,
      input
    }: {
      model: SettingsDataModel;
      input: UpdateSettingsDataModelApiExposureInput;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return updateSettingsDataModelApiExposure(model.id, input, csrfToken);
    },
    onSuccess: async () => {
      message.success('API 暴露请求已保存');
      if (effectiveSourceId) {
        await queryClient.invalidateQueries({
          queryKey: settingsDataModelsQueryKey(effectiveSourceId)
        });
      }
    }
  });

  const createFieldMutation = useMutation({
    mutationFn: ({
      model,
      input
    }: {
      model: SettingsDataModel;
      input: CreateSettingsDataModelFieldInput;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return createSettingsDataModelField(model.id, input, csrfToken);
    },
    onSuccess: async () => {
      message.success('字段已创建');
      if (effectiveSourceId) {
        await queryClient.invalidateQueries({
          queryKey: settingsDataModelsQueryKey(effectiveSourceId)
        });
      }
    }
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({
      model,
      field,
      input
    }: {
      model: SettingsDataModel;
      field: SettingsDataModelField;
      input: UpdateSettingsDataModelFieldInput;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return updateSettingsDataModelField(model.id, field.id, input, csrfToken);
    },
    onSuccess: async () => {
      message.success('字段已保存');
      if (effectiveSourceId) {
        await queryClient.invalidateQueries({
          queryKey: settingsDataModelsQueryKey(effectiveSourceId)
        });
      }
    }
  });

  const deleteFieldMutation = useMutation({
    mutationFn: ({
      model,
      field
    }: {
      model: SettingsDataModel;
      field: SettingsDataModelField;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return deleteSettingsDataModelField(model.id, field.id, csrfToken);
    },
    onSuccess: async () => {
      message.success('字段已删除');
      if (effectiveSourceId) {
        await queryClient.invalidateQueries({
          queryKey: settingsDataModelsQueryKey(effectiveSourceId)
        });
      }
    }
  });

  const saveGrantMutation = useMutation({
    mutationFn: ({
      grant,
      input
    }: {
      grant: SettingsDataModelScopeGrant;
      input: UpdateSettingsDataModelScopeGrantInput;
    }) => {
      if (!csrfToken) {
        throw new Error('missing csrf token');
      }
      return updateSettingsDataModelScopeGrant(
        grant.data_model_id,
        grant.id,
        input,
        csrfToken
      );
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: settingsDataModelScopeGrantsQueryKey(
          variables.grant.data_model_id
        )
      });
    }
  });

  const errorMessage =
    getErrorMessage(sourcesQuery.error) ??
    getErrorMessage(modelsQuery.error) ??
    getErrorMessage(scopeGrantsQuery.error) ??
    getErrorMessage(advisorQuery.error) ??
    getErrorMessage(recordPreviewQuery.error) ??
    getErrorMessage(updateDefaultsMutation.error) ??
    getErrorMessage(updateModelMutation.error) ??
    getErrorMessage(createModelMutation.error) ??
    getErrorMessage(updateApiExposureMutation.error) ??
    getErrorMessage(createFieldMutation.error) ??
    getErrorMessage(updateFieldMutation.error) ??
    getErrorMessage(deleteFieldMutation.error) ??
    getErrorMessage(saveGrantMutation.error);

  return (
    <SettingsSectionSurface
      title="数据源"
      description="管理内建主数据源和外部数据源的默认建模状态、API 暴露策略与 Data Model 访问面。"
      status={
        errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null
      }
    >
      <div className="data-model-panel">
        <DataSourcePanel
          sources={sources}
          selectedSourceId={effectiveSourceId}
          loading={sourcesQuery.isLoading}
          saving={updateDefaultsMutation.isPending}
          onSelectSource={setSelectedSourceId}
          onUpdateDefaults={(source, patch) =>
            updateDefaultsMutation.mutate({ source, patch })
          }
        />

        <Flex vertical gap={16} className="data-model-panel__models">
          <DataModelTable
            models={models}
            selectedSource={selectedSource}
            selectedModelId={selectedModelId}
            loading={modelsQuery.isLoading}
            saving={createModelMutation.isPending || updateModelMutation.isPending}
            canManage={canManage}
            onSelectModel={(model) => setSelectedModelId(model.id)}
            onCreateModel={(input) => createModelMutation.mutate(input)}
            onUpdateModel={(model, input) =>
              updateModelMutation.mutate({ model, input })
            }
          />

          {selectedModel ? (
            <DataModelDetail
              model={selectedModel}
              allModels={models}
              canManage={canManage}
              grants={scopeGrantsQuery.data ?? []}
              grantsLoading={scopeGrantsQuery.isLoading}
              grantsSaving={saveGrantMutation.isPending}
              advisorFindings={advisorQuery.data ?? []}
              advisorLoading={advisorQuery.isLoading}
              recordPreview={recordPreviewQuery.data}
              recordPreviewLoading={recordPreviewQuery.isLoading}
              modelSaving={
                updateModelMutation.isPending ||
                updateApiExposureMutation.isPending
              }
              fieldSaving={
                createFieldMutation.isPending ||
                updateFieldMutation.isPending ||
                deleteFieldMutation.isPending
              }
              onUpdateModelStatus={(status) =>
                updateModelMutation.mutate({
                  model: selectedModel,
                  input: { status }
                })
              }
              onUpdateModel={(input) =>
                updateModelMutation.mutate({ model: selectedModel, input })
              }
              onCreateField={(input) =>
                createFieldMutation.mutate({ model: selectedModel, input })
              }
              onUpdateField={(field, input) =>
                updateFieldMutation.mutate({
                  model: selectedModel,
                  field,
                  input
                })
              }
              onDeleteField={(field) =>
                deleteFieldMutation.mutate({ model: selectedModel, field })
              }
              onUpdateApiExposure={(input) =>
                updateApiExposureMutation.mutate({
                  model: selectedModel,
                  input
                })
              }
              onSaveGrant={(grant, input) =>
                saveGrantMutation.mutate({ grant, input })
              }
            />
          ) : null}
        </Flex>
      </div>
    </SettingsSectionSurface>
  );
}
