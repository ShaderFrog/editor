import {
  NodePosition,
  sourceNode,
  numberUniformData,
  textureUniformData,
  colorUniformData,
  UniformDataType,
  vectorUniformData,
} from '@core/graph';
import { texture2DStrategy, uniformStrategy } from '@core/strategy';

const perlinCloudsF = (
  id: string,
  position: NodePosition,
  uniforms?: UniformDataType[]
) =>
  sourceNode(
    id,
    'Perlin Clouds',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [texture2DStrategy(), uniformStrategy()],
      uniforms: uniforms || [
        colorUniformData('color', ['1', '1', '1']),
        numberUniformData('scale', '0.05'),
        textureUniformData('noiseImage', { assetId: 1, versionId: 1 }),
        vectorUniformData('speed', ['-0.002', '-0.002']),
        numberUniformData('cloudBrightness', '0.2'),
        numberUniformData('cloudMorphSpeed', '0.2'),
        numberUniformData('cloudMorphDirection', '1'),
        numberUniformData('cloudCover', '0.6'),
      ],
    },
    `precision highp float;
precision highp int;

uniform float scale;
uniform sampler2D noiseImage;
uniform vec2 speed;
uniform float cloudBrightness;
uniform float cloudMorphSpeed;
uniform float cloudMorphDirection;
uniform float cloudCover;

uniform float time;
uniform vec3 color;
varying vec2 vUv;

void main() {
  
  vec4 colorOutput = vec4( 0.0 );
  vec2 elapsed = time * speed;
  vec2 uv = ( vUv + elapsed ) * scale;
  
  for( int i = 1; i <= 4; i++ ) {
      float f = float( i );
      
      float divis = pow( 2.0, f );
      float uvPow = pow( 2.0, f - 1.0 );
      
      vec4 computed = texture2D(
          noiseImage, uvPow * ( uv + vec2( 0.1, 0.0 ) + ( time * 0.001 * cloudMorphSpeed ) )
      ) / divis;
      computed += texture2D(
          noiseImage, uvPow * ( uv + vec2( 0.1 ) )
      ) / divis;
      computed += texture2D(
          noiseImage, uvPow * ( uv + vec2( 0.0, 0.1 ) + ( cloudMorphDirection * time * 0.001 * cloudMorphSpeed ) )
      ) / divis;
      
      computed *= 0.25;
      
      colorOutput += computed;
  }
  
  colorOutput = max( colorOutput - ( 1.0 - cloudCover ), 0.0 );
  colorOutput = vec4( 1.0 - pow( ( 1.0 - cloudBrightness ), colorOutput.r * 255.0 ) );
  
  gl_FragColor = vec4( vec3(0.4, 0.6, 1.0) + color * colorOutput.rgb, 1.0 );

}
`,
    'fragment'
  );

export default perlinCloudsF;
