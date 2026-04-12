import { Button, Descriptions, Space } from 'antd';
import { useNavigate } from '@tanstack/react-router';

import { getNode } from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { StatusBadge } from './StatusBadge';

export function NodeInspector() {
  const navigate = useNavigate();
  const selectedNodeId = useWorkspaceStore((state) => state.selectedNodeId);
  const setContractMode = useWorkspaceStore((state) => state.setContractMode);
  const openFirstRunForFilter = useWorkspaceStore(
    (state) => state.openFirstRunForFilter
  );
  const node = getNode(selectedNodeId);

  if (!node) {
    return null;
  }

  return (
    <aside className="panel inspector-panel">
      <p className="section-label">节点检查</p>
      <div className="panel-title-row">
        <div>
          <h2>{node.title}</h2>
          <p>{node.summary}</p>
        </div>
      </div>

      <Space wrap size={[8, 8]}>
        <span className="kind-badge">{node.kind}</span>
        <StatusBadge status={node.status} label={node.statusLabel} />
        {node.isDraftChanged ? (
          <span className="outline-tag">Draft change</span>
        ) : null}
      </Space>

      <Descriptions
        className="detail-descriptions"
        column={1}
        items={[
          { key: 'input', label: '输入', children: node.input },
          { key: 'output', label: '输出', children: node.output },
          { key: 'role', label: '节点职责', children: node.role },
          { key: 'change', label: '最近变化', children: node.change }
        ]}
      />

      <div className="info-block">
        <h3>为什么它影响契约</h3>
        <p>{node.description}</p>
      </div>

      <div className="action-row">
        <Button
          onClick={() => {
            openFirstRunForFilter(node.logsFilter);
            void navigate({ to: '/logs' });
          }}
        >
          查看相关运行
        </Button>
        <Button
          type="link"
          onClick={() => {
            setContractMode(node.contractMode);
            void navigate({ to: '/api' });
          }}
        >
          查看契约影响
        </Button>
      </div>
    </aside>
  );
}
