import type { FlowNodeType } from '@1flowse/flow-schema';

import { NodePickerPopover } from '../node-picker/NodePickerPopover';

export function EdgeInsertButton({
  open,
  onOpenChange,
  onPickNode
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickNode: (nodeType: FlowNodeType) => void;
}) {
  return (
    <NodePickerPopover
      ariaLabel="在此连线上新增节点"
      open={open}
      onOpenChange={onOpenChange}
      onPickNode={onPickNode}
    />
  );
}
