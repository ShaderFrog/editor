import {
  NodePosition,
  sourceNode,
  numberUniformData,
  colorUniformData,
} from '@shaderfrog/core/graph';
import { uniformStrategy } from '@shaderfrog/core/strategy';

const fluidCirclesNode = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Fluid Circles',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [
        numberUniformData('speed', '0.2'),
        numberUniformData('baseRadius', '0.286'),
        numberUniformData('colorVariation', '0.6'),
        numberUniformData('brightnessVariation', '0'),
        numberUniformData('variation', '8'),
        colorUniformData('backgroundColor', ['0.0', '0.0', '0.5']),
      ],
    },
    `
    // Original https://www.shadertoy.com/view/MljSzW - Imported with permission
    // Created by Stefan Draganov - vortex/2015
    // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
    
    precision highp float;
    precision highp int;
    
    uniform float time;
    uniform float speed;
    uniform float baseRadius;
    uniform float colorVariation;
    uniform float brightnessVariation;
    uniform vec3 backgroundColor;
    uniform float variation;
    
    varying vec2 vUv;
    
    vec3 n(vec2 x, float t) {
        vec3 v = floor(vec3(x, t));
        vec3 u = vec3(mod(v.xy, variation), v.z);
        vec3 c = fract( u.xyz * (
            vec3(0.16462, 0.84787, 0.98273) +
            u.xyz * vec3(0.24808, 0.75905, 0.13898) +
            u.yzx * vec3(0.31517, 0.62703, 0.26063) +
            u.zxy * vec3(0.47127, 0.58568, 0.37244)
        ) + u.yzx * (
            vec3(0.35425, 0.65187, 0.12423) +
            u.yzx * vec3(0.95238, 0.93187, 0.95213) +
            u.zxy * vec3(0.31526, 0.62512, 0.71837)
        ) + u.zxy * (
            vec3(0.95213, 0.13841, 0.16479) +
            u.zxy * vec3(0.47626, 0.69257, 0.19738)
        ) );
        return v + c;
    }
    
    // Generate a predictably random color based on an input coord
    vec3 col(vec2 x, float t) {
        return vec3(
            0.5 + max( brightnessVariation * cos( x.y * x.x ), 0.0 )
        ) + clamp(
            colorVariation * cos(fract(vec3(x, t)) * 371.0241),
            vec3( -0.4 ),
            vec3( 1.0 )
        );
    }
    
    vec2 idx(vec2 x) {
        return floor(fract(x * 29.0) * 3.0) - vec2(1.0);
    }
    
    float circle(vec2 x, vec2 c, float r) {
        return max(0.0, 1.0 - dot(x - c, x - c) / (r * r));
    }
    
    void main() {
        
        vec2 x = vUv * 10.0;
        float t = time * speed;
        vec4 c = vec4(vec3(0.0), 0.1);
        
        for (int N = 0; N < 3; N++) {
            for (int k = -1; k <= 0; k++) {
                for (int i = -1; i <= 1; i++) {
                    for (int j = -1; j <= 1; j++) {
                        vec2 X = x + vec2(j, i);
                        float t = t + float(N) * 38.0;
                        float T = t + float(k);
                        vec3 a = n(X, T);
                        vec2 o = idx(a.xy);
                        vec3 b = n(X + o, T + 1.0);
                        vec2 m = mix(a.xy, b.xy, (t - a.z) / (b.z - a.z));
                        float r = baseRadius * sin(3.1415927 * clamp((t - a.z) / (b.z - a.z), 0.0, 1.0));
                        if (length(a.xy - b.xy) / (b.z - a.z) > 2.0) {
                            r = 0.0;
                        }
                        c += vec4(col(a.xy, a.z), 1.0) * circle(x, m, r);
                    }
                }
            }
        }
        
        gl_FragColor = vec4(c.rgb / max(1e-5, c.w) + backgroundColor, 1.0);
        
    }
    
`,
    'fragment',
    'three'
  );

export default fluidCirclesNode;
