import { useQuery } from '@tanstack/react-query';
import { Result } from 'antd';
import { Suspense, lazy, type ReactNode } from 'react';

import { ApiClientError } from '@1flowbase/api-client';
import { PermissionDeniedState } from '../../../shared/ui/PermissionDeniedState';
import { SectionPageLayout } from '../../../shared/ui/section-page-layout/SectionPageLayout';
import { applicationDetailQueryKey, fetchApplicationDetail } from '../api/applications';
import { ApplicationSectionState } from '../components/ApplicationSectionState';
import {
  getApplicationSections,
  type ApplicationSectionKey
} from '../lib/application-sections';

const AgentFlowEditorPage = lazy(() =>
  import('../../agent-flow/pages/AgentFlowEditorPage').then((module) => ({
    default: module.AgentFlowEditorPage
  }))
);
const ApplicationLogsPage = lazy(() =>
  import('./ApplicationLogsPage').then((module) => ({
    default: module.ApplicationLogsPage
  }))
);

function ApplicationSectionFallback() {
  return <Result status="info" title="正在加载应用模块" />;
}

function ApplicationSectionBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ApplicationSectionFallback />}>{children}</Suspense>;
}

export function ApplicationDetailPage({
  applicationId,
  requestedSectionKey
}: {
  applicationId: string;
  requestedSectionKey: ApplicationSectionKey;
}) {
  const detailQuery = useQuery({
    queryKey: applicationDetailQueryKey(applicationId),
    queryFn: () => fetchApplicationDetail(applicationId)
  });

  if (detailQuery.isPending) {
    return <Result status="info" title="正在加载应用" />;
  }

  if (detailQuery.isError) {
    const error = detailQuery.error;

    if (error instanceof ApiClientError && error.status === 403) {
      return <PermissionDeniedState />;
    }

    if (error instanceof ApiClientError && error.status === 404) {
      return <Result status="404" title="应用不存在" />;
    }

    return <Result status="error" title="应用加载失败" />;
  }

  const application = detailQuery.data;
  const content =
    requestedSectionKey === 'orchestration' ? (
      <ApplicationSectionBoundary>
        <AgentFlowEditorPage
          applicationId={applicationId}
          applicationName={application.name}
        />
      </ApplicationSectionBoundary>
    ) : requestedSectionKey === 'logs' ? (
      <ApplicationSectionBoundary>
        <ApplicationLogsPage applicationId={applicationId} />
      </ApplicationSectionBoundary>
    ) : (
      <ApplicationSectionState
        application={application}
        sectionKey={requestedSectionKey}
      />
    );

  return (
    <SectionPageLayout
      pageTitle={application.name}
      navItems={getApplicationSections(applicationId)}
      activeKey={requestedSectionKey}
      contentWidth={requestedSectionKey === 'orchestration' ? 'full' : 'wide'}
    >
      {content}
    </SectionPageLayout>
  );
}
