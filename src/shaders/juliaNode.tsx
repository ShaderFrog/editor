import {
  NodePosition,
  sourceNode,
  numberUniformData,
  vectorUniformData,
} from '@core/graph';
import { uniformStrategy } from '@core/strategy';

const juliaF = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Julia',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [
        vectorUniformData('start', ['-0.2307', '0.69230']),
        numberUniformData('iter', '60'),
        vectorUniformData('color', ['0.9', '0.6', '0.43']),
      ],
    },
    `precision highp float;
precision highp int;

uniform vec2 start;
uniform int iter;
uniform vec3 color;
uniform float time;
varying vec2 vUv;

void main() {
    vec2 z;
    z.x = 3.0 * (vUv.x - .5);
    z.y = 3.0 * (vUv.y - .5);
    
    int y = 0;
    for (int i = 0; i < 100; i++) {
        y++;
        float x = (z.x * z.x - z.y * z.y) + start.x;
        float y = (z.x * z.y + z.x * z.y) + start.y;
        
        if ((x * x + y * y) > 10.0) {
            break;
        }
        z.x = x;
        z.y = y;
    }
    
    float val = float(y) / float(iter);
    gl_FragColor = vec4(color * val, 1.0) + 0.1;
}
`,
    'fragment',
    'three'
  );

const juliaV = (id: string, nextStageNodeId: string, position: NodePosition) =>
  sourceNode(
    id,
    'Julia',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [],
    },
    `precision highp float;
    precision highp int;
    
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    varying vec2 vUv;
    
    attribute vec3 position;
    attribute vec2 uv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
    'vertex',
    'three',
    nextStageNodeId
  );

export { juliaF, juliaV };
