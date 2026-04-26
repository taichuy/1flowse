import { describe, expect, test } from 'vitest';

import type { FlowDebugRunDetail } from '../../api/runtime';
import { extractAssistantOutputText } from '../../lib/debug-console/run-detail-mapper';

function baseDetail(): FlowDebugRunDetail {
  return {
    flow_run: {
      id: 'flow-run-1',
      application_id: 'app-1',
      flow_id: 'flow-1',
      draft_id: 'draft-1',
      compiled_plan_id: 'plan-1',
      run_mode: 'debug_flow_run',
      status: 'failed',
      target_node_id: null,
      input_payload: {},
      output_payload: {},
      error_payload: null,
      created_by: 'user-1',
      started_at: '2026-04-26T10:00:00Z',
      finished_at: '2026-04-26T10:00:01Z',
      created_at: '2026-04-26T10:00:00Z'
    },
    node_runs: [],
    checkpoints: [],
    callback_tasks: [],
    events: []
  };
}

describe('run detail mapper', () => {
  test('prefers provider error message over structural error kind text', () => {
    const detail = baseDetail();
    detail.flow_run.output_payload = {
      text: null,
      error: {
        error_kind: 'provider_invalid_response',
        message: 'upstream unavailable: provider_runtime',
        protocol: 'openai_compatible'
      }
    };

    expect(extractAssistantOutputText(detail)).toBe(
      'upstream unavailable: provider_runtime'
    );
  });

  test('prefers answer or text output before metadata strings', () => {
    const detail = baseDetail();
    detail.flow_run.status = 'succeeded';
    detail.flow_run.output_payload = {
      finish_reason: 'stop',
      answer: '退款政策摘要'
    };

    expect(extractAssistantOutputText(detail)).toBe('退款政策摘要');
  });
});
