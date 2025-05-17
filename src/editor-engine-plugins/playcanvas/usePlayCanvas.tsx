import { useCallback, useEffect, useRef, useState, useContext } from 'react';
import {
  Application,
  Color,
  Entity,
  FILLMODE_NONE,
  Keyboard,
  Material,
  Mouse,
  RESOLUTION_AUTO,
  StandardMaterial,
  TouchDevice,
  Vec3,
} from 'playcanvas';
import {
  OrbitCamera,
  OrbitCameraInputMouse,
  OrbitCameraInputTouch,
  OrbitCameraInputKeyboard,
} from './OrbitCamera';
import { useHoisty } from '../../editor/hoistedRefContext';
import { physicalDefaultProperties } from '@core/plugins/playcanvas/playengine';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(pc.usePc)\x1b[0m', ...args);

type SceneData = {
  lights: Entity[];
  mesh?: Entity;
};
type ScenePersistence = {
  sceneData: SceneData;
  orbitCamera: OrbitCamera;
  orbitCameraInputMouse: OrbitCameraInputMouse;
  orbitCameraInputTouch: OrbitCameraInputTouch;
  orbitCameraInputKeyboard: OrbitCameraInputKeyboard;
  canvas: HTMLCanvasElement;
  pcDom: HTMLDivElement;
  app: Application;
  camera: Entity;
  loadingMaterial: Material;
};

type Callback = (time: number) => void;
function cancelAllAnimationFrames() {
  let id = window.requestAnimationFrame(() => {});
  while (id--) {
    window.cancelAnimationFrame(id);
  }
}

export const usePlayCanvas = (callback: Callback) => {
  const { getRefData } = useHoisty();

  const {
    orbitCamera,
    orbitCameraInputMouse,
    orbitCameraInputTouch,
    orbitCameraInputKeyboard,
    canvas,
    loadingMaterial,
    app,
    camera,
    sceneData,
  } = getRefData<Omit<ScenePersistence, 'pcDom'>>('playcanvas', () => {
    const canvas = document.createElement('canvas');

    log('Creating new Playcanvas Application!');
    const app = new Application(canvas, {
      mouse: new Mouse(canvas as unknown as Element),
      touch: new TouchDevice(canvas as unknown as Element),
      keyboard: new Keyboard(window),
    });
    // fill the available space at full resolution
    app.setCanvasFillMode(FILLMODE_NONE);
    app.setCanvasResolution(RESOLUTION_AUTO);

    app.start();

    const camera = new Entity('camera');
    camera.addComponent('camera', {
      fov: 75,
      frustumCulling: true,
      clearColor: new Color(0, 0, 0, 0),
    });
    camera.setPosition(0, 0, 6);

    // All of the orbitcamera stuff is hacked up from
    // https://github.com/playcanvas/model-viewer/blob/61e8f51207dd8e7a676e1d55cb70e894fa20e337/src/viewer.ts#L166
    const origMouseHandler = app.mouse!._moveHandler;
    app.mouse!.detach();
    app.mouse!._moveHandler = (event: MouseEvent) => {
      if (event.target === canvas) {
        origMouseHandler(event);
      }
    };
    app.mouse!.attach(canvas as unknown as Element);

    const origTouchHandler = app.touch!._moveHandler;
    app.touch!.detach();
    app.touch!._moveHandler = (event: MouseEvent) => {
      if (event.target === canvas) {
        origTouchHandler(event);
      }
    };
    app.touch!.attach(canvas as unknown as Element);

    const orbitCamera = new OrbitCamera(camera, 1);
    const orbitCameraInputMouse = new OrbitCameraInputMouse(app, orbitCamera);
    const orbitCameraInputTouch = new OrbitCameraInputTouch(app, orbitCamera);
    const orbitCameraInputKeyboard = new OrbitCameraInputKeyboard(
      app,
      orbitCamera
    );

    orbitCamera.focalPoint.snapto(new Vec3(0, 0, 0));
    orbitCamera.azimElevDistance.snapto(new Vec3(0, -10, 2));

    app.root.addChild(camera);

    const loadingMaterial = new StandardMaterial();
    Object.assign(loadingMaterial, physicalDefaultProperties);
    loadingMaterial.diffuse.set(0.8, 0.2, 0.5);
    loadingMaterial.update();

    return {
      sceneData: {
        lights: [],
      },
      orbitCamera,
      orbitCameraInputMouse,
      orbitCameraInputTouch,
      orbitCameraInputKeyboard,
      canvas,
      app,
      loadingMaterial,
      camera,
      destroy: (data: ScenePersistence) => {
        log('👋🏻 Bye Bye PlayCanvas!');
        app.destroy();
      },
    };
  });

  const [pcDom, setPcDom] = useState<HTMLDivElement | null>(null);
  const pcDomRef = useCallback((node: HTMLDivElement | null) => {
    setPcDom(node);
  }, []);

  useEffect(() => {
    if (pcDom && !pcDom.childNodes.length) {
      log('Re-attaching PC DOM', canvas, 'to', pcDom);
      pcDom.appendChild(canvas);
    }
  }, [canvas, pcDom]);

  const savedCallback = useRef<Callback>(callback);
  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (pcDom && !pcDom.childNodes.length) {
      log('Re-attaching Playcanvas DOM', canvas, 'to', pcDom);
      pcDom.appendChild(canvas);
    }
  }, [canvas, pcDom]);

  const animate = useCallback(
    (deltaTime: number) => {
      // Catch attribute errors until https://github.com/playcanvas/engine/pull/5710 is merged
      try {
        app.render();
      } catch (e) {
        console.error('Render error!', e);
      }
      orbitCamera.update(deltaTime);
      savedCallback.current(deltaTime);
    },
    [app, orbitCamera]
  );

  useEffect(() => {
    log('🎬 Starting PC app.on(update)');
    app.on('update', animate);
    app.renderNextFrame = true;
    app.autoRender = true;

    return () => {
      log('🛑 Stopping PC app rendering');
      app.renderNextFrame = false;
      app.autoRender = false;
      app.off('update');
    };
  }, [app, animate]);

  return {
    canvas,
    pcDom,
    pcDomRef,
    app,
    camera,
    sceneData,
    loadingMaterial,
  };
};
