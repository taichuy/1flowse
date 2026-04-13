import { useMemo, useState } from 'react';

import { Card, Descriptions, Drawer, Table, Tabs, Typography } from 'antd';

import { apiSurface, demoRuns, monitoringSignals } from '../demo-data';

export function ToolsPage() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRun = useMemo(
    () => demoRuns.find((item) => item.id === activeRunId) ?? null,
    [activeRunId]
  );

  return (
    <div className="demo-page">
      <section className="demo-page-hero">
        <span className="demo-kicker">L2 Manage Entry</span>
        <Typography.Title level={1}>工具</Typography.Title>
        <Typography.Paragraph className="demo-page-lede">
          工具页统一承接 API、调用日志和监控报表，不再把这些主题拆成一组互相抢主入口的平级页面。
        </Typography.Paragraph>
      </section>

      <Card className="demo-card">
        <Tabs
          items={[
            {
              key: 'api',
              label: 'API 概览',
              children: (
                <Table
                  rowKey="path"
                  pagination={false}
                  dataSource={apiSurface}
                  columns={[
                    {
                      title: 'Method',
                      dataIndex: 'method',
                      key: 'method'
                    },
                    {
                      title: 'Path',
                      dataIndex: 'path',
                      key: 'path'
                    },
                    {
                      title: 'Exposure',
                      dataIndex: 'exposure',
                      key: 'exposure'
                    },
                    {
                      title: '说明',
                      dataIndex: 'note',
                      key: 'note'
                    }
                  ]}
                />
              )
            },
            {
              key: 'logs',
              label: '调用日志',
              children: (
                <div className="run-list">
                  {demoRuns.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="run-row-button"
                      aria-label={`查看 ${item.id} 详情`}
                      onClick={() => setActiveRunId(item.id)}
                    >
                      <div>
                        <div className="run-row-title">
                          <span>{item.id}</span>
                          <span className={`status-pill ${item.status}`}>{item.summary}</span>
                        </div>
                        <Typography.Paragraph className="run-row-note">
                          {item.flow} · {item.owner} · {item.startedAt}
                        </Typography.Paragraph>
                      </div>
                    </button>
                  ))}
                </div>
              )
            },
            {
              key: 'monitoring',
              label: '监控报表',
              children: (
                <div className="metric-grid">
                  {monitoringSignals.map((item) => (
                    <Card key={item.label} className="metric-card">
                      <span className={`status-pill ${item.status}`}>{item.label}</span>
                      <Typography.Title level={2}>{item.value}</Typography.Title>
                      <Typography.Paragraph>{item.note}</Typography.Paragraph>
                    </Card>
                  ))}
                </div>
              )
            }
          ]}
        />
      </Card>

      <Drawer
        open={Boolean(activeRun)}
        title={activeRun?.id}
        width={420}
        onClose={() => setActiveRunId(null)}
      >
        {activeRun ? (
          <Descriptions
            column={1}
            colon={false}
            items={[
              {
                key: 'detail',
                label: '详情',
                children: activeRun.detail
              },
              {
                key: 'flow',
                label: 'Flow',
                children: activeRun.flow
              },
              {
                key: 'status',
                label: '状态',
                children: <span className={`status-pill ${activeRun.status}`}>{activeRun.summary}</span>
              }
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
