import type { ReactElement } from 'react';

export type StyleBoundarySceneKind = 'component' | 'page';

export interface StyleBoundaryPropertyAssertion {
  property: string;
  expected: string;
}

export interface StyleBoundaryTargetNode {
  id: string;
  selector: string;
  propertyAssertions: StyleBoundaryPropertyAssertion[];
}

export interface StyleBoundaryManifestScene {
  id: string;
  kind: StyleBoundarySceneKind;
  title: string;
  impactFiles: string[];
  boundaryNodes: StyleBoundaryTargetNode[];
}

export interface StyleBoundaryRuntimeScene extends StyleBoundaryManifestScene {
  render: () => ReactElement;
}
