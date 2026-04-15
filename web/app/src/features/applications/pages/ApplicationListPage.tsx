import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Button, Empty, Input, Result, Select, Space, Typography } from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import { applicationsQueryKey, fetchApplications } from '../api/applications';
import { ApplicationCardGrid } from '../components/ApplicationCardGrid';
import { ApplicationCreateModal } from '../components/ApplicationCreateModal';

export function ApplicationListPage() {
  const actor = useAuthStore((state) => state.actor);
  const me = useAuthStore((state) => state.me);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'agent_flow' | 'workflow'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const applicationsQuery = useQuery({
    queryKey: applicationsQueryKey,
    queryFn: fetchApplications
  });
  const isRoot = actor?.effective_display_role === 'root';
  const canCreate = isRoot || Boolean(me?.permissions.includes('application.create.all'));
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (applicationsQuery.isPending) {
    return <Result status="info" title="正在加载应用" />;
  }

  if (applicationsQuery.isError) {
    return <Result status="error" title="应用列表加载失败" />;
  }

  const visibleApplications = (applicationsQuery.data ?? []).filter((application) => {
    const matchesType = typeFilter === 'all' || application.application_type === typeFilter;
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      application.name.toLowerCase().includes(normalizedKeyword) ||
      application.description.toLowerCase().includes(normalizedKeyword);

    return matchesType && matchesKeyword;
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>工作台</Typography.Title>
        <Typography.Paragraph>浏览、创建并进入当前工作区可见的应用。</Typography.Paragraph>
      </div>

      <Space wrap>
        <Input.Search
          aria-label="搜索应用"
          placeholder="按名称或简介搜索"
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          aria-label="应用类型"
          value={typeFilter}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'agent_flow', label: 'AgentFlow' },
            { value: 'workflow', label: 'Workflow' }
          ]}
          onChange={setTypeFilter}
          style={{ minWidth: 160 }}
        />
        {canCreate ? (
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新建应用
          </Button>
        ) : null}
      </Space>

      {visibleApplications.length === 0 ? (
        <Empty description="当前没有可见应用" />
      ) : (
        <ApplicationCardGrid applications={visibleApplications} />
      )}

      <ApplicationCreateModal
        open={createOpen}
        csrfToken={csrfToken ?? ''}
        onClose={() => setCreateOpen(false)}
        onCreated={(applicationId) => {
          window.location.assign(`/applications/${applicationId}/orchestration`);
        }}
      />
    </Space>
  );
}
