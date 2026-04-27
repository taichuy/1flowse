import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { DebugComposer } from '../../components/debug-console/conversation/DebugComposer';

describe('DebugComposer', () => {
  test('submits by button click and Enter key', () => {
    const handleSubmit = vi.fn();

    render(
      <DebugComposer
        disabled={false}
        submitting={false}
        value="你好？"
        onChange={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '发送调试消息' }));
    fireEvent.keyDown(screen.getByPlaceholderText('输入内容...'), {
      key: 'Enter',
      code: 'Enter'
    });

    expect(handleSubmit).toHaveBeenCalledTimes(2);
  });
});
