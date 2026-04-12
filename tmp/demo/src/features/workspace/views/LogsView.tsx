import { Button, Card, Segmented } from 'antd';

import { getRunsByFilter, type RunFilter } from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { StatusBadge } from '../components/StatusBadge';

export function LogsView() {
  const runFilter = useWorkspaceStore((state) => state.runFilter);
  const setRunFilter = useWorkspaceStore((state) => state.setRunFilter);
  const openRun = useWorkspaceStore((state) => state.openRun);
  const runs = getRunsByFilter(runFilter);

  return (
    <section className="view-stack">
      <Card className="panel" title="调用日志">
        <div className="header-split">
          <p className="hero-copy">
            这里不重新解释产品定位，只回答 run 发生了什么、停在哪里、怎样恢复。详情统一用 Drawer 打开，保持 Shell 页的 L1 详情模型一致。
          </p>
        </div>

        <Segmented
          className="segmented-control"
          value={runFilter}
          options={[
            { label: '全部', value: 'all' },
            { label: '运行中', value: 'running' },
            { label: '等待中', value: 'waiting' },
            { label: '失败', value: 'failed' },
            { label: '成功', value: 'success' }
          ]}
          onChange={(value) => setRunFilter(value as RunFilter)}
        />
      </Card>

      <div className="stack-list run-list">
        {runs.map((run) => (
          <Card key={run.id} className="panel run-card" variant="borderless">
            <div className="run-row">
              <div className="run-copy">
                <div className="badge-row">
                  <StatusBadge status={run.status} label={run.statusLabel} />
                  <span className="meta-chip">{run.contract}</span>
                  <span className="meta-chip">{run.currentNode}</span>
                </div>
                <strong>{run.title}</strong>
                <p>{run.subtitle}</p>
                <small>
                  Started at {run.startedAt} · Runtime {run.runtime}
                </small>
              </div>
              <Button
                onClick={() => openRun(run.id)}
                aria-label={`查看 ${run.id} 详情`}
              >
                查看详情
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
