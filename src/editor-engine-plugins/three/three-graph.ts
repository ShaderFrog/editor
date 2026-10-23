import {
  mangleVar,
  SamplerCubeNode,
  TextureNode,
  evaluateNode,
  Graph,
  findLinkedNode,
  SourceNode,
  IndexedDataInputs,
  Grindex,
  CompileResult,
  computeGrindex,
} from '@core/graph';
import { EngineContext } from '@core/engine';
import {
  createFrogMaterialResult,
  threngine,
} from '@core/plugins/three/threngine';
import { DoubleSide, FrontSide, Texture } from 'three';

export const extractProperties = (
  graph: Graph,
  grindex: Grindex,
  dataInputs: IndexedDataInputs,
  getTexture: (fromNode: TextureNode | SamplerCubeNode) => any
) =>
  Object.entries(dataInputs || {}).reduce<{
    uniforms: Record<string, { value: any }>;
    properties: Record<string, any>;
  }>(
    ({ uniforms, properties }, [nodeId, inputs]) => {
      const node = grindex.nodes[nodeId];

      if (!node) {
        console.warn(
          'Graph dataInputs referenced nodeId',
          nodeId,
          'which was not present.'
        );
        return { uniforms, properties };
      }
      const updatedUniforms: typeof uniforms = {};
      const updatedProperties: typeof properties = {};

      inputs.forEach((input) => {
        const edge = grindex.edgesByNode[nodeId]?.to.edgesByInput?.[input.id];
        if (edge) {
          const fromNode = grindex.nodes[edge.from];

          let value;
          try {
            value = evaluateNode(threngine, graph, fromNode);
          } catch (err) {
            console.warn('Tried to evaluate a non-data node!', {
              err,
              dataInputs: dataInputs,
            });
          }
          let newValue = value;
          if (fromNode.type === 'texture') {
            // This is instantiation of initial value
            newValue = getTexture(fromNode as TextureNode);
          } else if (fromNode.type === 'samplerCube') {
            newValue = getTexture(fromNode as SamplerCubeNode);
          }

          // TODO: This doesn't work for engine variables because
          // those aren't suffixed
          const name = mangleVar(
            input.displayName,
            threngine,
            node,
            findLinkedNode(graph, node.id) as SourceNode
          );

          if (input.property) {
            updatedProperties[input.property] = newValue;
          } else {
            updatedUniforms[name] = { value: newValue };
          }
        }
      });
      return {
        uniforms: { ...uniforms, ...updatedUniforms },
        properties: { ...properties, ...updatedProperties },
      };
    },
    {
      uniforms: {},
      properties: {},
    }
  );

/**
 * Create the material to render a compiled graph with, including its uniforms,
 * properties, and the scene config settings that apply to materials.
 */
export const createSceneMaterial = (
  compileResult: CompileResult,
  ctx: EngineContext,
  graph: Graph,
  getTexture: (fromNode: TextureNode | SamplerCubeNode) => any,
  // The three scene config, which has wireframe, doubleSide, transparent
  sceneConfig: Record<string, any>,
  environment: Texture | null
) => {
  const material = createFrogMaterialResult(compileResult, ctx, graph);

  // Note this is setting the uniforms of the shader at creation time. The
  // uniforms are also updated every frame in the useThree() loop.
  const { uniforms, properties } = extractProperties(
    graph,
    computeGrindex(graph),
    compileResult.dataInputs,
    getTexture
  );

  // This prevents a deluge of warnings from three on the constructor saying
  // that each of these properties is not a property of the material
  Object.entries(properties).forEach(([key, value]) => {
    // @ts-ignore
    material[key] = value;
  });

  // FrogMaterial (MeshPhysical/Phong/Toon + onBeforeCompile): user uniforms
  // must be merged into shader.uniforms inside onBeforeCompile so Three's
  // WebGL program knows about them. Chain after FrogMaterial's own OBC.
  const existingOBC = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    existingOBC(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    material.userData.shader = shader;
  };

  // Copy the sceneConfig properties onto the material. For now this means
  // that toggling doubleSide etc creates a new material. Also I don't know if
  // these properties require the core material in threngine to get
  // re-created. I did it here because there's not currently a way to pass the
  // scene config into the core graph for compiling.
  // @ts-expect-error no wireframe
  material.wireframe = sceneConfig.wireframe;
  material.side = sceneConfig.doubleSide ? DoubleSide : FrontSide;
  material.transparent = !!sceneConfig.transparent;

  // The envMap needs to be set on the material. Note scene.envMap globally
  // applies to all materials that don't override it. Setting on the
  // material is required to work for the envMapIntensity property to work.
  if (environment) {
    // @ts-expect-error no envmap
    material.envMap = environment;
  }

  return { material, uniforms, properties };
};
