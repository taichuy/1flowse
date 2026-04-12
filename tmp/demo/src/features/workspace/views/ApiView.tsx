import { Button, Card, Segmented } from 'antd';
import { useNavigate } from '@tanstack/react-router';

import { contracts, type ContractMode } from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { StatusBadge } from '../components/StatusBadge';

export function ApiView() {
  const navigate = useNavigate();
  const contractMode = useWorkspaceStore((state) => state.contractMode);
  const setContractMode = useWorkspaceStore((state) => state.setContractMode);
  const openFirstRunForFilter = useWorkspaceStore(
    (state) => state.openFirstRunForFilter
  );
  const contract = contracts[contractMode];

  return (
    <section className="view-stack">
      <Card className="panel" title="应用 API">
        <div className="header-split">
          <p className="hero-copy">
            兼容模式只改变 envelope，不改变 flow、本地 state 和 callback discipline。Published 与 Draft 必须并排展示，而不是混在一句话里。
          </p>
          <div className="badge-row">
            <StatusBadge status={contract.status} label={contract.statusLabel} />
          </div>
        </div>

        <Segmented
          className="segmented-control"
          value={contractMode}
          options={[
            { label: 'OpenAI', value: 'openai' },
            { label: 'Claude', value: 'claude' },
            { label: 'Native', value: 'native' }
          ]}
          onChange={(value) => setContractMode(value as ContractMode)}
        />
      </Card>

      <div className="content-grid api-grid">
        <Card className="panel" title={contract.label}>
          <div className="stack-list compact-list">
            <article className="stack-row compact-row">
              <div>
                <strong>Endpoint</strong>
                <p>{contract.endpoint}</p>
              </div>
            </article>
            <article className="stack-row compact-row">
              <div>
                <strong>Auth</strong>
                <p>{contract.auth}</p>
              </div>
            </article>
            <article className="stack-row compact-row">
              <div>
                <strong>Callback discipline</strong>
                <p>{contract.callback}</p>
              </div>
            </article>
          </div>

          <div className="info-block">
            <h3>当前说明</h3>
            <p>{contract.draftNote}</p>
          </div>

          <div className="action-row">
            <Button
              onClick={() => {
                openFirstRunForFilter(contract.id === 'claude' ? 'running' : 'waiting');
                void navigate({ to: '/logs' });
              }}
            >
              查看相关运行
            </Button>
          </div>
        </Card>

        <Card className="panel" title="Consumers">
          <ul className="bullet-list">
            {contract.consumers.map((consumer) => (
              <li key={consumer}>{consumer}</li>
            ))}
          </ul>
        </Card>

        <Card className="panel" title="Request example">
          <pre className="code-block">{contract.requestExample}</pre>
        </Card>

        <Card className="panel" title="Response example">
          <pre className="code-block">{contract.responseExample}</pre>
        </Card>

        <Card className="panel" title="发布前检查">
          <ul className="bullet-list">
            {contract.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
