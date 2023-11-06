import {
  Graph,
  GraphNode,
  Edge as GraphEdge,
  makeEdge,
  arrayNode,
  colorNode,
  numberNode,
  samplerCubeNode,
  textureNode,
  Vector2,
  Vector3,
  Vector4,
  vectorNode,
  compileSource,
} from '@core/graph';
import { Engine, EngineContext } from '@core/engine';
import { UICompileGraphResult } from '../uICompileGraphResult';

import { makeId } from '../../editor-util/id';
import { addNode, multiplyNode, sourceNode } from '@core/graph';
import { texture2DStrategy, uniformStrategy } from '@core/strategy';

const compileGraphAsync = async (
  graph: Graph,
  engine: Engine,
  ctx: EngineContext
): Promise<UICompileGraphResult> =>
  new Promise((resolve, reject) => {
    setTimeout(async () => {
      console.warn('Compiling!', graph, 'for nodes', ctx.nodes);

      const allStart = performance.now();

      try {
        const {
          compileResult,
          fragmentResult,
          vertexResult,
          dataNodes,
          dataInputs,
        } = await compileSource(graph, engine, ctx);

        resolve({
          compileMs: (performance.now() - allStart).toFixed(3),
          compileResult,
          fragmentResult,
          vertexResult,
          dataNodes,
          dataInputs,
          graph,
        });
      } catch (err) {
        return reject(err);
      }
    }, 10);
  });

const expandUniformDataNodes = (graph: Graph): Graph =>
  graph.nodes.reduce<Graph>((updated, node) => {
    if ('config' in node && node.config.uniforms) {
      const newNodes = node.config.uniforms.reduce<[GraphNode[], GraphEdge[]]>(
        (acc, uniform, index) => {
          const position = {
            x: node.position.x - 250,
            y: node.position.y - 200 + index * 100,
          };
          let n;
          switch (uniform.type) {
            case 'texture': {
              n = textureNode(makeId(), uniform.name, position, uniform.value);
              break;
            }
            case 'number': {
              n = numberNode(makeId(), uniform.name, position, uniform.value, {
                range: uniform.range,
                stepper: uniform.stepper,
              });
              break;
            }
            case 'vector2': {
              n = vectorNode(
                makeId(),
                uniform.name,
                position,
                uniform.value as Vector2
              );
              break;
            }
            case 'vector3': {
              n = vectorNode(
                makeId(),
                uniform.name,
                position,
                uniform.value as Vector3
              );
              break;
            }
            case 'vector4': {
              n = vectorNode(
                makeId(),
                uniform.name,
                position,
                uniform.value as Vector4
              );
              break;
            }
            case 'rgb': {
              n = colorNode(
                makeId(),
                uniform.name,
                position,
                uniform.value as Vector3
              );
              break;
            }
            case 'samplerCube': {
              n = samplerCubeNode(
                makeId(),
                uniform.name,
                position,
                uniform.value as string
              );
              break;
            }
            case 'rgba': {
              n = colorNode(
                makeId(),
                uniform.name,
                position,
                uniform.value as Vector4
              );
              break;
            }
          }
          return [
            [...acc[0], n],
            [
              ...acc[1],
              makeEdge(
                makeId(),
                n.id,
                node.id,
                'out',
                `uniform_${uniform.name}`,
                uniform.type
              ),
            ],
          ];
        },
        [[], []]
      );

      return {
        nodes: [...updated.nodes, ...newNodes[0]],
        edges: [...updated.edges, ...newNodes[1]],
      };
    }
    return updated;
  }, graph);

const createGraphNode = (
  nodeDataType: string,
  name: string,
  position: { x: number; y: number },
  engine: Engine,
  newEdgeData?: Omit<GraphEdge, 'id' | 'from'>,
  defaultValue?: any
): [Set<string>, Graph] => {
  const makeName = (type: string) => name || type;
  const id = makeId();
  const groupId = makeId();
  let newGns: GraphNode[];

  if (nodeDataType === 'number') {
    newGns = [
      numberNode(
        id,
        makeName('number'),
        position,
        defaultValue === undefined || defaultValue === null ? '1' : defaultValue
      ),
    ];
  } else if (nodeDataType === 'texture') {
    newGns = [
      textureNode(
        id,
        makeName('texture'),
        position,
        defaultValue || 'grayscale-noise'
      ),
    ];
  } else if (nodeDataType === 'vector2') {
    newGns = [
      vectorNode(id, makeName('vec2'), position, defaultValue || ['1', '1']),
    ];
  } else if (nodeDataType === 'array') {
    newGns = [
      arrayNode(id, makeName('array'), position, defaultValue || ['1', '1']),
    ];
  } else if (nodeDataType === 'vector3') {
    newGns = [
      vectorNode(
        id,
        makeName('vec3'),
        position,
        defaultValue || ['1', '1', '1']
      ),
    ];
  } else if (nodeDataType === 'vector4') {
    newGns = [
      vectorNode(
        id,
        makeName('vec4'),
        position,
        defaultValue || ['1', '1', '1', '1']
      ),
    ];
  } else if (nodeDataType === 'rgb') {
    newGns = [
      colorNode(id, makeName('rgb'), position, defaultValue || ['1', '1', '1']),
    ];
  } else if (nodeDataType === 'rgba') {
    newGns = [
      colorNode(
        id,
        makeName('rgba'),
        position,
        defaultValue || ['1', '1', '1', '1']
      ),
    ];
  } else if (nodeDataType === 'multiply') {
    newGns = [multiplyNode(id, position)];
  } else if (nodeDataType === 'add') {
    newGns = [addNode(id, position)];
  } else if (nodeDataType === 'fragmentandvertex') {
    const fragment = sourceNode(
      makeId(),
      'Source Code ' + id,
      position,
      {
        version: 2,
        preprocess: true,
        strategies: [uniformStrategy(), texture2DStrategy()],
        uniforms: [],
      },
      `void main() {
gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
}`,
      'fragment',
      engine.name
    );
    newGns = [
      fragment,
      sourceNode(
        makeId(),
        'Source Code ' + id,
        position,
        {
          version: 2,
          preprocess: true,
          strategies: [uniformStrategy()],
          uniforms: [],
        },
        `void main() {
  gl_Position = vec4(1.0);
}`,
        'vertex',
        engine.name,
        fragment.id
      ),
    ];
  } else if (nodeDataType === 'fragment' || nodeDataType === 'vertex') {
    newGns = [
      sourceNode(
        makeId(),
        'Source Code ' + id,
        position,
        {
          version: 2,
          preprocess: true,
          strategies: [uniformStrategy(), texture2DStrategy()],
          uniforms: [],
        },
        nodeDataType === 'fragment'
          ? `void main() {
  gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
}`
          : `void main() {
  gl_Position = vec4(1.0);
}`,
        nodeDataType,
        engine.name
      ),
    ];
  } else if (nodeDataType === 'samplerCube') {
    newGns = [
      samplerCubeNode(
        id,
        makeName('samplerCube'),
        position,
        'warehouseEnvTexture'
      ),
    ];
  } else {
    throw new Error(
      `Could not create node: Unknown node type "${nodeDataType}'"`
    );
  }

  let newGEs: GraphEdge[] = newEdgeData
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
};

export { createGraphNode, expandUniformDataNodes, compileGraphAsync };
