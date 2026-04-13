import { Card, Table, Typography } from 'antd';

import { subsystems } from '../demo-data';

export function EmbeddedAppsPage() {
  return (
    <div className="demo-page">
      <section className="demo-page-hero">
        <span className="demo-kicker">L2 Stable Entry</span>
        <Typography.Title level={1}>子系统</Typography.Title>
        <Typography.Paragraph className="demo-page-lede">
          当前项目仍以 embedded-apps 作为稳定子系统边界。这里用 mock 数据演示版本、挂载路径和宿主约束的展示方式。
        </Typography.Paragraph>
      </section>

      <Card title="已接入子系统" className="demo-card">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={subsystems}
          columns={[
            {
              title: '应用',
              dataIndex: 'name',
              key: 'name',
              render: (value: string, record) => (
                <div className="table-block">
                  <Typography.Text strong>{value}</Typography.Text>
                  <Typography.Paragraph>{record.summary}</Typography.Paragraph>
                </div>
              )
            },
            {
              title: '挂载路径',
              dataIndex: 'routePrefix',
              key: 'routePrefix'
            },
            {
              title: '版本',
              dataIndex: 'version',
              key: 'version'
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (value: string) => <span className={`status-pill ${value}`}>{value}</span>
            }
          ]}
        />
      </Card>
    </div>
  );
}
