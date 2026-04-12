import { Button, Card } from 'antd';
import { useNavigate } from '@tanstack/react-router';

import { nodePaths, nodes } from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { NodeInspector } from '../components/NodeInspector';
import { SummaryStats } from '../components/SummaryStats';
import { StatusBadge } from '../components/StatusBadge';

export function OrchestrationView() {
  const navigate = useNavigate();
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useWorkspaceStore((state) => state.setSelectedNodeId);

  return (
    <section className="view-stack">
      <Card className="panel" title="客户问询主流程">
        <div className="header-split">
          <p className="hero-copy">
            节点详情只在 Inspector 里更新，run 详情只在 Logs 的 Drawer 里打开。这两个 L1 模型保持固定，不再混用。
          </p>
          <div className="action-row">
            <Button onClick={() => setSelectedNodeId('approval')}>定位等待节点</Button>
            <Button
              type="primary"
              onClick={() => {
                void navigate({ to: '/api' });
              }}
            >
              查看发布契约
            </Button>
          </div>
        </div>
      </Card>

      <SummaryStats
        items={[
          {
            label: 'Published contract',
            value: 'v0.8.14',
            note: 'live traffic 只暴露一个正式契约。'
          },
          {
            label: 'Draft node changes',
            value: '3',
            note: '草稿变化不会覆盖 published 运行结果。'
          },
          {
            label: 'Waiting run',
            value: '1',
            note: '等待态必须先落 checkpoint，再进入恢复流程。'
          },
          {
            label: 'Failure hotspot',
            value: '1',
            note: 'CRM adapter 的失败样本被保留下来供排查。'
          }
        ]}
      />

      <div className="content-grid orchestration-grid">
        <Card className="panel stage-panel" title="agentFlow studio">
          <div className="stage-toolbar">
            <Button onClick={() => setSelectedNodeId('classifier')}>聚焦运行节点</Button>
            <Button onClick={() => setSelectedNodeId('crm')}>聚焦失败样本</Button>
          </div>

          <div className="canvas-shell">
            <svg className="canvas-wires" viewBox="0 0 1048 430" aria-hidden="true">
              {nodePaths.map((path) => (
                <path key={path} d={path} />
              ))}
            </svg>

            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;

              return (
                <button
                  key={node.id}
                  type="button"
                  className={`node-card ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    left: `${node.position.left}px`,
                    top: `${node.position.top}px`
                  }}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <div className="node-meta-row">
                    <span className="kind-badge">{node.kind}</span>
                    <StatusBadge status={node.status} label={node.statusLabel} />
                  </div>
                  <strong>{node.title}</strong>
                  <p>{node.description}</p>
                  {node.isDraftChanged ? (
                    <span className="outline-tag">Draft change</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mobile-node-list">
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`mobile-node-card ${
                  selectedNodeId === node.id ? 'is-selected' : ''
                }`}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <div className="node-meta-row">
                  <span className="kind-badge">{node.kind}</span>
                  <StatusBadge status={node.status} label={node.statusLabel} />
                </div>
                <strong>{node.title}</strong>
                <p>{node.summary}</p>
              </button>
            ))}
          </div>
        </Card>

        <NodeInspector />
      </div>
    </section>
  );
}
