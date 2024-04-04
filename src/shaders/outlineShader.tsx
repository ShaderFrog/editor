import {
  NodePosition,
  sourceNode,
  numberUniformData,
  colorUniformData,
} from '@shaderfrog/core/graph';
import { uniformStrategy } from '@shaderfrog/core/strategy';

const outlineShaderF = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Outline',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [
        colorUniformData('color', ['1', '1', '1']),
        numberUniformData('start', '0'),
        numberUniformData('end', '1'),
        numberUniformData('alpha', '1'),
      ],
    },
    `
precision highp float;

uniform vec3 color;
uniform float start;
uniform float end;
uniform float alpha;

varying vec3 fPosition;
varying vec3 fNormal;

void main()
{
    vec3 normal = normalize(fNormal);
    vec3 eye = normalize(-fPosition.xyz);
    float rim = smoothstep(start, end, 1.0 - dot(normal, eye));
    gl_FragColor = vec4( clamp(rim, 0.0, 1.0) * alpha * color, 1.0 );
}
`,
    'fragment'
  );

const outlineShaderV = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Outline',
    position,
    { version: 2, preprocess: true, strategies: [], uniforms: [] },
    `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec2 uv2;

uniform mat3 normalMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

varying vec3 fNormal;
varying vec3 fPosition;
varying vec2 fUv;

void main()
{
    fNormal = normalize(normalMatrix * normal);
    vec4 pos = modelViewMatrix * vec4(position, 1.0);
    fPosition = pos.xyz;
    fUv = uv;
    gl_Position = projectionMatrix * pos;
}
`,
    'vertex',
    'three'
  );

export { outlineShaderF, outlineShaderV };
