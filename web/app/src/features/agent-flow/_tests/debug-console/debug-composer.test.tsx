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
    expect(screen.getByText('功能已开启')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText('和 Bot 聊天'), {
      key: 'Enter',
      code: 'Enter'
    });

    expect(handleSubmit).toHaveBeenCalledTimes(2);
  });
});
