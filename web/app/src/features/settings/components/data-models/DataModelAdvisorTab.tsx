import { Empty, List, Space, Tag, Typography } from 'antd';

import type { SettingsDataModelAdvisorFinding } from '../../api/data-models';

function severityColor(severity: string) {
  if (severity === 'blocking') return 'red';
  if (severity === 'high') return 'orange';
  return 'blue';
}

export function DataModelAdvisorTab({
  findings,
  loading
}: {
  findings: SettingsDataModelAdvisorFinding[];
  loading: boolean;
}) {
  if (!loading && findings.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Advisor 发现" />;
  }

  return (
    <div data-testid="data-model-advisor-tab">
      <List
        loading={loading}
        dataSource={findings}
        renderItem={(finding) => (
          <List.Item>
            <Space direction="vertical" size={4}>
              <Space wrap>
                <Tag color={severityColor(finding.severity)}>{finding.severity}</Tag>
                <Typography.Text strong>{finding.code}</Typography.Text>
              </Space>
              <Typography.Text>{finding.message}</Typography.Text>
              <Typography.Text type="secondary">
                {finding.recommended_action}
              </Typography.Text>
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
}
