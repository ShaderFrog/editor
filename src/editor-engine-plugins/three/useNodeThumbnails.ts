import { useEffect, useRef } from 'react';
import {
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  CompileResult,
  Graph,
  SamplerCubeNode,
  TextureNode,
  compileSource,
  extractNodePreviewGraph,
  isError,
  isPreviewableNode,
} from '@core/graph';
import { EngineContext } from '@core/engine';
import { ThreeRuntime, threngine } from '@core/plugins/three/threngine';
import { createSceneMaterial } from './three-graph';
import { logger } from '@editor/util/log';

const { log } = logger('three.thumbnails');

const THUMBNAIL_SIZE = 128;
// Wait for edits to settle before rendering any thumbnails
const DEBOUNCE_MS = 1000;
// Pause between thumbnails so the main preview stays smooth
const BETWEEN_MS = 100;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything that affects how a node looks. If it changes, the node needs a
 * new thumbnail. Positions don't affect rendering, so they're left out.
 */
const previewSignature = (preview: Graph, sceneKey: string) =>
  sceneKey +
  JSON.stringify([
    preview.nodes.map(({ position, ...node }) => node),
    preview.edges,
  ]);

type ThumbnailOptions = {
  ctx: EngineContext<ThreeRuntime>;
  graph: Graph;
  compileResult: CompileResult | undefined;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  // Read when rendering, since the mesh is replaced when the preview object
  // changes
  sceneData: { mesh?: Mesh; helpers: Object3D[] };
  cameraPosition: Vector3;
  // Shader time uniform value, in seconds
  time: number;
  sceneConfig: Record<string, any>;
  // Any change to this re-renders all thumbnails
  sceneKey: string;
  loadNodeTexture: (node: TextureNode | SamplerCubeNode) => any;
  setNodeThumbnail?: (nodeId: string, url: string) => void;
};

// A thumbnail can't be rendered yet because a texture is still loading
const PENDING = 'pending';

/**
 * Builds a material for one node's preview graph. Returns undefined if the
 * preview graph doesn't compile.
 */
const buildPreviewMaterial = async (
  options: ThumbnailOptions,
  preview: Graph
) => {
  const { ctx, sceneConfig, scene, loadNodeTexture } = options;
  const runtime = ctx.runtime;

  // Compiling engine nodes sets the runtime's engineMaterial, which the main
  // preview reads when it creates its own material. Don't clobber it.
  const engineMaterial = runtime.engineMaterial;
  try {
    // Every node context is recomputed, because compiling mutates the ASTs
    const previewCtx = { ...ctx, nodes: {} };
    const result = await compileSource(preview, threngine, previewCtx);
    if (isError(result)) {
      return;
    }

    let texturesLoading = false;
    const { material } = createSceneMaterial(
      result,
      { ...previewCtx, nodes: result.updatedNodeContext },
      preview,
      (node) => {
        const texture = loadNodeTexture(node) as Texture | undefined;
        const image = texture?.image;
        if (
          !image ||
          (Array.isArray(image) && !image.length) ||
          (image instanceof HTMLImageElement && !image.complete)
        ) {
          texturesLoading = true;
        }
        return texture;
      },
      sceneConfig,
      scene.environment
    );
    if (texturesLoading) {
      material.dispose();
      return PENDING;
    }
    return material;
  } catch (e) {
    log('Could not compile node preview', e);
    return;
  } finally {
    runtime.engineMaterial = engineMaterial;
  }
};

/**
 * Renders a mesh into the corner of the main canvas and copies the pixels out.
 * Rendering to the canvas rather than a render target means tone mapping and
 * color space conversion match the main preview. The main scene is rendered
 * again right after, in the same task, so the thumbnail never shows on screen.
 */
const renderToCanvas = (
  options: ThumbnailOptions,
  thumbMesh: Mesh,
  thumbCamera: PerspectiveCamera
) => {
  const {
    renderer,
    scene,
    camera,
    sceneData: { mesh, helpers },
  } = options;
  const size = renderer.getSize(new Vector2());
  if (size.x < THUMBNAIL_SIZE || size.y < THUMBNAIL_SIZE) {
    return;
  }

  // Hide the main mesh and debug helpers so only the node's mesh is rendered
  const hidden: Object3D[] = [...helpers];
  scene.traverse((obj) => {
    if (obj.type.endsWith('Helper')) {
      hidden.push(obj);
    }
  });
  if (mesh) {
    hidden.push(mesh);
  }
  const visibilities = hidden.map((obj) => obj.visible);
  hidden.forEach((obj) => (obj.visible = false));
  scene.add(thumbMesh);

  renderer.setViewport(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  renderer.setScissor(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  renderer.setScissorTest(true);
  renderer.render(scene, thumbCamera);

  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const source = renderer.domElement;
  const sourceSize = THUMBNAIL_SIZE * renderer.getPixelRatio();
  canvas
    .getContext('2d')
    ?.drawImage(
      source,
      0,
      source.height - sourceSize,
      sourceSize,
      sourceSize,
      0,
      0,
      THUMBNAIL_SIZE,
      THUMBNAIL_SIZE
    );

  scene.remove(thumbMesh);
  hidden.forEach((obj, i) => (obj.visible = visibilities[i]));
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.render(scene, camera);

  return canvas;
};

const programLinked = (renderer: WebGLRenderer, material: Material) => {
  const program = (renderer.properties.get(material) as any).currentProgram;
  if (!program) {
    return false;
  }
  const gl = renderer.getContext();
  return !!gl.getProgramParameter(program.program, gl.LINK_STATUS);
};

const renderNodeThumbnail = async (
  options: ThumbnailOptions,
  preview: Graph
): Promise<Blob | typeof PENDING | undefined> => {
  const {
    renderer,
    scene,
    cameraPosition,
    time,
    sceneData: { mesh },
  } = options;
  if (!mesh) {
    return;
  }
  const material = await buildPreviewMaterial(options, preview);
  if (!material || material === PENDING) {
    return material;
  }

  const thumbMesh = new Mesh(mesh.geometry, material);
  thumbMesh.position.copy(mesh.position);
  thumbMesh.quaternion.copy(mesh.quaternion);
  thumbMesh.scale.copy(mesh.scale);

  const thumbCamera = new PerspectiveCamera(45, 1, 0.1, 1000);
  thumbCamera.position.copy(cameraPosition);
  thumbCamera.lookAt(new Vector3(0, 0, 0));

  const shaderUniforms = (): ShaderMaterial['uniforms'] =>
    material.userData?.shader?.uniforms ?? (material as any).uniforms ?? {};

  try {
    // Compile the shader program off the main thread when the browser
    // supports it, using the main scene's lights
    await renderer.compileAsync(thumbMesh, thumbCamera, scene);
    if (!programLinked(renderer, material)) {
      return;
    }

    const uniforms = shaderUniforms();
    if (uniforms.time) {
      uniforms.time.value = time;
    }
    if (uniforms.cameraPosition) {
      uniforms.cameraPosition.value = thumbCamera.position;
    }
    if (uniforms.renderResolution) {
      uniforms.renderResolution.value = new Vector2(
        THUMBNAIL_SIZE,
        THUMBNAIL_SIZE
      );
    }

    const canvas = renderToCanvas(options, thumbMesh, thumbCamera);
    if (!canvas) {
      return;
    }
    return await new Promise<Blob | undefined>((resolve) =>
      canvas.toBlob((blob) => resolve(blob || undefined), 'image/jpeg', 0.85)
    );
  } finally {
    material.dispose();
  }
};

/**
 * Renders a small preview image of each fragment node in the graph, showing
 * what that node outputs on its own on the current preview object. Thumbnails
 * are re-rendered, a while after edits settle, for any node whose preview
 * graph changed, which includes every node downstream of an edited node.
 */
export const useNodeThumbnails = (options: ThumbnailOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // The signature each node's current thumbnail was rendered with
  const renderedRef = useRef<Record<string, string>>({});
  // Bumped to cancel an in progress run when something changes
  const runRef = useRef(0);

  const { graph, compileResult, sceneKey, loadNodeTexture, setNodeThumbnail } =
    options;
  const ready = !!(options.ctx.runtime.loaded && setNodeThumbnail);

  useEffect(() => {
    if (!ready || !compileResult) {
      return;
    }
    const run = ++runRef.current;
    const cancelled = () => run !== runRef.current;

    const timeout = setTimeout(async () => {
      const queue = graph.nodes
        .filter(isPreviewableNode)
        .map((node) => {
          const preview = extractNodePreviewGraph(graph, node.id);
          return preview
            ? {
                nodeId: node.id,
                preview,
                signature: previewSignature(preview, sceneKey),
              }
            : undefined;
        })
        .filter(
          (item): item is NonNullable<typeof item> =>
            !!item && renderedRef.current[item.nodeId] !== item.signature
        );

      if (queue.length) {
        log(`Rendering ${queue.length} node thumbnails`);
      }

      for (const { nodeId, preview, signature } of queue) {
        if (cancelled()) {
          return;
        }
        let result: Awaited<ReturnType<typeof renderNodeThumbnail>>;
        try {
          result = await renderNodeThumbnail(optionsRef.current, preview);
        } catch (e) {
          log('Error rendering node thumbnail', e);
        }
        if (cancelled()) {
          return;
        }
        // Retry pending thumbnails when textures load. Don't retry failed
        // ones until the node's preview graph changes.
        if (result !== PENDING) {
          renderedRef.current[nodeId] = signature;
        }
        if (result instanceof Blob) {
          optionsRef.current.setNodeThumbnail?.(
            nodeId,
            URL.createObjectURL(result)
          );
        }
        await wait(BETWEEN_MS);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      runRef.current++;
    };
    // loadNodeTexture changes when textures finish loading
  }, [ready, graph, compileResult, sceneKey, loadNodeTexture]);
};
