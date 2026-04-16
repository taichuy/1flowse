import type {
  FlowAuthoringDocument,
  FlowNodeDocument
} from '@1flowse/flow-schema';

import { createEdgeDocument } from '../edge-factory';
import { getEdgeById, getNodeById } from '../selectors';

export interface EdgeConnection {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function validateConnection(
  document: FlowAuthoringDocument,
  connection: Pick<EdgeConnection, 'source' | 'target'>
) {
  if (!connection.source || !connection.target) {
    return false;
  }

  const sourceNode = getNodeById(document, connection.source);
  const targetNode = getNodeById(document, connection.target);

  return Boolean(
    sourceNode &&
      targetNode &&
      sourceNode.id !== targetNode.id &&
      sourceNode.containerId === targetNode.containerId
  );
}

export function reconnectEdge(
  document: FlowAuthoringDocument,
  payload: {
    edgeId: string;
    connection: EdgeConnection;
  }
) {
  const edge = getEdgeById(document, payload.edgeId);

  if (!edge || !validateConnection(document, payload.connection)) {
    return document;
  }

  return {
    ...document,
    graph: {
      ...document.graph,
      edges: document.graph.edges.map((item) =>
        item.id === payload.edgeId
          ? {
              ...item,
              source: payload.connection.source ?? item.source,
              target: payload.connection.target ?? item.target,
              sourceHandle: payload.connection.sourceHandle ?? null,
              targetHandle: payload.connection.targetHandle ?? null
            }
          : item
      )
    }
  };
}

export function insertNodeOnEdge(
  document: FlowAuthoringDocument,
  payload: {
    edgeId: string;
    node: FlowNodeDocument;
  }
) {
  const edge = getEdgeById(document, payload.edgeId);

  if (!edge) {
    return document;
  }

  const sourceNode = getNodeById(document, edge.source);
  const targetNode = getNodeById(document, edge.target);

  if (!sourceNode || !targetNode) {
    return document;
  }

  const insertedNode = {
    ...payload.node,
    containerId: sourceNode.containerId,
    position: {
      x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
      y: Math.round((sourceNode.position.y + targetNode.position.y) / 2)
    }
  };

  return {
    ...document,
    graph: {
      nodes: [...document.graph.nodes, insertedNode],
      edges: [
        ...document.graph.edges.filter((item) => item.id !== payload.edgeId),
        createEdgeDocument({
          id: `edge-${edge.source}-${insertedNode.id}`,
          source: edge.source,
          target: insertedNode.id,
          sourceHandle: edge.sourceHandle,
          targetHandle: null,
          containerId: edge.containerId
        }),
        createEdgeDocument({
          id: `edge-${insertedNode.id}-${edge.target}`,
          source: insertedNode.id,
          target: edge.target,
          sourceHandle: null,
          targetHandle: edge.targetHandle,
          containerId: edge.containerId
        })
      ]
    }
  };
}
