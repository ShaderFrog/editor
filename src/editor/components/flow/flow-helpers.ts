import {
  Node as XyFlowNode,
  Edge as XYFlowEdge,
  XYPosition,
} from '@xyflow/react';

import {
  isSourceNode,
  findNode,
  Graph,
  GraphNode,
  ShaderStage,
  MAGIC_OUTPUT_STMTS,
  NodeType,
  NodeInput,
  alphabet,
  Edge as GraphEdge,
  EdgeLink,
  GraphDataType,
} from '@core/graph';
import { OutputNodeHandle, SHADERFROG_FLOW_EDGE_TYPE } from './flow-types';
import indexById from '@core/util/indexByid';
import {
  FlowNode,
  FlowSourceNode,
  FlowDataNode,
  FlowNodeData,
  FlowEdgeData,
  FlowNodeSourceData,
  InputNodeHandle,
  FlowElements,
  FlowElement,
  FlowEdgeOrLink,
} from './flow-types';

export const isFlowSourceNode = (node: FlowNode): node is FlowSourceNode =>
  'stage' in node.data;

export const isFlowDataNode = (node: FlowNode): node is FlowDataNode =>
  'value' in node.data;

// Determine the stage of a node (vertex/fragment) by recursively looking at
// the nodes that feed into this one, until we find one that has a stage set
export const findInputStage = (
  ids: Record<string, FlowNode>,
  edgesByTarget: Record<string, XYFlowEdge<FlowEdgeData>[]>,
  node: FlowNode
): ShaderStage | undefined => {
  let nodeData = node.data as FlowNodeSourceData;
  return (
    (!nodeData?.biStage && nodeData?.stage) ||
    (edgesByTarget[node.id] || []).reduce<ShaderStage | undefined>(
      (found, edge) => {
        const type = edge.data?.type;
        return (
          found ||
          (type === 'fragment' || type === 'vertex' ? type : false) ||
          findInputStage(ids, edgesByTarget, ids[edge.source])
        );
      },
      undefined
    )
  );
};

export const setFlowNodeCategories = (
  flowElements: FlowElements,
  dataNodes: Record<string, GraphNode>
): FlowElements => ({
  ...flowElements,
  nodes: flowElements.nodes.map((node) => {
    if (node.id in dataNodes) {
      const n = node as FlowDataNode;
      return {
        ...n,
        data: {
          ...n.data,
          category: 'code',
        },
      };
    }
    return node;
  }),
});

// Some nodes, like add, can be used for either fragment or vertex stage. When
// we connect edges in the graph, update it to figure out which stage we should
// set the add node to based on inputs to the node.
export const setFlowNodeStages = (flowElements: FlowElements): FlowElements => {
  const targets = flowElements.edges.reduce<Record<string, XYFlowEdge[]>>(
    (acc, edge) => ({
      ...acc,
      [edge.target]: [...(acc[edge.target] || []), edge],
    }),
    {}
  );
  const nodesById = indexById(flowElements.nodes);

  const updatedSides: Record<string, FlowElement> = {};
  // Update the node stages by looking at their inputs
  return {
    nodes: flowElements.nodes.map((node) => {
      if (!node.data || !('biStage' in node.data)) {
        return node;
      }
      if (!node.data.biStage && node.data.stage) {
        return node;
      }
      return (updatedSides[node.id] = {
        ...node,
        data: {
          ...node.data,
          stage: findInputStage(nodesById, targets, node),
        },
      });
    }),
    // Set the stage for edges connected to nodes whose stage changed
    edges: flowElements.edges.map((element) => {
      if (!('source' in element) || !(element.source in updatedSides)) {
        return element;
      }
      const { stage } = updatedSides[element.source].data as FlowNodeSourceData;
      return {
        ...element,
        // className: element.data?.type === 'data' ? element.data.type : stage,
        data: {
          ...element.data,
          stage,
        },
      };
    }),
  };
};

export const toFlowInputs = (node: GraphNode): InputNodeHandle[] =>
  (node.inputs || [])
    .filter(({ displayName }) => displayName !== MAGIC_OUTPUT_STMTS)
    .map((input) => ({
      id: input.id,
      name: input.displayName,
      type: input.type,
      dataType: input.dataType,
      baked: input.baked,
      bakeable: input.bakeable,
      validTarget: null,
      connected: false,
      accepts: input.accepts,
    }));

export const graphNodeToFlowNode = (
  node: GraphNode,
  position: XYPosition
): FlowNode => {
  const base = {
    id: node.id,
    type: node.type,
    position,
  };
  return isSourceNode(node)
    ? {
        ...base,
        data: {
          label: node.name,
          stage: node.stage,
          active: false,
          biStage: node.biStage || false,
          engine: node.engine || false,
          inputs: toFlowInputs(node),
          outputs: node.outputs.map((o) =>
            flowOutput(o.name, o.id, o.dataType)
          ),
          display: node.display,
        },
      }
    : {
        ...base,
        data: {
          label: node.name,
          dataType: node.type,
          value: node.value,
          inputs: toFlowInputs(node),
          outputs: node.outputs.map((o) =>
            flowOutput(o.name, o.id, o.dataType)
          ),
          config: { ...node },
          display: node.display,
        },
      };
};

export const flowEdgeToGraphEdge = (
  edge: XYFlowEdge<FlowEdgeData>
): GraphEdge => ({
  id: edge.id,
  from: edge.source,
  to: edge.target,
  output: 'out',
  input: edge.targetHandle as string,
  type: edge.data?.type,
});

export const graphEdgeToFlowEdge = (
  edge: GraphEdge
): XYFlowEdge<FlowEdgeData> => ({
  id: edge.id,
  source: edge.from,
  sourceHandle: edge.output,
  targetHandle: edge.input,
  target: edge.to,
  data: { type: edge.type },
  className: edge.type,
  focusable: edge.type !== EdgeLink.NEXT_STAGE,
  // Not the edge type, the flow edge component type that renders this edge
  type: SHADERFROG_FLOW_EDGE_TYPE,
});

export const updateGraphNodeInput = <T extends GraphNode>(
  node: T,
  inputId: string,
  data: Partial<NodeInput>
): T => ({
  ...node,
  inputs: node.inputs.map((input) =>
    input.id === inputId
      ? {
          ...input,
          ...data,
        }
      : input
  ),
});

export const updateGraphNode = (
  graph: Graph,
  nodeId: string,
  data: Partial<GraphNode>
): Graph => ({
  ...graph,
  nodes: graph.nodes.map((node) => {
    if (node.id === nodeId) {
      const updated = { ...node, ...data };
      return updated as GraphNode;
    }
    return node;
  }),
});

export const updateFlowEdgeData = (
  edge: FlowEdgeOrLink,
  data: Partial<FlowEdgeData>
): FlowEdgeOrLink => ({
  ...edge,
  data: {
    ...edge.data,
    ...data,
  },
});

export const updateFlowNode = <T extends FlowNode>(
  node: T,
  data: Partial<T>
): T => ({
  ...node,
  ...data,
});

export const updateFlowNodeData = <T extends FlowNode>(
  node: T,
  data: Partial<T['data']>
): T => ({
  ...node,
  data: {
    ...node.data,
    ...data,
  },
});

export const updateFlowNodesData = (
  nodes: FlowDataNode[],
  nodeId: string,
  data: Partial<FlowNodeData>
): FlowDataNode[] =>
  nodes.map((node) =>
    node.id === nodeId ? updateFlowNodeData(node, data) : node
  );

export const updateFlowNodeConfig = (
  node: FlowDataNode,
  config: Record<string, any>
): FlowDataNode => ({
  ...node,
  data: {
    ...node.data,
    config: {
      ...node.data.config,
      ...config,
    },
  },
});

export const updateFlowNodesConfig = (
  nodes: FlowDataNode[],
  nodeId: string,
  config: Record<string, any>
): FlowDataNode[] =>
  nodes.map((node) =>
    node.id === nodeId ? updateFlowNodeConfig(node, config) : node
  );

export const updateFlowNodeInput = <T extends FlowNode>(
  node: T,
  inputId: string,
  data: Partial<InputNodeHandle>
): T => ({
  ...node,
  data: {
    ...node.data,
    inputs: node.data.inputs.map((input) =>
      input.id === inputId
        ? {
            ...input,
            ...data,
          }
        : input
    ),
  },
});

/**
 * Adds an edge to the graph and enforces graph edge business logic rules:
 * - Makes sure "binary" (add/multiply) nodes edges are collapsed
 * - Makes sure two edges can't flow into the same input.
 * See also @core#addGraphEdge
 */
export const addFlowEdge = (
  flowElements: FlowElements,
  newEdge: XYFlowEdge
): FlowElements => {
  const updatedEdges = flowElements.edges.filter(
    (element) =>
      // Prevent one input handle from having multiple inputs
      !(
        'targetHandle' in element &&
        element.targetHandle === newEdge.targetHandle &&
        element.target === newEdge.target
      )
  );

  const updatedFlowElements = setFlowNodeStages({
    ...flowElements,
    edges: [...updatedEdges, newEdge],
  });
  return collapseBinaryFlowEdges(updatedFlowElements);
};

export const collapseBinaryFlowEdges = (
  flowGraph: FlowElements
): FlowElements => {
  // Find all edges that flow into a binary node, grouped by the target node's
  // id, since we need to know the total number of edges per node first
  const binaryEdges = flowGraph.edges.reduce<Record<string, FlowEdgeOrLink[]>>(
    (acc, edge) => {
      const toNode = flowGraph.nodes.find(({ id }) => id === edge.target);
      return toNode?.type === NodeType.BINARY
        ? {
            ...acc,
            [toNode.id]: [...(acc[toNode.id] || []), edge],
          }
        : acc;
    },
    {}
  );

  // Then collapse them
  const updatedEdges = flowGraph.edges.map((edge) => {
    return edge.target in binaryEdges
      ? {
          ...edge,
          targetHandle: alphabet.charAt(binaryEdges[edge.target].indexOf(edge)),
        }
      : edge;
  });
  return {
    ...flowGraph,
    edges: updatedEdges,
  };
};

export const markInputsConnected = (graph: FlowElements): FlowElements => {
  const byTarget = graph.edges.reduce(
    (acc, edge) => ({
      ...acc,
      [`${edge.source}_${edge.sourceHandle}`]: true,
      [`${edge.target}_${edge.targetHandle}`]: true,
    }),
    {}
  );

  const connected = graph.nodes.map((node) => {
    return updateFlowNodeData(node, {
      ...node.data,
      inputs: node.data.inputs.map((input) => ({
        ...input,
        connected: `${node.id}_${input.id}` in byTarget,
      })),
      outputs: node.data.outputs.map((output) => ({
        ...output,
        connected: `${node.id}_${output.id}` in byTarget,
      })),
    });
  });

  return {
    ...graph,
    nodes: connected,
  };
};

export const graphToFlowGraph = (graph: Graph): FlowElements => {
  const nodes = graph.nodes.map((node) =>
    graphNodeToFlowNode(node, node.position)
  );

  const edges: FlowEdgeOrLink[] = graph.edges.map(graphEdgeToFlowEdge);

  return markInputsConnected(setFlowNodeStages({ nodes, edges }));
};

export const updateGraphFromFlowGraph = (
  graph: Graph,
  elements: FlowElements
): Graph => {
  const byId = indexById(elements.nodes);
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      position: byId[n.id].position,
    })),
  };
};

export const flowOutput = (
  name: string,
  id?: string,
  dataType?: GraphDataType
): OutputNodeHandle => ({
  connected: false,
  validTarget: null,
  dataType,
  id: id || name,
  name,
});
