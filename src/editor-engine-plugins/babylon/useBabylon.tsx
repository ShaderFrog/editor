import { useCallback, useEffect, useRef, useState, useContext } from 'react';
import * as BABYLON from 'babylonjs';
import { useHoisty } from '../../editor/hoistedRefContext';

type SceneData = {
  lights: BABYLON.Node[];
  mesh?: BABYLON.Mesh;
};
type ScenePersistence = {
  sceneData: SceneData;
  canvas: HTMLCanvasElement;
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  loadingMaterial: BABYLON.Material;
};

type Callback = (time: number) => void;

export const useBabylon = (callback: Callback) => {
  const { getRefData } = useHoisty();

  const { loadingMaterial, engine, camera, sceneData, canvas, scene } =
    getRefData<ScenePersistence>('babylon', () => {
      const canvas = document.createElement('canvas');
      const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      const scene = new BABYLON.Scene(engine);
      const loadingMaterial = new BABYLON.StandardMaterial('mat2', scene);
      loadingMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.2, 0.5);
      // scene.createDefaultEnvironment();
      // This line makes the object disappear on page load - race condition?
      // Bad shader compile?
      // scene.environmentTexture = hdrTexture;
      return {
        sceneData: {
          lights: [],
        },
        canvas,
        engine,
        scene,
        loadingMaterial,
        camera: new BABYLON.ArcRotateCamera(
          'camera1',
          Math.PI / 2,
          Math.PI / 2,
          4,
          new BABYLON.Vector3(0, 0, 0),
          scene
        ),
        destroy: (data: ScenePersistence) => {
          console.log('👋🏻 Bye Bye Babylon!');
          data.scene.dispose();
          data.engine.dispose();
        },
      };
    });

  const [babylonDom, setBabylonDom] = useState<HTMLCanvasElement | null>(null);
  const babylonDomRef = useCallback((node) => setBabylonDom(node), []);

  const frameRef = useRef<number>(0);

  useEffect(() => {
    // Target the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());
    // Attach the camera to the canvas
    camera.attachControl(canvas, false);
  }, [scene, camera, canvas]);

  const savedCallback = useRef<Callback>(callback);
  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (babylonDom && !babylonDom.childNodes.length) {
      console.log('Re-attaching Babylon DOM', canvas, 'to', babylonDom);
      babylonDom.appendChild(canvas);
    }
  }, [canvas, babylonDom]);

  const animate = useCallback((time: number) => {
    savedCallback.current(time);
    frameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (babylonDom) {
      console.log('🎬 Starting Babylon requestAnimationFrame');
      frameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      console.log('🛑 Cleaning up Babylon animationframe');
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      // TODO: How to cleanup?
      // engine.dispose();
    };
  }, [engine, animate, babylonDom]);

  return {
    canvas,
    babylonDomRef,
    engine,
    scene,
    camera,
    sceneData,
    loadingMaterial,
  };
};
