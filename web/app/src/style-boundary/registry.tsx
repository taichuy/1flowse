import { Menu } from 'antd';

import { createAccountMenuItems } from '../app-shell/AccountMenu';
import { AppShellFrame } from '../app-shell/AppShellFrame';
import { AgentFlowPage } from '../features/agent-flow/pages/AgentFlowPage';
import { EmbeddedAppsPage } from '../features/embedded-apps/pages/EmbeddedAppsPage';
import { HomePage } from '../features/home/pages/HomePage';
import manifest from './scenario-manifest.json';
import type {
  StyleBoundaryManifestScene,
  StyleBoundaryRuntimeScene
} from './types';

function getAccountPopupChildren() {
  const items = createAccountMenuItems() ?? [];
  const firstItem = items[0];

  if (
    !firstItem ||
    typeof firstItem !== 'object' ||
    !('children' in firstItem) ||
    !Array.isArray(firstItem.children)
  ) {
    return [];
  }

  return firstItem.children;
}

const renderers: Record<string, StyleBoundaryRuntimeScene['render']> = {
  'component.account-popup': () => (
    <div className="app-shell-account-popup">
      <Menu mode="vertical" selectable={false} items={getAccountPopupChildren()} />
    </div>
  ),
  'component.account-trigger': () => (
    <Menu
      className="app-shell-account-menu"
      mode="horizontal"
      selectable={false}
      items={createAccountMenuItems()}
      openKeys={['account']}
    />
  ),
  'page.home': () => (
    <AppShellFrame pathname="/">
      <HomePage />
    </AppShellFrame>
  ),
  'page.embedded-apps': () => (
    <AppShellFrame pathname="/embedded-apps">
      <EmbeddedAppsPage />
    </AppShellFrame>
  ),
  'page.agent-flow': () => (
    <AppShellFrame pathname="/agent-flow">
      <AgentFlowPage />
    </AppShellFrame>
  )
};

export function getSceneManifest(): StyleBoundaryManifestScene[] {
  return manifest as StyleBoundaryManifestScene[];
}

export function getSceneIdsForFiles(files: string[]): string[] {
  const fileSet = new Set(files);

  return getSceneManifest()
    .filter((scene) => scene.impactFiles.some((file) => fileSet.has(file)))
    .map((scene) => scene.id);
}

export function getRuntimeScene(sceneId: string): StyleBoundaryRuntimeScene {
  const scene = getSceneManifest().find((entry) => entry.id === sceneId);

  if (!scene || !renderers[scene.id]) {
    throw new Error(`Unknown style boundary scene: ${sceneId}`);
  }

  return {
    ...scene,
    render: renderers[scene.id]
  };
}
