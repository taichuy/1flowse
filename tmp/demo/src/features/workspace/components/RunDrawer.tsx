import { Button, Descriptions, Drawer, Timeline } from 'antd';

import { getRun } from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { StatusBadge } from './StatusBadge';

export function RunDrawer() {
  const activeRunId = useWorkspaceStore((state) => state.activeRunId);
  const closeRun = useWorkspaceStore((state) => state.closeRun);
  const run = getRun(activeRunId);

  return (
    <Drawer
      open={Boolean(run)}
      onClose={closeRun}
      width={380}
      title={run ? run.title : 'Run detail'}
      extra={
        run ? <StatusBadge status={run.status} label={run.statusLabel} /> : null
      }
      destroyOnClose
    >
      {run ? (
        <div className="drawer-content">
          <Descriptions
            className="detail-descriptions"
            column={1}
            items={[
              { key: 'id', label: 'Run ID', children: run.id },
              { key: 'runtime', label: 'Runtime', children: run.runtime },
              { key: 'contract', label: 'Contract', children: run.contract },
              { key: 'node', label: 'Current node', children: run.currentNode },
              { key: 'startedAt', label: 'Started at', children: run.startedAt }
            ]}
          />

          <div className="info-block">
            <h3>为什么停在这里</h3>
            <p>{run.reason}</p>
          </div>

          <div className="info-block">
            <h3>恢复策略</h3>
            <p>{run.recovery}</p>
          </div>

          <div className="info-block">
            <h3>Latest trail</h3>
            <Timeline
              items={run.events.map((event) => ({
                children: (
                  <div>
                    <strong>{event.title}</strong>
                    <p>
                      {event.time} · {event.note}
                    </p>
                  </div>
                )
              }))}
            />
          </div>

          <Button onClick={closeRun}>关闭</Button>
        </div>
      ) : null}
    </Drawer>
  );
}
