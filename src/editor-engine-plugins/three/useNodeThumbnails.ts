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
  isError,
} from '@core/graph';
import { EngineContext } from '@core/engine';
import { ThreeRuntime, threngine } from '@core/plugins/three/threngine';
import { createSceneMaterial } from './three-graph';
import {
  extractNodePreviewGraph,
  isPreviewableNode,
} from '../../editor/components/flow/graph-helpers';
import { logger } from '@editor/util/log';
import { NodeThumbnail } from '../../editor/components/flow/editor-store';

const { log } = logger('three.thumbnails');

// Matches the preview strip above graph nodes, in CSS pixels
export const THUMBNAIL_WIDTH = 236;
export const THUMBNAIL_HEIGHT = 128;
// Move the camera closer than the screenshot camera, so the object's surface
// fills the wide strip instead of the whole object floating in the middle
const CAMERA_ZOOM = 0.75;
// The strip is very wide, so set the field of view horizontally. A 45° vertical
// field of view would see far past the sides of the object.
const CAMERA_FOV =
  (2 *
    Math.atan(
      Math.tan((45 / 2) * (Math.PI / 180)) /
        (THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT)
    ) *
    180) /
  Math.PI;
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
  setNodeThumbnail?: (nodeId: string, thumbnail: NodeThumbnail) => void;
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
  if (size.x < THUMBNAIL_WIDTH || size.y < THUMBNAIL_HEIGHT) {
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

  renderer.setViewport(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  renderer.setScissor(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  renderer.setScissorTest(true);
  renderer.render(scene, thumbCamera);

  // Copy at the canvas's pixel ratio so the image is sharp on retina screens
  const pixelRatio = renderer.getPixelRatio();
  const width = Math.round(THUMBNAIL_WIDTH * pixelRatio);
  const height = Math.round(THUMBNAIL_HEIGHT * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const source = renderer.domElement;
  canvas
    .getContext('2d')
    ?.drawImage(
      source,
      0,
      source.height - height,
      width,
      height,
      0,
      0,
      width,
      height
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

  const thumbCamera = new PerspectiveCamera(
    CAMERA_FOV,
    THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT,
    0.01,
    1000
  );
  thumbCamera.position.copy(cameraPosition).multiplyScalar(CAMERA_ZOOM);
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
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT
      ).multiplyScalar(renderer.getPixelRatio());
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
          return {
            nodeId: node.id,
            preview,
            signature: preview ? previewSignature(preview, sceneKey) : 'none',
          };
        })
        .filter((item) => renderedRef.current[item.nodeId] !== item.signature);

      if (queue.length) {
        log(`Rendering ${queue.length} node thumbnails`);
      }

      for (const { nodeId, preview, signature } of queue) {
        if (cancelled()) {
          return;
        }
        let result: Awaited<ReturnType<typeof renderNodeThumbnail>>;
        if (preview) {
          try {
            result = await renderNodeThumbnail(optionsRef.current, preview);
          } catch (e) {
            log('Error rendering node thumbnail', e);
          }
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
          optionsRef.current.setNodeThumbnail?.(nodeId, {
            status: 'ready',
            url: URL.createObjectURL(result),
          });
        } else if (result !== PENDING) {
          optionsRef.current.setNodeThumbnail?.(nodeId, { status: 'error' });
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
