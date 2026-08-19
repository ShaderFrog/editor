import {
  CompileResult,
  Graph,
  GraphNode,
  Grindex,
  IndexedDataInputs,
  NodeInput,
  SourceNode,
  DataNode,
  findLinkedNode,
  mangleVar,
} from '@core/graph';
import {
  threngine,
  prepareFrogMaterialExport,
} from '@core/plugins/three/threngine';

export type ExportFormat = 'vanilla' | 'es6';

export interface GenerateExportParams {
  compileResult: CompileResult;
  graph: Graph;
  grindex: Grindex;
  shaderName: string;
  format: ExportFormat;
}

function dataNodeToValueCode(node: DataNode): string {
  const v = node.value;
  if (node.type === 'number') {
    return String(parseFloat(v as string));
  }
  if (node.type === 'vector2') {
    const [x, y] = v as string[];
    return `new THREE.Vector2(${x}, ${y})`;
  }
  if (node.type === 'vector3') {
    const [x, y, z] = v as string[];
    return `new THREE.Vector3(${x}, ${y}, ${z})`;
  }
  if (node.type === 'vector4') {
    const [x, y, z, w] = v as string[];
    return `new THREE.Vector4(${x}, ${y}, ${z}, ${w})`;
  }
  if (node.type === 'rgb') {
    const [r, g, b] = v as string[];
    return `new THREE.Color(${r}, ${g}, ${b})`;
  }
  if (node.type === 'rgba') {
    const [r, g, b, a] = v as string[];
    return `new THREE.Vector4(${r}, ${g}, ${b}, ${a})`;
  }
  if (node.type === 'texture') {
    return 'makePlaceholderTexture()';
  }
  if (node.type === 'samplerCube') {
    return 'null /* provide your own CubeTexture */';
  }
  return 'null';
}

interface CollectedUniform {
  name: string;
  valueCode: string;
}

// Collect only non-property uniform inputs from data nodes.
// Engine node property inputs (map, color, etc.) are handled via
// prepareFrogMaterialExport's injectableProps / fragmentInjections.
function collectUniforms(
  dataInputs: IndexedDataInputs,
  graph: Graph,
  grindex: Grindex,
): CollectedUniform[] {
  const uniforms: CollectedUniform[] = [];
  const seen = new Set<string>();

  Object.entries(dataInputs || {}).forEach(([nodeId, inputs]) => {
    const node = grindex.nodes[nodeId];
    if (!node) return;

    inputs.forEach((input: NodeInput) => {
      if (input.property) return; // property inputs handled via engineNodeProperties
      const edge = grindex.edgesByNode[nodeId]?.to.edgesByInput?.[input.id];
      if (!edge) return;
      const fromNode = grindex.nodes[edge.from];
      if (!fromNode || !('value' in fromNode)) return;

      const name = mangleVar(
        input.displayName,
        threngine,
        node as GraphNode,
        findLinkedNode(graph, node.id) as SourceNode,
      );
      if (!seen.has(name)) {
        seen.add(name);
        uniforms.push({ name, valueCode: dataNodeToValueCode(fromNode as DataNode) });
      }
    });
  });

  return uniforms;
}

function placeholderTextureFn(isEs6: boolean): string {
  const d = isEs6 ? 'const' : 'var';
  return `function makePlaceholderTexture() {
  ${d} canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  ${d} ctx = canvas.getContext('2d');
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 1, 1);
  ${d} tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}`;
}

function glslTemplateLiteral(glsl: string): string {
  return '/* glsl */`\n' + glsl + '\n`';
}

function injectionArrayCode(
  injections: Array<{ search: string; replace: string }>,
  indent: string,
): string {
  if (!injections.length) return '[]';
  const entries = injections.map(
    (inj) =>
      `${indent}  { search: new RegExp(${JSON.stringify(inj.search)}), replace: ${JSON.stringify(inj.replace)} }`,
  );
  return `[\n${entries.join(',\n')},\n${indent}]`;
}

export function generateExport(params: GenerateExportParams): string {
  const { compileResult, graph, grindex, shaderName, format } = params;
  const isEs6 = format === 'es6';
  const d = isEs6 ? 'const' : 'var';

  const hasEngineNode = graph.nodes.some((node) => (node as any).engine);
  const frogData = hasEngineNode
    ? prepareFrogMaterialExport(compileResult, graph)
    : null;

  const uniforms = collectUniforms(compileResult.dataInputs, graph, grindex);

  const hasPlaceholderTexture = uniforms.some(
    (u) => u.valueCode === 'makePlaceholderTexture()',
  );

  const uniformEntries = [
    `    time: { value: 0 }`,
    `    renderResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }`,
    ...uniforms.map((u) => `    ${u.name}: { value: ${u.valueCode} }`),
  ];

  const safeName = shaderName || 'Shader';

  if (frogData) {
    const { injectableProps, fragmentInjections, vertexInjections } = frogData;

    const propEntries = Object.entries(injectableProps).map(
      ([name, glsl]) => `    ${name}: ${JSON.stringify(glsl)},`,
    );

    const fragInjCode = injectionArrayCode(fragmentInjections, '    ');
    const vertInjCode = injectionArrayCode(vertexInjections, '    ');
    const hasInjections = fragmentInjections.length > 0 || vertexInjections.length > 0;

    const frogImport = isEs6
      ? `import { FrogMaterial } from '@shaderfrog/core/plugins/three';`
      : `${d} FrogMaterial = require('@shaderfrog/core/plugins/three').FrogMaterial;`;

    const threeImport = isEs6
      ? `import * as THREE from 'three';`
      : `${d} THREE = require('three');`;

    const materialLines = [
      `  ${d} uniforms = {`,
      uniformEntries.join(',\n'),
      `  };`,
      ``,
      `  ${d} material = new FrogMaterial({`,
      `    baseMaterial: THREE.${frogData.baseMaterialType},`,
      `    fragmentShader: ${glslTemplateLiteral(frogData.fragmentShader)},`,
      `    fragmentOutput: ${JSON.stringify(frogData.fragmentOutput)},`,
      `    vertexShader: ${glslTemplateLiteral(frogData.vertexShader)},`,
      `    vertexOutput: ${JSON.stringify(frogData.vertexOutput)},`,
      `    uniforms,`,
      ...(propEntries.length ? propEntries : []),
      ...(hasInjections
        ? [
            `    fragmentInjections: ${fragInjCode},`,
            `    vertexInjections: ${vertInjCode},`,
          ]
        : []),
      `  });`,
      ``,
      `  material.defines = material.defines || {};`,
      `  material.defines.USE_UV = '';`,
      `  material.defines.USE_UV2 = '';`,
      `  material.defines.USE_TANGENT = '';`,
    ];

    const materialConstruction = materialLines.join('\n');

    const header = `/**
 * ${safeName} - ShaderFrog Export
 *
 * Requirements:
 *   - Three.js r165+
 *   - @shaderfrog/core (npm install @shaderfrog/core)
 *
 * Usage:
 *   ${isEs6 ? `import { createMaterial } from './shader.mjs';` : `var createMaterial = require('./shader.js').createMaterial;`}
 *   ${isEs6 ? `const` : `var`} material = createMaterial();
 *   mesh.material = material;
 *   // In animation loop:
 *   material.uniforms.time.value = performance.now() / 1000;
 */`;

    if (isEs6) {
      return [
        header,
        ``,
        threeImport,
        frogImport,
        hasPlaceholderTexture ? `\n${placeholderTextureFn(true)}\n` : ``,
        `export function createMaterial() {`,
        materialConstruction,
        ``,
        `  return material;`,
        `}`,
        ``,
        `export default createMaterial;`,
      ].join('\n');
    } else {
      return [
        header,
        ``,
        hasPlaceholderTexture ? `\n${placeholderTextureFn(false)}\n` : ``,
        `function createMaterial() {`,
        `  var THREE = typeof THREE !== 'undefined' ? THREE : require('three');`,
        `  var FrogMaterial = require('@shaderfrog/core/plugins/three').FrogMaterial;`,
        materialConstruction,
        ``,
        `  return material;`,
        `}`,
        ``,
        `if (typeof module !== 'undefined') {`,
        `  module.exports = { createMaterial: createMaterial };`,
        `}`,
      ].join('\n');
    }
  } else {
    // ShaderMaterial path (no engine node)
    const threeImport = isEs6 ? `import * as THREE from 'three';` : '';

    const materialConstruction = [
      `  ${d} uniforms = {`,
      uniformEntries.join(',\n'),
      `  };`,
      ``,
      `  ${d} material = new THREE.RawShaderMaterial({`,
      `    glslVersion: THREE.GLSL3,`,
      `    uniforms,`,
      `    vertexShader: ${glslTemplateLiteral(compileResult.vertexResult)},`,
      `    fragmentShader: ${glslTemplateLiteral(compileResult.fragmentResult)},`,
      `  });`,
    ].join('\n');

    const header = `/**
 * ${safeName} - ShaderFrog Export
 *
 * Requirements:
 *   - Three.js r165+
 *
 * Usage:
 *   ${isEs6 ? `import { createMaterial } from './shader.mjs';` : `var createMaterial = require('./shader.js').createMaterial;`}
 *   ${isEs6 ? `const` : `var`} material = createMaterial();
 *   mesh.material = material;
 *   // In animation loop:
 *   material.uniforms.time.value = performance.now() / 1000;
 */`;

    if (isEs6) {
      return [
        header,
        ``,
        threeImport,
        hasPlaceholderTexture ? `\n${placeholderTextureFn(true)}\n` : ``,
        `export function createMaterial() {`,
        materialConstruction,
        ``,
        `  return material;`,
        `}`,
        ``,
        `export default createMaterial;`,
      ].join('\n');
    } else {
      return [
        header,
        ``,
        hasPlaceholderTexture ? `\n${placeholderTextureFn(false)}\n` : ``,
        `function createMaterial(THREE) {`,
        materialConstruction,
        ``,
        `  return material;`,
        `}`,
        ``,
        `if (typeof module !== 'undefined') {`,
        `  module.exports = { createMaterial: createMaterial };`,
        `}`,
      ].join('\n');
    }
  }
}
