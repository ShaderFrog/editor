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
import { makeId } from '../../util/id';
import { engine as playengine } from '@core/plugins/playcanvas';
import { expandUniformDataNodes } from '@editor-components/useGraph';
import { MenuItem } from '@editor-components/ContextMenu';
import { AnySceneConfig } from '@editor-components/editorTypes';
import { AddEngineNode } from '@editor/editor/editor-types';

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

export const menuItems: MenuItem[] = [
  {
    display: `PlayCanvas Materials`,
    children: [{ display: 'Physical', value: 'physical' }],
  },
];

export const addEngineNode: AddEngineNode = (
  nodeDataType,
  name,
  position,
  defaultValue
) => {
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
    // Expand uniforms on new nodes automatically
    const originalNodes = new Set<string>(newGns.map((n) => n.id));
    return [
      originalNodes,
      expandUniformDataNodes({ nodes: newGns, edges: newEdges }),
      id,
    ];
  }
};
