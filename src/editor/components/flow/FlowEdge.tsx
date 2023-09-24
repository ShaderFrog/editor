import React from 'react';
import {
  EdgeProps,
  getBezierPath,
  // getEdgeCenter,
  // getMarkerEnd,
} from 'reactflow';
import { EdgeType } from '@core/graph';

export type LinkEdgeData = {
  type: 'link';
};

export type FlowEdgeData = {
  type?: EdgeType;
};

export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps<any>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  // const [edgeCenterX, edgeCenterY] = getEdgeCenter({
  //   sourceX,
  //   sourceY,
  //   targetX,
  //   targetY,
  // });

  // Note that className is an edge prop, not explicitly set here
  return (
    <>
      <path
        style={style}
        className="react-flow__edge-path-selector"
        d={edgePath}
        markerEnd={markerEnd}
        fillRule="evenodd"
      />
      <path
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        fillRule="evenodd"
      />
    </>
  );
}
