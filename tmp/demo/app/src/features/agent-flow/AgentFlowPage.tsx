import { useMemo, useState } from 'react';

import { Button, Card, Col, Descriptions, Row, Space, Typography } from 'antd';

import { demoRuns, studioNodes } from '../demo-data';

export function AgentFlowPage() {
  const [activeNodeId, setActiveNodeId] = useState(studioNodes[0]?.id ?? null);
  const activeNode = useMemo(
    () => studioNodes.find((item) => item.id === activeNodeId) ?? studioNodes[0],
    [activeNodeId]
  );

  return (
    <div className="demo-page">
      <section className="demo-page-hero studio-hero">
        <span className="demo-kicker">L3 Execute Workspace</span>
        <Typography.Title level={1}>Agent Flow Studio</Typography.Title>
        <Typography.Paragraph className="demo-page-lede">
          Studio 作为执行层单独存在，保持画布与 inspector 的固定组合，不再混进一级导航。
        </Typography.Paragraph>
      </section>

      <Row gutter={[18, 18]}>
        <Col xs={24} xl={15}>
          <Card title="Flow Surface" className="demo-card studio-surface-card">
            <div className="studio-surface">
              {studioNodes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`studio-node ${item.id === activeNode.id ? 'is-active' : ''}`}
                  onClick={() => setActiveNodeId(item.id)}
                >
                  <span className="studio-node-kind">{item.kind}</span>
                  <span className="studio-node-name">{item.name}</span>
                  <span className={`status-pill ${item.status}`}>
                    {item.status === 'healthy' ? 'ready' : item.status}
                  </span>
                </button>
              ))}
            </div>
            <div className="studio-lane">
              {demoRuns.slice(0, 2).map((item) => (
                <div key={item.id} className="studio-lane-row">
                  <span>{item.id}</span>
                  <span>{item.flow}</span>
                  <span className={`status-pill ${item.status}`}>{item.summary}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title="当前聚焦节点" className="demo-card studio-inspector-card">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Typography.Title level={4}>{activeNode.name}</Typography.Title>
                <Typography.Paragraph>{activeNode.description}</Typography.Paragraph>
              </div>
              <Descriptions
                column={1}
                colon={false}
                items={[
                  {
                    key: 'owner',
                    label: 'Owner',
                    children: activeNode.owner
                  },
                  {
                    key: 'kind',
                    label: 'Kind',
                    children: activeNode.kind
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    children: (
                      <span className={`status-pill ${activeNode.status}`}>{activeNode.status}</span>
                    )
                  }
                ]}
              />
              <Card size="small" title="输出">
                <Typography.Paragraph>{activeNode.output}</Typography.Paragraph>
              </Card>
              <Button type="primary">继续执行当前节点</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
