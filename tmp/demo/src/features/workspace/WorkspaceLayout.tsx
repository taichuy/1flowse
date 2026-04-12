import { Link, useRouterState } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';

import {
  embedRuntimeSnapshot,
  embeddedArtifacts,
  getWorkspacePageForPath,
  workspaceMeta,
  workspacePages
} from '../../data/workspace-data';
import { RunDrawer } from './components/RunDrawer';
import { StatusBadge } from './components/StatusBadge';

export function WorkspaceLayout({ children }: PropsWithChildren) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const currentPage = getWorkspacePageForPath(pathname);

  return (
    <div className="workspace-shell">
      <main className="workspace-main">
        <nav className="mobile-domain-nav" aria-label="任务域切换">
          {workspacePages.map((page) => {
            const isActive =
              page.route === '/'
                ? pathname === page.route
                : pathname.startsWith(page.route);

            return (
              <Link
                key={`mobile-${page.id}`}
                to={page.route}
                className={`switch-link ${isActive ? 'is-active' : ''}`}
              >
                {page.title}
              </Link>
            );
          })}
        </nav>

        {children}
      </main>

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
          <p className="section-label">Workspace capsule</p>
          <div className="stack-list">
            <article className="stack-row compact-row">
              <div>
                <strong>当前任务域</strong>
                <p>
                  {currentPage.title} · {currentPage.summary}
                </p>
              </div>
              <span className="meta-chip">Active now</span>
            </article>
            <article className="stack-row compact-row">
              <div>
                <strong>Published surface</strong>
                <p>OpenAI compatible · {workspaceMeta.publishedVersion}</p>
              </div>
              <StatusBadge status="published" label="Live traffic" />
            </article>
            <article className="stack-row compact-row">
              <div>
                <strong>Host context</strong>
                <p>
                  {embedRuntimeSnapshot.applicationId} ·{' '}
                  {embedRuntimeSnapshot.teamId}
                </p>
              </div>
              <StatusBadge status="healthy" label="Host wired" />
            </article>
            <article className="stack-row compact-row">
              <div>
                <strong>Embedded manifests</strong>
                <p>{embeddedArtifacts.length} staged artifacts waiting for runtime</p>
              </div>
              <StatusBadge status="draft" label="Shell only" />
            </article>
          </div>
        </section>
      </aside>
      <RunDrawer />
    </div>
  );
}
