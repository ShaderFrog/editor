import { NodePosition, sourceNode } from '@core/graph';
import { uniformStrategy } from '@core/strategy';

const hellOnEarthFrag = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Hell',
    position,
    {
      version: 2,
      preprocess: true,
      strategies: [uniformStrategy()],
      uniforms: [],
    },
    `
/**
 * Example Fragment Shader
 * Sets the color and alpha of the pixel by setting gl_FragColor
 */

// Set the precision for data types used in this shader
precision highp float;
precision highp int;

// Default THREE.js uniforms available to both fragment and vertex shader
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

// Default uniforms provided by ShaderFrog.
uniform float time;

// Example varyings passed from the vertex shader
varying vec3 vPosition;

//
//  Wombat
//  An efficient texture-free GLSL procedural noise library
//  Source: https://github.com/BrianSharpe/Wombat
//  Derived from: https://github.com/BrianSharpe/GPU-Noise-Lib
//
//  I'm not one for copyrights.  Use the code however you wish.
//  All I ask is that credit be given back to the blog or myself when appropriate.
//  And also to let me know if you come up with any changes, improvements, thoughts or interesting uses for this stuff. :)
//  Thanks!
//
//  Brian Sharpe
//  brisharpe CIRCLE_A yahoo DOT com
//  http://briansharpe.wordpress.com
//  https://github.com/BrianSharpe
//

//
//  Perlin Noise 3D
//  Return value range of -1.0->1.0
//

float Perlin4D( vec4 P )
{
    //  https://github.com/BrianSharpe/Wombat/blob/master/Perlin4D.glsl

    // establish our grid cell and unit position
    vec4 Pi = floor(P);
    vec4 Pf = P - Pi;
    vec4 Pf_min1 = Pf - 1.0;

    // clamp the domain
    Pi = Pi - floor(Pi * ( 1.0 / 69.0 )) * 69.0;
    vec4 Pi_inc1 = step( Pi, vec4( 69.0 - 1.5 ) ) * ( Pi + 1.0 );

    // calculate the hash.
    const vec4 OFFSET = vec4( 16.841230, 18.774548, 16.873274, 13.664607 );
    const vec4 SCALE = vec4( 0.102007, 0.114473, 0.139651, 0.084550 );
    Pi = ( Pi * SCALE ) + OFFSET;
    Pi_inc1 = ( Pi_inc1 * SCALE ) + OFFSET;
    Pi *= Pi;
    Pi_inc1 *= Pi_inc1;
    vec4 x0y0_x1y0_x0y1_x1y1 = vec4( Pi.x, Pi_inc1.x, Pi.x, Pi_inc1.x ) * vec4( Pi.yy, Pi_inc1.yy );
    vec4 z0w0_z1w0_z0w1_z1w1 = vec4( Pi.z, Pi_inc1.z, Pi.z, Pi_inc1.z ) * vec4( Pi.ww, Pi_inc1.ww );
    const vec4 SOMELARGEFLOATS = vec4( 56974.746094, 47165.636719, 55049.667969, 49901.273438 );
    vec4 hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.xxxx;
    vec4 lowz_loww_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 lowz_loww_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 lowz_loww_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 lowz_loww_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
    hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.yyyy;
    vec4 highz_loww_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 highz_loww_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 highz_loww_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 highz_loww_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
    hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.zzzz;
    vec4 lowz_highw_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 lowz_highw_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 lowz_highw_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 lowz_highw_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
    hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.wwww;
    vec4 highz_highw_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 highz_highw_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 highz_highw_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 highz_highw_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );

    // calculate the gradients
    lowz_loww_hash_0 -= 0.49999;
    lowz_loww_hash_1 -= 0.49999;
    lowz_loww_hash_2 -= 0.49999;
    lowz_loww_hash_3 -= 0.49999;
    highz_loww_hash_0 -= 0.49999;
    highz_loww_hash_1 -= 0.49999;
    highz_loww_hash_2 -= 0.49999;
    highz_loww_hash_3 -= 0.49999;
    lowz_highw_hash_0 -= 0.49999;
    lowz_highw_hash_1 -= 0.49999;
    lowz_highw_hash_2 -= 0.49999;
    lowz_highw_hash_3 -= 0.49999;
    highz_highw_hash_0 -= 0.49999;
    highz_highw_hash_1 -= 0.49999;
    highz_highw_hash_2 -= 0.49999;
    highz_highw_hash_3 -= 0.49999;

    vec4 grad_results_lowz_loww = inversesqrt( lowz_loww_hash_0 * lowz_loww_hash_0 + lowz_loww_hash_1 * lowz_loww_hash_1 + lowz_loww_hash_2 * lowz_loww_hash_2 + lowz_loww_hash_3 * lowz_loww_hash_3 );
    grad_results_lowz_loww *= ( vec2( Pf.x, Pf_min1.x ).xyxy * lowz_loww_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * lowz_loww_hash_1 + Pf.zzzz * lowz_loww_hash_2 + Pf.wwww * lowz_loww_hash_3 );

    vec4 grad_results_highz_loww = inversesqrt( highz_loww_hash_0 * highz_loww_hash_0 + highz_loww_hash_1 * highz_loww_hash_1 + highz_loww_hash_2 * highz_loww_hash_2 + highz_loww_hash_3 * highz_loww_hash_3 );
    grad_results_highz_loww *= ( vec2( Pf.x, Pf_min1.x ).xyxy * highz_loww_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * highz_loww_hash_1 + Pf_min1.zzzz * highz_loww_hash_2 + Pf.wwww * highz_loww_hash_3 );

    vec4 grad_results_lowz_highw = inversesqrt( lowz_highw_hash_0 * lowz_highw_hash_0 + lowz_highw_hash_1 * lowz_highw_hash_1 + lowz_highw_hash_2 * lowz_highw_hash_2 + lowz_highw_hash_3 * lowz_highw_hash_3 );
    grad_results_lowz_highw *= ( vec2( Pf.x, Pf_min1.x ).xyxy * lowz_highw_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * lowz_highw_hash_1 + Pf.zzzz * lowz_highw_hash_2 + Pf_min1.wwww * lowz_highw_hash_3 );

    vec4 grad_results_highz_highw = inversesqrt( highz_highw_hash_0 * highz_highw_hash_0 + highz_highw_hash_1 * highz_highw_hash_1 + highz_highw_hash_2 * highz_highw_hash_2 + highz_highw_hash_3 * highz_highw_hash_3 );
    grad_results_highz_highw *= ( vec2( Pf.x, Pf_min1.x ).xyxy * highz_highw_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * highz_highw_hash_1 + Pf_min1.zzzz * highz_highw_hash_2 + Pf_min1.wwww * highz_highw_hash_3 );

    // Classic Perlin Interpolation
    vec4 blend = Pf * Pf * Pf * (Pf * (Pf * 6.0 - 15.0) + 10.0);
    vec4 res0 = grad_results_lowz_loww + ( grad_results_lowz_highw - grad_results_lowz_loww ) * blend.wwww;
    vec4 res1 = grad_results_highz_loww + ( grad_results_highz_highw - grad_results_highz_loww ) * blend.wwww;
    res0 = res0 + ( res1 - res0 ) * blend.zzzz;
    blend.zw = vec2( 1.0 ) - blend.xy;
    return dot( res0, blend.zxzx * blend.wwyy );
}

#define noise(x) Perlin4D(x)

#define OCTAVES 6
float fbm(in vec4 st) {
    // Initial values
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    //
    // Loop of octaves
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(st);
        st *= 2.;
        amplitude *= .5;
    }
    return value;
}

float smootherstep(float edge0, float edge1, float x)
{
    // Scale, and clamp x to 0..1 range
    x = clamp((x - edge0)/(edge1 - edge0), 0.0, 1.0);
    // Evaluate polynomial
    return x*x*x*(x*(x*6.0 - 15.0) + 10.0);
}


void main() {

    // Calculate the real position of this pixel in 3d space, taking into account
    // the rotation and scale of the model. It's a useful formula for some effects.
    // This could also be done in the vertex shader
    vec3 worldPosition = ( modelMatrix * vec4( vPosition, 1.0 )).xyz;

    // Fragment shaders set the gl_FragColor, which is a vector4 of
    // ( red, green, blue, alpha ).
    //gl_FragColor = vec4( color * brightness, 1.0 );
    //float noiseVal = noise(vec4(worldPosition * 8.0, time));
    float noiseVal = fbm(vec4(worldPosition * 8.0, 0.3*time));
    
    noiseVal = smootherstep(-0.3, 0.3, noiseVal);
    noiseVal = max(noiseVal, 0.00001);
    
    vec3 col = vec3(0.2, 0.07, 0.01) / noiseVal;
    col = pow(col, vec3(1.6));
    
    gl_FragColor = vec4(col, 1.0);

}
`,
    'fragment',
    'three'
  );

const hellOnEarthVert = (id: string, position: NodePosition) =>
  sourceNode(
    id,
    'Hell',
    position,
    { version: 2, preprocess: true, strategies: [], uniforms: [] },
    `
/**
* Example Vertex Shader
* Sets the position of the vertex by setting gl_Position
*/

// Set the precision for data types used in this shader
precision highp float;
precision highp int;

// Default THREE.js uniforms available to both fragment and vertex shader
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;

// Default uniforms provided by ShaderFrog.
uniform float time;
attribute vec3 position;
attribute vec3 normal;
varying vec3 vPosition;

float Perlin4D( vec4 P )
{
    //  https://github.com/BrianSharpe/Wombat/blob/master/Perlin4D.glsl

    // establish our grid cell and unit position
    vec4 Pi = floor(P);
    vec4 Pf = P - Pi;
    vec4 Pf_min1 = Pf - 1.0;

    // clamp the domain
    Pi = Pi - floor(Pi * ( 1.0 / 69.0 )) * 69.0;
    vec4 Pi_inc1 = step( Pi, vec4( 69.0 - 1.5 ) ) * ( Pi + 1.0 );

    // calculate the hash.
    const vec4 OFFSET = vec4( 16.841230, 18.774548, 16.873274, 13.664607 );
    const vec4 SCALE = vec4( 0.102007, 0.114473, 0.139651, 0.084550 );
    Pi = ( Pi * SCALE ) + OFFSET;
    Pi_inc1 = ( Pi_inc1 * SCALE ) + OFFSET;
    Pi *= Pi;
    Pi_inc1 *= Pi_inc1;
    vec4 x0y0_x1y0_x0y1_x1y1 = vec4( Pi.x, Pi_inc1.x, Pi.x, Pi_inc1.x ) * vec4( Pi.yy, Pi_inc1.yy );
    vec4 z0w0_z1w0_z0w1_z1w1 = vec4( Pi.z, Pi_inc1.z, Pi.z, Pi_inc1.z ) * vec4( Pi.ww, Pi_inc1.ww );
    const vec4 SOMELARGEFLOATS = vec4( 56974.746094, 47165.636719, 55049.667969, 49901.273438 );
    vec4 hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.xxxx;
    vec4 lowz_loww_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 lowz_loww_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 lowz_loww_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 lowz_loww_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
    hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.yyyy;
    vec4 highz_loww_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 highz_loww_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 highz_loww_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 highz_loww_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
    hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.zzzz;
    vec4 lowz_highw_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 lowz_highw_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 lowz_highw_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 lowz_highw_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
    hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.wwww;
    vec4 highz_highw_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
    vec4 highz_highw_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
    vec4 highz_highw_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
    vec4 highz_highw_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );

    // calculate the gradients
    lowz_loww_hash_0 -= 0.49999;
    lowz_loww_hash_1 -= 0.49999;
    lowz_loww_hash_2 -= 0.49999;
    lowz_loww_hash_3 -= 0.49999;
    highz_loww_hash_0 -= 0.49999;
    highz_loww_hash_1 -= 0.49999;
    highz_loww_hash_2 -= 0.49999;
    highz_loww_hash_3 -= 0.49999;
    lowz_highw_hash_0 -= 0.49999;
    lowz_highw_hash_1 -= 0.49999;
    lowz_highw_hash_2 -= 0.49999;
    lowz_highw_hash_3 -= 0.49999;
    highz_highw_hash_0 -= 0.49999;
    highz_highw_hash_1 -= 0.49999;
    highz_highw_hash_2 -= 0.49999;
    highz_highw_hash_3 -= 0.49999;

    vec4 grad_results_lowz_loww = inversesqrt( lowz_loww_hash_0 * lowz_loww_hash_0 + lowz_loww_hash_1 * lowz_loww_hash_1 + lowz_loww_hash_2 * lowz_loww_hash_2 + lowz_loww_hash_3 * lowz_loww_hash_3 );
    grad_results_lowz_loww *= ( vec2( Pf.x, Pf_min1.x ).xyxy * lowz_loww_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * lowz_loww_hash_1 + Pf.zzzz * lowz_loww_hash_2 + Pf.wwww * lowz_loww_hash_3 );

    vec4 grad_results_highz_loww = inversesqrt( highz_loww_hash_0 * highz_loww_hash_0 + highz_loww_hash_1 * highz_loww_hash_1 + highz_loww_hash_2 * highz_loww_hash_2 + highz_loww_hash_3 * highz_loww_hash_3 );
    grad_results_highz_loww *= ( vec2( Pf.x, Pf_min1.x ).xyxy * highz_loww_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * highz_loww_hash_1 + Pf_min1.zzzz * highz_loww_hash_2 + Pf.wwww * highz_loww_hash_3 );

    vec4 grad_results_lowz_highw = inversesqrt( lowz_highw_hash_0 * lowz_highw_hash_0 + lowz_highw_hash_1 * lowz_highw_hash_1 + lowz_highw_hash_2 * lowz_highw_hash_2 + lowz_highw_hash_3 * lowz_highw_hash_3 );
    grad_results_lowz_highw *= ( vec2( Pf.x, Pf_min1.x ).xyxy * lowz_highw_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * lowz_highw_hash_1 + Pf.zzzz * lowz_highw_hash_2 + Pf_min1.wwww * lowz_highw_hash_3 );

    vec4 grad_results_highz_highw = inversesqrt( highz_highw_hash_0 * highz_highw_hash_0 + highz_highw_hash_1 * highz_highw_hash_1 + highz_highw_hash_2 * highz_highw_hash_2 + highz_highw_hash_3 * highz_highw_hash_3 );
    grad_results_highz_highw *= ( vec2( Pf.x, Pf_min1.x ).xyxy * highz_highw_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * highz_highw_hash_1 + Pf_min1.zzzz * highz_highw_hash_2 + Pf_min1.wwww * highz_highw_hash_3 );

    // Classic Perlin Interpolation
    vec4 blend = Pf * Pf * Pf * (Pf * (Pf * 6.0 - 15.0) + 10.0);
    vec4 res0 = grad_results_lowz_loww + ( grad_results_lowz_highw - grad_results_lowz_loww ) * blend.wwww;
    vec4 res1 = grad_results_highz_loww + ( grad_results_highz_highw - grad_results_highz_loww ) * blend.wwww;
    res0 = res0 + ( res1 - res0 ) * blend.zzzz;
    blend.zw = vec2( 1.0 ) - blend.xy;
    return dot( res0, blend.zxzx * blend.wwyy );
}

#define noise(x) Perlin4D(x)


void main() {

    // To pass variables to the fragment shader, you assign them here in the
    // main function. Traditionally you name the varying with vAttributeName
    
    vPosition = position;
    
    //vec3 worldPosition = ( modelMatrix * vec4( vPosition, 1.0 )).xyz;
    
    float noiseVal = noise(vec4(vPosition * 8.0, 0.3*time));
    float r = length(vPosition);
    float theta = acos(vPosition.z / r);
    float gamma = atan(vPosition.y, vPosition.x);
    
    r += noiseVal * 0.2;
    
    vPosition = vec3(
        r * sin(theta) * cos(gamma),
        r * sin(theta) * sin(gamma),
        r * cos(theta)
    );

    // This sets the position of the vertex in 3d space. The correct math is
    // provided below to take into account camera and object data.
    gl_Position = projectionMatrix * modelViewMatrix * vec4( vPosition, 1.0 );
}
`,
    'vertex',
    'three'
  );

export { hellOnEarthFrag, hellOnEarthVert };
