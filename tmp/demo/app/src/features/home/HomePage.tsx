import { useMemo, useState } from 'react';

import { Link } from '@tanstack/react-router';
import { Card, Col, Descriptions, Drawer, List, Row, Space, Typography } from 'antd';

import { critiqueNotes, demoRuns, workbenchMetrics, workbenchTracks } from '../demo-data';

export function HomePage() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRun = useMemo(
    () => demoRuns.find((item) => item.id === activeRunId) ?? null,
    [activeRunId]
  );

  return (
    <div className="demo-page">
      <section className="demo-page-hero">
        <span className="demo-kicker">Current Product Demo</span>
        <Typography.Title level={1}>工作台</Typography.Title>
        <Typography.Paragraph className="demo-page-lede">
          这个 demo 不再做主题预览板，而是直接模拟 1Flowse 当前控制台应该呈现的
          L2 工作台：先看系统现状，再进入 Studio、子系统、工具与设置。
        </Typography.Paragraph>
        <Space wrap>
          <Link to="/studio" className="demo-cta-link demo-cta-link-primary">
            进入 Agent Flow Studio
          </Link>
          <Link to="/settings" className="demo-cta-link">
            打开设置
          </Link>
        </Space>
      </section>

      <div className="metric-grid">
        {workbenchMetrics.map((item) => (
          <Card key={item.label} className="metric-card">
            <span className={`status-pill ${item.status}`}>{item.label}</span>
            <Typography.Title level={2}>{item.value}</Typography.Title>
            <Typography.Paragraph>{item.note}</Typography.Paragraph>
          </Card>
        ))}
      </div>

      <Row gutter={[18, 18]}>
        <Col xs={24} xl={15}>
          <Card title="当前收敛主线" className="demo-card">
            <List
              dataSource={workbenchTracks}
              renderItem={(item) => (
                <List.Item>
                  <div className="demo-list-block">
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Typography.Paragraph>{item.detail}</Typography.Paragraph>
                  </div>
                </List.Item>
              )}
            />
          </Card>

          <Card title="最近运行" className="demo-card">
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
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title="当前项目现状" className="demo-card">
            <Descriptions
              column={1}
              colon={false}
              items={[
                {
                  key: 'shell',
                  label: '控制台主题',
                  children: '浅色工作台 + 翡翠绿高信号语义'
                },
                {
                  key: 'subsystems',
                  label: '子系统边界',
                  children: 'embedded-apps 仍是稳定的子系统主入口'
                },
                {
                  key: 'studio',
                  label: 'Studio 入口',
                  children: '保留为工作台主动作，而不是一级导航'
                },
                {
                  key: 'settings',
                  label: '设置收口',
                  children: '个人资料、团队、访问控制、API 文档统一进入设置页'
                }
              ]}
            />
          </Card>

          <Card title="本轮批判" className="demo-card">
            <List
              dataSource={critiqueNotes}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Paragraph>{item}</Typography.Paragraph>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        open={Boolean(activeRun)}
        title={activeRun?.id}
        width={440}
        onClose={() => setActiveRunId(null)}
      >
        {activeRun ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Typography.Paragraph>{activeRun.detail}</Typography.Paragraph>
            <Descriptions
              column={1}
              colon={false}
              items={[
                {
                  key: 'flow',
                  label: 'Flow',
                  children: activeRun.flow
                },
                {
                  key: 'owner',
                  label: 'Owner',
                  children: activeRun.owner
                },
                {
                  key: 'startedAt',
                  label: 'Started',
                  children: activeRun.startedAt
                }
              ]}
            />
            <Card size="small" title="事件时间线" className="drawer-timeline-card">
              <List
                dataSource={activeRun.events}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
