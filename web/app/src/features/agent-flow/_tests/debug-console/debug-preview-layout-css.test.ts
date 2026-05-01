import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

const debugMessageCss = readFileSync(
  join(
    process.cwd(),
    'src/features/agent-flow/components/debug-console/conversation/debug-message.css'
  ),
  'utf8'
);
const shellCss = readFileSync(
  join(
    process.cwd(),
    'src/features/agent-flow/components/editor/styles/shell.css'
  ),
  'utf8'
);

function cssBlock(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  return match?.[1] ?? '';
}

describe('debug preview responsive layout CSS', () => {
  test('does not lock preview rows or composer controls to fixed pixel columns', () => {
    expect(
      cssBlock(debugMessageCss, '.agent-flow-editor__debug-workflow-row')
    ).not.toMatch(/grid-template-columns:[^;]*\d+px/);
    expect(
      cssBlock(shellCss, '.agent-flow-editor__debug-composer-box')
    ).not.toMatch(/grid-template-columns:[^;]*\d+px/);
    expect(
      cssBlock(shellCss, '.agent-flow-editor__debug-feature-bar')
    ).not.toMatch(/grid-template-columns:[^;]*\d+px/);
  });

  test('keeps icon and submit affordances relative to text scale', () => {
    expect(
      cssBlock(debugMessageCss, '.agent-flow-editor__debug-workflow-node-icon')
    ).not.toMatch(/(?:width|height):\s*\d+px/);
    expect(
      cssBlock(shellCss, '.agent-flow-editor__debug-composer-submit')
    ).not.toMatch(/(?:width|height|min-width):\s*\d+px/);
    expect(
      cssBlock(shellCss, '.agent-flow-editor__debug-feature-icon')
    ).not.toMatch(/(?:width|height):\s*\d+px/);
  });
});
