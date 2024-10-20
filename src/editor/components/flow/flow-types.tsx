import { Node as XyFlowNode, Edge as XYFlowEdge } from '@xyflow/react';

// Attempt to abstract out types to avoid circular dependencies

import {
  EdgeType,
  ShaderStage,
  GraphDataType,
  InputCategory,
} from '@core/graph';

export const SHADERFROG_FLOW_EDGE_TYPE = 'special';

export type LinkEdgeData = {
  type: 'link';
};

export type FlowEdgeData = {
  type?: EdgeType;
  ghost?: boolean;
};

export type FlowEdgeOrLink = XYFlowEdge<FlowEdgeData>;

export type FlowSourceNode = XyFlowNode<FlowNodeSourceData>;
export type FlowDataNode = XyFlowNode<FlowNodeDataData>;

export type FlowNode = FlowSourceNode | FlowDataNode;

export type FlowElement = FlowNode | FlowEdgeOrLink;

export type FlowElements = {
  nodes: FlowNode[];
  edges: FlowEdgeOrLink[];
};

export type InputNodeHandle = {
  name: string;
  id: string;
  type: string;
  dataType?: GraphDataType;
  validTarget: boolean;
  connected: boolean;
  accepts?: InputCategory[];
  baked?: boolean;
  bakeable: boolean;
};

export type OutputNodeHandle = {
  validTarget: boolean;
  connected: boolean;
  category?: InputCategory;
  id: string;
  name: string;
};

export type CoreFlowNode = {
  label: string;
  ghost?: boolean;
  outputs: OutputNodeHandle[];
  inputs: InputNodeHandle[];
};
export type FlowNodeDataData = {
  dataType: GraphDataType;
  value: any;
  config: Record<string, any>;
} & CoreFlowNode;

export type FlowNodeSourceData = {
  stage?: ShaderStage;
  category?: InputCategory;
  active: boolean;
  /**
   * Whether or not this node can be used for both shader fragment and vertex
   */
  biStage: boolean;
  glslError?: boolean;
  engine?: boolean;
} & CoreFlowNode;

export type FlowNodeData = FlowNodeSourceData | FlowNodeDataData;
