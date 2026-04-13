import { useState } from 'react';

import { Card, Descriptions, Drawer, List, Table, Typography } from 'antd';

import { apiSurface, demoRuns, monitoringSignals, toolFollowUps } from '../demo-data';
import { DemoPageHero } from '../../shared/ui/DemoPageHero';
import { StatusPill } from '../../shared/ui/StatusPill';

export function ToolsPage() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRun = activeRunId ? demoRuns.find((item) => item.id === activeRunId) ?? null : null;

  return (
    <div className="demo-page">
      <DemoPageHero
        kicker="工具台总览"
        title="工具"
        description="工具台统一承接接口审阅、运行告警和交付检查，帮助平台团队在一个页面内完成问题收口。"
      />

      <div className="metric-grid">
        {monitoringSignals.map((item) => (
          <Card key={item.label} className="metric-card">
            <StatusPill status={item.status}>{item.label}</StatusPill>
            <Typography.Title level={2}>{item.value}</Typography.Title>
            <Typography.Paragraph>{item.note}</Typography.Paragraph>
          </Card>
        ))}
      </div>

      <div className="demo-grid-columns">
        <div className="demo-two-column">
          <Card title="待处理事项" className="demo-card">
            <div className="run-list">
              {demoRuns.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="run-row-button"
                  aria-label={`查看 ${item.flow}`}
                  onClick={() => setActiveRunId(item.id)}
                >
                  <div>
                    <div className="run-row-title">
                      <span>{item.flow}</span>
                      <StatusPill status={item.status}>{item.summary}</StatusPill>
                    </div>
                    <Typography.Paragraph className="run-row-note">
                      {item.owner} · {item.startedAt}
                    </Typography.Paragraph>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="demo-two-column">
          <Card title="接口概览" className="demo-card">
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
                  title: '暴露级别',
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
          </Card>
        </div>
      </div>

      <Card title="近期收口方向" className="demo-card">
        <List
          dataSource={toolFollowUps}
          renderItem={(item) => (
            <List.Item>
              <Typography.Paragraph>{item}</Typography.Paragraph>
            </List.Item>
          )}
        />
      </Card>

      <Drawer
        open={Boolean(activeRun)}
        title={activeRun?.flow}
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
                label: '流程',
                children: activeRun.flow
              },
              {
                key: 'status',
                label: '状态',
                children: <StatusPill status={activeRun.status}>{activeRun.summary}</StatusPill>
              }
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
