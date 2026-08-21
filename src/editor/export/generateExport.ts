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

export interface GenerateExportParams {
  compileResult: CompileResult;
  graph: Graph;
  grindex: Grindex;
  shaderName: string;
}

function dataNodeToValueCode(node: DataNode, threeImports: Set<string>): string {
  const v = node.value;
  if (node.type === 'number') {
    return String(parseFloat(v as string));
  }
  if (node.type === 'vector2') {
    const [x, y] = v as string[];
    threeImports.add('Vector2');
    return `new Vector2(${x}, ${y})`;
  }
  if (node.type === 'vector3') {
    const [x, y, z] = v as string[];
    threeImports.add('Vector3');
    return `new Vector3(${x}, ${y}, ${z})`;
  }
  if (node.type === 'vector4') {
    const [x, y, z, w] = v as string[];
    threeImports.add('Vector4');
    return `new Vector4(${x}, ${y}, ${z}, ${w})`;
  }
  if (node.type === 'rgb') {
    const [r, g, b] = v as string[];
    threeImports.add('Color');
    return `new Color(${r}, ${g}, ${b})`;
  }
  if (node.type === 'rgba') {
    const [r, g, b, a] = v as string[];
    threeImports.add('Vector4');
    return `new Vector4(${r}, ${g}, ${b}, ${a})`;
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

function collectUniforms(
  dataInputs: IndexedDataInputs,
  graph: Graph,
  grindex: Grindex,
  threeImports: Set<string>,
): CollectedUniform[] {
  const uniforms: CollectedUniform[] = [];
  const seen = new Set<string>();

  Object.entries(dataInputs || {}).forEach(([nodeId, inputs]) => {
    const node = grindex.nodes[nodeId];
    if (!node) return;

    inputs.forEach((input: NodeInput) => {
      if (input.property) return;
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
        uniforms.push({ name, valueCode: dataNodeToValueCode(fromNode as DataNode, threeImports) });
      }
    });
  });

  return uniforms;
}

function placeholderTextureFn(): string {
  return `function makePlaceholderTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 1, 1);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
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

export function generateUsage(
  shaderName: string,
  hasTime: boolean,
  hasRenderResolution: boolean,
  hasCameraPosition: boolean,
): string {
  const filename = `${(shaderName || 'shader').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mjs`;
  const lines = [
    `import { uniforms, createMaterial } from './${filename}';`,
    `const material = createMaterial();`,
    `mesh.material = material;`,
  ];

  const loopLines: string[] = [];
  if (hasTime) {
    loopLines.push(`  const delta = (now - prevTime) / 1000;`);
    loopLines.push(`  prevTime = now;`);
    loopLines.push(`  uniforms.time.value += delta;`);
  }
  if (hasRenderResolution) {
    loopLines.push(`  uniforms.renderResolution.value.set(window.innerWidth, window.innerHeight);`);
  }
  if (hasCameraPosition) {
    loopLines.push(`  uniforms.cameraPosition.value.copy(camera.position);`);
  }

  if (loopLines.length > 0) {
    lines.push(``);
    if (hasTime) lines.push(`let prevTime = 0;`);
    lines.push(`function animate(now) {`);
    lines.push(`  requestAnimationFrame(animate);`);
    lines.push(...loopLines);
    lines.push(`}`);
    lines.push(`requestAnimationFrame(animate);`);
  }

  return lines.join('\n');
}

export interface GenerateExportResult {
  code: string;
  usage: string;
  hasTime: boolean;
  hasRenderResolution: boolean;
  hasCameraPosition: boolean;
}

export function generateExport(params: GenerateExportParams): GenerateExportResult {
  const { compileResult, graph, grindex, shaderName } = params;

  const threeImports = new Set<string>();

  const hasEngineNode = graph.nodes.some((node) => (node as any).engine);
  const frogData = hasEngineNode
    ? prepareFrogMaterialExport(compileResult, graph)
    : null;

  const collectedUniforms = collectUniforms(compileResult.dataInputs, graph, grindex, threeImports);

  const hasPlaceholderTexture = collectedUniforms.some(
    (u) => u.valueCode === 'makePlaceholderTexture()',
  );

  if (hasPlaceholderTexture) {
    threeImports.add('CanvasTexture');
    threeImports.add('RepeatWrapping');
  }

  // renderResolution is always included
  threeImports.add('Vector2');

  const uniformNames = new Set([
    'time',
    'renderResolution',
    ...collectedUniforms.map((u) => u.name),
  ]);
  const hasTime = uniformNames.has('time');
  const hasRenderResolution = uniformNames.has('renderResolution');
  const hasCameraPosition = uniformNames.has('cameraPosition');

  const uniformEntries = [
    `  time: { value: 0 },`,
    `  renderResolution: { value: new Vector2(typeof window !== 'undefined' ? window.innerWidth : 1, typeof window !== 'undefined' ? window.innerHeight : 1) },`,
    ...collectedUniforms.map((u) => `  ${u.name}: { value: ${u.valueCode} },`),
  ];

  const safeName = shaderName || 'Shader';
  const header = `// ${safeName} - ShaderFrog Export`;

  const usage = generateUsage(shaderName, hasTime, hasRenderResolution, hasCameraPosition);

  let code: string;

  if (frogData) {
    threeImports.add(frogData.baseMaterialType);

    const { injectableProps, fragmentInjections, vertexInjections } = frogData;

    const propEntries = Object.entries(injectableProps).map(
      ([name, glsl]) => `    ${name}: ${JSON.stringify(glsl)},`,
    );

    const fragInjCode = injectionArrayCode(fragmentInjections, '    ');
    const vertInjCode = injectionArrayCode(vertexInjections, '    ');
    const hasInjections = fragmentInjections.length > 0 || vertexInjections.length > 0;

    const sortedImports = [...threeImports].sort();
    const threeImportLine = `import { ${sortedImports.join(', ')} } from 'three';`;

    code = [
      header,
      ``,
      threeImportLine,
      `import { FrogMaterial } from '@shaderfrog/core/plugins/three';`,
      ...(hasPlaceholderTexture ? [``, placeholderTextureFn(), ``] : [``]),
      `export const uniforms = {`,
      uniformEntries.join('\n'),
      `};`,
      ``,
      `const fragmentShader = ${glslTemplateLiteral(frogData.fragmentShader)};`,
      ``,
      `const fragmentOutput = ${JSON.stringify(frogData.fragmentOutput)};`,
      ``,
      `const vertexShader = ${glslTemplateLiteral(frogData.vertexShader)};`,
      ``,
      `const vertexOutput = ${JSON.stringify(frogData.vertexOutput)};`,
      ``,
      `export function createMaterial() {`,
      `  const material = new FrogMaterial({`,
      `    baseMaterial: ${frogData.baseMaterialType},`,
      `    materialName: '${frogData.baseMaterialType}',`,
      `    fragmentShader,`,
      `    fragmentOutput,`,
      `    vertexShader,`,
      `    vertexOutput,`,
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
      ``,
      `  return material;`,
      `}`,
      ``,
      `export default createMaterial;`,
    ].join('\n');
  } else {
    threeImports.add('RawShaderMaterial');
    threeImports.add('GLSL3');

    const sortedImports = [...threeImports].sort();
    const threeImportLine = `import { ${sortedImports.join(', ')} } from 'three';`;

    code = [
      header,
      ``,
      threeImportLine,
      ...(hasPlaceholderTexture ? [``, placeholderTextureFn(), ``] : [``]),
      `export const uniforms = {`,
      uniformEntries.join('\n'),
      `};`,
      ``,
      `const vertexShader = ${glslTemplateLiteral(compileResult.vertexResult)};`,
      ``,
      `const fragmentShader = ${glslTemplateLiteral(compileResult.fragmentResult)};`,
      ``,
      `export function createMaterial() {`,
      `  return new RawShaderMaterial({`,
      `    glslVersion: GLSL3,`,
      `    uniforms,`,
      `    vertexShader,`,
      `    fragmentShader,`,
      `  });`,
      `}`,
      ``,
      `export default createMaterial;`,
    ].join('\n');
  }

  return { code, usage, hasTime, hasRenderResolution, hasCameraPosition };
}
