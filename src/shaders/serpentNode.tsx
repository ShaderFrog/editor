import {
  NodePosition,
  sourceNode,
  numberUniformData,
  textureUniformData,
} from '@shaderfrog/core/graph';
import { texture2DStrategy, uniformStrategy } from '@shaderfrog/core/strategy';

const serpentF = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Serpent',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy(), texture2DStrategy()],
      uniforms: [
        numberUniformData('lineWidth', '0.5'),
        numberUniformData('tiling', '4.9'),
        numberUniformData('rotationSpeed', '0.23'),
        textureUniformData('image1', 'brick'),
        textureUniformData('image2', 'pebbles'),
      ],
    },
    `precision highp float;
precision highp int;

// Default THREE.js uniforms available to both fragment and vertex shader
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

// Default uniforms provided by ShaderFrog.
uniform vec3 cameraPosition;
uniform float time;

uniform sampler2D image1;
uniform sampler2D image2;
uniform float lineWidth;

// Example varyings passed from the vertex shader
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

uniform float rotationSpeed;
uniform float tiling;

vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
        cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
        cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
}

float reverse(float val) {
    return 1.0 + -1.0 * val;
}

void main() {
    float tile = tiling + 2.0 * sin(time * 0.5);
    vec2 posTurn = tile*(rotateUV(vUv, time * rotationSpeed * 2.0));
    vec2 negTurn = tile*(rotateUV(vUv, time * -rotationSpeed * 2.0));

    float x = fract(fract(posTurn.x * 2.0) + fract(posTurn.y * 2.0));
    float shadow = clamp(x * reverse(x) * 3.0, 0.0, 1.0);
    float pos = fract(fract(posTurn.x) + fract(posTurn.y));
    float val = step(pos, lineWidth);

    vec3 col;
    if(val > 0.0) {
        col = texture2D(image1, posTurn - 0.4 * time).rgb * (shadow + 0.4);
    } else {
        col = texture2D(image2, negTurn - 0.4 * time).rgb + shadow * 0.2 * shadow;
    }

    gl_FragColor = vec4( col, 1.0 );
}    
`,
    'fragment',
    'three'
  );

const serpentV = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Serpent',
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

// Default THREE.js uniforms available to both fragment and vertex shader
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

// Default uniforms provided by ShaderFrog.
uniform vec3 cameraPosition;
uniform float time;

// Default attributes provided by THREE.js. Attributes are only available in the
// vertex shader. You can pass them to the fragment shader using varyings
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;

// Examples of variables passed from vertex to fragment shader
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vUv2;

void main() {

    // To pass variables to the fragment shader, you assign them here in the
    // main function. Traditionally you name the varying with vAttributeName
    vNormal = normal;
    vUv = uv;
    vUv2 = uv2;
    vPosition = position;

    // This sets the position of the vertex in 3d space. The correct math is
    // provided below to take into account camera and object data.
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}
`,
    'vertex',
    'three'
  );

export { serpentF, serpentV };
