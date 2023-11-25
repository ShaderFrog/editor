import {
  Graph,
  EdgeType,
  makeEdge,
  BaseNode,
  outputNode,
  Edge,
  GraphNode,
  linkFromVertToFrag,
} from '@core/graph';
import { makeId } from '../../editor-util/id';
import { engine as playengine } from '@core/plugins/playcanvas';
import { expandUniformDataNodes } from '@editor/editor/components/useGraph';
import { AnySceneConfig } from '@editor/editor/components/Editor';
import { MenuItems } from '@editor/editor/components/flow/GraphContextMenu';

export enum Example {
  GLASS_FIREBALL = 'Glass Fireball',
  // GEMSTONE = 'Gemstone',
  LIVING_DIAMOND = 'Living Diamond',
  // TOON = 'Toon',
  DEFAULT = 'Mesh Physical Material',
}

const edgeFrom = (
  fromNode: BaseNode,
  toId: string,
  input: string,
  type?: EdgeType
) => makeEdge(makeId(), fromNode.id, toId, outFrom(fromNode), input, type);

const outFrom = (node: BaseNode) => node.outputs[0].id;

export const makeExampleGraph = (example: string): [Graph, AnySceneConfig] => {
  console.log('🌈 Making new graph!!');
  let newGraph: Graph;
  let previewObject: string;
  let bg: string = '';

  const physicalF = playengine.constructors.physical!(
    makeId(),
    'Physical',
    { x: 178, y: -103 },
    [],
    'fragment'
  );
  const physicalV = playengine.constructors.physical!(
    makeId(),
    'Physical',
    { x: 434, y: 130 },
    [],
    'vertex'
  );

  const outputF = outputNode(
    makeId(),
    'Output',
    { x: 434, y: -97 },
    'fragment'
  );
  const outputV = outputNode(makeId(), 'Output', { x: 434, y: 20 }, 'vertex');

  newGraph = {
    nodes: [physicalF, physicalV, outputF, outputV],
    edges: [
      linkFromVertToFrag(makeId(), physicalV.id, physicalF.id),
      edgeFrom(physicalF, outputF.id, 'filler_frogFragOut', 'fragment'),
      edgeFrom(physicalV, outputV.id, 'filler_gl_Position', 'vertex'),
    ],
  };
  previewObject = 'sphere';

  const defaultSceneConfig: AnySceneConfig = {
    bg: '',
    lights: '3point',
    previewObject,
  };
  return [newGraph, defaultSceneConfig];
};

export const menuItems: MenuItems = [
  [`PlayCanvas Materials`, [['Physical', 'physical']]],
];

export const addEngineNode = (
  nodeDataType: string,
  name: string,
  position: { x: number; y: number },
  newEdgeData?: Omit<Edge, 'id' | 'from'>,
  defaultValue?: any
): [Set<string>, Graph] | undefined => {
  const id = makeId();

  let newGns: GraphNode[] = [];
  let newEdges: Edge[] = [];
  const { phong, physical, toon } = playengine.constructors;

  const link = (frag: GraphNode, vert: GraphNode): [Edge[], GraphNode[]] => [
    [linkFromVertToFrag(makeId(), vert.id, frag.id)],
    [frag, vert],
  ];

  if (nodeDataType === 'phong') {
    [newEdges, newGns] = link(
      phong!(id, 'Phong', position, [], 'fragment'),
      phong!(makeId(), 'Phong', position, [], 'vertex')
    );
  } else if (nodeDataType === 'physical') {
    [newEdges, newGns] = link(
      physical!(id, 'Physical', position, [], 'fragment'),
      physical!(makeId(), 'Physical', position, [], 'vertex')
    );
  } else if (nodeDataType === 'toon') {
    [newEdges, newGns] = link(
      toon!(id, 'Toon', position, [], 'fragment'),
      toon!(makeId(), 'Toon', position, [], 'vertex')
    );
  }

  if (newGns.length) {
    if (newEdgeData) {
      newEdges = newEdges.concat([
        makeEdge(
          makeId(),
          id,
          newEdgeData.to,
          newEdgeData.output,
          newEdgeData.input,
          newEdgeData.type
        ),
      ]);
    }

    // Expand uniforms on new nodes automatically
    const originalNodes = new Set<string>(newGns.map((n) => n.id));
    return [
      originalNodes,
      expandUniformDataNodes({ nodes: newGns, edges: newEdges }),
    ];
  }
};
