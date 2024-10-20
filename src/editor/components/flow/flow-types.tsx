import { ShaderStage, GraphDataType, InputCategory } from '@core/graph';

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
} & CoreFlowNode;

export type FlowNodeData = FlowNodeSourceData | FlowNodeDataData;
