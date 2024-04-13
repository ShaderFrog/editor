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
        acc.edges.map((edge) => edge.from).includes(node.id)
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
  elements.edges = elements.edges.concat(outboundEdges);

  const edgesById = new Set<string>(elements.edges.map((edge) => edge.id));
  const nodesById = new Set<string>(Object.keys(elements.nodes));
  nodesById.add(linkedFragmentNode.id);
  elements.nodes[linkedFragmentNode.id] = linkedFragmentNode;
  if (linkedVertexNode) {
    nodesById.add(linkedVertexNode.id);
    elements.nodes[linkedVertexNode.id] = linkedVertexNode;
  }

  return {
    edgesById,
    nodesById,
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
  const nodesById = new Set<string>(Object.keys(elements.nodes));

  // Find outbound edges, which aren't found when filtering node from itself
  const outboundEdges = graph.edges.filter((edge) => nodesById.has(edge.from));
  elements.edges = elements.edges.concat(outboundEdges);

  const edgesById = new Set<string>(elements.edges.map((edge) => edge.id));
  nodesById.add(linkedFragmentNode.id);
  elements.nodes[linkedFragmentNode.id] = linkedFragmentNode;
  if (linkedVertexNode) {
    nodesById.add(linkedVertexNode.id);
    elements.nodes[linkedVertexNode.id] = linkedVertexNode;
  }

  const outputVertexNode = ensure(
    graph.nodes.find(
      (node) => node.type === 'output' && node.stage === 'vertex'
    ),
    'No output node found in graph!'
  );
  const edgeToVertexOutput = elements.edges.find(
    (edge) => edge.to === outputVertexNode?.id
  );

  return {
    edgesById,
    nodesById,
    edgeToVertexOutput,
    nodes: elements.nodes,
    edges: elements.edges,
    linkedFragmentNode,
    linkedVertexNode,
  };
};
