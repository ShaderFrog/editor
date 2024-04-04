import { NodePosition, sourceNode } from '@shaderfrog/core/graph';
import { uniformStrategy } from '@shaderfrog/core/strategy';

export const variation0 = `
precision highp float;
precision highp int;
uniform float time;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

void main() {
    gl_FragColor = vec4( clamp(tan(vNormal*time*time), vec3(0.0), vec3(1.0)), 1.0 );
}
`;

export const variation1 = `
precision highp float;
precision highp int;
uniform float time;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

const float PI = 3.14159;

void main() {
    vec2 scaledUv = sin(vUv * PI);
    gl_FragColor = vec4(
        clamp(
            1.0 + vNormal * vec3(scaledUv, -scaledUv.y) * (1.0 + vec3(viewMatrix[0])),
            vec3(0.0),
            vec3(1.0)
        ),
        1.0
    );
}
`;

const staticShaderNode = (
  id: string,
  position: NodePosition,
  source = variation0
) =>
  sourceNode(
    id,
    'Static Shader',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [],
    },
    source,
    'fragment',
    'three'
  );

export default staticShaderNode;
