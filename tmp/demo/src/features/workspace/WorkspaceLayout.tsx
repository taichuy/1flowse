import { Link, useRouterState } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';

import {
  embedRuntimeSnapshot,
  embeddedArtifacts,
  iterationCritique,
  nextIterationFocus,
  repoReality,
  workspaceMeta,
  workspacePages
} from '../../data/workspace-data';
import { RunDrawer } from './components/RunDrawer';
import { StatusBadge } from './components/StatusBadge';

export function WorkspaceLayout({ children }: PropsWithChildren) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });

  return (
    <div className="workspace-shell">
      <main className="workspace-main">{children}</main>

      <aside className="workspace-sidebar">
        <div className="sidebar-top">
          <p className="section-label">1Flowse Application</p>
          <h1>{workspaceMeta.name}</h1>
          <p className="sidebar-copy">{workspaceMeta.description}</p>
          <div className="badge-row">
            <StatusBadge
              status="published"
              label={`Published ${workspaceMeta.publishedVersion}`}
            />
            <StatusBadge status="healthy" label="Runtime healthy" />
          </div>
          <p className="sidebar-copy">
            Owner: {workspaceMeta.owner} · Updated: {workspaceMeta.updatedAt}
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="应用任务域">
          {workspacePages.map((page) => {
            const isActive =
              page.route === '/'
                ? pathname === page.route
                : pathname.startsWith(page.route);

            return (
              <Link
                key={page.id}
                to={page.route}
                className={`nav-item ${isActive ? 'is-active' : ''}`}
              >
                <strong>{page.title}</strong>
                <span>{page.summary}</span>
              </Link>
            );
          })}
        </nav>

        <section className="panel sidebar-panel">
          <p className="section-label">当前代码现状</p>
          <div className="stack-list">
            {repoReality.map((item) => (
              <article key={item.title} className="stack-row compact-row">
                <div>
                  <strong>{item.title}</strong>
                </div>
                <StatusBadge status={item.status} label={item.statusLabel} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel sidebar-panel">
          <p className="section-label">本轮批判</p>
          <ul className="bullet-list">
            {iterationCritique.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="panel sidebar-panel">
          <p className="section-label">Embedded snapshot</p>
          <div className="stack-list compact-list">
            {embeddedArtifacts.map((artifact) => (
              <article key={artifact.appId} className="stack-row compact-row">
                <div>
                  <strong>{artifact.name}</strong>
                  <p>
                    {artifact.routePrefix} · {artifact.version}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="sidebar-copy">
            Host context: {embedRuntimeSnapshot.applicationId} ·{' '}
            {embedRuntimeSnapshot.teamId}
          </p>
        </section>

        <section className="panel sidebar-panel">
          <p className="section-label">下轮方向</p>
          <ul className="bullet-list">
            {nextIterationFocus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </aside>
      <RunDrawer />
    </div>
  );
}
