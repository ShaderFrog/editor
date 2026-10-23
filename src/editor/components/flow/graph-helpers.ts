import indexById from '@core/util/indexByid';
import {
  Graph,
  GraphNode,
  findLinkedNode,
  SourceNode,
  Predicates,
  filterGraphFromNode,
  consSearchResult,
  mergeSearchResults,
  isDataNode,
  isSourceNode,
  collectConnectedNodes,
  EdgeLink,
  NodeType,
} from '@core/graph';
import { ensure } from '@core/util/ensure';

/**
 * Find this node and all its data inputs and edges
 */
export const findNodeAndData = (graph: Graph, startNode: GraphNode) => {
  // Find the current active node and its next stage node if present
  let linkedFragmentNode = startNode;
  const maybeOtherNode = findLinkedNode(graph, linkedFragmentNode.id);

  // If we selected a vertex node, swap it to the linked fragment node. If
  // there is no linked fragment node I think this whole thing will break
  if (
    maybeOtherNode &&
    (linkedFragmentNode as SourceNode)?.stage === 'vertex'
  ) {
    linkedFragmentNode = maybeOtherNode;
  }

  const linkedVertexNode = findLinkedNode(graph, linkedFragmentNode.id);

  const finder = (
    startNode: GraphNode,
    linkedNode?: GraphNode
  ): Predicates => ({
    node: (node, inputEdges, acc) => {
      return (
        // Stop at the linked node if present, since the other finder does that.
        isDataNode(node) &&
        node.id !== linkedNode?.id &&
        Object.values(acc.edges)
          .map((edge) => edge.from)
          .includes(node.id)
      );
    },
    edge: (input, toNode, inputEdge, fromNode, acc) => {
      return !!(toNode.id === startNode.id || toNode.id in acc.nodes);
    },
  });

  // Find anything downstream from this node
  const currentElements = filterGraphFromNode(
    graph,
    linkedFragmentNode,
    finder(linkedFragmentNode)
  );

  // And its friend, if present
  const otherElements = linkedVertexNode
    ? filterGraphFromNode(
        graph,
        linkedVertexNode,
        finder(linkedVertexNode, linkedFragmentNode)
      )
    : consSearchResult();

  const elements = mergeSearchResults(currentElements, otherElements);

  // Find outbound edges, which aren't found when filtering node from itself
  const outboundEdges = graph.edges.filter(
    (edge) =>
      edge.from === linkedFragmentNode.id || edge.from === linkedVertexNode?.id
  );
  elements.edges = elements.edges = {
    ...elements.edges,
    ...indexById(outboundEdges),
  };

  const edgeIds = new Set(Object.keys(elements.edges));
  const nodeIds = new Set(Object.keys(elements.nodes));
  nodeIds.add(linkedFragmentNode.id);
  elements.nodes[linkedFragmentNode.id] = linkedFragmentNode;
  if (linkedVertexNode) {
    nodeIds.add(linkedVertexNode.id);
    elements.nodes[linkedVertexNode.id] = linkedVertexNode;
  }

  return {
    edgeIds,
    nodeIds,
    nodes: elements.nodes,
    edges: elements.edges,
    linkedFragmentNode,
    linkedVertexNode,
  };
};

/**
 * Return everything downstream of this node, including:
 * - Any linked node, and its tree
 * - Edges outbound from this node and any linked node
 * - If there's a linked vertex node that plugs into the output node, return
 *   it for convenience, so consumers can know to replace that output link if
 *   present
 */
export const findNodeTree = (graph: Graph, startNode: GraphNode) => {
  // Find the current active node and its next stage node if present
  let linkedFragmentNode = startNode;
  const maybeOtherNode = findLinkedNode(graph, linkedFragmentNode.id);

  // If we selected a vertex node, swap it to the linked fragment node. If
  // there is no linked fragment node I think this whole thing will break
  if (
    maybeOtherNode &&
    (linkedFragmentNode as SourceNode)?.stage === 'vertex'
  ) {
    linkedFragmentNode = maybeOtherNode;
  }

  const linkedVertexNode = findLinkedNode(graph, linkedFragmentNode.id);

  const finder: Predicates = {
    node: () => true,
    edge: () => true,
  };

  // Find anything downstream from this node
  const currentElements = filterGraphFromNode(
    graph,
    linkedFragmentNode,
    finder
  );

  // And its friend, if present
  const otherElements = linkedVertexNode
    ? filterGraphFromNode(graph, linkedVertexNode, finder)
    : consSearchResult();

  const elements = mergeSearchResults(currentElements, otherElements);
  const nodeIds = new Set(Object.keys(elements.nodes));

  // Find outbound edges, which aren't found when filtering node from itself
  const outboundEdges = graph.edges.filter((edge) => nodeIds.has(edge.from));
  elements.edges = {
    ...elements.edges,
    ...indexById(outboundEdges),
  };

  const edgeIds = new Set(Object.keys(elements.edges));
  nodeIds.add(linkedFragmentNode.id);
  elements.nodes[linkedFragmentNode.id] = linkedFragmentNode;
  if (linkedVertexNode) {
    nodeIds.add(linkedVertexNode.id);
    elements.nodes[linkedVertexNode.id] = linkedVertexNode;
  }

  const outputVertexNode = ensure(
    graph.nodes.find(
      (node) => node.type === 'output' && node.stage === 'vertex'
    ),
    'No output node found in graph!'
  );
  const edgeToVertexOutput = Object.values(elements.edges).find(
    (edge) => edge.to === outputVertexNode?.id
  );

  return {
    edgeIds,
    nodeIds,
    edgeToVertexOutput,
    nodes: elements.nodes,
    edges: elements.edges,
    linkedFragmentNode,
    linkedVertexNode,
  };
};

/**
 * Can this node be rendered on its own as a preview? Only fragment code nodes
 * have an output that can be plugged into the fragment output.
 */
export const isPreviewableNode = (node: GraphNode): node is SourceNode =>
  isSourceNode(node) &&
  node.type !== NodeType.OUTPUT &&
  node.stage === 'fragment' &&
  node.outputs.length > 0;

/**
 * Build a standalone graph that renders what a single node looks like: the
 * node and everything that flows into it, plugged into the graph's output
 * nodes. Used for node thumbnails.
 *
 * Nodes are shallow copied because computing context reassigns node.inputs.
 */
export const extractNodePreviewGraph = (
  graph: Graph,
  nodeId: string
): Graph | undefined => {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const outputFrag = graph.nodes.find(
    (n) => n.type === NodeType.OUTPUT && (n as SourceNode).stage === 'fragment'
  );
  const outputVert = graph.nodes.find(
    (n) => n.type === NodeType.OUTPUT && (n as SourceNode).stage === 'vertex'
  );
  if (!node || !outputFrag || !outputVert || !isPreviewableNode(node)) {
    return;
  }

  // This includes linked vertex nodes and everything that flows into them
  const upstream = collectConnectedNodes(graph, node);

  // Something has to compute gl_Position. Prefer this node's own vertex
  // shader, then any vertex shader linked to an upstream fragment node, and
  // fall back to whatever feeds the vertex output in the full graph.
  const linkedVertexIds = new Set(
    graph.edges
      .filter((e) => e.type === EdgeLink.NEXT_STAGE && e.to in upstream)
      .map((e) => e.from)
  );
  const ownVertex = findLinkedNode(graph, node.id);
  let vertexSource: GraphNode | undefined =
    ownVertex && ownVertex.id in upstream
      ? ownVertex
      : Object.values(upstream).find((n) => linkedVertexIds.has(n.id));

  let vertexChain: Record<string, GraphNode> = {};
  if (!vertexSource) {
    const mainVertEdge = graph.edges.find(
      (e) => e.to === outputVert.id && e.type !== EdgeLink.NEXT_STAGE
    );
    vertexSource = graph.nodes.find((n) => n.id === mainVertEdge?.from);
    vertexChain = vertexSource
      ? collectConnectedNodes(graph, vertexSource)
      : {};
  }

  const nodeIds = { ...upstream, ...vertexChain };
  // Reuse the input ids of the existing output edges in case of legacy graphs
  const outputInput = (outputId: string, fallback: string) =>
    graph.edges.find((e) => e.to === outputId && e.type !== EdgeLink.NEXT_STAGE)
      ?.input || fallback;
  const edges = graph.edges.filter((e) => e.from in nodeIds && e.to in nodeIds);

  edges.push({
    id: `preview_frag_${node.id}`,
    from: node.id,
    to: outputFrag.id,
    output: node.outputs[0].id,
    input: outputInput(outputFrag.id, 'filler_frogFragOut'),
    type: 'fragment',
  });

  if (vertexSource?.outputs.length) {
    edges.push({
      id: `preview_vert_${node.id}`,
      from: vertexSource.id,
      to: outputVert.id,
      output: vertexSource.outputs[0].id,
      input: outputInput(outputVert.id, 'filler_gl_Position'),
      type: 'vertex',
    });
  }

  return {
    nodes: [...Object.values(nodeIds), outputFrag, outputVert].map((n) => ({
      ...n,
    })),
    edges,
  };
};
