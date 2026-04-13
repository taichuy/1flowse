import type { StyleBoundaryRuntimeScene } from './types';

export function StyleBoundaryHarness({
  scene
}: {
  scene: StyleBoundaryRuntimeScene;
}) {
  window.__STYLE_BOUNDARY__ = {
    ready: true,
    scene
  };

  return <div data-testid="style-boundary-scene">{scene.render()}</div>;
}
