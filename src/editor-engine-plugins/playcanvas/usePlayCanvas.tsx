import { useCallback, useEffect, useRef, useState, useContext } from 'react';
import * as pc from 'playcanvas';
import { useHoisty } from '../../editor/hoistedRefContext';
import { physicalDefaultProperties } from '@core/plugins/playcanvas/playengine';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(pc.usePc)\x1b[0m', ...args);

type SceneData = {
  lights: pc.Entity[];
  mesh?: pc.Entity;
};
type ScenePersistence = {
  sceneData: SceneData;
  canvas: HTMLCanvasElement;
  pcDom: HTMLDivElement;
  app: pc.Application;
  camera: pc.Entity;
  loadingMaterial: pc.Material;
};

type Callback = (time: number) => void;

export const usePlayCanvas = (callback: Callback) => {
  const { getRefData } = useHoisty();

  const { canvas, loadingMaterial, app, camera, sceneData } = getRefData<
    Omit<ScenePersistence, 'pcDom'>
  >('babylon', () => {
    const canvas = document.createElement('canvas');

    const app = new pc.Application(canvas);
    // fill the available space at full resolution
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    app.start();

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.1, 0.1, 0.1),
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    const loadingMaterial = new pc.StandardMaterial();
    Object.assign(loadingMaterial, physicalDefaultProperties);
    loadingMaterial.diffuse.set(0.8, 0.2, 0.5);
    loadingMaterial.update();

    return {
      sceneData: {
        lights: [],
      },
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
  const pcDomRef = useCallback((node) => setPcDom(node), []);

  // useEffect(() => {
  //   // Target the camera to scene origin
  //   camera.setTarget(BABYLON.Vector3.Zero());
  //   // Attach the camera to the canvas
  //   camera.attachControl(canvas, false);
  // }, [camera, canvas]);

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
    (time: number) => {
      app.render();
      savedCallback.current(time);
    },
    [app]
  );

  useEffect(() => {
    if (pcDom) {
      log('🎬 Starting PC app.on(update)');

      app.on('update', animate);
    }

    return () => {
      log('🛑 Cleaning up PC animationframe');
      app.off('update');
    };
  }, [app, animate, pcDom]);

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
