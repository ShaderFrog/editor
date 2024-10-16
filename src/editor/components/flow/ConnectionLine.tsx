import React from 'react';
import cx from 'classnames';

import {
  ConnectionLineComponentProps,
  getBezierPath,
  Position,
} from '@xyflow/react';

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

  return (
    <g className={cx('react-flow__edge animated', fromNode?.data?.stage)}>
      <path className="react-flow__edge-path" d={edgePath} fillRule="evenodd" />
    </g>
  );
};

export default ConnectionLine;
