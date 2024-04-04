import {
  NodePosition,
  sourceNode,
  numberUniformData,
} from '@shaderfrog/core/graph';
import {
  namedAttributeStrategy,
  uniformStrategy,
} from '@shaderfrog/core/strategy';

const sinCosVertWarp = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Simple Vertex Warp',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy(), namedAttributeStrategy('position')],
      uniforms: [
        numberUniformData('height', '1'),
        numberUniformData('frequency', '10.0', [0, 100]),
      ],
    },
    `
precision highp float;
precision highp int;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

uniform float height;
uniform float frequency;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;

varying vec2 vUv;
varying vec3 vPosition;

uniform float time;

vec3 warp(vec3 position) {
  return vec3(
    0.0,
    height * 0.1 * cos(position.y * frequency * 2.0 + time * 4.5),
    height * 0.1 * sin(position.z * frequency + time * 3.5)
  ) * normal;
}

// http://lolengine.net/blog/2013/09/21/picking-orthogonal-vector-combing-coconuts
vec3 orthogonal(vec3 v) {
  return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0)
  : vec3(0.0, -v.z, v.y));
}

void main() {
    vUv = uv;
    vPosition = position;

    vec3 displacedPosition = position + warp(position);

    float offset = 0.5;
    vec3 tangent = orthogonal(normal);
    vec3 bitangent = normalize(cross(normal, tangent));
    vec3 neighbour1 = position + tangent * offset;
    vec3 neighbour2 = position + bitangent * offset;
    vec3 displacedNeighbour1 = neighbour1 + normal * warp(neighbour1);
    vec3 displacedNeighbour2 = neighbour2 + normal * warp(neighbour2);

    // https://i.ya-webdesign.com/images/vector-normals-tangent-16.png
    vec3 displacedTangent = displacedNeighbour1 - displacedPosition;
    vec3 displacedBitangent = displacedNeighbour2 - displacedPosition;

    // https://upload.wikimedia.org/wikipedia/commons/d/d2/Right_hand_rule_cross_product.svg
    vec3 displacedNormal = normalMatrix * normalize(cross(displacedTangent, displacedBitangent));
    vNormal = displacedNormal;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
    
`,
    'vertex',
    'three'
  );

export default sinCosVertWarp;
