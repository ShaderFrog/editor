import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import {
  ACESFilmicToneMapping,
  PMREMGenerator,
  BoxGeometry,
  BufferGeometry,
  CineonToneMapping,
  Color,
  CubeTexture,
  CubeTextureLoader,
  DoubleSide,
  FrontSide,
  Group,
  IcosahedronGeometry,
  LinearToneMapping,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  PointLightHelper,
  ReinhardToneMapping,
  RepeatWrapping,
  SphereGeometry,
  SpotLight,
  SpotLightHelper,
  sRGBEncoding,
  Texture,
  TextureLoader,
  TorusKnotGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  ClampToEdgeWrapping,
} from 'three';
// @ts-ignore
import { VertexTangentsHelper } from 'three/addons/helpers/VertexTangentsHelper.js';
// @ts-ignore
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import {
  mangleVar,
  SamplerCubeNode,
  TextureNode,
  evaluateNode,
  Graph,
  findLinkedNode,
  SourceNode,
  TextureNodeValueData,
} from '@core/graph';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EngineContext } from '@core/engine';
import {
  threngine,
  ThreeRuntime,
  createMaterial,
} from '@core/plugins/three/threngine';

import {
  Tabs,
  Tab,
  TabGroup,
  TabPanel,
  TabPanels,
} from '../../editor/components/tabs/Tabs';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera,
  faCube,
  faInfoCircle,
  faPause,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';

import { useThree } from './useThree';
import { usePrevious } from '../../editor/hooks/usePrevious';
import { ensure } from '../../util/ensure';
import { useSize } from '../../editor/hooks/useSize';
import { RoomEnvironment } from './RoomEnvironment';
import { SceneProps } from '@editor-components/editorTypes';
import { useAssetsAndGroups } from '@editor/api';

import styles from '../../editor/styles/editor.module.css';
import clamp from '@/editor/util/clamp';

const cx = classnames.bind(styles);

export const AUTO_ROTATE_LIMIT = 10;

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(component)\x1b[0m', ...args);

const loadingMaterial = new MeshBasicMaterial({ color: 'pink' });

export type SceneConfig = {
  showTangents: boolean;
  showNormals: boolean;
  wireframe: boolean;
  doubleSide: boolean;
  transparent: boolean;
  torusKnotResolution: [number, number];
  torusResolution: [number, number];
  boxResolution: [number, number, number];
  planeResolution: [number, number];
  sphereResolution: [number, number];
  icosahedronResolution: [number];
  autoRotate: boolean;
  autoRotateSpeed: number;
};

const maxResolution = 10000;
const defaultResolution = {
  torusResolution: [200, 32],
  torusKnotResolution: [200, 32],
  boxResolution: [64, 64, 64],
  planeResolution: [64, 64],
  sphereResolution: [128, 128],
  icosahedronResolution: [0],
};

const LIGHT_SETTINGS = {
  NONE: 'none',
  THREE_POINT: '3point',
  POINT: 'point',
  SPOT: 'spot',
} as const;

const resolutionConfigMapping: Record<
  string,
  { labels: string[]; key: keyof typeof defaultResolution }
> = {
  torus: {
    labels: ['Tube Segments', 'Radial Segments'],
    key: 'torusResolution',
  },
  torusknot: {
    labels: ['Tube Segments', 'Radial Segments'],
    key: 'torusKnotResolution',
  },
  cube: {
    labels: ['Width Segments', 'Height Segments', 'Depth Segments'],
    key: 'boxResolution',
  },
  plane: {
    labels: ['Width Segments', 'Height Segments'],
    key: 'planeResolution',
  },
  sphere: {
    labels: ['Width Segments', 'Height Segments'],
    key: 'sphereResolution',
  },
  icosahedron: {
    labels: ['Detail'],
    key: 'icosahedronResolution',
  },
};

export const SceneAngles = {
  TOP_LEFT: 'topleft',
  TOP_MIDDLE: 'topmid',
  TOP_RIGHT: 'topright',
  MIDDLE_LEFT: 'midleft',
  MIDDLE_MIDDLE: 'midmid',
  MIDDLE_RIGHT: 'midright',
  BOTTOM_LEFT: 'botleft',
  BOTTOM_MIDDLE: 'botmid',
  BOTTOM_RIGHT: 'botright',
};

const calculateViewPosition =
  (xPosition: number, yPosition: number) => (radius: number) => {
    const spread = 0.8;
    const position = new Vector3(0, 0, radius);
    position.applyAxisAngle(new Vector3(1, 0, 0), yPosition * spread);
    position.applyAxisAngle(new Vector3(0, 1, 0), xPosition * spread);
    return position;
  };

export const SceneAngleVectors = {
  [SceneAngles.TOP_LEFT]: calculateViewPosition(-1, -1),
  [SceneAngles.TOP_MIDDLE]: calculateViewPosition(0, -1),
  [SceneAngles.TOP_RIGHT]: calculateViewPosition(1, -1),
  [SceneAngles.MIDDLE_LEFT]: calculateViewPosition(-1, 0),
  [SceneAngles.MIDDLE_MIDDLE]: calculateViewPosition(0, 0),
  [SceneAngles.MIDDLE_RIGHT]: calculateViewPosition(1, 0),
  [SceneAngles.BOTTOM_LEFT]: calculateViewPosition(-1, 1),
  [SceneAngles.BOTTOM_MIDDLE]: calculateViewPosition(0, 1),
  [SceneAngles.BOTTOM_RIGHT]: calculateViewPosition(1, 1),
};

export const SceneDefaultAngles: Record<string, string> = {
  sphere: SceneAngles.MIDDLE_MIDDLE,
  cube: SceneAngles.TOP_LEFT,
  torusknot: SceneAngles.MIDDLE_MIDDLE,
  torus: SceneAngles.BOTTOM_MIDDLE,
  teapot: SceneAngles.MIDDLE_MIDDLE,
  bunny: SceneAngles.MIDDLE_MIDDLE,
  icosahedron: SceneAngles.MIDDLE_MIDDLE,
  plane: SceneAngles.MIDDLE_MIDDLE,
  cylinder: SceneAngles.TOP_MIDDLE,
  cone: SceneAngles.MIDDLE_MIDDLE,
};

export const CameraDistances: Record<string, number> = {
  sphere: 0.55,
  cube: 0.45,
  torusknot: 0.5,
  icosahedron: 0.5,
  torus: 0.38,
  teapot: 0.9,
  bunny: 0.54,
  plane: 0.24,
  cylinder: 0.38,
  cone: 0.35,
};

const useCubeMap = (path: string) => {
  const [cubeMap, setCubeMap] = useState<CubeTexture>();
  useEffect(() => {
    new CubeTextureLoader()
      .setPath(path)
      .load(
        [
          'posx.jpg',
          'negx.jpg',
          'posy.jpg',
          'negy.jpg',
          'posz.jpg',
          'negz.jpg',
        ],
        (cubeTexture) => {
          setCubeMap(cubeTexture);
        }
      );
  }, [path]);

  return cubeMap;
};

const useEnvMap = (
  renderer: WebGLRenderer,
  bg: string | null,
  key: string,
  assetPath: string
) => {
  const [hdrImage, setHdrImage] = useState<Texture>();
  useEffect(() => {
    if (hdrImage || bg !== key) {
      return;
    }
    new RGBELoader().load(assetPath, (texture) => {
      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      pmremGenerator.dispose();
      setHdrImage(envMap);
    });
  }, [assetPath, key, renderer, setHdrImage, hdrImage, bg]);

  return hdrImage;
};

const repeat = (t: Texture, x: number, y: number) => {
  t.repeat = new Vector2(x, y);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
};

const srgb = (t: Texture) => {
  t.encoding = sRGBEncoding;
  return t;
};

const unflipY = (t: Texture) => {
  t.flipY = false;
  return t;
};

const VectorEditor = ({
  value,
  labels,
  placeholder,
  onChange,
}: {
  value: number[];
  placeholder: number[];
  labels: string[];
  onChange: (vector: number[]) => void;
}) => {
  const validateInteger =
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const val = event.target.value.replace(/[^0-9]/g, '');
      if (val) {
        const parsed = Math.max(1, Math.min(maxResolution, parseFloat(val)));
        const updated = value.map((val, idx) => (idx === index ? parsed : val));
        onChange(updated);
      }
    };
  return (
    <div className={`grid col${labels.length}`}>
      {labels.map((label, index) => (
        <div key={label}>
          <label className="label noselect">
            {label}
            <input
              className="textinput"
              type="text"
              placeholder={placeholder[index].toString()}
              defaultValue={value[index]}
              onChange={validateInteger(index)}
            />
          </label>
        </div>
      ))}
    </div>
  );
};

const ThreeComponent: React.FC<SceneProps> = ({
  compile,
  compileResult,
  graph,
  sceneConfig,
  setSceneConfig,
  setCtx,
  setGlResult,
  assetPrefix,
  takeScreenshotRef,
}) => {
  const path = useCallback((src: string) => assetPrefix + src, [assetPrefix]);
  const shadersUpdated = useRef<boolean>(false);
  const sceneWrapper = useRef<HTMLDivElement>(null);
  const sceneWrapperSize = useSize(sceneWrapper);
  const [isPaused, setIsPaused] = useState(false);

  const { sceneData, scene, camera, threeDomCbRef, renderer } = useThree(
    (time, controls) => {
      const { mesh } = sceneData;
      if (!mesh) {
        return;
      }

      controls.autoRotate = sceneConfig.autoRotate || false;
      controls.autoRotateSpeed = sceneConfig.autoRotateSpeed || 0.5;

      if (shadersUpdated.current) {
        const gl = renderer.getContext();

        const { programs } = renderer.properties.get(mesh.material);

        // These can be null if the scene isn't rendering
        if (programs) {
          const { fragmentShader, vertexShader, program } = programs
            .values()
            .next().value;

          const compiled = gl.getProgramParameter(program, gl.LINK_STATUS);
          if (!compiled) {
            const log = gl.getProgramInfoLog(program)?.trim();

            setGlResult({
              fragError: gl.getShaderInfoLog(fragmentShader)?.trim() || log,
              vertError: gl.getShaderInfoLog(vertexShader)?.trim() || log,
              programError: log,
            });
          } else {
            setGlResult({
              fragError: null,
              vertError: null,
              programError: null,
            });
          }
        }

        shadersUpdated.current = false;
      }

      if (sceneConfig.animatedLights) {
        if (
          sceneConfig.lights === LIGHT_SETTINGS.POINT &&
          sceneData.lights.length >= 1
        ) {
          const light = sceneData.lights[0];
          light.position.x = 1.2 * Math.sin(time * 0.001);
          light.position.y = 1.2 * Math.cos(time * 0.001);
        } else if (
          sceneConfig.lights === LIGHT_SETTINGS.SPOT &&
          sceneData.lights.length >= 2
        ) {
          const light1 = sceneData.lights[0];
          light1.position.x = 1.2 * Math.sin(time * 0.001);
          light1.position.y = 1.2 * Math.cos(time * 0.001);
          light1.lookAt(new Vector3(0, 0, 0));

          const light2 = sceneData.lights[1];
          light2.position.x = 1.3 * Math.cos(time * 0.0015);
          light2.position.y = 1.3 * Math.sin(time * 0.0015);
          light2.lookAt(new Vector3(0, 0, 0));

          if (sceneConfig.showHelpers && sceneData.lights.length >= 2) {
            (sceneData.lights[2] as SpotLightHelper).update();
            (sceneData.lights[3] as SpotLightHelper).update();
          }
        } else if (sceneConfig.lights === LIGHT_SETTINGS.THREE_POINT) {
          const group = sceneData.lights[0];
          group.rotation.x = 1.2 * Math.sin(time * 0.0002);
          group.rotation.y = 1.2 * Math.cos(time * 0.0002);
          group.rotation.z = 1.2 * Math.sin((time + Math.PI) * 0.0002);
        }
      }

      // Note the uniforms are updated here every frame, but also instantiated
      // in this component at RawShaderMaterial creation time. There might be
      // some logic duplication to worry about.
      if (compileResult?.dataInputs) {
        Object.entries(compileResult.dataInputs).forEach(([nodeId, inputs]) => {
          const node = graph.nodes.find(({ id }) => id === nodeId);
          if (!node) {
            console.warn(
              `While populating uniforms, compileResults.dataInput referenced node id "${nodeId}," but this node is not in the graph.`,
              { nodeId, dataInputs: compileResult.dataInputs, graph }
            );
            return;
          }
          inputs.forEach((input) => {
            const edge = graph.edges.find(
              ({ to, input: i }) => to === nodeId && i === input.id
            );
            if (edge) {
              const fromNode = graph.nodes.find(({ id }) => id === edge.from);
              // In the case where a node has been deleted from the graph,
              // dataInputs won't have been udpated until a recompile completes
              if (!fromNode) {
                return;
              }

              let value;
              // THIS DUPLICATES OTHER LINE
              // When a shader is plugged into the Texture node of a megashader,
              // this happens, I'm not sure why yet. In fact, why is this branch
              // getting called at all in useThree() ?
              try {
                value = evaluateNode(threngine, graph, fromNode);
              } catch (err) {
                console.warn(
                  `Tried to evaluate a non-data node! ${input.displayName} on ${node.name}`
                );
                return;
              }
              let newValue = value;
              if (fromNode.type === 'texture') {
                // Runtime uniform updating
                newValue = getAndUpdateTexture(fromNode as TextureNode);
              }
              // TODO RENDER TARGET
              if (fromNode.type === 'samplerCube') {
                newValue = textures[(fromNode as SamplerCubeNode).value];
              }

              if (input.type === 'property') {
                // @ts-ignore
                mesh.material[input.property] = newValue;
              } else {
                // TODO: This doesn't work for engine variables because
                // those aren't suffixed
                const name = mangleVar(
                  input.displayName,
                  threngine,
                  node,
                  findLinkedNode(graph, node.id) as SourceNode
                );

                // @ts-ignore
                if (name in (mesh.material.uniforms || {})) {
                  // @ts-ignore
                  mesh.material.uniforms[name].value = newValue;
                } else {
                  console.warn('Unknown uniform', name);
                }
              }
            }
          });
        });
      }

      // @ts-ignore
      if (mesh.material?.uniforms?.time && !Array.isArray(mesh.material)) {
        // @ts-ignore
        mesh.material.uniforms.time.value = time * 0.001;
      }
      if (
        // @ts-ignore
        mesh.material?.uniforms?.renderResolution &&
        !Array.isArray(mesh.material) &&
        ctx.runtime
      ) {
        // @ts-ignore
        mesh.material.uniforms.renderResolution.value = new Vector2(
          ctx.runtime.renderer.domElement.width,
          ctx.runtime.renderer.domElement.height
        );
      }
      if (
        // @ts-ignore
        mesh.material?.uniforms?.cameraPosition &&
        !Array.isArray(mesh.material)
      ) {
        // @ts-ignore
        mesh.material.uniforms.cameraPosition.value = camera.position;
      }
    },
    isPaused
  );

  const { assets } = useAssetsAndGroups();
  const textureCacheKey = (value: TextureNodeValueData) =>
    `${value.assetId}-${value.versionId}`;
  const textureCache = useRef<Record<string, Texture>>({});
  const loadTexture = useCallback(
    (value: TextureNodeValueData) => {
      if (!textureCache.current) {
        return;
      }
      if (typeof value !== 'object') {
        return;
      }
      const key = textureCacheKey(value);
      if (textureCache.current[key]) {
        return textureCache.current[key];
      }
      const { assetId, versionId } = value;
      if (value.assetId in assets) {
        const { subtype, versions } = assets[assetId];
        const { url } = versions.find((v) => v.id === versionId) || {};
        if (!url) {
          return;
        }
        const tl = new TextureLoader();
        const texture = tl.load(url);
        if (subtype === 'Diffuse') {
          texture.encoding = sRGBEncoding;
        }
        texture.anisotropy = 16;
        textureCache.current[key] = texture;
        return texture;
      }
    },
    [assets, textureCache]
  );

  const getAndUpdateTexture = useCallback(
    (node: TextureNode) => {
      const value = node.value as TextureNodeValueData;
      if (!value) {
        return;
      }
      const properties = value.properties;
      const texture = loadTexture(value as TextureNodeValueData);
      if (!texture) {
        throw new Error(`Could not load texture for node ${node.id}`);
      }
      if (!properties || (texture as any).__properties === properties) {
        return texture;
      }

      if (properties?.repeatTexure && properties?.repeat) {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.set(properties.repeat.x || 1, properties.repeat.y || 1);
      } else {
        texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
        texture.repeat.set(1, 1);
      }
      (texture as any).__properties = properties;
      texture.needsUpdate = true;

      return texture;
    },
    [loadTexture]
  );

  const [textures] = useState<Record<string, any>>({});
  const pondCubeMap = useCubeMap(path('/envmaps/pond/'));
  textures.pondCubeMap = pondCubeMap;

  const warehouseImage = useEnvMap(
    renderer,
    sceneConfig.bg,
    'warehouseImage',
    path('/envmaps/empty_warehouse_01_1k.hdr')
  );
  textures.warehouseImage = warehouseImage;

  const skyImage = useEnvMap(
    renderer,
    sceneConfig.bg,
    'skyImage',
    path('/envmaps/industrial_sunset_puresky_1k.hdr')
  );
  textures.skyImage = skyImage;

  const previousSceneConfig = usePrevious(sceneConfig);
  useEffect(() => {
    if (
      previousSceneConfig?.previewObject === sceneConfig.previewObject &&
      previousSceneConfig?.showNormals === sceneConfig.showNormals &&
      previousSceneConfig?.showTangents === sceneConfig.showTangents &&
      previousSceneConfig?.torusResolution === sceneConfig.torusResolution &&
      previousSceneConfig?.torusKnotResolution ===
        sceneConfig.torusKnotResolution &&
      previousSceneConfig?.boxResolution === sceneConfig.boxResolution &&
      previousSceneConfig?.planeResolution === sceneConfig.planeResolution &&
      previousSceneConfig?.sphereResolution === sceneConfig.sphereResolution &&
      previousSceneConfig?.icosahedronResolution ===
        sceneConfig.icosahedronResolution
    ) {
      return;
    }
    if (sceneData.mesh) {
      scene.remove(sceneData.mesh);
    }

    let mesh: Mesh;
    let geometry: BufferGeometry;
    if (sceneConfig.previewObject === 'torus') {
      geometry = new TorusGeometry(
        0.6,
        0.25,
        ...(sceneConfig.torusResolution || defaultResolution.torusResolution)
      );
    } else if (sceneConfig.previewObject === 'torusknot') {
      geometry = new TorusKnotGeometry(
        0.6,
        0.25,
        ...(sceneConfig.torusKnotResolution ||
          defaultResolution.torusKnotResolution)
      );
    } else if (sceneConfig.previewObject === 'cube') {
      geometry = new BoxGeometry(
        1,
        1,
        1,
        ...(sceneConfig.boxResolution || defaultResolution.boxResolution)
      );
    } else if (sceneConfig.previewObject === 'plane') {
      geometry = new PlaneGeometry(
        1,
        1,
        ...(sceneConfig.planeResolution || defaultResolution.planeResolution)
      );
    } else if (sceneConfig.previewObject === 'sphere') {
      geometry = new SphereGeometry(
        1,
        ...(sceneConfig.sphereResolution || defaultResolution.sphereResolution)
      );
    } else if (sceneConfig.previewObject === 'icosahedron') {
      geometry = new IcosahedronGeometry(
        1,
        ...(sceneConfig.icosahedronResolution ||
          defaultResolution.icosahedronResolution)
      );
    } else {
      throw new Error(
        `Wtf there is no preview object named ${sceneConfig.previewObject}`
      );
    }
    geometry.computeTangents();
    mesh = new Mesh(geometry);
    if (sceneData.mesh) {
      mesh.material = sceneData.mesh.material;
    }
    sceneData.mesh = mesh;
    scene.add(mesh);

    if (sceneConfig.showTangents) {
      const helper = new VertexTangentsHelper(mesh, 0.3, 0xff0000);
      mesh.add(helper);
    }
    if (sceneConfig.showNormals) {
      const helper = new VertexNormalsHelper(mesh, 0.25, 0x00ffff);
      mesh.add(helper);
    }
  }, [
    previousSceneConfig,
    sceneData,
    sceneConfig.showTangents,
    sceneConfig.showNormals,
    sceneConfig.previewObject,
    sceneConfig.torusResolution,
    sceneConfig.torusKnotResolution,
    sceneConfig.boxResolution,
    sceneConfig.planeResolution,
    sceneConfig.sphereResolution,
    sceneConfig.icosahedronResolution,
    scene,
  ]);

  const previousBg = usePrevious(sceneConfig.bg);
  const previousWarehouseImage = usePrevious(warehouseImage);
  const previousPondCubeMap = usePrevious(pondCubeMap);
  const previousSkyImage = usePrevious(skyImage);
  useEffect(() => {
    if (
      sceneConfig.bg === previousBg &&
      warehouseImage === previousWarehouseImage &&
      pondCubeMap === previousPondCubeMap &&
      skyImage === previousSkyImage
    ) {
      return;
    }

    if (sceneConfig.bg) {
      if (sceneConfig.bg === 'modelviewer') {
        const pmremGenerator = new PMREMGenerator(renderer);
        scene.background = pmremGenerator.fromScene(
          new RoomEnvironment(),
          0.04
        ).texture;
        scene.environment = scene.background;
      } else {
        scene.background = textures[sceneConfig.bg];
        scene.environment = textures[sceneConfig.bg];
      }
    } else {
      scene.environment = null;
      scene.background = null;
    }
  }, [
    sceneConfig,
    previousBg,
    renderer,
    previousSceneConfig,
    sceneData,
    sceneConfig.previewObject,
    scene,
    previousSkyImage,
    skyImage,
    previousWarehouseImage,
    warehouseImage,
    pondCubeMap,
    previousPondCubeMap,
    textures,
  ]);

  useEffect(() => {
    const toneMapping = sceneConfig.toneMapping;
    if (toneMapping === 'NoToneMapping') {
      renderer.toneMapping = NoToneMapping;
    } else if (toneMapping === 'LinearToneMapping') {
      renderer.toneMapping = LinearToneMapping;
    } else if (toneMapping === 'ReinhardToneMapping') {
      renderer.toneMapping = ReinhardToneMapping;
    } else if (toneMapping === 'CineonToneMapping') {
      renderer.toneMapping = CineonToneMapping;
    } else if (toneMapping === 'ACESFilmicToneMapping') {
      renderer.toneMapping = ACESFilmicToneMapping;
    }
  }, [renderer, sceneConfig.toneMapping]);

  const [ctx] = useState<EngineContext<ThreeRuntime>>(
    // Use context from hoisted ref as initializer to avoid re-creating context
    // including cache and envmaptexture
    {
      engine: 'three',
      // TODO: Rename runtime to "engine" and make a new nodes and data top level
      // key cache (if we keep the material cache) and type it in the graph
      runtime: {
        renderer,
        sceneData,
        scene,
        camera,
        index: 0,
        engineMaterial: null,
        loaded: false,
        cache: { data: {}, nodes: {} },
      },
      nodes: {},
      debuggingNonsense: {},
    }
  );

  useEffect(() => {
    if (
      // I originally had this to let the three child scene load images, which I
      // thought was a blocking requirement for creating envMap textures. Now I
      // see this can be done synchrounously. Not sure if this is needed, but
      // it sends context to parent, so keeping for now
      !ctx?.runtime?.loaded &&
      // Obviously this needs to be refactored, but this is my stopgap solution
      // for waiting for the env map to load before the context is set. This is
      // for shaders with envmaps. On first page load, the shader compiles
      // before the envmap is loaded, and then the envmap loads, but the cached
      // shader in threngine doesn't support an envMap, so it's locked out.
      ((sceneConfig.bg !== 'warehouseImage' &&
        sceneConfig.bg !== 'pondCubeMap' &&
        sceneConfig.bg !== 'skyImage') ||
        (sceneConfig.bg === 'warehouseImage' && warehouseImage) ||
        (sceneConfig.bg === 'pondCubeMap' && pondCubeMap) ||
        (sceneConfig.bg === 'skyImage' && skyImage))
    ) {
      ctx.runtime.loaded = true;
      // Inform parent our context is created
      setCtx(ctx);
    }
  }, [ctx, setCtx, sceneConfig.bg, warehouseImage, pondCubeMap, skyImage]);

  takeScreenshotRef.current = useCallback(async () => {
    const viewAngle = SceneDefaultAngles[sceneConfig.previewObject];

    const screenshotCanvas = document.createElement('canvas');
    const context2d = screenshotCanvas.getContext('2d');
    if (!context2d) {
      throw new Error('No context');
    }
    const screenshotHeight = 400;
    const screenshotWidth = 400;
    screenshotCanvas.height = screenshotHeight;
    screenshotCanvas.width = screenshotWidth;

    // Set up a camera for the screenshot
    const camera = new PerspectiveCamera(
      45,
      screenshotWidth / screenshotHeight,
      0.1,
      1000
    );
    scene.add(camera);
    camera.position.copy(
      SceneAngleVectors[viewAngle](
        5 * CameraDistances[sceneConfig.previewObject]
      )
    );
    camera.lookAt(new Vector3(0, 0, 0));

    // Set the camera position on the running shader
    const { mesh } = sceneData;
    if (
      // @ts-ignore
      mesh?.material?.uniforms?.cameraPosition &&
      !Array.isArray(mesh?.material)
    ) {
      // @ts-ignore
      mesh.material.uniforms.cameraPosition.value = camera.position;
    }

    // Render to specific size
    const originalSize = new Vector2();
    renderer.getSize(originalSize);
    renderer.setSize(screenshotWidth, screenshotHeight);
    renderer.render(scene, camera);
    const data = renderer.domElement.toDataURL('image/jpeg', 0.9);
    // Reset
    renderer.setSize(originalSize.x, originalSize.y);
    scene.remove(camera);

    return data;
  }, [sceneData, sceneConfig.previewObject, renderer, scene]);

  // The below effect relies on graph, however when the graph changes, it can be
  // from moving nodes or sliding uniform sliders, which should not cause a
  // material re-creation. Putting the graph in a ref lets the effect access it
  // without making it a dependency of the effect.
  const graphRef = useRef<Graph>(graph);
  graphRef.current = graph;

  useEffect(() => {
    if (!compileResult?.fragmentResult) {
      return;
    }

    const material = createMaterial(compileResult, ctx);
    const graph = graphRef.current;

    // const { graph } = compileResult;
    const {
      sceneData: { mesh },
      // engineMaterial,
    } = ctx.runtime as ThreeRuntime;

    log('oh hai birfday boi boi boiiiii');

    // Note this is setting the uniforms of the shader at creation time. The
    // uniforms are also updated every frame in the useThree() loop.
    const { uniforms, properties } = Object.entries(
      compileResult.dataInputs || {}
    ).reduce<{
      uniforms: Record<string, { value: any }>;
      properties: Record<string, any>;
    }>(
      ({ uniforms, properties }, [nodeId, inputs]) => {
        const node = graph.nodes.find(({ id }) => id === nodeId);
        if (!node) {
          console.warn(
            'Graph dataInputs referenced nodeId',
            nodeId,
            'which was not present.',
            { compileResult }
          );
          return { uniforms, properties };
        }
        const updatedUniforms: typeof uniforms = {};
        const updatedProperties: typeof properties = {};

        inputs.forEach((input) => {
          const edge = graph.edges.find(
            ({ to, input: i }) => to === nodeId && i === input.id
          );
          if (edge) {
            const fromNode = ensure(
              graph.nodes.find(({ id }) => id === edge.from)
            );
            // THIS DUPLICATE OTHER LINE
            let value;
            try {
              value = evaluateNode(threngine, graph, fromNode);
            } catch (err) {
              console.warn('Tried to evaluate a non-data node!', {
                err,
                dataInputs: compileResult.dataInputs,
              });
              return;
            }
            let newValue = value;
            if (fromNode.type === 'texture') {
              // This is instantiation of initial value
              newValue = getAndUpdateTexture(fromNode as TextureNode);
            } else if (fromNode.type === 'samplerCube') {
              newValue = textures[(fromNode as SamplerCubeNode).value];
            }
            // TODO: This doesn't work for engine variables because
            // those aren't suffixed
            const name = mangleVar(
              input.displayName,
              threngine,
              node,
              findLinkedNode(graph, node.id) as SourceNode
            );

            if (input.property) {
              updatedProperties[name] = newValue;
            } else {
              updatedUniforms[name] = { value: newValue };
            }
          }
        });
        return {
          uniforms: { ...uniforms, ...updatedUniforms },
          properties: { ...properties, ...updatedProperties },
        };
      },
      {
        uniforms: {},
        properties: {},
      }
    );

    // This prevents a deluge of warnings from three on the constructor saying
    // that each of these properties is not a property of the material
    Object.entries(properties).forEach(([key, value]) => {
      // @ts-ignore
      material[key] = value;
    });

    material.uniforms = {
      ...material.uniforms,
      ...uniforms,
    };

    // Copy the sceneConfig properties onto the material. For now this means
    // that toggling doubleSide etc creates a new material. Also I don't know if
    // these properties require the core material in threngine to get
    // re-created. I did it here because there's not currently a way to pass the
    // scene config into the core graph for compiling.
    material.wireframe = sceneConfig.wireframe;
    // @ts-ignore wtf is this "side" type error that's only in public client?
    material.side = sceneConfig.doubleSide ? DoubleSide : FrontSide;
    material.transparent = sceneConfig.transparent;

    // The envMap needs to be set on the material. Note scene.envMap globally
    // applies to all materials that don't override it. Setting on the
    // material is required to work for the envMapIntensity property to work.
    if (scene.environment) {
      // @ts-ignore
      material.envMap = scene.environment;
    }

    log('🏞 Re-creating Three.js material!', {
      material,
      properties,
      uniforms: material.uniforms,
      engineMaterial: ctx.runtime.engineMaterial,
    });

    mesh.material = material;
    shadersUpdated.current = true;
  }, [
    loadTexture,
    sceneConfig,
    compileResult,
    ctx,
    textures,
    getAndUpdateTexture,
    scene.environment,
  ]);

  const prevLights = usePrevious(sceneConfig.lights);
  const previousShowHelpers = usePrevious(sceneConfig.showHelpers);
  useEffect(() => {
    if (
      // If the lights are unchanged
      (prevLights === sceneConfig.lights &&
        previousShowHelpers === sceneConfig.showHelpers) ||
      // Or if there were no previous lights, but we already have them in the
      // persisted sceneData, we already have three data in memory
      (prevLights === undefined && sceneData.lights.length)
    ) {
      return;
    }
    sceneData.lights.forEach((light) => {
      scene.remove(light);
    });

    let helpers: Object3D[] = [];
    let newLights: Object3D[] = [];
    if (sceneConfig.lights === LIGHT_SETTINGS.POINT) {
      const pointLight = new PointLight(0xffffff, 1);
      pointLight.position.set(0, 0, 2);

      newLights = [pointLight];
      helpers = [new PointLightHelper(pointLight, 0.1)];
    } else if (sceneConfig.lights === LIGHT_SETTINGS.THREE_POINT) {
      const group = new Group();

      const light1 = new PointLight(0xffffff, 1, 0);
      light1.position.set(2, 2, 5);

      const light2 = new PointLight(0xffffff, 1, 0);
      light2.position.set(-2, 5, -5);

      const light3 = new PointLight(0xffffff, 1, 0);
      light3.position.set(5, -5, -5);

      group.add(light1);
      group.add(light2);
      group.add(light3);

      newLights = [group];
      if (sceneConfig.showHelpers) {
        group.add(new PointLightHelper(light1, 0.1));
        group.add(new PointLightHelper(light2, 0.1));
        group.add(new PointLightHelper(light3, 0.1));
      }
    } else if (sceneConfig.lights === LIGHT_SETTINGS.SPOT) {
      const light1 = new SpotLight(0x00ff00, 1, 3, 0.4, 1);
      light1.position.set(0, 0, 2);

      const light2 = new SpotLight(0xff0000, 1, 4, 0.4, 1);
      light2.position.set(0, 0, 2);

      newLights = [light1, light2];
      helpers = [
        new SpotLightHelper(light1, new Color(0x00ff00)),
        new SpotLightHelper(light2, new Color(0xff0000)),
      ];
    }

    if (sceneConfig.showHelpers) {
      sceneData.lights = [...newLights, ...helpers];
    } else {
      sceneData.lights = newLights;
    }
    sceneData.lights.forEach((obj) => {
      scene.add(obj);
    });

    if (
      prevLights &&
      prevLights !== undefined &&
      prevLights !== sceneConfig.lights
    ) {
      if (sceneData.mesh) {
        sceneData.mesh.material = loadingMaterial;
      }

      compile(ctx);
    }
  }, [
    sceneData,
    sceneConfig.lights,
    scene,
    compile,
    ctx,
    prevLights,
    previousShowHelpers,
    sceneConfig.showHelpers,
  ]);

  useEffect(() => {
    if (ctx.runtime?.camera && sceneWrapperSize) {
      const { camera, renderer } = ctx.runtime;

      const canvasWidth = sceneWrapperSize.width;
      const canvasHeight = sceneWrapperSize.height;
      camera.aspect = canvasWidth / canvasHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasWidth, canvasHeight);
    }
  }, [sceneWrapperSize, ctx.runtime]);

  const [editorTabIndex, setEditorTabIndex] = useState(0);

  const resolutionConfig = resolutionConfigMapping[sceneConfig.previewObject];

  return (
    <>
      <Tabs onTabSelect={setEditorTabIndex} selected={editorTabIndex}>
        <TabGroup className={styles.tabBar}>
          <Tab>
            <FontAwesomeIcon icon={faCube} color="#aca" /> Object
          </Tab>
          <Tab>
            <FontAwesomeIcon icon={faCamera} color="#aca" /> Scene
          </Tab>
          <div className={styles.sceneTabControls}>
            <button
              className={styles.playPause}
              onClick={(e) => {
                e.preventDefault();
                setIsPaused((p) => !p);
              }}
              title={isPaused ? 'Resume rendering' : 'Pause rendering'}
            >
              {isPaused ? (
                <FontAwesomeIcon icon={faPlay} />
              ) : (
                <FontAwesomeIcon icon={faPause} />
              )}
            </button>
          </div>
        </TabGroup>
        <TabPanels>
          <TabPanel className={styles.sceneControls}>
            <div>
              <label htmlFor="Modelsfs" className="label noselect">
                <span>Model</span>
              </label>
            </div>
            <div>
              <select
                id="Modelsfs"
                className="select"
                onChange={(event) => {
                  setSceneConfig({
                    ...sceneConfig,
                    previewObject: event.target.value,
                  });
                }}
                value={sceneConfig.previewObject}
              >
                <option value="sphere">Sphere</option>
                <option value="cube">Cube</option>
                <option value="plane">Plane</option>
                <option value="torus">Torus</option>
                <option value="torusknot">Torus Knot</option>
                <option value="icosahedron">Icosahedron</option>
              </select>
            </div>

            <div className={cx(styles.controlGrid, 'm-top-5')}>
              {resolutionConfig ? (
                <VectorEditor
                  value={
                    sceneConfig[resolutionConfig.key] ||
                    defaultResolution[resolutionConfig.key]
                  }
                  placeholder={defaultResolution[resolutionConfig.key]}
                  labels={resolutionConfig.labels}
                  onChange={(v) =>
                    setSceneConfig({
                      ...sceneConfig,
                      [resolutionConfig.key]: v,
                    })
                  }
                />
              ) : null}
            </div>

            <div className="grid col2 m-top-5">
              <div className={styles.controlGrid}>
                <div>
                  <input
                    className="checkbox"
                    id="dbs"
                    type="checkbox"
                    checked={sceneConfig.doubleSide}
                    onChange={(event) =>
                      setSceneConfig({
                        ...sceneConfig,
                        doubleSide: event?.target.checked,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label noselect" htmlFor="dbs">
                    <span>Double Side</span>
                  </label>
                </div>
              </div>

              <div className={styles.controlGrid}>
                <div>
                  <input
                    className="checkbox"
                    id="trnsp"
                    type="checkbox"
                    checked={sceneConfig.transparent}
                    onChange={(event) =>
                      setSceneConfig({
                        ...sceneConfig,
                        transparent: event?.target.checked,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label noselect" htmlFor="trnsp">
                    <span>Transparent</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid col2 m-top-10">
              <div className={styles.controlGrid}>
                <div>
                  <input
                    className="checkbox"
                    id="Wireframesfs"
                    type="checkbox"
                    checked={sceneConfig.wireframe}
                    onChange={(event) =>
                      setSceneConfig({
                        ...sceneConfig,
                        wireframe: event?.target.checked,
                      })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="Wireframesfs" className="label noselect">
                    <span>Wireframe</span>
                  </label>
                </div>
              </div>

              <div className={styles.controlGrid}>
                <div>
                  <input
                    className="checkbox"
                    id="nrm"
                    type="checkbox"
                    checked={sceneConfig.showNormals}
                    onChange={(event) =>
                      setSceneConfig({
                        ...sceneConfig,
                        showNormals: event?.target.checked,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label noselect" htmlFor="nrm">
                    <span>Show Normals</span>
                  </label>
                </div>
              </div>

              <div className={styles.controlGrid}>
                <div>
                  <input
                    className="checkbox"
                    id="tng"
                    type="checkbox"
                    checked={sceneConfig.showTangents}
                    onChange={(event) =>
                      setSceneConfig({
                        ...sceneConfig,
                        showTangents: event?.target.checked,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label noselect" htmlFor="tng">
                    <span>Show Tangents</span>
                  </label>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel className={styles.sceneControls}>
            <div className={cx(styles.controlGrid, 'm-top-5')}>
              <div>
                <label htmlFor="Lightingsfs" className="label noselect">
                  <span>Lighting</span>
                </label>
              </div>
              <div>
                <select
                  id="Lightingsfs"
                  className="select"
                  onChange={(event) => {
                    setSceneConfig({
                      ...sceneConfig,
                      lights: event.target.value,
                    });
                  }}
                  value={sceneConfig.lights}
                >
                  <option value={LIGHT_SETTINGS.NONE}>None</option>
                  <option value={LIGHT_SETTINGS.POINT}>
                    Single Point Light
                  </option>
                  <option value={LIGHT_SETTINGS.THREE_POINT}>
                    Multiple Point Lights
                  </option>
                  <option value={LIGHT_SETTINGS.SPOT}>Spot Lights</option>
                </select>
              </div>
            </div>

            <div className="bottomDivide m-bottom-5 m-top-5">
              <div className="grid span2">
                <div className={styles.controlGrid}>
                  <div>
                    <input
                      className="checkbox"
                      id="sha"
                      type="checkbox"
                      checked={sceneConfig.animatedLights}
                      onChange={(event) =>
                        setSceneConfig({
                          ...sceneConfig,
                          animatedLights: event?.target.checked,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="label noselect" htmlFor="sha">
                      <span>Animate</span>
                    </label>
                  </div>
                </div>

                <div className={styles.controlGrid}>
                  <div>
                    <input
                      className="checkbox"
                      id="shp"
                      type="checkbox"
                      checked={sceneConfig.showHelpers}
                      onChange={(event) =>
                        setSceneConfig({
                          ...sceneConfig,
                          showHelpers: event?.target.checked,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="label noselect" htmlFor="shp">
                      <span>Lighting Helpers</span>
                    </label>
                  </div>
                </div>
              </div>

              {graph.nodes.find(
                (node) => (node as any).engine === true
              ) ? null : (
                <div className="secondary m-top-5 px12">
                  <FontAwesomeIcon icon={faInfoCircle} /> Lights have no effect
                  without a Three.js material in the graph.
                </div>
              )}
            </div>

            <div>
              <label htmlFor="Backgroundsfs" className="label noselect">
                <span>Background</span>
              </label>
            </div>
            <div>
              <select
                id="Backgroundsfs"
                className="select"
                onChange={(event) => {
                  setSceneConfig({
                    ...sceneConfig,
                    bg:
                      event.target.value === 'none' ? null : event.target.value,
                  });
                }}
                value={sceneConfig.bg ? sceneConfig.bg : 'none'}
              >
                <option value="none">None</option>
                <option value="skyImage">Sky</option>
                <option value="warehouseImage">Warehouse</option>
                <option value="pondCubeMap">Pond Cube Map</option>
                <option value="modelviewer">Model Viewer</option>
              </select>
            </div>

            <div
              className={cx(
                styles.controlGrid,
                'm-top-10 bottomDivide m-bottom-10'
              )}
            >
              <div>
                <label htmlFor="tonemappingfs" className="label noselect">
                  <span>Tone Mapping</span>
                </label>
              </div>
              <div>
                <select
                  id="tonemappingfs"
                  className="select"
                  onChange={(event) => {
                    setSceneConfig({
                      ...sceneConfig,
                      toneMapping: event.target.value,
                    });
                  }}
                  value={sceneConfig.toneMapping}
                >
                  <option value="NoToneMapping">NoToneMapping</option>
                  <option value="LinearToneMapping">LinearToneMapping</option>
                  <option value="ReinhardToneMapping">
                    ReinhardToneMapping
                  </option>
                  <option value="CineonToneMapping">CineonToneMapping</option>
                  <option value="ACESFilmicToneMapping">
                    ACESFilmicToneMapping
                  </option>
                </select>
              </div>
            </div>
            <div className="grid span2">
              <div className={styles.controlGrid}>
                <div>
                  <input
                    className="checkbox"
                    id="arc"
                    type="checkbox"
                    checked={sceneConfig.autoRotate}
                    onChange={(event) =>
                      setSceneConfig({
                        ...sceneConfig,
                        autoRotate: event?.target.checked,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label noselect" htmlFor="arc">
                    <span>Auto Rotate Camera</span>
                  </label>
                </div>
              </div>
              <label className="label noselect">
                Auto Rotate Speed
                <input
                  className="textinput"
                  id="ars"
                  type="text"
                  checked={sceneConfig.autoRotateSpeed}
                  onChange={(event) =>
                    setSceneConfig({
                      ...sceneConfig,
                      autoRotateSpeed: clamp(
                        parseFloat(event.target.value),
                        -AUTO_ROTATE_LIMIT,
                        AUTO_ROTATE_LIMIT
                      ),
                    })
                  }
                />
              </label>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <div ref={sceneWrapper} className={styles.sceneContainer}>
        <div ref={threeDomCbRef}></div>
      </div>
    </>
  );
};

export default ThreeComponent;
