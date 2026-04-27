import { describe, expect, test } from 'vitest';

import { mapRuntimeDebugStreamParts } from '../../lib/runtime-observability/debug-stream-parts';

describe('runtime debug stream parts', () => {
  test('keeps external opaque trust level visible', () => {
    const parts = mapRuntimeDebugStreamParts([
      {
        id: 'part-1',
        flow_run_id: 'run-1',
        item_id: null,
        span_id: null,
        part_type: 'data',
        status: 'created',
        trust_level: 'external_opaque',
        payload: { event_type: 'external_agent_opaque_boundary_marked' }
      }
    ]);

    expect(parts[0]).toMatchObject({
      id: 'part-1',
      type: 'data',
      trustLevel: 'external_opaque',
      isHostFact: false
    });
  });

  test('maps host text deltas to stream text parts', () => {
    const parts = mapRuntimeDebugStreamParts([
      {
        id: 'part-1',
        flow_run_id: 'run-1',
        item_id: null,
        span_id: 'span-1',
        part_type: 'text',
        status: 'created',
        trust_level: 'host_fact',
        payload: { payload: { delta: 'hello' } }
      }
    ]);

    expect(parts[0]).toMatchObject({
      text: 'hello',
      isHostFact: true
    });
  });
});
