import React from 'react';
import {
  EdgeProps,
  getBezierPath,
  getStraightPath,
  // getEdgeCenter,
  // getMarkerEnd,
} from 'reactflow';
import { EdgeLink, EdgeType } from '@core/graph';

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
  data,
  style = {},
  markerEnd,
}: EdgeProps<any>) {
  const isLink = data?.type === EdgeLink.NEXT_STAGE;
  const [edgePath] = (isLink ? getStraightPath : getBezierPath)({
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
      {isLink ? null : (
        <path
          style={style}
          className="react-flow__edge-path-selector"
          d={edgePath}
          markerEnd={markerEnd}
          fillRule="evenodd"
        />
      )}
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
