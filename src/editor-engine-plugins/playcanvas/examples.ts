import {
  Graph,
  EdgeType,
  makeEdge,
  BaseNode,
  outputNode,
  Edge,
  GraphNode,
} from '@core/graph';
import { makeId } from '../../editor-util/id';
import { engine as playengine } from '@core/plugins/playcanvas';
import { expandUniformDataNodes } from '@editor/editor/components/useGraph';
import { MenuItems } from '@editor/editor/components/flow/FlowEditor';
import { AnySceneConfig } from '@editor/editor/components/Editor';

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

  const physicalGroupId = makeId();
  const physicalF = playengine.constructors.physical!(
    makeId(),
    'Physical',
    physicalGroupId,
    { x: 178, y: -103 },
    [],
    'fragment'
  );
  const physicalV = playengine.constructors.physical!(
    makeId(),
    'Physical',
    physicalGroupId,
    { x: 434, y: 130 },
    [],
    'vertex',
    physicalF.id
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
  const makeName = (type: string) => name || type;
  const id = makeId();
  const groupId = makeId();
  let newGns: GraphNode[] = [];

  if (nodeDataType === 'phong') {
    newGns = [
      playengine.constructors.phong!(
        id,
        'Phong',
        groupId,
        position,
        [],
        'fragment'
      ),
      playengine.constructors.phong!(
        makeId(),
        'Phong',
        groupId,
        position,
        [],
        'vertex',
        id
      ),
    ];
  } else if (nodeDataType === 'physical') {
    newGns = [
      playengine.constructors!.physical!(
        id,
        'Physical',
        groupId,
        position,
        [],
        'fragment'
      ),
      playengine.constructors!.physical!(
        makeId(),
        'Physical',
        groupId,
        position,
        [],
        'vertex',
        id
      ),
    ];
  } else if (nodeDataType === 'toon') {
    newGns = [
      playengine.constructors.toon!(
        id,
        'Toon',
        groupId,
        position,
        [],
        'fragment'
      ),
      playengine.constructors.toon!(
        makeId(),
        'Toon',
        groupId,
        position,
        [],
        'vertex',
        id
      ),
    ];
  }

  if (newGns.length) {
    let newGEs: Edge[] = newEdgeData
      ? [
          makeEdge(
            makeId(),
            id,
            newEdgeData.to,
            newEdgeData.output,
            newEdgeData.input,
            newEdgeData.type
          ),
        ]
      : [];

    // Expand uniforms on new nodes automatically
    const originalNodes = new Set<string>(newGns.map((n) => n.id));
    return [
      originalNodes,
      expandUniformDataNodes({ nodes: newGns, edges: newGEs }),
    ];
  }
};
