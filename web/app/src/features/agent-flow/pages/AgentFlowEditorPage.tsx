import { useQuery } from '@tanstack/react-query';
import { Button, Result, Space, Typography } from 'antd';

import { ApiClientError } from '@1flowse/api-client';
import { PermissionDeniedState } from '../../../shared/ui/PermissionDeniedState';
import {
  fetchOrchestrationState,
  orchestrationQueryKey
} from '../api/orchestration';
import { AgentFlowEditorShell } from '../components/editor/AgentFlowEditorShell';

export function AgentFlowEditorPage({
  applicationId,
  applicationName,
  apiCapabilityStatus
}: {
  applicationId: string;
  applicationName: string;
  apiCapabilityStatus: string;
}) {
  const orchestrationQuery = useQuery({
    queryKey: orchestrationQueryKey(applicationId),
    queryFn: () => fetchOrchestrationState(applicationId)
  });

  if (orchestrationQuery.isPending) {
    return <Result status="info" title="正在加载编排" />;
  }

  if (orchestrationQuery.isError) {
    const error = orchestrationQuery.error;

    if (error instanceof ApiClientError && error.status === 403) {
      return <PermissionDeniedState />;
    }

    if (error instanceof ApiClientError && error.status === 404) {
      return <Result status="404" title="编排主体不存在" />;
    }

    return <Result status="error" title="编排加载失败" />;
  }

  const state = orchestrationQuery.data;

  return (
    <AgentFlowEditorShell
      applicationId={applicationId}
      applicationName={applicationName}
      initialState={state}
      saveDraftOverride={
        apiCapabilityStatus === 'ready' ? undefined : async () => state
      }
    />
  );
}
