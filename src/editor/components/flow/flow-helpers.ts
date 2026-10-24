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
    // Prevent react-flow from ever deleting output nodes. Filtering the remove
    // change in onNodesChange isn't enough, because react-flow still passes the
    // node to onNodesDelete
    ...(node.type === 'output' ? { deletable: false } : {}),
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

export const updateFlowNodeOutput = <T extends FlowNode>(
  node: T,
  outputId: string,
  data: Partial<OutputNodeHandle>
): T => ({
  ...node,
  data: {
    ...node.data,
    outputs: node.data.outputs.map((output) =>
      output.id === outputId
        ? {
            ...output,
            ...data,
          }
        : output
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

export type HandleOffset = (
  nodeId: string,
  handleId: string | null | undefined,
  type: 'source' | 'target'
) => number | undefined;

type LayoutBlock = {
  // Node ids, top to bottom
  ids: string[];
  // Distance from each node's position to the top of the block
  offsets: Record<string, number>;
  width: number;
  height: number;
  column: number;
  x: number;
  top: number;
};

/**
 * Lay out the graph left to right, working backwards from the output nodes:
 *
 * - Linked vertex/fragment nodes (NEXT_STAGE links) are stacked as one block
 *   with the fragment node on top. The output nodes are stacked the same way.
 * - The output block is the rightmost column. Every other block's column is
 *   its longest distance from the outputs, so a node is always left of every
 *   node it feeds into.
 * - Columns are placed right to left. Each block tries to line up its output
 *   handles with the input handles it plugs into, and blocks that would
 *   overlap are pushed apart as a group centered on where they want to be.
 *
 * handleOffset gives a handle's y offset from its node's position, from
 * react-flow's measured handle bounds. topOverflow is how far a node draws
 * above its position (like the preview strip, which has a negative top
 * margin), so the layout leaves room for it.
 */
export const layoutFlowNodes = (
  nodes: FlowNode[],
  edges: FlowEdgeOrLink[],
  handleOffset: HandleOffset,
  topOverflow: Record<string, number> = {}
): Record<string, XYPosition> => {
  const STACK_GAP = 30;
  const NODE_GAP = 40;
  const COLUMN_GAP = 80;
  const byId = indexById(nodes);
  const width = (id: string) => byId[id].measured?.width || 200;
  const height = (id: string) => byId[id].measured?.height || 100;

  const blocks: LayoutBlock[] = [];
  const blockOf: Record<string, LayoutBlock> = {};
  const addBlock = (ids: string[]) => {
    const offsets: Record<string, number> = {};
    let h = 0;
    ids.forEach((id, i) => {
      h += (i > 0 ? STACK_GAP : 0) + (topOverflow[id] || 0);
      offsets[id] = h;
      h += height(id);
    });
    const block: LayoutBlock = {
      ids,
      offsets,
      width: Math.max(...ids.map(width)),
      height: h,
      column: -1,
      x: 0,
      top: 0,
    };
    blocks.push(block);
    ids.forEach((id) => (blockOf[id] = block));
    return block;
  };

  const outputIds = nodes
    .filter((node) => node.type === 'output')
    // Fragment output on top
    .sort(
      (a, b) =>
        Number(isFlowSourceNode(b) && b.data.stage === 'fragment') -
        Number(isFlowSourceNode(a) && a.data.stage === 'fragment')
    )
    .map((node) => node.id);
  const outputBlock = outputIds.length ? addBlock(outputIds) : undefined;

  // NEXT_STAGE links go from the vertex node to the fragment node
  edges.forEach((edge) => {
    if (
      edge.data?.type === EdgeLink.NEXT_STAGE &&
      byId[edge.source] &&
      byId[edge.target] &&
      !blockOf[edge.source] &&
      !blockOf[edge.target]
    ) {
      addBlock([edge.target, edge.source]);
    }
  });
  nodes.forEach((node) => {
    if (!blockOf[node.id]) {
      addBlock([node.id]);
    }
  });

  // Data edges between blocks, grouped by the block they come out of
  const dataEdges = edges.filter(
    (edge) =>
      edge.data?.type !== EdgeLink.NEXT_STAGE &&
      blockOf[edge.source] &&
      blockOf[edge.target] &&
      blockOf[edge.source] !== blockOf[edge.target]
  );
  const outgoing = new Map<LayoutBlock, FlowEdgeOrLink[]>();
  dataEdges.forEach((edge) => {
    const from = blockOf[edge.source];
    outgoing.set(from, [...(outgoing.get(from) || []), edge]);
  });

  // Column = longest path to the outputs. Blocks that don't feed into the
  // outputs end up in column 0 next to them, and get moved to the left below.
  const visiting = new Set<LayoutBlock>();
  const columnOf = (block: LayoutBlock): number => {
    if (block.column >= 0) {
      return block.column;
    }
    // Guard against cycles, which the graph shouldn't have
    if (visiting.has(block)) {
      return 0;
    }
    visiting.add(block);
    const consumers = (outgoing.get(block) || []).map(
      (edge) => blockOf[edge.target]
    );
    block.column =
      block === outputBlock
        ? 0
        : consumers.length
        ? Math.max(...consumers.map((c) => columnOf(c) + 1))
        : -1;
    visiting.delete(block);
    return block.column;
  };
  blocks.forEach(columnOf);

  // Unconnected blocks go in their own column on the far left
  const maxColumn = Math.max(0, ...blocks.map((b) => b.column));
  blocks.forEach((block) => {
    if (block.column < 0) {
      block.column = block === outputBlock ? 0 : maxColumn + 1;
    }
  });

  const columns: LayoutBlock[][] = [];
  blocks.forEach((block) => {
    (columns[block.column] = columns[block.column] || []).push(block);
  });

  const positionOf = (id: string): XYPosition => {
    const block = blockOf[id];
    return {
      x: block.x + (block.width - width(id)),
      y: block.top + block.offsets[id],
    };
  };

  // Place columns right to left. Blocks in a column are right aligned so edges
  // into the next column are short.
  let columnRight = 0;
  columns.forEach((column = []) => {
    const columnWidth = Math.max(0, ...column.map((b) => b.width));
    column.forEach((block) => (block.x = columnRight - block.width));
    columnRight -= columnWidth + COLUMN_GAP;

    // Where each block's top would line up its outputs with their targets,
    // which are all in columns that are already placed
    const desired = column.map((block) => {
      const tops = (outgoing.get(block) || []).map((edge) => {
        const targetY =
          positionOf(edge.target).y +
          (handleOffset(edge.target, edge.targetHandle, 'target') ??
            height(edge.target) / 2);
        const sourceY =
          block.offsets[edge.source] +
          (handleOffset(edge.source, edge.sourceHandle, 'source') ??
            height(edge.source) / 2);
        return targetY - sourceY;
      });
      return {
        block,
        // Unconnected blocks stack in their original order
        top: tops.length
          ? tops.reduce((a, b) => a + b, 0) / tops.length
          : byId[block.ids[0]].position.y,
      };
    });
    desired.sort((a, b) => a.top - b.top);

    // Resolve overlaps. Each cluster of touching blocks is centered on the
    // average of where its blocks want to be.
    type Cluster = {
      items: { block: LayoutBlock; offset: number }[];
      top: number;
      height: number;
      // Sum of each block's desired top minus its offset in the cluster
      sum: number;
    };
    const clusters: Cluster[] = [];
    desired.forEach(({ block, top }) => {
      let cluster: Cluster = {
        items: [{ block, offset: 0 }],
        top,
        height: block.height,
        sum: top,
      };
      while (clusters.length) {
        const prev = clusters[clusters.length - 1];
        if (prev.top + prev.height + NODE_GAP <= cluster.top) {
          break;
        }
        clusters.pop();
        const shift = prev.height + NODE_GAP;
        const items = [
          ...prev.items,
          ...cluster.items.map((item) => ({
            ...item,
            offset: item.offset + shift,
          })),
        ];
        const sum = prev.sum + cluster.sum - cluster.items.length * shift;
        cluster = {
          items,
          sum,
          top: sum / items.length,
          height: shift + cluster.height,
        };
      }
      clusters.push(cluster);
    });
    clusters.forEach((cluster) =>
      cluster.items.forEach(
        ({ block, offset }) => (block.top = cluster.top + offset)
      )
    );
  });

  return nodes.reduce<Record<string, XYPosition>>((acc, node) => {
    acc[node.id] = positionOf(node.id);
    return acc;
  }, {});
};
