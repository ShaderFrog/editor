import { Graph } from '@core/graph-types';
import {
  colorNode,
  DataNode,
  numberNode,
  numberUniformData,
  textureNode,
  vectorUniformData,
} from '@core/nodes/data-nodes';
import { EdgeType, makeEdge } from '@core/nodes/edge';
import { outputNode } from '@core/nodes/engine-node';
import { fireFrag, fireVert } from '../../shaders/fireNode';
import {
  heatShaderFragmentNode,
  heatShaderVertexNode,
  variation1 as heatmapV1,
} from '../../shaders/heatmapShaderNode';
import purpleNoiseNode from '../../shaders/purpleNoiseNode';
import staticShaderNode, { variation1 } from '../../shaders/staticShaderNode';
import { makeId } from '../../editor-util/id';
import { checkerboardF, checkerboardV } from '../../shaders/checkboardNode';
import normalMapify from '../../shaders/normalmapifyNode';
import { convertNode } from '@core/engine';
import { engine as playengine } from '@core/plugins/playcanvas';
import { CoreNode } from '@core/nodes/core-node';
import { SourceNode } from '@core/nodes/code-nodes';

export enum Example {
  GLASS_FIREBALL = 'Glass Fireball',
  // GEMSTONE = 'Gemstone',
  LIVING_DIAMOND = 'Living Diamond',
  // TOON = 'Toon',
  DEFAULT = 'Mesh Physical Material',
}

const edgeFrom = (
  fromNode: CoreNode,
  toId: string,
  input: string,
  type?: EdgeType
) => makeEdge(makeId(), fromNode.id, toId, outFrom(fromNode), input, type);

const outFrom = (node: CoreNode) => node.outputs[0].name;

export const makeExampleGraph = (example: Example): [Graph, string, string] => {
  console.log('🌈 Making new graph!!');
  let newGraph: Graph;
  let previewObject: string;
  let bg: string = '';

  const physicalGroupId = makeId();
  const physicalF = playengine.constructors.physical(
    makeId(),
    'Physical',
    physicalGroupId,
    { x: 178, y: -103 },
    [],
    'fragment'
  );
  const physicalV = playengine.constructors.physical(
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

  return [newGraph, previewObject, bg];
};
