import {
  NodePosition,
  sourceNode,
  numberUniformData,
  textureUniformData,
} from '@core/graph';
import { texture2DStrategy, uniformStrategy } from '@core/strategy';

const badTvFrag = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Bad TV',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy(), texture2DStrategy()],
      uniforms: [
        textureUniformData('image', 'bricks'),
        numberUniformData('distortion', '3.0', [0, 10]),
        numberUniformData('distortion2', '5.0', [0, 10]),
        numberUniformData('speed', '0.2', [-1, 1]),
        numberUniformData('rollSpeed', '0.1', [-1, 1]),
      ],
    },
    `/**
 * Adapted from:
 * @author Felix Turner / www.airtight.cc / @felixturner
 * MIT License: https://github.com/felixturner/bad-tv-shader/blob/6d279ebb6d0962c7d409d801424a3b7303efeec9/BadTVShader.js#L15
 */
precision highp float;
precision highp int;

uniform sampler2D image;
uniform float time;
uniform float distortion;
uniform float distortion2;
uniform float speed;
uniform float rollSpeed;
varying vec2 vUv;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}
float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
void main() {
    vec2 p = vUv;
    float ty = time*speed;
    float yt = p.y - ty;
    float offset = snoise(vec2(yt*3.0,0.0))*0.2;
    offset = offset*distortion * offset*distortion * offset;
    offset += snoise(vec2(yt*50.0,0.0))*distortion2*0.001;
    vec3 color = texture2D(
      image,
      vec2(fract(p.x + offset), fract(p.y-time*rollSpeed))
    ).rgb;
    gl_FragColor = vec4(
      color + sin(vUv.x * 100.0),
      1.0
    );
}
`,
    'fragment',
    'three'
  );

export { badTvFrag };
