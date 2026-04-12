import { Button, Card, Segmented } from 'antd';
import { useNavigate } from '@tanstack/react-router';

import {
  monitoringWindows,
  type MonitoringWindow
} from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { SparkBars } from '../components/SparkBars';
import { StatusBadge } from '../components/StatusBadge';

export function MonitoringView() {
  const navigate = useNavigate();
  const monitoringWindow = useWorkspaceStore(
    (state) => state.monitoringWindow
  );
  const setMonitoringWindow = useWorkspaceStore(
    (state) => state.setMonitoringWindow
  );
  const openFirstRunForFilter = useWorkspaceStore(
    (state) => state.openFirstRunForFilter
  );
  const setContractMode = useWorkspaceStore((state) => state.setContractMode);
  const currentWindow = monitoringWindows[monitoringWindow];

  return (
    <section className="view-stack">
      <Card className="panel" title="监控报表">
        <div className="header-split">
          <p className="hero-copy">
            监控页回答的是系统事实和热点，不抢日志页的细节，也不抢编排页的编辑权。这里重点是运行健康、state discipline 和 plugin 边界。
          </p>
          <Segmented
            value={monitoringWindow}
            options={[
              { label: '24h', value: '24h' },
              { label: '7d', value: '7d' }
            ]}
            onChange={(value) => setMonitoringWindow(value as MonitoringWindow)}
          />
        </div>
      </Card>

      <div className="metric-grid">
        {currentWindow.metrics.map((metric) => (
          <Card
            key={metric.title}
            className="panel metric-card"
            variant="borderless"
          >
            <div className="metric-top">
              <div>
                <p className="section-label">{metric.title}</p>
                <strong className="metric-value">{metric.value}</strong>
                <p>{metric.note}</p>
              </div>
              <StatusBadge status={metric.status} label={metric.statusLabel} />
            </div>
            <SparkBars values={metric.spark} />
          </Card>
        ))}
      </div>

      <div className="content-grid monitoring-grid">
        <Card className="panel" title="Hotspots">
          <div className="stack-list">
            {currentWindow.hotspots.map((hotspot) => (
              <article key={hotspot.title} className="stack-row">
                <div>
                  <strong>{hotspot.title}</strong>
                  <p>{hotspot.note}</p>
                </div>
                <Button
                  onClick={() => {
                    if (hotspot.actionView === 'logs') {
                      openFirstRunForFilter(hotspot.runFilter ?? 'all');
                      void navigate({ to: '/logs' });
                      return;
                    }

                    if (hotspot.contractMode) {
                      setContractMode(hotspot.contractMode);
                    }

                    void navigate({ to: '/api' });
                  }}
                >
                  {hotspot.actionLabel}
                </Button>
              </article>
            ))}
          </div>
        </Card>

        <Card className="panel" title="State model">
          <ul className="bullet-list">
            {currentWindow.stateRows.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="panel" title="Plugin & runtime">
          <div className="stack-list">
            {currentWindow.pluginRows.map((item) => (
              <article key={item.title} className="stack-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
                <StatusBadge status={item.status} label={item.statusLabel} />
              </article>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
