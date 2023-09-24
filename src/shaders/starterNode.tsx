import { NodePosition, sourceNode } from '@core/graph';
import { uniformStrategy } from '@core/strategy';

const starterVertex = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Vertex',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [],
    },
    `precision highp float;
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

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

void main() {
    vNormal = normal;
    vUv = uv;
    vUv2 = uv2;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,
    'vertex',
    'three'
  );

export default starterVertex;
