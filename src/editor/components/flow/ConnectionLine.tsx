import cx from 'classnames';

import { ConnectionLineComponentProps, getBezierPath } from '@xyflow/react';
import { FlowSourceNode } from './flow-helpers';

const ConnectionLine = ({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionLineType,
  connectionLineStyle,
  fromNode,
  fromHandle,
}: ConnectionLineComponentProps) => {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });
  const n = fromNode as unknown as FlowSourceNode;

  return (
    <g className={cx('react-flow__edge animated', n?.data?.stage)}>
      <path className="react-flow__edge-path" d={edgePath} fillRule="evenodd" />
    </g>
  );
};

export default ConnectionLine;
