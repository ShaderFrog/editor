import { NodePosition, sourceNode, numberUniformData } from '@core/graph';
import { uniformStrategy } from '@core/strategy';

const whiteNoiseNode = (
  id: string,
  position: NodePosition,
  source = `precision highp float;
precision highp int;

uniform float speed;
uniform float scale;
uniform float time;
varying vec2 vUv;

float random2d(vec2 uv) {
  return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float grain = random2d(vec2(sin(vUv * (scale * 100.0)) / 999999.9) * time * speed);
  vec3 color = vec3(grain);
  gl_FragColor = vec4(color, 1.0);
}
`
) =>
  sourceNode(
    id,
    'White Noise',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [
        numberUniformData('scale', '10000.0', [0, 10000]),
        numberUniformData('speed', '1.0', [0, 10]),
      ],
    },
    source,
    'fragment',
    'three'
  );

export default whiteNoiseNode;
