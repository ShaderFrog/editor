import { NodePosition, sourceNode, numberUniformData } from '@core/graph';
import { uniformStrategy } from '@core/strategy';

export const variation0 = `
// Adapted from http://blogs.msdn.com/b/eternalcoding/archive/2014/04/17/learning-shaders-create-your-own-shaders-with-babylon-js.aspx

precision highp float;

varying vec3 vNormal;
varying vec3 vPosition;

uniform mat4 modelMatrix;    
uniform vec3 vLightPosition;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

uniform float scale; // bigger scale = more outer surface is blue
uniform float power; // power = heat the object emits
    
vec3 toneToHeatColorMap(in float tone) {
    if(tone > 0.95) 
       return vec3(0.0, 0.0, 1.0);
    else if(tone  > 0.80)
        return vec3(0.0, 0.2+tone, 0.0);
    else if(tone > 0.25) 
        return vec3(1.0, tone, 0.0);
    else if(tone > 0.1) 
        return vec3(1.0-tone, 0.0, 0.0);
        
    return vec3(0.4, 0.05, 0.2); 
}

void main(void) {
    // color
    vec3 fresnel = vec3(1.0, 1.0, 1.0);
    
    vec3 pos2World = (modelViewMatrix * vec4(vPosition, 1.0)).xyz;
    vec3 norm2World = normalize(modelViewMatrix * vec4(vNormal, 1.0)).xyz;
    vec3 cameraPos2World = (modelViewMatrix * vec4(viewMatrix[0][3], viewMatrix[1][3], viewMatrix[2][3], 1.0)).xyz;
    
    // Light
    vec3 lightVectorW = normalize(vec3(vec4( vLightPosition, 1.0) * modelMatrix) - vPosition);
    
    // diffuse
    float ndl = max(0.0, dot(vNormal, lightVectorW));
    
    vec3 I = normalize(pos2World - cameraPos2World);
    float R = scale * pow(1.0 + dot(I, norm2World), power);
    
    vec3 color = vec3(0);
    
    color = clamp(mix(color, fresnel, R), 0.0, 1.0);
    
        
    gl_FragColor = vec4( toneToHeatColorMap(color.r), 1.0 );
}
`;

export const variation1 = `
// Adapted from http://blogs.msdn.com/b/eternalcoding/archive/2014/04/17/learning-shaders-create-your-own-shaders-with-babylon-js.aspx

precision highp float;

varying vec3 vNormal;
varying vec3 vPosition;

uniform mat4 modelMatrix;    
uniform vec3 vLightPosition;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

uniform float scale; // bigger scale = more outer surface is blue
uniform float power; // power = heat the object emits
    
vec3 toneToHeatColorMap(in float tone) {
    if(tone > 0.95) 
       return vec3(0.0, 0.0, 1.0);
    else if(tone  > 0.80)
        return vec3(0.0, 0.2+tone, 0.0);
    else if(tone > 0.25) 
        return vec3(1.0, tone, 0.0);
    else if(tone > 0.1) 
        return vec3(1.0-tone, 0.0, 0.0);
        
    return vec3(0.4, 0.05, 0.2); 
}

void main(void) {
    // color
    vec3 fresnel = vec3(1.0, 1.0, 1.0);
    
    vec3 pos2World = (modelViewMatrix * vec4(vPosition, 1.0)).xyz;
    vec3 norm2World = normalize(modelViewMatrix * vec4(vNormal, 1.0)).xyz;
    vec3 cameraPos2World = (modelViewMatrix * vec4(viewMatrix[0][3], viewMatrix[1][3], viewMatrix[2][3], 1.0)).xyz;
    
    // Light
    vec3 lightVectorW = normalize(vec3(vec4( vLightPosition, 1.0) * modelMatrix) - vPosition);
    
    // diffuse
    float ndl = max(0.0, dot(vNormal, lightVectorW));
    
    vec3 I = normalize(pos2World - cameraPos2World);
    float R = scale * pow(1.0 + dot(I, norm2World), power);
    
    vec3 color = vec3(0);
    
    color = clamp(mix(color, fresnel, R), 0.0, 1.0);
    
        
    gl_FragColor = vec4( vec3(0.5, 0.5, 1.0) + 0.3 * toneToHeatColorMap(color.r), 1.0 );
}
`;

const heatShaderFragmentNode = (
  id: string,
  position: NodePosition,
  source = variation0
) =>
  sourceNode(
    id,
    'Fake Heatmap',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [
        numberUniformData('scale', '1.2'),
        numberUniformData('power', '1'),
      ],
    },
    source,
    'fragment',
    'three'
  );

const heatShaderVertexNode = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Fake Heatmap',
    position,
    { version: 2, preprocess: true, strategies: [], uniforms: [] },
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
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() 
    {
      vNormal = normal;
      vPosition = position;
    
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,
    'vertex',
    'three'
  );

export { heatShaderFragmentNode, heatShaderVertexNode };
