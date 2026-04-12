import { Button, Card } from 'antd';
import { useNavigate } from '@tanstack/react-router';

import {
  contracts,
  repoReality,
  summaryStats,
  workspaceMeta
} from '../../../data/workspace-data';
import { SummaryStats } from '../components/SummaryStats';
import { StatusBadge } from '../components/StatusBadge';

export function OverviewView() {
  const navigate = useNavigate();

  return (
    <section className="view-stack">
      <Card className="hero-card" variant="borderless">
        <div className="hero-layout">
          <div>
            <p className="section-label">应用概览</p>
            <h2>{workspaceMeta.name} workspace demo</h2>
            <p className="hero-copy">
              这一版 demo 不再只是漂亮静态图，而是把当前真实仓库状态、目标工作区语义与
              embedded runtime 线索一起放进可运行项目里。
            </p>
            <div className="action-row">
              <Button
                type="primary"
                onClick={() => {
                  void navigate({ to: '/orchestration' });
                }}
              >
                进入编排
              </Button>
            </div>
          </div>

          <div className="hero-side">
            <StatusBadge
              status="published"
              label={`Published ${workspaceMeta.publishedVersion}`}
            />
            <StatusBadge status="healthy" label="Runtime healthy" />
            <p className="sidebar-copy">
              概览页只回答当前状态、repo 现实与下一步去哪；完整编排、API 正文、日志细节和监控都回到各自任务域。
            </p>
          </div>
        </div>
      </Card>

      <SummaryStats items={summaryStats} />

      <div className="content-grid content-grid-overview">
        <Card className="panel" title="Published 与 Draft 明确分层">
          <div className="stack-list">
            <article className="stack-row">
              <div>
                <strong>Published contract</strong>
                <p>{contracts.openai.draftNote}</p>
              </div>
              <StatusBadge
                status={contracts.openai.status}
                label={contracts.openai.statusLabel}
              />
            </article>
            <article className="stack-row">
              <div>
                <strong>Current draft</strong>
                <p>
                  Classifier 阈值、Approval gate 文案与 Reply composer 输出仍等待下一次发布。
                </p>
              </div>
              <StatusBadge status="draft" label="3 changes" />
            </article>
          </div>
        </Card>

        <Card className="panel" title="真实路由成熟度">
          <div className="stack-list">
            {repoReality.map((item) => (
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

        <Card className="panel" title="为什么这轮要 React 化">
          <ul className="bullet-list">
            <li>原静态稿无法证明和 `web/` 依赖体系一起运行。</li>
            <li>概览页主入口必须唯一，不能再堆多个主按钮。</li>
            <li>后续定时任务需要在组件化结构上继续拆、测、截图，而不是继续堆字符串模板。</li>
          </ul>
        </Card>

        <Card className="panel" title="本轮建议">
          <ul className="bullet-list">
            <li>先在编排页验证节点状态、选中态和 draft change 的分离是否足够清楚。</li>
            <li>再去 API 页看 published 与 draft parity 的边界是否讲清楚。</li>
            <li>日志与监控两页只承担运行事实，不承担“解释产品定位”的责任。</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}
