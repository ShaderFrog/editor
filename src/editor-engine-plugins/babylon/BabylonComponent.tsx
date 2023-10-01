import * as BABYLON from 'babylonjs';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  mangleVar,
  Graph,
  evaluateNode,
  SamplerCubeNode,
  TextureNode,
} from '@core/graph';
import { EngineContext, EngineNodeType } from '@core/engine';
import {
  babylengine,
  physicalDefaultProperties,
} from '@core/plugins/babylon/bablyengine';

import styles from '../../editor/styles/editor.module.css';

import { useBabylon } from './useBabylon';
import { usePrevious } from '../../editor/hooks/usePrevious';
import { UICompileGraphResult } from '../../editor/uICompileGraphResult';
import { useSize } from '../../editor/hooks/useSize';
import { Nullable } from 'babylonjs';
import { SceneProps } from '@editor/editor/components/Editor';

export type PreviewLight = 'point' | '3point' | 'spot';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(component)\x1b[0m', ...args);

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
    const position = new BABYLON.Vector3(0, 0, radius);

    // No idea if this is righ tlol
    const matrixX = BABYLON.Matrix.RotationAxis(
      BABYLON.Axis.X,
      yPosition * spread
    );
    const matrixY = BABYLON.Matrix.RotationAxis(
      BABYLON.Axis.Y,
      yPosition * spread
    );
    const transformed = BABYLON.Vector3.TransformCoordinates(
      BABYLON.Vector3.TransformCoordinates(position, matrixX),
      matrixY
    );
    return transformed;
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
  plane: 0.485,
  cylinder: 0.38,
  cone: 0.35,
};

let mIdx = 0;
let id = () => mIdx++;
const _err = BABYLON.Logger.Error;
let capturing = false;
let capture: any[] = [];
BABYLON.Logger.Error = (...args) => {
  const str = args[0] || '';
  if (capturing || str.includes('Unable to compile effect')) {
    capturing = true;
    capture.push(str);
    if (str.includes('Error:')) {
      capturing = false;
    }
  }
  _err(...args);
};

type OnBeforeDraw = (mesh: BABYLON.Mesh) => void;
const useOnMeshDraw = (
  mesh: BABYLON.Mesh | undefined,
  callback: (mesh: BABYLON.Mesh) => void
) => {
  const lastMesh = usePrevious(mesh);
  const savedCallback = useRef<(mesh: BABYLON.Mesh) => void>(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (mesh && lastMesh !== mesh) {
      const applied: OnBeforeDraw = (mesh) => savedCallback.current(mesh);
      log('Setting new onBeforeDrawObservable callback on mesh!');
      if (lastMesh) {
        lastMesh.onBeforeDrawObservable.clear();
      }
      mesh.onBeforeDrawObservable.clear();
      mesh.onBeforeDrawObservable.add(applied);
    }
  }, [lastMesh, mesh]);
};

const lightHelper = (scene: BABYLON.Scene, parent: BABYLON.Light) => {
  const helper = BABYLON.MeshBuilder.CreatePolyhedron(
    'oct',
    { type: 1, size: 0.075 },
    scene
  );
  const mat1 = new BABYLON.StandardMaterial('lighthelpermat' + id(), scene);
  mat1.emissiveColor = new BABYLON.Color3(1, 1, 1);
  mat1.wireframe = true;
  helper.material = mat1;
  helper.setParent(parent);

  return helper;
};

const BabylonComponent: React.FC<SceneProps> = ({
  compile,
  compileResult,
  graph,
  lights,
  setLights,
  animatedLights,
  setAnimatedLights,
  previewObject,
  setCtx,
  setGlResult,
  setPreviewObject,
  bg,
  setBg,
  showHelpers,
  setShowHelpers,
  width,
  height,
  assetPrefix,
  takeScreenshotRef,
}) => {
  const path = useCallback((src: string) => assetPrefix + src, [assetPrefix]);
  const checkForCompileErrors = useRef<boolean>(false);
  const lastCompile = useRef<any>({});
  const sceneWrapper = useRef<HTMLDivElement>(null);
  const size = useSize(sceneWrapper);

  const {
    canvas,
    sceneData,
    babylonDomRef,
    scene,
    camera,
    engine,
    loadingMaterial,
  } = useBabylon((time) => {
    if (checkForCompileErrors.current) {
      setGlResult({
        fragError: capture.find((str) => str.includes('FRAGMENT SHADER ERROR')),
        vertError: capture.find((str) => str.includes('VERTEX SHADER ERROR')),
        programError: '',
      });
      checkForCompileErrors.current = false;
    }

    const { lights: lightMeshes } = sceneData;
    if (animatedLights) {
      if (lights === 'point') {
        const light = lightMeshes[0] as BABYLON.PointLight;
        light.position.x = 1.2 * Math.sin(time * 0.001);
        light.position.y = 1.2 * Math.cos(time * 0.001);
      } else if (lights === 'spot') {
        // I haven't done this yet
      }
    }

    engine.beginFrame();
    scene.render();
    engine.endFrame();
  });

  const textures = useMemo<
    Record<
      string,
      BABYLON.Texture | BABYLON.HDRCubeTexture | BABYLON.CubeTexture | null
    >
  >(
    () => ({
      explosion: new BABYLON.Texture(path('/explosion.png'), scene),
      'grayscale-noise': new BABYLON.Texture(
        path('/grayscale-noise.png'),
        scene
      ),
      threeTone: new BABYLON.Texture(path('/3tone.jpg'), scene),
      brick: new BABYLON.Texture(path('/bricks.jpeg'), scene),
      brickNormal: new BABYLON.Texture(path('/bricknormal.jpeg'), scene),
      pebbles: new BABYLON.Texture(path('/Big_pebbles_pxr128.jpeg'), scene),
      pebblesNormal: new BABYLON.Texture(
        path('/Big_pebbles_pxr128_normal.jpeg'),
        scene
      ),
      pebblesBump: new BABYLON.Texture(
        path('/Big_pebbles_pxr128_bmp.jpeg'),
        scene
      ),
      pondCubeMap: null,
      warehouseEnvTexture: new BABYLON.HDRCubeTexture(
        path('/envmaps/room.hdr'),
        scene,
        512
      ),
      cityCourtYard: BABYLON.CubeTexture.CreateFromPrefilteredData(
        path('/envmaps/citycourtyard.dds'),
        scene
      ),
    }),
    [scene, path]
  );

  useEffect(() => {
    if (sceneData.mesh) {
      sceneData.mesh.onBeforeDrawObservable.clear();
      sceneData.mesh.dispose();
    }

    let mesh: BABYLON.Mesh;
    if (previewObject === 'torusknot') {
      mesh = BABYLON.MeshBuilder.CreateTorusKnot(
        'torusKnot',
        {
          radius: 0.5,
          tube: 0.15,
          radialSegments: 128,
        },
        scene
      );
    } else if (previewObject === 'plane') {
      mesh = BABYLON.MeshBuilder.CreatePlane(
        'plane1',
        { size: 2, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
        scene
      );
      mesh.increaseVertices(4);
    } else if (previewObject === 'cube') {
      mesh = BABYLON.MeshBuilder.CreateBox(
        'cube1',
        {
          size: 1,
        },
        scene
      );
      mesh.increaseVertices(2);
    } else if (previewObject === 'sphere') {
      mesh = BABYLON.MeshBuilder.CreateSphere(
        'sphere1',
        {
          segments: 64,
          diameter: 2,
        },
        scene
      );
      mesh.increaseVertices(2);
    } else if (previewObject === 'icosahedron') {
      mesh = BABYLON.MeshBuilder.CreatePolyhedron(
        'oct',
        { type: 3, size: 1 },
        scene
      );
    } else {
      throw new Error('fffffff');
    }
    if (sceneData.mesh) {
      mesh.material = sceneData.mesh.material;
    }
    sceneData.mesh = mesh;
  }, [previewObject, scene, sceneData]);

  const meshUpdater = useCallback(
    (mesh: BABYLON.Mesh) => {
      if (mesh && mesh.material) {
        const effect = mesh.material.getEffect();
        if (!effect) {
          return;
        }
        effect.setFloat('time', performance.now() * 0.001);

        // Note the uniforms are updated here every frame, but also instantiated
        // in this component at RawShaderMaterial creation time. There might be
        // some logic duplication to worry about.
        if (compileResult?.dataInputs && sceneData.mesh?.material) {
          const material = sceneData.mesh.material as BABYLON.Material &
            Record<string, any>;
          Object.entries(compileResult.dataInputs).forEach(
            ([nodeId, inputs]) => {
              const node = graph.nodes.find(({ id }) => id === nodeId);
              if (!node) {
                console.warn(
                  'While populating uniforms, no node was found from dataInputs',
                  { nodeId, dataInputs: compileResult.dataInputs, graph }
                );
                return;
              }
              inputs.forEach((input) => {
                const edge = graph.edges.find(
                  ({ to, input: i }) => to === nodeId && i === input.id
                );
                if (edge) {
                  const fromNode = graph.nodes.find(
                    ({ id }) => id === edge.from
                  );
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
                    value = evaluateNode(babylengine, graph, fromNode);
                  } catch (err) {
                    console.warn(
                      `Tried to evaluate a non-data node! ${input.displayName} on ${node.name}`
                    );
                    return;
                  }
                  let newValue = value;
                  if (fromNode.type === 'texture') {
                    // THIS DUPLICATES OTHER LINE, used for runtime uniform setting
                    newValue = textures[(fromNode as TextureNode).value];
                    // console.log('setting texture', newValue, 'from', fromNode);
                  }
                  if (fromNode.type === 'samplerCube') {
                    newValue = textures[(fromNode as SamplerCubeNode).value];
                  }

                  if (input.type === 'property' && input.property) {
                    if (
                      !newValue.url ||
                      material[input.property]?.url !== newValue.url
                    ) {
                      material[input.property] = newValue;
                    }
                  } else {
                    // TODO: This doesn't work for engine variables because
                    // those aren't suffixed
                    const name = mangleVar(
                      input.displayName,
                      babylengine,
                      node
                    );

                    // @ts-ignore
                    if (fromNode.type === 'number') {
                      effect.setFloat(name, newValue);
                    } else if (fromNode.type === 'vector2') {
                      effect.setVector2(name, newValue);
                    } else if (fromNode.type === 'vector3') {
                      effect.setVector3(name, newValue);
                    } else if (fromNode.type === 'vector4') {
                      effect.setVector4(name, newValue);
                    } else if (fromNode.type === 'rgb') {
                      effect.setColor3(name, newValue);
                    } else if (fromNode.type === 'rgba') {
                      // TODO: Uniforms aren't working for plugging in purple noise
                      // shader to Texture filler of babylon physical - was getting
                      // webgl warnings, but now object is black? Also I need to
                      // get the actual color4 alpha value here
                      effect.setColor4(name, newValue, 1.0);
                    } else if (fromNode.type === 'texture') {
                      effect.setTexture(name, newValue);
                    } else {
                      log(`Unknown uniform type: ${fromNode.type}`);
                    }
                  }
                }
              });
            }
          );
        }
      }
    },
    [compileResult?.dataInputs, sceneData.mesh, graph, textures]
  );

  useOnMeshDraw(sceneData.mesh, meshUpdater);

  const [ctx] = useState<EngineContext>(() => {
    return {
      engine: 'babylon',
      runtime: {
        BABYLON,
        scene,
        camera,
        sceneData,
        cache: { nodes: {}, data: {} },
      },
      nodes: {},
      debuggingNonsense: {},
    };
  });

  // Inform parent our context is created
  useEffect(() => {
    setCtx(ctx);
  }, [ctx, setCtx]);

  const previousPreviewObject = usePrevious(previewObject);
  const previousBg = usePrevious(bg);
  const skybox = useRef<Nullable<BABYLON.Mesh>>();
  useEffect(() => {
    if (bg === previousBg) {
      return;
    }
    const newBg = bg ? textures[bg] : null;
    scene.environmentTexture = newBg;
    if (skybox.current) {
      skybox.current.dispose();
    }
    if (newBg) {
      skybox.current = scene.createDefaultSkybox(newBg);
    }
  }, [
    bg,
    previousBg,
    previousPreviewObject,
    sceneData,
    previewObject,
    scene,
    textures,
  ]);

  useEffect(() => {
    if (!compileResult?.fragmentResult) {
      // log('Not yet creating a Babylon material as there is no fragmentResult');
      return;
    }
    const { graph } = compileResult;

    const pbrName = `component_pbr_${id()}`;
    log('🛠 Re-creating BPR material', {
      pbrName,
      scene,
      compileResult,
    });

    // TODO: This hard codes the assumption there's a Physical material in the
    // graph.
    const shaderMaterial = new BABYLON.PBRMaterial(pbrName, scene);
    // @ts-ignore
    const graphProperties: Record<string, any> = {};

    // Babylon has some internal uniforms like vAlbedoInfos that are only set
    // if a property is set on the object. If a shader is plugged in to an image
    // property, this code sets a placeholder image, to force Babylon to create
    // the internal uniforms, even though they aren't used on the property image
    const physicalFragmentNode = graph.nodes.find(
      (n) =>
        'stage' in n &&
        n.stage === 'fragment' &&
        n.type === EngineNodeType.physical
    );
    if (physicalFragmentNode) {
      physicalFragmentNode.inputs.forEach((input) => {
        const edge = graph.edges.find(
          ({ to, input: i }) => to === physicalFragmentNode.id && i === input.id
        );
        // @ts-ignore
        if (edge) {
          if (input?.dataType === 'texture' && input.property) {
            graphProperties[input.property] =
              textures.brickNormal as BABYLON.Texture;
          }
        }
      });
    }

    // Possible PBRMaterial defaults
    // Ensures irradiance is computed per fragment to make the bump visible

    // todo:
    // refaction works if set subsurface here, and in babylengine. so need to
    // make sub properties settable in default properties.
    // and examples need to be engine specific becuse three transmission
    // doesn't translate to babylon properties easily
    // see https://playground.babylonjs.com/#FEEK7G#546 working transmission example with ior
    // all to get glass fireball working
    shaderMaterial.linkRefractionWithTransparency = true;
    shaderMaterial.subSurface.isRefractionEnabled = true;
    // shaderMaterial.forceIrradianceInFragment = true;
    // shaderMaterial.bumpTexture = images.brickNormal as BABYLON.Texture;
    // shaderMaterial.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);
    // shaderMaterial.metallic = 0.0;
    // Roughness of 0 makes the material black.
    // shaderMaterial.roughness = 1.0;

    const newProperties = {
      ...physicalDefaultProperties,
      ...graphProperties,
    };
    log('Component material properties', { newProperties });
    Object.assign(shaderMaterial, newProperties);

    // If you define a custom shader name, Babylon tries to look up that
    // shader's source code in the ShaderStore. If it's not present, Babylon
    // makes a network call to try to find the shader. Setting these values
    // makes Babylon not perform a network call. Ironically these values are
    // completely discarded because of processFinalCode.
    BABYLON.Effect.ShadersStore[pbrName + 'VertexShader'] =
      'Cant Be Empty Despite Being Unused';
    BABYLON.Effect.ShadersStore[pbrName + 'FragmentShader'] =
      'Cant Be Empty Despite Being Unused';

    let didResove = false;
    shaderMaterial.customShaderNameResolve = (
      shaderName,
      uniforms,
      uniformBuffers,
      samplers,
      defines,
      attributes,
      options
    ) => {
      lastCompile.current.vertexResult = compileResult?.vertexResult;
      lastCompile.current.fragmentResult = compileResult?.fragmentResult;
      if (!Array.isArray(defines)) {
        defines.source =
          compileResult?.vertexResult + compileResult?.fragmentResult;
      }

      uniforms.push('time');

      // Take the data nodes from the graph and add them to the shader definition.
      // Note dataInputs uses non-baked inputs only. Adding a Texture() to the
      // diffuseMap property is done above physicalFragmentNode.
      // TODO: I wrote collectInitialEvaluatedGraphProperties() to make this an
      // engine concern, but didn't account for the different logic below
      // (uniforms.push() for example). Are these mergable? This is a lot of code
      // to have in the component, would be nice to move into the engine.
      if (compileResult?.dataInputs) {
        Object.entries(compileResult.dataInputs).forEach(([nodeId, inputs]) => {
          const node = graph.nodes.find(({ id }) => id === nodeId);
          if (!node) {
            console.warn(
              'While creating uniforms, no node was found from dataInputs',
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
              const name = mangleVar(input.displayName, babylengine, node);
              if (input.type !== 'property') {
                uniforms.push(name);
              }
              if (fromNode.type === 'texture') {
                samplers.push(name);
              }
            }
          });
        });
      }

      log(`${pbrName} PBRMaterial customShaderNameResolve called...`, {
        defines,
        uniforms,
      });

      if (options) {
        options.processFinalCode = (type, _code) => {
          didResove = true;
          log(
            `${pbrName} scene processFinalCode called, setting ${type} shader source!`
          );
          // return _code;
          if (type === 'vertex') {
            if (!compileResult?.vertexResult) {
              console.error('No vertex result for Babylon shader!');
            }
            // log('Setting vertex source', {
            //   code,
            //   type,
            //   vert: compileResult?.vertexResult,
            // });
            return compileResult?.vertexResult;
          }
          // log('Setting fragment source', {
          //   code,
          //   type,
          //   frag: compileResult?.fragmentResult,
          // });
          // Babylo
          return compileResult?.fragmentResult.replace(
            'out vec4 glFragColor',
            ''
          );
        };
      } else {
        console.warn(
          'No options present to set processFinalCode on, cannot set shader source!'
        );
      }
      capture = [];
      checkForCompileErrors.current = true;
      return pbrName;
    };

    setTimeout(() => {
      if (!didResove) {
        log('❌ DID NOT RE-CREATE SHADER ❌');
      }
    }, 100);

    if (sceneData.mesh) {
      sceneData.mesh.material = shaderMaterial;
    } else {
      console.warn('No mesh to assign the material to!');
    }
    // sceneRef.current.shadersUpdated = true;
  }, [scene, compileResult, textures.brickNormal, sceneData.mesh]);

  const prevLights = usePrevious(lights);
  const previousShowHelpers = usePrevious(showHelpers);
  useEffect(() => {
    if (
      (prevLights === lights && previousShowHelpers === showHelpers) ||
      (prevLights === undefined && sceneData.lights.length)
    ) {
      return;
    }
    sceneData.lights.forEach((light) => light.dispose());

    if (lights === 'point') {
      const pointLight = new BABYLON.PointLight(
        'p1',
        new BABYLON.Vector3(1, 0, 0),
        scene
      );
      pointLight.position = new BABYLON.Vector3(0, 0, 1);
      pointLight.diffuse = new BABYLON.Color3(1, 1, 1);
      pointLight.specular = new BABYLON.Color3(1, 1, 1);
      sceneData.lights = [pointLight];

      // https://forum.babylonjs.com/t/creating-a-mesh-without-adding-to-the-scene/12546/17
      // :(
      if (showHelpers) {
        const sphere1 = lightHelper(scene, pointLight);
        sphere1.position = new BABYLON.Vector3(0, 0, 2);
        sceneData.lights = sceneData.lights.concat(sphere1);
      }
    } else if (lights === '3point') {
      const light1 = new BABYLON.PointLight(
        'light1',
        new BABYLON.Vector3(2, -2, 0),
        scene
      );

      const light2 = new BABYLON.PointLight(
        'light2',
        new BABYLON.Vector3(-1, 2, 1),
        scene
      );

      const light3 = new BABYLON.PointLight(
        'light3',
        new BABYLON.Vector3(-1, -2, -1),
        scene
      );

      sceneData.lights = [light1, light2, light3];

      if (showHelpers) {
        const sphere1 = lightHelper(scene, light1);
        sphere1.position = new BABYLON.Vector3(2, -2, 0);
        const sphere2 = lightHelper(scene, light2);
        sphere2.position = new BABYLON.Vector3(-1, 2, 1);
        const sphere3 = lightHelper(scene, light3);
        sphere3.position = new BABYLON.Vector3(-1, -2, -1);

        sceneData.lights = sceneData.lights.concat(sphere1, sphere2, sphere3);
      }
    } else if (lights === 'spot') {
      const spot1 = new BABYLON.SpotLight(
        'spotLight',
        new BABYLON.Vector3(0, 0, 2),
        new BABYLON.Vector3(0, 0, -1),
        Math.PI,
        0.1,
        scene
      );
      spot1.position = new BABYLON.Vector3(0, 0, 2);
      spot1.diffuse = new BABYLON.Color3(0, 1, 0);
      spot1.specular = new BABYLON.Color3(0, 1, 0);

      const spot2 = new BABYLON.SpotLight(
        'spotLight2',
        new BABYLON.Vector3(0, 0, 2),
        new BABYLON.Vector3(0, 0, -1),
        Math.PI,
        0.1,
        scene
      );
      spot2.position = new BABYLON.Vector3(0, 0, 2);
      spot2.diffuse = new BABYLON.Color3(1, 0, 0);
      spot2.specular = new BABYLON.Color3(1, 0, 0);

      sceneData.lights = [spot1, spot2];

      if (showHelpers) {
        const sphere1 = lightHelper(scene, spot1);
        sphere1.position = new BABYLON.Vector3(0, 0, 2);

        const sphere2 = lightHelper(scene, spot2);
        sphere2.position = new BABYLON.Vector3(0, 0, 2);

        sceneData.lights = sceneData.lights.concat(sphere1, sphere2);
      }
    }

    if (prevLights && prevLights !== undefined && prevLights !== lights) {
      if (sceneData.mesh) {
        sceneData.mesh.material = loadingMaterial;
      }
      compile(ctx);
    }
  }, [
    sceneData,
    prevLights,
    lights,
    scene,
    compile,
    ctx,
    previousShowHelpers,
    showHelpers,
    loadingMaterial,
  ]);

  useEffect(() => {
    canvas.width = width;
    canvas.height = height;
    engine.resize();
  }, [engine, canvas, width, height, ctx.runtime]);

  takeScreenshotRef.current = useCallback(async () => {
    const viewAngle = SceneDefaultAngles[previewObject];

    const screenshotHeight = 400;
    const screenshotWidth = 400;

    const camera = new BABYLON.FreeCamera(
      'screenshotCamera',
      SceneAngleVectors[viewAngle](5 * CameraDistances[previewObject]),
      scene
    );
    camera.setTarget(BABYLON.Vector3.Zero());

    return new Promise<string>((resolve) => {
      BABYLON.Tools.CreateScreenshotUsingRenderTarget(
        engine,
        camera,
        {
          width: screenshotWidth,
          height: screenshotHeight,
        },
        resolve
      );
    });
  }, [previewObject, scene, engine]);

  return (
    <>
      <div className={styles.sceneControls}>
        <div className={styles.controlGrid}>
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
                setLights(event.target.value);
              }}
              value={lights}
            >
              <option value="point">Single Point Light</option>
              <option value="3point">Multiple Point Lights</option>
              {/* <option value="spot">Spot Lights</option> */}
            </select>
          </div>

          <div className="grid span2">
            <div className={styles.controlGrid}>
              <div>
                <input
                  className="checkbox"
                  id="shp"
                  type="checkbox"
                  checked={showHelpers}
                  onChange={(event) => setShowHelpers(event?.target.checked)}
                />
              </div>
              <div>
                <label className="label noselect" htmlFor="shp">
                  <span>Lighting Helpers</span>
                </label>
              </div>
            </div>
            <div className={styles.controlGrid}>
              <div>
                <input
                  className="checkbox"
                  id="sha"
                  type="checkbox"
                  checked={animatedLights}
                  onChange={(event) => setAnimatedLights(event?.target.checked)}
                />
              </div>
              <div>
                <label className="label noselect" htmlFor="sha">
                  <span>Animate</span>
                </label>
              </div>
            </div>
          </div>

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
                setPreviewObject(event.target.value);
              }}
              value={previewObject}
            >
              <option value="sphere">Sphere</option>
              <option value="cube">Cube</option>
              <option value="plane">Plane</option>
              <option value="torusknot">Torus Knot</option>
              <option value="icosahedron">Icosahedron</option>
            </select>
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
                setBg(
                  event.target.value === 'none' ? null : event.target.value
                );
              }}
              value={bg ? bg : 'none'}
            >
              <option value="none">None</option>
              <option value="warehouseEnvTexture">Warehouse</option>
              <option value="pondCubeMap">Pond Cube Map</option>
              <option value="modelviewer">Model Viewer</option>
            </select>
          </div>
        </div>
      </div>

      <div ref={sceneWrapper} className={styles.sceneContainer}>
        <div ref={babylonDomRef} className={styles.babylonContainer}></div>
      </div>
    </>
  );
};

export default BabylonComponent;
