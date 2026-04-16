import { forwardRef } from 'react';
import { Handle, type HandleProps } from '@xyflow/react';

export const CanvasHandle = forwardRef<HTMLDivElement, HandleProps>(
  function CanvasHandle(props, ref) {
    return <Handle ref={ref} {...props} />;
  }
);
