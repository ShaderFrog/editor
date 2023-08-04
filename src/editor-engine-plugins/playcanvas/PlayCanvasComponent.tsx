import * as pc from 'playcanvas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { mangleVar } from '@core/graph';
import { Graph } from '@core/graph-types';
import { EngineContext, EngineNodeType } from '@core/engine';
import styles from '../../editor/styles/editor.module.css';

import { useBabylon } from './usePlayCanvas';
import { usePrevious } from '../../editor/hooks/usePrevious';
import { UICompileGraphResult } from '../../editor/uICompileGraphResult';
import { SamplerCubeNode, TextureNode } from '@core/nodes/data-nodes';
import { useSize } from '../../editor/hooks/useSize';
import { Nullable } from 'babylonjs';
import { evaluateNode } from '@core/evaluate';
import { playengine } from '@core/plugins/playcanvas/playengine';

export type PreviewLight = 'point' | '3point' | 'spot';

let mIdx = 0;
let id = () => mIdx++;

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(component)\x1b[0m', ...args);

// MONKEYPATCH WARNING MONKEYPATCH WARNING MONKEYPATCH WARNING MONKEYPATCH WARNING
const orig = pc.StandardMaterial.prototype.getShaderVariant;
pc.StandardMaterial.prototype.getShaderVariant = function (...args) {
  let shader = orig.apply(this, args);
  if (this.hasOwnProperty('hortiblortfast')) {
    // @ts-ignore
    shader = this.hortiblortfast(shader);
  }
  return shader;
};

let someCallback: ((args: any) => any) | null;
const origGsd = pc.ProgramLibrary.prototype.generateShaderDefinition;
pc.ProgramLibrary.prototype.generateShaderDefinition = function (...args) {
  // log('generateShaderDefinition', someCallback);
  let def = origGsd.apply(this, args);
  if (someCallback) {
    // @ts-ignore
    def = someCallback(def);
    someCallback = null;
  }
  return def;
};

const horse =
  (app: pc.Application) =>
  (path: string): pc.Texture => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const texture = new pc.Texture(app.graphicsDevice);
    image.onload = () => {
      texture.setSource(image);
    };
    image.src = path;
    return texture;
  };

type AnyFn = (...args: any) => any;
type PlayCanvasComponentProps = {
  compile: AnyFn;
  compileResult: UICompileGraphResult | undefined;
  graph: Graph;
  lights: PreviewLight;
  animatedLights: boolean;
  setAnimatedLights: AnyFn;
  previewObject: string;
  setCtx: (ctx: EngineContext) => void;
  setGlResult: AnyFn;
  setLights: AnyFn;
  setPreviewObject: AnyFn;
  showHelpers: boolean;
  setShowHelpers: AnyFn;
  bg: string | undefined;
  setBg: AnyFn;
  width: number;
  height: number;
  assetPrefix: string;
};
const PlayCanvasComponent: React.FC<PlayCanvasComponentProps> = ({
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
}) => {
  const path = useCallback((src: string) => assetPrefix + src, [assetPrefix]);
  const checkForCompileErrors = useRef<boolean>(false);
  const lastCompile = useRef<any>({});
  const sceneWrapper = useRef<HTMLDivElement>(null);
  const size = useSize(sceneWrapper);

  // todo: material is black on first load - moving paramater fixes it. why?
  // todo: adding new input to saved shader causes crash - source code in core
  // graph is frog - is this because hacksource didn't change when the inputs change? use cache key as hacksource?

  // const {
  //   canvas,
  //   sceneData,
  //   babylonDomRef,
  //   scene,
  //   camera,
  //   engine,
  //   loadingMaterial,
  // } = useBabylon((time) => {
  //   if (checkForCompileErrors.current) {
  //     setGlResult({
  //       fragError: capture.find((str) => str.includes('FRAGMENT SHADER ERROR')),
  //       vertError: capture.find((str) => str.includes('VERTEX SHADER ERROR')),
  //       programError: '',
  //     });
  //     checkForCompileErrors.current = false;
  //   }

  //   const { lights: lightMeshes } = sceneData;
  //   if (animatedLights) {
  //     if (lights === 'point') {
  //       const light = lightMeshes[0] as BABYLON.PointLight;
  //       light.position.x = 1.2 * Math.sin(time * 0.001);
  //       light.position.y = 1.2 * Math.cos(time * 0.001);
  //     } else if (lights === 'spot') {
  //       // I haven't done this yet
  //     }
  //   }
  // });

  const [playCanvasDom, setPlayCanvasDom] = useState<HTMLCanvasElement | null>(
    null
  );
  const playCanvasDomRef = useCallback((node) => setPlayCanvasDom(node), []);

  const [app, setApp] = useState<pc.Application>();
  // const appRef = useRef<pc.Application>();

  const sceneData = useRef<any>({});

  useEffect(() => {
    if (!playCanvasDom) {
      return;
    } else {
      console.log(
        '🔥🔥🔥🔥🔥🔥 initting playcanvas! 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥'
      );
    }
    // create a PlayCanvas application
    const app = new pc.Application(playCanvasDom);
    setApp(app);

    // fill the available space at full resolution
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // ensure canvas is resized when window changes size
    // window.addEventListener('resize', () => app.resizeCanvas());

    const material = new pc.StandardMaterial();
    //     material.customFragmentShader = `
    // void main() {
    //     gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    // }
    //     `;
    // material.update();
    app.render();
    // console.log('after render before box', material.variants);

    const box = new pc.Entity('cube');
    box.addComponent('model', {
      type: 'box',
      material,
    });
    app.root.addChild(box);
    // @ts-ignore
    window.box = box;
    // @ts-ignore
    window.material = material;

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.1, 0.1),
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 0);

    app.render();
    app.start();

    sceneData.current.mesh = box;
    sceneData.current.app = app;
    console.log('Initial materialId', material.id);
  }, [playCanvasDom]);

  const [ctx] = useState<EngineContext>(() => {
    return {
      engine: 'playcanvas',
      runtime: {
        sceneData: sceneData.current,
        // i'm not intentionally putting some things on scenedata and others on
        // runtime, it's just hacking to test out playcanvas
        app: sceneData.current.app,
        cache: { nodes: {}, data: {} },
      },
      nodes: {},
      debuggingNonsense: {},
    };
  });

  // Inform parent our context is created
  useEffect(() => {
    if (!app) {
      return;
    }
    ctx.runtime.app = app;
    setCtx(ctx);
  }, [ctx, setCtx, app]);

  useEffect(() => {
    if (!app) {
      return;
    }
    // playCanvasDom.width = width;
    // playCanvasDom.height = height;
    app.resizeCanvas(width, height);
  }, [app, width, height]);

  const textures = useMemo<
    Record<string, pc.Texture | null> | undefined
  >(() => {
    if (!app) {
      return;
    }
    const horser = horse(app);
    console.log('🔥 loading textures again 🔥');
    return {
      explosion: horser(path('/explosion.png')),
      'grayscale-noise': horser(path('/grayscale-noise.png')),
      threeTone: horser(path('/3tone.jpg')),
      brick: horser(path('/bricks.jpeg')),
      brickNormal: horser(path('/bricknormal.jpeg')),
      pebbles: horser(path('/Big_pebbles_pxr128.jpeg')),
      pebblesNormal: horser(path('/Big_pebbles_pxr128_normal.jpeg')),
      pebblesBump: horser(path('/Big_pebbles_pxr128_bmp.jpeg')),
      pondCubeMap: null,
      // warehouseEnvTexture: new BABYLON.HDRCubeTexture(
      //   path('/envmaps/room.hdr'),
      //   512
      // ),
      // cityCourtYard: BABYLON.CubeTexture.CreateFromPrefilteredData(
      //   path('/envmaps/citycourtyard.dds'),
      // ),
    };
  }, [path, app]);

  useEffect(() => {
    if (!compileResult?.fragmentResult) {
      return;
    }
    const { graph } = compileResult;

    const pbrName = `component_playcanvas_${id()}`;
    log('🛠 Re-creating Playcanvas material', {
      pbrName,
      compileResult,
    });

    const graphProperties: Record<string, any> = {};

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
          if (input?.dataType === 'texture') {
            if (input.property) {
              graphProperties[input.property] = new pc.Texture(
                sceneData.current.app.graphicsDevice
              );
            } else {
              console.error(
                'Tried to set texture on non-property input',
                input.property
              );
            }
          }
        }
      });
    }

    // TODO: Babylon doesn't have a RawShaderMaterial. This hard codes the
    // assumption there's a Physical material in the graph.
    const shaderMaterial = new pc.StandardMaterial();
    // shaderMaterial.diffuseMap = new pc.Texture(app!.graphicsDevice);
    // shaderMaterial.diffuseMap = textures!.brick;

    const newProperties = {
      // ...physicalDefaultProperties,
      ...graphProperties,
    };
    log('PlayCanvasEngine material props:', graphProperties);
    Object.assign(shaderMaterial, newProperties);

    // material[input.property] = newValue;
    /**
     * In hell so far. Setting customFragmentShader causes
     * to stop working. looking at playcanvas source for material_diffuse and
     * customFragmentShader and MAPCOLOR to try to learn more
     */
    // @ts-ignore
    // shaderMaterial.customFragmentShader = `/* ${Math.random()} */`;
    // @ts-ignore
    // shaderMaterial.customFragmentShader = compileResult.fragmentResult;
    // console.log(
    //   'getShaderVariant',
    //   pc.StandardMaterial.prototype.getShaderVariant
    // );
    // @ts-ignore
    shaderMaterial.SKIP__hortiblortfast = (shader: any) => {
      log('intercepted shader in #getShaderVariant', shader);
      shader.impl.glProgram = null;
      const x = {
        ...shader,
        ready: false,
        definition: {
          ...shader.definition,
          fshader: compileResult.fragmentResult,
          vshader: compileResult.vertexResult,
        },
      };
      // x.compile();
      return x;
      // shaderMaterial.update();
    };

    someCallback = (def) => {
      // log('generateShaderDefinition', def);
      def.fshader = '#version 300 es\n' + compileResult.fragmentResult;
      def.vshader = '#version 300 es\n' + compileResult.vertexResult;
      return def;
    };

    // Object.defineProperty(shaderMaterial, 'customFragmentShader', {
    //   get() {
    //     debugger;
    //     return compileResult.fragmentResult;
    //   },
    // });
    // @ts-ignore
    // shaderMaterial.customVertexShader = compileResult.vertexResult;
    // @ts-ignore
    // shaderMaterial.vshader = compileResult.vertexResult;

    // test to see if this changes anything
    // shaderMaterial.diffuse.set(Math.random(), Math.random(), Math.random());
    // shaderMaterial.onUpdateShader = (options) => {
    //   log('onUpdateShader callback called');
    //   // todo: trying to force material to update. what about setting customFragmetnShader to random string?
    //   // but seeing that code is fully regenerated in generateFragmentShader - debugging
    //   // @ts-ignore
    //   options.chunks.hackSource = `${compileResult.fragmentResult}${compileResult.vertexResult}`;
    //   // options.litOptions = {
    //   //   ...(options.litOptions || {}),
    //   //   // @ts-ignore
    //   //   // source: `${compileResult.fragmentResult}${compileResult.vertexResult}`,
    //   // };
    //   // @ts-ignore
    //   // options.x = Math.random();
    //   return options;
    // };

    // @ts-ignore
    shaderMaterial.chunks.hackSource = `${compileResult.fragmentResult}${compileResult.vertexResult}`;
    // TODO: NEEDED???
    // shaderMaterial.clearVariants();

    shaderMaterial.update();

    if (sceneData.current.mesh) {
      if (sceneData.current.mesh.model.meshInstances.length !== 1) {
        console.error(
          'Too many mesh instances!',
          sceneData.current.mesh.model.meshInstances
        );
        throw new Error('Too many mesh instances!');
      }
      sceneData.current.mesh.model.meshInstances[0].material = shaderMaterial;
      log('created new materialId:', shaderMaterial.id);
    } else {
      console.warn('No mesh to assign the material to!');
    }
  }, [compileResult, sceneData, app, textures]);

  const callbackRef = useRef<Function>();
  callbackRef.current = useMemo(() => {
    if (!app) {
      return;
    }
    // rotate the box according to the delta time since the last frame
    return (dt: any) => {
      const { mesh } = sceneData.current;
      const meshInstance = mesh?.model?.meshInstances?.[0];
      const { material } = meshInstance || {};
      // @ts-ignore
      window.mesh = mesh;
      // @ts-ignore
      window.meshInstance = meshInstance;
      // @ts-ignore
      window.pc = pc;

      mesh.rotate(10 * dt, 20 * dt, 30 * dt);
      material.setParameter('time', performance.now() * 0.001);

      // @ts-ignore
      if (window.xxx) {
        log('frame', {
          textures,
          di: compileResult?.dataInputs,
          material,
          sceneData: sceneData.current,
          materialId: material?.id,
        });
      }
      // Note the uniforms are updated here every frame, but also instantiated
      // in this component at RawShaderMaterial creation time. There might be
      // some logic duplication to worry about.
      if (textures && compileResult?.dataInputs && material) {
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
                value = evaluateNode(playengine, graph, fromNode);
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
              // meshInstance.material.diffuse = new pc.Color(1, 1, 0, 1);
              // meshInstance.material.update();
              // material.diffuse = new pc.Color(1, 1, 0, 1);
              // material.update();
              // material.setParameter('diffuse', new pc.Color(1, 0, 0));
              // meshInstance.setParameter('diffuse', new pc.Color(0, 1, 0));
              // material.setParameter('material_diffuse', new pc.Color(0, 0, 1));
              // meshInstance.setParameter(
              //   'material_diffuse',
              //   new pc.Color(1, 0, 1)
              // );
              // material.update();

              if (input.type === 'property' && input.property) {
                // if (
                //   !newValue.url ||
                //   material[input.property]?.url !== newValue.url
                // ) {
                // @ts-ignore
                if (window.xxx) {
                  console.log(
                    'setting property',
                    input.property,
                    'to',
                    newValue
                  );
                }
                material[input.property] = newValue;
                material.update();
                // material.setParameter(input.property, newValue);
                // meshInstance.setParameter(input.property, newValue);
                // }
              } else {
                // TODO: This doesn't work for engine variables because
                // those aren't suffixed
                const name = mangleVar(input.displayName, playengine, node);
                // @ts-ignore
                if (window.xxx) {
                  console.log('setting', name, 'to', newValue);
                }
                material.setParameter(name, newValue);
                meshInstance.setParameter(name, newValue);

                // @ts-ignore
                // if (fromNode.type === 'number') {
                // } else if (fromNode.type === 'vector2') {
                //   material.setParameter(name, newValue);
                // } else if (fromNode.type === 'vector3') {
                //   material.setParameter(name, newValue);
                // } else if (fromNode.type === 'vector4') {
                //   material.setParameter(name, newValue);
                // } else if (fromNode.type === 'rgb') {
                //   material.setParameter(name, newValue);
                // } else if (fromNode.type === 'rgba') {
                //   // TODO: Uniforms aren't working for plugging in purple noise
                //   // shader to Texture filler of babylon physical - was getting
                //   // webgl warnings, but now object is black? Also I need to
                //   // get the actual color4 alpha value here
                //   material.setParameter(name, newValue, 1.0);
                // } else if (fromNode.type === 'texture') {
                //   material.setParameter(name, newValue);
                // } else {
                //   log(`Unknown uniform type: ${fromNode.type}`);
                // }
              }
            }
          });
        });
      }
      // @ts-ignore
      window.xxx = false;
    };
  }, [app, compileResult?.dataInputs, sceneData, graph, textures]);
  log('Playcanvas Render', compileResult?.dataInputs);

  useEffect(() => {
    if (!app) {
      return;
    }

    // Hack. This useEffect shouldn't be called repeatedly
    console.log('PlayCanvas adding new scene render loop');
    app.off('update');
    app.on('update', (dt: any) => {
      const cb = callbackRef.current;
      if (cb) {
        cb(dt);
      }
    });
  }, [app, callbackRef]);

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
        <canvas ref={playCanvasDomRef}></canvas>
      </div>
    </>
  );
};

export default PlayCanvasComponent;
