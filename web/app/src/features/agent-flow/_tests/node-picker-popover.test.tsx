import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { NodePickerPopover } from '../components/node-picker/NodePickerPopover';

describe('NodePickerPopover', () => {
  test('lets mousedown bubble so the surrounding handle can start a connection drag', () => {
    const handleMouseDown = vi.fn();

    render(
      <div onMouseDown={handleMouseDown}>
        <NodePickerPopover
          ariaLabel="在 LLM 后新增节点"
          open={false}
          onOpenChange={vi.fn()}
          onPickNode={vi.fn()}
        />
      </div>
    );

    fireEvent.mouseDown(
      screen.getByRole('button', { name: '在 LLM 后新增节点' })
    );

    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });

  test('keeps click from bubbling to the surrounding node card', () => {
    const handleClick = vi.fn();

    render(
      <div onClick={handleClick}>
        <NodePickerPopover
          ariaLabel="在 LLM 后新增节点"
          open={false}
          onOpenChange={vi.fn()}
          onPickNode={vi.fn()}
        />
      </div>
    );

    fireEvent.click(
      screen.getByRole('button', { name: '在 LLM 后新增节点' })
    );

    expect(handleClick).not.toHaveBeenCalled();
  });
});
