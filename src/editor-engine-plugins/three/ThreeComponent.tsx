import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as three from 'three';
import { mangleVar } from '@core/graph';
import { Graph } from '@core/graph-types';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EngineContext } from '@core/engine';

import styles from '../../editor/styles/editor.module.css';

import { threngine, ThreeRuntime } from '@core/plugins/three/threngine';

import { useThree } from './useThree';
import { usePrevious } from '../../editor/hooks/usePrevious';
import { UICompileGraphResult } from '../../editor/uICompileGraphResult';
import { PreviewLight } from '../../editor/components/Editor';
import { ensure } from '../../editor-util/ensure';
import { SamplerCubeNode, TextureNode } from '@core/nodes/data-nodes';
import { useSize } from '../../editor/hooks/useSize';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from './RoomEnvironment';
import { evaluateNode } from '@core/evaluate';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(component)\x1b[0m', ...args);

const loadingMaterial = new three.MeshBasicMaterial({ color: 'pink' });

function mapTextureMapping(texture: three.Texture, mapping: any) {
  if (mapping === three.EquirectangularReflectionMapping) {
    texture.mapping = three.CubeReflectionMapping;
  } else if (mapping === three.EquirectangularRefractionMapping) {
    texture.mapping = three.CubeRefractionMapping;
  }
  return texture;
}

type AnyFn = (...args: any) => any;
type ThreeSceneProps = {
  compile: AnyFn;
  compileResult: UICompileGraphResult | undefined;
  graph: Graph;
  lights: PreviewLight;
  animatedLights: boolean;
  setAnimatedLights: AnyFn;
  previewObject: string;
  bg: string | undefined;
  setBg: AnyFn;
  setCtx: (ctx: EngineContext) => void;
  initialCtx: any;
  setGlResult: AnyFn;
  setLights: AnyFn;
  setPreviewObject: AnyFn;
  showHelpers: boolean;
  setShowHelpers: AnyFn;
  width: number;
  height: number;
  assetPrefix: string;
};

const repeat = (t: three.Texture, x: number, y: number) => {
  t.repeat = new three.Vector2(x, y);
  t.wrapS = t.wrapT = three.RepeatWrapping;
  return t;
};

const ThreeComponent: React.FC<ThreeSceneProps> = ({
  compile,
  compileResult,
  graph,
  lights,
  animatedLights,
  setAnimatedLights,
  previewObject,
  setCtx,
  initialCtx,
  setGlResult,
  setLights,
  showHelpers,
  setShowHelpers,
  setPreviewObject,
  bg,
  setBg,
  assetPrefix,
}) => {
  const path = useCallback((src: string) => assetPrefix + src, [assetPrefix]);
  const shadersUpdated = useRef<boolean>(false);
  const sceneWrapper = useRef<HTMLDivElement>(null);
  const sceneWrapperSize = useSize(sceneWrapper);

  const { sceneData, scene, camera, threeDomCbRef, renderer } = useThree(
    (time) => {
      const { mesh } = sceneData;
      if (!mesh) {
        return;
      }

      if (shadersUpdated.current) {
        const gl = renderer.getContext();

        const { fragmentShader, vertexShader, program } = renderer.properties
          .get(mesh.material)
          .programs.values()
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

        shadersUpdated.current = false;
      }

      if (animatedLights) {
        if (lights === 'point' && sceneData.lights.length >= 1) {
          const light = sceneData.lights[0];
          light.position.x = 1.2 * Math.sin(time * 0.001);
          light.position.y = 1.2 * Math.cos(time * 0.001);
        } else if (lights === 'point' && sceneData.lights.length >= 1) {
          const light = sceneData.lights[0];
          light.position.x = 1.2 * Math.sin(time * 0.001);
          light.position.y = 1.2 * Math.cos(time * 0.001);
        } else if (lights === 'spot' && sceneData.lights.length >= 2) {
          const light = sceneData.lights[0];
          light.position.x = 1.2 * Math.sin(time * 0.001);
          light.position.y = 1.2 * Math.cos(time * 0.001);
          light.lookAt(new three.Vector3(0, 0, 0));

          const light1 = sceneData.lights[1];
          light1.position.x = 1.3 * Math.cos(time * 0.0015);
          light1.position.y = 1.3 * Math.sin(time * 0.0015);

          light1.lookAt(new three.Vector3(0, 0, 0));
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
                // THIS DUPLICATES OTHER LINE, used for runtime uniform setting
                newValue = textures[(fromNode as TextureNode).value];
              }
              // TODO RENDER TARGET
              if (fromNode.type === 'samplerCube') {
                return;
              }

              if (input.type === 'property') {
                // @ts-ignore
                mesh.material[input.property] = newValue;
              } else {
                // TODO: This doesn't work for engine variables because
                // those aren't suffixed
                const name = mangleVar(input.displayName, threngine, node);

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
    }
  );

  const textures = useMemo<Record<string, any>>(
    () => ({
      explosion: new three.TextureLoader().load(path('/explosion.png')),
      'grayscale-noise': new three.TextureLoader().load(
        path('/grayscale-noise.png')
      ),
      threeTone: (() => {
        const image = new three.TextureLoader().load(path('/3tone.jpg'));
        image.minFilter = three.NearestFilter;
        image.magFilter = three.NearestFilter;
        return image;
      })(),
      brick: repeat(new three.TextureLoader().load(path('/bricks.jpeg')), 3, 3),
      brickNormal: repeat(
        new three.TextureLoader().load(path('/bricknormal.jpeg')),
        3,
        3
      ),
      pebbles: repeat(
        new three.TextureLoader().load(path('/Big_pebbles_pxr128.jpeg')),
        3,
        3
      ),
      pebblesNormal: repeat(
        new three.TextureLoader().load(path('/Big_pebbles_pxr128_normal.jpeg')),
        3,
        3
      ),
      pebblesBump: repeat(
        new three.TextureLoader().load(path('/Big_pebbles_pxr128_bmp.jpeg')),
        3,
        3
      ),
      pondCubeMap: new three.CubeTextureLoader()
        .setPath(path('/envmaps/pond/'))
        .load([
          'posx.jpg',
          'negx.jpg',
          'posy.jpg',
          'negy.jpg',
          'posz.jpg',
          'negz.jpg',
        ]),
      warehouseEnvTexture: null,
    }),
    [path]
  );

  const [warehouseImage, setWarehouseImage] = useState<{
    texture: three.DataTexture;
    envMap: three.Texture;
  }>();
  useEffect(() => {
    if (warehouseImage) {
      return;
    }
    new RGBELoader().load(
      path('/envmaps/empty_warehouse_01_2k.hdr'),
      (texture) => {
        const pmremGenerator = new three.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        pmremGenerator.dispose();
        textures.warehouseEnvTexture = envMap;
        setWarehouseImage({ texture, envMap });
      }
    );
  }, [renderer, setWarehouseImage, warehouseImage, textures, path]);

  const previousPreviewObject = usePrevious(previewObject);
  useEffect(() => {
    if (previousPreviewObject === previewObject) {
      return;
    }
    if (sceneData.mesh) {
      scene.remove(sceneData.mesh);
    }

    let mesh: three.Mesh;
    let geometry: three.BufferGeometry;
    if (previewObject === 'torusknot') {
      geometry = new three.TorusKnotGeometry(0.6, 0.25, 200, 32);
    } else if (previewObject === 'cube') {
      geometry = new three.BoxGeometry(1, 1, 1, 64, 64, 64);
    } else if (previewObject === 'plane') {
      geometry = new three.PlaneGeometry(1, 1, 64, 64);
    } else if (previewObject === 'sphere') {
      geometry = new three.SphereGeometry(1, 128, 128);
    } else if (previewObject === 'icosahedron') {
      geometry = new three.IcosahedronGeometry(1, 0);
    } else {
      throw new Error(`Wtf there is no preview object named ${previewObject}`);
    }
    mesh = new three.Mesh(geometry);
    if (sceneData.mesh) {
      mesh.material = sceneData.mesh.material;
    }
    sceneData.mesh = mesh;
    scene.add(mesh);
  }, [previousPreviewObject, sceneData, previewObject, scene]);

  const previousBg = usePrevious(bg);
  const previousWarehouseImage = usePrevious(warehouseImage);
  useEffect(() => {
    if (bg === previousBg && warehouseImage === previousWarehouseImage) {
      return;
    }

    if (bg) {
      if (bg === 'modelviewer') {
        const pmremGenerator = new PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(
          new RoomEnvironment(),
          0.04
        ).texture;
        scene.background = scene.environment;
      } else {
        scene.background = textures[bg];
        scene.environment = textures[bg];
      }
    } else {
      scene.environment = null;
      scene.background = null;
    }
  }, [
    bg,
    previousBg,
    renderer,
    previousPreviewObject,
    sceneData,
    previewObject,
    scene,
    previousWarehouseImage,
    warehouseImage,
    textures,
  ]);

  const [ctx] = useState<EngineContext>(
    // Use context from hoisted ref as initializer to avoid re-creating context
    // including cache and envmaptexture
    initialCtx || {
      engine: 'three',
      // TODO: Rename runtime to "engine" and make a new nodes and data top level
      // key cache (if we keep the material cache) and type it in the graph
      runtime: {
        three,
        renderer,
        sceneData,
        scene,
        camera,
        index: 0,
        cache: { data: {}, nodes: {} },
      },
      nodes: {},
      debuggingNonsense: {},
    }
  );

  useEffect(() => {
    // I originally had this to let the three child scene load images, which I
    // thought was a blocking requirement fo creating envMap textures. Now I
    // see this can be done synchrounously. Not sure if this is needed, but
    // it sends context to parent, so keeping for now
    if (!ctx?.runtime?.loaded) {
      ctx.runtime.loaded = true;
      // Inform parent our context is created
      setCtx(ctx);
    }
  }, [ctx, setCtx]);

  useEffect(() => {
    if (!compileResult?.fragmentResult) {
      return;
    }
    const { graph } = compileResult;
    const {
      sceneData: { mesh },
      engineMaterial,
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
        const node = ensure(graph.nodes.find(({ id }) => id === nodeId));
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
              // THIS DUPLICATES OTHER LINE
              // This is instantiation of initial shader
              newValue = textures[(fromNode as TextureNode).value];
            } else if (fromNode.type === 'samplerCube') {
              newValue = textures[(fromNode as SamplerCubeNode).value];
            }
            // TODO: This doesn't work for engine variables because
            // those aren't suffixed
            const name = mangleVar(input.displayName, threngine, node);

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

    const finalUniforms = {
      // TODO: Get these from threngine
      ...three.ShaderLib.phong.uniforms,
      ...three.ShaderLib.toon.uniforms,
      ...three.ShaderLib.physical.uniforms,
      ...uniforms,
      time: { value: 0 },
    };

    const initialProperties = {
      name: 'ShaderFrog Material',
      lights: true,
      uniforms: {
        ...finalUniforms,
      },
      transparent: true,
      opacity: 1.0,
      vertexShader: compileResult?.vertexResult,
      fragmentShader: compileResult?.fragmentResult,
    };

    const additionalProperties = Object.entries({
      ...engineMaterial,
      ...properties,
    })
      .filter(
        ([property]) =>
          // Ignore three material "hidden" properties
          property.charAt(0) !== '_' &&
          // Ignore uuid since it should probably be unique?
          property !== 'uuid' &&
          // I'm not sure what three does with type under the hood, ignore it
          property !== 'type' &&
          // "precision" adds a precision preprocessor line
          property !== 'precision' &&
          // Ignore existing properties
          !(property in initialProperties) &&
          // Ignore STANDARD and PHYSICAL defines to the top of the shader in
          // WebGLProgram
          // https://github.com/mrdoob/three.js/blob/e7042de7c1a2c70e38654a04b6fd97d9c978e781/src/renderers/webgl/WebGLProgram.js#L392
          // which occurs if we set isMeshPhysicalMaterial/isMeshStandardMaterial
          property !== 'defines'
      )
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value,
        }),
        {}
      );

    const newMat = new three.RawShaderMaterial(initialProperties);

    // This prevents a deluge of warnings from three on the constructor saying
    // that each of these properties is not a property of the material
    Object.entries(additionalProperties).forEach(([key, value]) => {
      // @ts-ignore
      newMat[key] = value;
    });

    log('🏞 Re-creating three.js material!', {
      newMat,
      uniforms,
      properties,
      finalUniforms,
      engineMaterial: ctx.runtime.engineMaterial,
    });

    mesh.material = newMat;
    shadersUpdated.current = true;
  }, [compileResult, ctx.runtime, textures]);

  const prevLights = usePrevious(lights);
  const previousShowHelpers = usePrevious(showHelpers);
  useEffect(() => {
    if (
      // If the lights are unchanged
      (prevLights === lights && previousShowHelpers === showHelpers) ||
      // Or if there were no previous lights, but we already have them in the
      // persisted sceneData, we already have three data in memory
      (prevLights === undefined && sceneData.lights.length)
    ) {
      return;
    }
    sceneData.lights.forEach((light) => {
      scene.remove(light);
    });

    let helpers: three.Object3D[] = [];
    let newLights: three.Object3D[] = [];
    if (lights === 'point') {
      const pointLight = new three.PointLight(0xffffff, 1);
      pointLight.position.set(0, 0, 2);

      newLights = [pointLight];
      helpers = [new three.PointLightHelper(pointLight, 0.1)];
    } else if (lights === '3point') {
      const light1 = new three.PointLight(0xffffff, 1, 0);
      light1.position.set(2, 2, 5);

      const light2 = new three.PointLight(0xffffff, 1, 0);
      light2.position.set(-2, 5, -5);

      const light3 = new three.PointLight(0xffffff, 1, 0);
      light3.position.set(5, -5, -5);

      newLights = [light1, light2, light3];
      helpers = [
        new three.PointLightHelper(light1, 0.1),
        new three.PointLightHelper(light2, 0.1),
        new three.PointLightHelper(light3, 0.1),
      ];
    } else if (lights === 'spot') {
      const light1 = new three.SpotLight(0x00ff00, 1, 3, 0.4, 1);
      light1.position.set(0, 0, 2);

      const light2 = new three.SpotLight(0xff0000, 1, 4, 0.4, 1);
      light2.position.set(0, 0, 2);

      newLights = [light1, light2];
      helpers = [
        new three.SpotLightHelper(light1, new three.Color(0x00ff00)),
        new three.SpotLightHelper(light2, new three.Color(0xff0000)),
      ];
    }

    if (showHelpers) {
      sceneData.lights = [...newLights, ...helpers];
    } else {
      sceneData.lights = newLights;
    }
    sceneData.lights.forEach((obj) => {
      scene.add(obj);
    });

    if (prevLights && prevLights !== undefined && prevLights !== lights) {
      if (sceneData.mesh) {
        sceneData.mesh.material = loadingMaterial;
      }

      compile(ctx);
    }
  }, [
    sceneData,
    lights,
    scene,
    compile,
    ctx,
    prevLights,
    previousShowHelpers,
    showHelpers,
  ]);

  useEffect(() => {
    if (ctx.runtime?.camera && sceneWrapperSize) {
      const { camera, renderer } = ctx.runtime;

      const canvasWidth = sceneWrapperSize.width;
      const canvasHeight = sceneWrapperSize.height;
      camera.aspect = canvasWidth / canvasHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasWidth, canvasHeight, 400);
    }
  }, [sceneWrapperSize, ctx.runtime]);

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
              <option value="spot">Spot Lights</option>
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
        <div ref={threeDomCbRef}></div>
      </div>
    </>
  );
};

export default ThreeComponent;
