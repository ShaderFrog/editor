import * as pc from 'playcanvas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { mangleVar } from '@core/graph';
import { Graph } from '@core/graph-types';
import { EngineContext, EngineNodeType } from '@core/engine';
import styles from '../../editor/styles/editor.module.css';

import { usePrevious } from '../../editor/hooks/usePrevious';
import { UICompileGraphResult } from '../../editor/uICompileGraphResult';
import { SamplerCubeNode, TextureNode } from '@core/nodes/data-nodes';
import { useSize } from '../../editor/hooks/useSize';

import { evaluateNode } from '@core/evaluate';
import {
  physicalDefaultProperties,
  playengine,
} from '@core/plugins/playcanvas/playengine';
import { usePlayCanvas } from './usePlayCanvas';

export type PreviewLight = 'point' | '3point' | 'spot';

let mIdx = 0;
let id = () => mIdx++;

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(component)\x1b[0m', ...args);

// Intercept console errors, which is the only way to get playcanvas shader
// error logs
const consoleError = console.error;
let callback: Function;
console.error = (...args: any[]) => {
  if (callback) {
    callback(...args);
  }
  return consoleError.apply(console, args);
};

// MONKEYPATCH WARNING. See comment in playengine.ts for "hackSource"
let hackShaderDefinition: ((args: any) => any) | null;
const origGsd = pc.ProgramLibrary.prototype.generateShaderDefinition;
pc.ProgramLibrary.prototype.generateShaderDefinition = function (...args) {
  let def = origGsd.apply(this, args);
  if (hackShaderDefinition) {
    // @ts-ignore
    def = hackShaderDefinition(def);
    hackShaderDefinition = null;
  }
  return def;
};

const buildTextureLoader =
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
  const sceneWrapper = useRef<HTMLDivElement>(null);
  const size = useSize(sceneWrapper);

  // todo: material is black on first load - moving paramater fixes it. why?
  // todo: adding new input to saved shader causes crash - source code in core
  // graph is frog - is this because hacksource didn't change when the inputs change? use cache key as hacksource?

  useEffect(() => {
    callback = (msg: string) => {
      if (msg.toString().startsWith('Failed to compile')) {
        const type = (msg.match(/compile (\w+)/) as string[])[1];
        const err = msg.replace(/.*shader:\n+/m, '').replace(/\n[\s\S]*/m, '');
        setGlResult({
          fragError: type === 'fragment' ? err : null,
          vertError: type === 'vertex' ? err : null,
          programError: '',
        });
      }
    };
  }, [setGlResult]);

  const { canvas, pcDomRef, app, sceneData, loadingMaterial } = usePlayCanvas(
    (time) => {
      const { mesh } = sceneData;
      const meshInstance = mesh?.model?.meshInstances?.[0];
      const { material: mMaterial } = meshInstance || {};
      const material = mMaterial as pc.StandardMaterial;
      if (!mesh || !meshInstance || !material) {
        return;
      }
      // @ts-ignore
      window.mesh = mesh;
      // @ts-ignore
      window.meshInstance = meshInstance;
      // @ts-ignore
      window.pc = pc;

      mesh.rotate(10 * time, 20 * time, 30 * time);
      material.setParameter('time', performance.now() * 0.001);

      // @ts-ignore
      if (window.xxx) {
        log('frame', {
          textures,
          di: compileResult?.dataInputs,
          material,
          sceneData: sceneData,
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

              if (input.type === 'property' && input.property) {
                // @ts-ignore
                if (window.xxx) {
                  console.log(
                    'setting property',
                    input.property,
                    'to',
                    newValue
                  );
                }

                // @ts-ignore
                material[input.property] = newValue;
                if (input.property === 'opacity') {
                }
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
              }
            }
          });
        });

        material.update();
      }
      // @ts-ignore
      window.xxx = false;

      const { lights: lightMeshes } = sceneData;
      if (animatedLights) {
        if (lights === 'point') {
          const light = lightMeshes[0];
          const p = light.getPosition();
          light.setPosition(
            (p.x = 1.2 * Math.sin(time * 0.001)),
            (p.y = 1.2 * Math.cos(time * 0.001)),
            p.z
          );
        } else if (lights === 'spot') {
          // I haven't done this yet
        }
      }
    }
  );

  const [ctx] = useState<EngineContext>(() => {
    return {
      engine: 'playcanvas',
      runtime: {
        sceneData,
        // i'm not intentionally putting some things on scenedata and others on
        // runtime, it's just hacking to test out playcanvas
        app,
        cache: { nodes: {}, data: {} },
      },
      nodes: {},
      debuggingNonsense: {},
    };
  });

  useEffect(() => {
    if (sceneData.mesh) {
      sceneData.mesh.destroy();
    }

    let mesh = new pc.Entity();
    if (previewObject === 'torusknot') {
      mesh.addComponent('model', {
        type: 'torus',
      });
    } else if (previewObject === 'plane') {
      mesh.addComponent('model', {
        type: 'plane',
      });
    } else if (previewObject === 'cube') {
      mesh.addComponent('model', {
        type: 'box',
      });
    } else if (previewObject === 'sphere') {
      mesh.addComponent('model', {
        type: 'sphere',
      });
    } else if (previewObject === 'icosahedron') {
      mesh.addComponent('model', {
        type: 'box',
      });
    } else {
      throw new Error('fffffff');
    }

    if (sceneData.mesh && sceneData.mesh.model) {
      const origMat = sceneData.mesh.model.meshInstances[0].material;
      console.log('dont yet know how to transfer mat');
      // mesh.material = sceneData.mesh.material;
    }
    app.root.addChild(mesh);
    sceneData.mesh = mesh;
  }, [app, previewObject, sceneData]);

  const prevLights = usePrevious(lights);
  const previousShowHelpers = usePrevious(showHelpers);
  useEffect(() => {
    if (
      (prevLights === lights && previousShowHelpers === showHelpers) ||
      (prevLights === undefined && sceneData.lights.length)
    ) {
      return;
    }
    sceneData.lights.forEach((light) => light.destroy());

    if (lights === 'point') {
      const pointLight = new pc.Entity('light');
      pointLight.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        range: 10,
      });
      pointLight.setPosition(0, 0, 1);
      sceneData.lights = [pointLight];

      // TODO: Add helpers
      if (showHelpers) {
      }
    } else if (lights === '3point') {
      const light1 = new pc.Entity('light');
      light1.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        range: 10,
      });
      light1.setPosition(2, -2, 0);

      const light2 = new pc.Entity('light');
      light2.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        range: 10,
      });
      light2.setPosition(-1, 2, 1);

      const light3 = new pc.Entity('light');
      light3.addComponent('light', {
        type: 'omni',
        color: new pc.Color(1, 1, 1),
        range: 10,
      });
      light3.setPosition(-1, -2, -1);

      sceneData.lights = [light1, light2, light3];

      if (showHelpers) {
      }
    } else if (lights === 'spot') {
      const spot1 = new pc.Entity();
      spot1.addComponent('light', {
        type: 'spot',
        // new BABYLON.Vector3(0, 0, 2),
        // new BABYLON.Vector3(0, 0, -1),
      });
      spot1.setPosition(0, 0, 2);
      // spot1.diffuse = new BABYLON.Color3(0, 1, 0);
      // spot1.specular = new BABYLON.Color3(0, 1, 0);

      const spot2 = new pc.Entity();
      spot2.addComponent('light', {
        type: 'spot',
        // new BABYLON.Vector3(0, 0, 2),
        // new BABYLON.Vector3(0, 0, -1),
      });
      spot2.setPosition(0, 0, 2);
      // spot2.diffuse = new BABYLON.Color3(1, 0, 0);
      // spot2.specular = new BABYLON.Color3(1, 0, 0);

      sceneData.lights = [spot1, spot2];

      if (showHelpers) {
      }
    }

    sceneData.lights.forEach((obj) => {
      app.root.addChild(obj);
    });

    if (prevLights && prevLights !== undefined && prevLights !== lights) {
      if (sceneData.mesh && sceneData.mesh.model) {
        sceneData.mesh.model.meshInstances[0].material = loadingMaterial;
      }
      compile(ctx);
    }
  }, [
    app,
    sceneData,
    prevLights,
    lights,
    compile,
    ctx,
    previousShowHelpers,
    showHelpers,
    loadingMaterial,
  ]);

  // Inform parent our context is created
  useEffect(() => {
    setCtx(ctx);
  }, [ctx, setCtx]);

  useEffect(() => {
    if (!canvas) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    app.resizeCanvas(width, height);
  }, [app, canvas, width, height]);

  const textures = useMemo<
    Record<string, pc.Texture | null> | undefined
  >(() => {
    if (!app) {
      return;
    }
    const textureLoader = buildTextureLoader(app);
    // Logging to check if this happens more than once
    log('🔥 Loading Playcanvas textures');
    return {
      explosion: textureLoader(path('/explosion.png')),
      'grayscale-noise': textureLoader(path('/grayscale-noise.png')),
      threeTone: textureLoader(path('/3tone.jpg')),
      brick: textureLoader(path('/bricks.jpeg')),
      brickNormal: textureLoader(path('/bricknormal.jpeg')),
      pebbles: textureLoader(path('/Big_pebbles_pxr128.jpeg')),
      pebblesNormal: textureLoader(path('/Big_pebbles_pxr128_normal.jpeg')),
      pebblesBump: textureLoader(path('/Big_pebbles_pxr128_bmp.jpeg')),
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
    if (!compileResult?.fragmentResult || !app?.graphicsDevice) {
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
                app.graphicsDevice
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

    setGlResult({
      fragError: null,
      vertError: null,
      programError: null,
    });

    const shaderMaterial = new pc.StandardMaterial();

    const newProperties = {
      ...physicalDefaultProperties,
      ...graphProperties,
    };
    log('PlayCanvasEngine material props:', graphProperties);
    Object.assign(shaderMaterial, newProperties);

    hackShaderDefinition = (def) => {
      // log('generateShaderDefinition', def);
      def.fshader = '#version 300 es\n' + compileResult.fragmentResult;
      def.vshader = '#version 300 es\n' + compileResult.vertexResult;
      return def;
    };

    // See hackSource comment in playengine
    // @ts-ignore
    shaderMaterial.chunks.hackSource = `${compileResult.fragmentResult}${compileResult.vertexResult}`;

    shaderMaterial.update();

    if (sceneData.mesh) {
      const mis = sceneData?.mesh?.model?.meshInstances || [];
      if (mis.length !== 1) {
        console.error('Too many mesh instances!', mis);
        throw new Error('Too many mesh instances!');
      }
      mis[0].material = shaderMaterial;
      log('created new materialId:', shaderMaterial.id);
    } else {
      console.warn('No mesh to assign the material to!');
    }
  }, [setGlResult, compileResult, sceneData, app, textures]);

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

      <div ref={pcDomRef} className={styles.sceneContainer}></div>
    </>
  );
};

export default PlayCanvasComponent;
