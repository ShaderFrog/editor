import {
  Graph,
  colorNode,
  DataNode,
  numberNode,
  numberUniformData,
  textureNode,
  vectorUniformData,
  EdgeType,
  makeEdge,
  outputNode,
  CoreNode,
  SourceNode,
  Edge,
  GraphNode,
} from '@core/graph';
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
import { babylengine } from '@core/plugins/babylon/bablyengine';
import { MenuItems } from '@editor/editor/components/flow/FlowEditor';
import { expandUniformDataNodes } from '@editor/editor/components/useGraph';

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

const konvert = (node: SourceNode) =>
  convertNode(node, babylengine.importers.three);

export const makeExampleGraph = (example: string): [Graph, string, string] => {
  console.log('🌈 Making new graph!!');
  let newGraph: Graph;
  let previewObject: string;
  let bg: string = '';

  // @ts-ignore
  if (example === Example.GEMSTONE) {
    const outputF = outputNode(
      makeId(),
      'Output',
      { x: 434, y: -97 },
      'fragment'
    );
    const outputV = outputNode(makeId(), 'Output', { x: 434, y: 20 }, 'vertex');

    const physicalGroupId = makeId();
    const physicalF = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 178, y: -103 },
      [],
      'fragment'
    );
    const physicalV = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 434, y: 130 },
      [],
      'vertex',
      physicalF.id
    );
    const staticF = konvert(
      staticShaderNode(makeId(), { x: -196, y: -303 }, variation1)
    );
    const heatmap = konvert(
      heatShaderFragmentNode(makeId(), { x: -478, y: 12 }, heatmapV1)
    );
    const heatmapV = konvert(
      heatShaderVertexNode(makeId(), heatmap.id, {
        x: -478,
        y: -194,
      })
    );

    const normaled = normalMapify(makeId(), { x: -178, y: -149 });
    const normalStrength = numberNode(
      makeId(),
      'Normal Strength',
      { x: -482, y: -105 },
      '1..0'
    );

    const color = colorNode(makeId(), 'Color', { x: -187, y: -413 }, [
      '1.0',
      '0.75',
      '1.0',
    ]);
    const roughness = numberNode(
      makeId(),
      'Roughness',
      { x: -187, y: 54 },
      '0.37'
    );
    // const transmission = numberNode(
    //   makeId(),
    //   'Transmission',
    //   { x: -187, y: 153 },
    //   '0.5'
    // );
    // const thickness = numberNode(
    //   makeId(),
    //   'Thickness',
    //   { x: -187, y: 240 },
    //   '1.0'
    // );
    // const ior = numberNode(makeId(), 'Ior', { x: -187, y: 328 }, '2.0');

    newGraph = {
      nodes: [
        color,
        normaled,
        normalStrength,
        roughness,
        // transmission,
        // thickness,
        // ior,
        staticF,
        heatmap,
        heatmapV,
        outputF,
        outputV,
        physicalF,
        physicalV,
      ],
      edges: [
        edgeFrom(physicalF, outputF.id, 'filler_frogFragOut', 'fragment'),
        edgeFrom(physicalV, outputV.id, 'filler_gl_Position', 'vertex'),
        edgeFrom(staticF, physicalF.id, 'property_albedoTexture', 'fragment'),
        edgeFrom(color, physicalF.id, 'property_albedoColor', 'fragment'),
        edgeFrom(roughness, physicalF.id, 'property_roughness', 'fragment'),

        // edgeFrom(
        //   transmission,
        //   physicalF.id,
        //   'property_transmission',
        //   'fragment'
        // ),
        // edgeFrom(thickness, physicalF.id, 'property_thickness', 'fragment'),
        // edgeFrom(ior, physicalF.id, 'property_ior', 'fragment'),
        edgeFrom(
          normalStrength,
          normaled.id,
          'uniform_normal_strength',
          'fragment'
        ),
        edgeFrom(heatmap, normaled.id, 'filler_normal_map', 'fragment'),
        edgeFrom(normaled, physicalF.id, 'property_bumpTexture', 'fragment'),
      ],
    };
    previewObject = 'icosahedron';
    bg = 'cityCourtYard';
    // @ts-ignore
  } else if (example === Example.TOON) {
    const outputF = outputNode(
      makeId(),
      'Output',
      { x: 434, y: -97 },
      'fragment'
    );
    const outputV = outputNode(makeId(), 'Output', { x: 434, y: 16 }, 'vertex');

    const toonGroupId = makeId();
    const toonF = babylengine.constructors.toon!(
      makeId(),
      'Toon',
      toonGroupId,
      { x: 178, y: -103 },
      [],
      'fragment'
    );
    const toonV = babylengine.constructors.toon!(
      makeId(),
      'Toon',
      toonGroupId,
      { x: 434, y: 130 },
      [],
      'vertex',
      toonF.id
    );
    const properties: [string, DataNode][] = [
      [
        'albedoColor',
        colorNode(makeId(), 'Color', { x: -153, y: -268 }, ['0', '0.7', '0']),
      ],
      // [
      //   'gradientMap',
      //   textureNode(
      //     makeId(),
      //     'Gradient Map',
      //     { x: -153, y: -160 },
      //     'threeTone'
      //   ),
      // ],
      [
        'bumpTexture',
        textureNode(
          makeId(),
          'Bump Texture',
          { x: -153, y: -50 },
          'brickNormal'
        ),
      ],
    ];

    newGraph = {
      nodes: [outputF, outputV, toonF, toonV, ...properties.map(([, p]) => p)],
      edges: [
        edgeFrom(toonF, outputF.id, 'filler_frogFragOut', 'fragment'),
        edgeFrom(toonV, outputV.id, 'filler_gl_Position', 'vertex'),
        ...properties.map(([name, prop]) =>
          edgeFrom(prop, toonF.id, `property_${name}`, prop.type)
        ),
      ],
    };
    previewObject = 'torusknot';
    bg = '';
  } else if (example === Example.DEFAULT) {
    const outputF = outputNode(
      makeId(),
      'Output',
      { x: 434, y: -97 },
      'fragment'
    );
    const outputV = outputNode(makeId(), 'Output', { x: 434, y: 16 }, 'vertex');

    const physicalGroupId = makeId();
    const physicalF = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 178, y: -103 },
      [],
      'fragment'
    );
    const physicalV = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 434, y: 130 },
      [],
      'vertex',
      physicalF.id
    );

    const checkerboardf = checkerboardF(makeId(), { x: -162, y: -105 });
    const checkerboardv = checkerboardV(makeId(), checkerboardf.id, {
      x: -162,
      y: 43,
    });
    newGraph = {
      nodes: [
        outputF,
        outputV,
        physicalF,
        physicalV,
        checkerboardf,
        checkerboardv,
      ],
      edges: [
        edgeFrom(physicalF, outputF.id, 'filler_frogFragOut', 'fragment'),
        edgeFrom(physicalV, outputV.id, 'filler_gl_Position', 'vertex'),
        edgeFrom(
          checkerboardf,
          physicalF.id,
          'property_albedoTexture',
          'fragment'
        ),
      ],
    };
    previewObject = 'sphere';
    bg = '';
  } else if (example === Example.LIVING_DIAMOND) {
    const outputF = outputNode(
      makeId(),
      'Output',
      { x: 434, y: -97 },
      'fragment'
    );
    const outputV = outputNode(makeId(), 'Output', { x: 434, y: 16 }, 'vertex');

    const nMap = konvert(normalMapify(makeId(), { x: -185, y: 507 }));

    const purpleNoise = konvert(
      purpleNoiseNode(makeId(), { x: -512, y: 434 }, [
        numberUniformData(
          'speed',
          babylengine.name === 'babylon' ? '1.0' : '0.2'
        ),
        numberUniformData('brightnessX', '1.0'),
        numberUniformData('permutations', '10'),
        numberUniformData('iterations', '2'),
        vectorUniformData(
          'uvScale',
          babylengine.name === 'babylon' ? ['0.1', '0.1'] : ['0.9', '0.9']
        ),
        vectorUniformData('color1', ['0', '1', '1']),
        vectorUniformData('color2', ['1', '0', '1']),
        vectorUniformData('color3', ['1', '1', '0']),
      ])
    );

    const properties = [
      numberNode(makeId(), 'Metallic', { x: -185, y: -110 }, '0.1'),
      numberNode(makeId(), 'Roughness', { x: -185, y: 0 }, '0.055'),
      numberNode(makeId(), 'Alpha', { x: -185, y: 110 }, '0.2'),
    ];
    const ior = numberNode(
      makeId(),
      'Index Of Refraction',
      { x: -110, y: 62 },
      '1.05'
    );

    const physicalGroupId = makeId();
    const physicalF = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 178, y: -103 },
      [],
      'fragment'
    );
    const physicalV = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 434, y: 130 },
      [],
      'vertex',
      physicalF.id
    );

    newGraph = {
      nodes: [
        outputF,
        outputV,
        physicalF,
        physicalV,
        purpleNoise,
        nMap,
        ior,
        ...properties,
      ],
      edges: [
        edgeFrom(physicalF, outputF.id, 'filler_frogFragOut', 'fragment'),
        edgeFrom(physicalV, outputV.id, 'filler_gl_Position', 'vertex'),
        edgeFrom(purpleNoise, nMap.id, 'filler_normal_map', 'fragment'),
        edgeFrom(nMap, physicalF.id, 'property_bumpTexture', 'fragment'),
        edgeFrom(ior, physicalF.id, `property_indexOfRefraction`, 'number'),
        ...properties.map((prop) =>
          edgeFrom(
            prop,
            physicalF.id,
            `property_${prop.name.toLowerCase()}`,
            prop.type
          )
        ),
      ],
    };
    previewObject = 'icosahedron';
    bg = 'cityCourtYard';
  } else if (example === Example.GLASS_FIREBALL) {
    const outputF = outputNode(
      makeId(),
      'Output',
      { x: 434, y: -97 },
      'fragment'
    );
    const outputV = outputNode(makeId(), 'Output', { x: 434, y: 20 }, 'vertex');

    const physicalGroupId = makeId();
    const physicalF = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 178, y: -103 },
      [],
      'fragment'
    );
    const physicalV = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 434, y: 130 },
      [],
      'vertex',
      physicalF.id
    );
    const fireF = konvert(fireFrag(makeId(), { x: -88, y: -120 }));
    const fireV = konvert(
      fireVert(makeId(), fireF.id, { x: -88, y: 610 }, [
        numberUniformData('fireSpeed', '0.768'),
        numberUniformData('pulseHeight', '0.0'),
        numberUniformData('displacementHeight', '0.481'),
        numberUniformData('turbulenceDetail', '0.907'),
      ])
    );

    const roughness = numberNode(
      makeId(),
      'Roughness',
      { x: -103, y: -16 },
      '0.1'
    );
    const metalness = numberNode(
      makeId(),
      'Metalness',
      { x: -103, y: 62 },
      '0.09'
    );
    const alpha = numberNode(makeId(), 'Alpha', { x: -103, y: 62 }, '0.0');
    const ior = numberNode(
      makeId(),
      'Index Of Refraction',
      { x: -110, y: 62 },
      '1.05'
    );

    newGraph = {
      nodes: [
        alpha,
        ior,
        roughness,
        metalness,
        fireF,
        fireV,
        outputF,
        outputV,
        physicalF,
        physicalV,
      ],
      edges: [
        edgeFrom(physicalF, outputF.id, 'filler_frogFragOut', 'fragment'),
        edgeFrom(physicalV, outputV.id, 'filler_gl_Position', 'vertex'),
        edgeFrom(fireF, physicalF.id, 'property_albedoTexture', 'fragment'),
        edgeFrom(roughness, physicalF.id, 'property_roughness', 'fragment'),
        edgeFrom(metalness, physicalF.id, 'property_metallic', 'fragment'),
        edgeFrom(alpha, physicalF.id, 'property_alpha', 'fragment'),
        edgeFrom(ior, physicalF.id, 'property_indexOfRefraction', 'fragment'),
        edgeFrom(fireV, physicalV.id, 'filler_position', 'vertex'),
      ],
    };
    previewObject = 'sphere';
    bg = 'cityCourtYard';
  } else {
    const outputF = outputNode(
      makeId(),
      'Output',
      { x: 434, y: -97 },
      'fragment'
    );
    const outputV = outputNode(makeId(), 'Output', { x: 434, y: 20 }, 'vertex');

    const physicalGroupId = makeId();
    const physicalF = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 178, y: -103 },
      [],
      'fragment'
    );
    const physicalV = babylengine.constructors.physical!(
      makeId(),
      'Physical',
      physicalGroupId,
      { x: 434, y: 130 },
      [],
      'vertex',
      physicalF.id
    );

    const purpleNoise = konvert(purpleNoiseNode(makeId(), { x: -100, y: 0 }));

    newGraph = {
      nodes: [purpleNoise, outputF, outputV, physicalF, physicalV],
      edges: [
        edgeFrom(physicalF, outputF.id, 'filler_frogFragOut', 'fragment'),
        edgeFrom(physicalV, outputV.id, 'filler_gl_Position', 'vertex'),
        edgeFrom(
          purpleNoise,
          physicalF.id,
          'property_albedoTexture',
          'fragment'
        ),
      ],
    };
    previewObject = 'torusknot';
  }

  return [newGraph, previewObject, bg];
};

export const menuItems: MenuItems = [
  [`Babylon.js Materials`, [['Physical', 'physical']]],
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
      babylengine.constructors.phong!(
        id,
        'Phong',
        groupId,
        position,
        [],
        'fragment'
      ),
      babylengine.constructors.phong!(
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
      babylengine.constructors!.physical!(
        id,
        'Physical',
        groupId,
        position,
        [],
        'fragment'
      ),
      babylengine.constructors!.physical!(
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
      babylengine.constructors.toon!(
        id,
        'Toon',
        groupId,
        position,
        [],
        'fragment'
      ),
      babylengine.constructors.toon!(
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
