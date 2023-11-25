import groupBy from 'lodash.groupby';
import {
  Graph,
  GraphNode,
  findLinkedNode,
  SourceNode,
  Predicates,
  filterGraphFromNode,
  consSearchResult,
  mergeSearchResults,
} from '@core/graph';

export const findNodeAndDependencies = (graph: Graph, startNode: GraphNode) => {
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
        node.id !== linkedNode?.id &&
        acc.edges.map((edge) => edge.from).includes(node.id)
      );
    },
    edge: (input, toNode, inputEdge, fromNode, acc) => {
      return !!(toNode.id === startNode.id || toNode.id in acc.nodes);
    },
  });

  // Remove anything downstream from this node
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

  const edgesById = groupBy(elements.edges, 'id');
  const nodesById = groupBy(elements.nodes, 'id');

  return {
    edgesById,
    nodesById,
    nodes: elements.nodes,
    edges: elements.edges,
    linkedFragmentNode,
    linkedVertexNode,
  };
};
