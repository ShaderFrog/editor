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
} from '@core/graph';
import { FlowEdgeData } from './FlowEdge';
import { flowOutput } from './FlowNode';
import { SHADERFROG_FLOW_EDGE_TYPE } from './FlowEditor';
import indexById from '@/core/util/indexByid';
import {
  FlowNodeData,
  FlowNodeDataData,
  FlowNodeSourceData,
  InputNodeHandle,
} from './flow-types';

export type FlowEdgeOrLink = XYFlowEdge<FlowEdgeData>;

export type FlowSourceNode = XyFlowNode<FlowNodeSourceData>;
export type FlowDataNode = XyFlowNode<FlowNodeDataData>;

export type FlowNode = FlowSourceNode | FlowDataNode;

export type FlowElement = FlowNode | FlowEdgeOrLink;

export type FlowElements = {
  nodes: FlowNode[];
  edges: FlowEdgeOrLink[];
};

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
      validTarget: false,
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
          inputs: toFlowInputs(node),
          outputs: node.outputs.map((o) => flowOutput(o.name, o.id)),
        },
      }
    : {
        ...base,
        data: {
          label: node.name,
          dataType: node.type,
          value: node.value,
          inputs: toFlowInputs(node),
          outputs: node.outputs.map((o) => flowOutput(o.name, o.id)),
          config: { ...node },
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

export const addGraphEdge = (graph: Graph, newEdge: GraphEdge): Graph => {
  const updatedEdges = graph.edges.filter(
    (edge) =>
      // Prevent one input handle from having multiple inputs
      !(
        (edge.to === newEdge.to && edge.input === newEdge.input)
        // Prevent one output handle from having multiple lines out
      ) && !(edge.from === newEdge.from && edge.output === newEdge.output)
  );

  const updatedGraph: Graph = {
    ...graph,
    edges: [...updatedEdges, newEdge],
  };
  return collapseBinaryGraphEdges(updatedGraph);
};

export const addFlowEdge = (
  flowElements: FlowElements,
  newEdge: XYFlowEdge
): FlowElements => {
  const updatedEdges = flowElements.edges.filter(
    (element) =>
      // Prevent one input handle from having multiple inputs
      !(
        (
          'targetHandle' in element &&
          element.targetHandle === newEdge.targetHandle &&
          element.target === newEdge.target
        )
        // Prevent one output handle from having multiple lines out
      ) &&
      !(
        'sourceHandle' in element &&
        element.sourceHandle === newEdge.sourceHandle &&
        element.source === newEdge.source
      )
  );

  const updatedFlowElements = setFlowNodeStages({
    ...flowElements,
    edges: [...updatedEdges, newEdge],
  });
  return collapseBinaryFlowEdges(updatedFlowElements);
};

/**
 * A binary node automatically adds/removes inputs based on how many edges
 * connect to it. If a binary node has edges to "a" and "b", removing the edge
 * to "a" means the edge to "b" needs to be moved down to the "a" one. This
 * function essentially groups edges by target node id, and resets the edge
 * target to its index. This doesn't feel good to do here but I don't have a
 * better idea at the moment. One reason the inputs to binary nodes are
 * automatically updated after compile, but the edges are updated here
 * at the editor layer, before compile. This also hard codes assumptions about
 * (binary) node inputs into the graph, namely they can't have blank inputs.
 */
export const collapseBinaryGraphEdges = (graph: Graph): Graph => {
  // Find all edges that flow into a binary node, grouped by the target node's
  // id, since we need to know the total number of edges per node first
  const binaryEdges = graph.edges.reduce<Record<string, GraphEdge[]>>(
    (acc, edge) => {
      const toNode = findNode(graph, edge.to);
      return toNode.type === NodeType.BINARY
        ? {
            ...acc,
            [toNode.id]: [...(acc[toNode.id] || []), edge],
          }
        : acc;
    },
    {}
  );

  // Then collapse them
  const updatedEdges = graph.edges.map((edge) => {
    return edge.to in binaryEdges
      ? {
          ...edge,
          input: alphabet.charAt(binaryEdges[edge.to].indexOf(edge)),
        }
      : edge;
  });
  return {
    ...graph,
    edges: updatedEdges,
  };
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
