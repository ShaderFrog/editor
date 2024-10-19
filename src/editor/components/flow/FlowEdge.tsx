import React from 'react';
import {
  type EdgeProps,
  getBezierPath,
  getStraightPath,
  // getEdgeCenter,
  // getMarkerEnd,
} from '@xyflow/react';
import { EdgeLink, EdgeType } from '@core/graph';
import { FlowEdgeOrLink } from './flow-helpers';

export type LinkEdgeData = {
  type: 'link';
};

// Type 'FlowEdgeData' does not satisfy the constraint 'Edge<Record<string, unknown>, string | undefined>'.
//   Type 'FlowEdgeData' is missing the following properties from type 'EdgeBase<Record<string, unknown>, string | undefined>': id, source, targetts(2344)

export type FlowEdgeData = {
  type?: EdgeType;
  ghost?: boolean;
};

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
