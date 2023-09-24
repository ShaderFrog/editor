import { NodePosition, sourceNode, numberUniformData } from '@core/graph';
import { uniformStrategy } from '@core/strategy';

const checkerboardF = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Checkerboard',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [
        numberUniformData('multiplicationFactor', '12.0', [2, 100], 1),
      ],
    },
    `
precision highp float;
precision highp int;
    
uniform float multiplicationFactor;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vec2 t = vUv * multiplicationFactor;
    vec3 p = vPosition * multiplicationFactor;
    vec3 color;

    if (mod(floor(t.x) + floor(t.y), 2.0) == 1.0) {
        color = vec3( 1.0, 1.0, 1.0 );
    } else {
        color = vec3( 0.0, 0.0, 0.0 );
    }
    gl_FragColor = vec4(color, 1.0);    
        
}
`,
    'fragment',
    'three'
  );

const checkerboardV = (
  id: string,
  nextStageNodeId: string,
  position: NodePosition
) =>
  sourceNode(
    id,
    'Checkerboard',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [],
    },
    `
precision highp float;
precision highp int;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;

varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    'vertex',
    'three',
    nextStageNodeId
  );

export { checkerboardF, checkerboardV };
