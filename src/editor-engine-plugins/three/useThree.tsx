import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useCallback, useEffect, useRef, useState, useContext } from 'react';
import {
  Object3D,
  Mesh,
  Scene,
  Camera,
  CubeCamera,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  PerspectiveCamera,
  LinearMipmapLinearFilter,
  sRGBEncoding,
  LinearToneMapping,
  ACESFilmicToneMapping,
} from 'three';

import { useHoisty } from '../../editor/hoistedRefContext';
const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(component.useThree)\x1b[0m', ...args);

type Callback = (time: number) => void;

type SceneData = {
  helpers: Object3D[];
  lights: Object3D[];
  mesh?: Mesh;
  bg?: Mesh;
};
type ScenePersistence = {
  sceneData: SceneData;
  scene: Scene;
  camera: Camera;
  cubeCamera: CubeCamera;
  cubeRenderTarget: WebGLCubeRenderTarget;
  renderer: WebGLRenderer;
};

export const useThree = (callback: Callback) => {
  const { getRefData } = useHoisty();
  const { sceneData, scene, cubeCamera, camera, renderer } =
    getRefData<ScenePersistence>('three', () => {
      const scene = new Scene();
      const camera = new PerspectiveCamera(75, 1 / 1, 0.1, 1000);
      const cubeRenderTarget = new WebGLCubeRenderTarget(128, {
        generateMipmaps: true,
        minFilter: LinearMipmapLinearFilter,
      });
      const cubeCamera = new CubeCamera(0.1, 1000, cubeRenderTarget);

      camera.position.set(0, 0, 2);
      camera.lookAt(0, 0, 0);
      scene.add(camera);
      scene.add(cubeCamera);

      // https://www.donmccurdy.com/2020/06/17/color-management-in-threejs/
      const renderer = new WebGLRenderer();
      renderer.outputEncoding = sRGBEncoding;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMapping = LinearToneMapping;

      return {
        sceneData: {
          lights: [],
          helpers: [],
        },
        scene,
        camera,
        cubeCamera,
        cubeRenderTarget,
        renderer,
        destroy: (data: ScenePersistence) => {
          log('👋🏻 Bye Bye Three.js!');
          data.renderer.forceContextLoss();
          // @ts-ignore
          data.renderer.domElement = null;
        },
      };
    });

  const [threeDomElement, setThreeDom] = useState<HTMLDivElement | null>(null);
  // We use a callback ref to handle re-attaching scene controls when the
  // scene unmounts or re-mounts
  const threeDomCbRef = useCallback((node) => setThreeDom(node), []);

  const frameRef = useRef<number>(0);
  const controlsRef = useRef<OrbitControls>();

  // Add the camera to the scene if not already present. I don't remember why
  // I do all of this work in effects rather than in the ini
  useEffect(() => {
    if (!scene.children.find((child: any) => child === camera)) {
      // This disptance is overwritten by the component's cameradistances
      camera.position.set(0, 0, 2);
      camera.lookAt(0, 0, 0);
      scene.add(camera);
      scene.add(cubeCamera);
    }
  }, [scene, camera, cubeCamera]);

  const savedCallback = useRef<Callback>(callback);
  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (threeDomElement && !threeDomElement.childNodes.length) {
      log(
        'Re-attaching three.js DOM and instantiate OrbitControls, appending',
        renderer.domElement,
        'to',
        threeDomElement
      );
      threeDomElement.appendChild(renderer.domElement);
    }
  }, [camera, renderer, threeDomElement]);

  useEffect(() => {
    if (!controlsRef.current) {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.update();
      controlsRef.current = controls;
    }
    return () => {
      if (controlsRef.current) {
        log('Disposing of OrbitControls');
        controlsRef.current.dispose();
        controlsRef.current = undefined;
      }
    };
  }, [camera, renderer]);

  const animate = useCallback(
    (time: number) => {
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
      savedCallback.current(time);

      frameRef.current = requestAnimationFrame(animate);
    },
    [camera, renderer, scene]
  );

  useEffect(() => {
    if (threeDomElement) {
      log('🎬 Starting requestAnimationFrame');
      frameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      log('🛑 Cleaning up Three animationframe');
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [animate, threeDomElement]);

  return { sceneData, threeDomElement, threeDomCbRef, scene, camera, renderer };
};
