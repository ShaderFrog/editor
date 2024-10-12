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
} from '@core/graph';
import { threngine } from '@core/plugins/three/threngine';

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
