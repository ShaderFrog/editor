import { type EdgeProps, getBezierPath, getStraightPath } from '@xyflow/react';

import { EdgeLink } from '@core/graph';
import { FlowEdgeData, FlowEdgeOrLink } from './flow-types';

const isDataEdge = (data: any): data is FlowEdgeData => {
  return (
    data?.type !== 'next_stage' &&
    data?.type !== 'vertex' &&
    data?.type !== 'fragment'
  );
};

export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}: EdgeProps<FlowEdgeOrLink>) {
  const isLink = data?.type === EdgeLink.NEXT_STAGE;
  const [edgePath] = (isLink ? getStraightPath : getBezierPath)({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const klass =
    (data?.ghost ? ' ghost' : '') + (isDataEdge(data) ? ' data' : '');
  // Note that className is an edge prop, not explicitly set here
  return (
    <>
      {isLink ? null : (
        <path
          style={style}
          className={`react-flow__edge-path-selector${klass}`}
          d={edgePath}
          markerEnd={markerEnd}
          fillRule="evenodd"
        />
      )}
      <path
        style={style}
        className={`react-flow__edge-path${klass}`}
        d={edgePath}
        markerEnd={markerEnd}
        fillRule="evenodd"
      />
    </>
  );
}
