import { useEffect, useState } from 'react';
import {
  PMREMGenerator,
  CubeTexture,
  CubeTextureLoader,
  Texture,
  WebGLRenderer,
} from 'three';
// @ts-ignore
// @ts-ignore
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader';

export type BackgroundKey =
  | 'warehouseImage'
  | 'metroImage'
  | 'warmRestaurantImage'
  | 'roglandImage'
  | 'drachenfelsImage'
  | 'pondCubeMap'
  | 'nightSky007Image'
  | 'nightSky008Image'
  | 'nightSky014Image'
  | 'skyImage'
  | 'rustigImage'
  | 'kloofendalImage';

export const backgroundKeys = new Set<BackgroundKey>([
  'warehouseImage',
  'metroImage',
  'warmRestaurantImage',
  'roglandImage',
  'drachenfelsImage',
  'pondCubeMap',
  'nightSky007Image',
  'nightSky008Image',
  'nightSky014Image',
  'skyImage',
  'rustigImage',
  'kloofendalImage',
]);

const CubeMaps: Partial<Record<BackgroundKey, string>> = {
  pondCubeMap: '/envmaps/pond/',
};
const HdrMaps: Partial<Record<BackgroundKey, string>> = {
  warehouseImage: '/envmaps/empty_warehouse_01_1k.hdr',
  skyImage: '/envmaps/industrial_sunset_puresky_1k.hdr',
  roglandImage: '/envmaps/rogland_clear_night_2k.hdr',
  drachenfelsImage: '/envmaps/drachenfels_cellar_2k.hdr',
  kloofendalImage: '/envmaps/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
  metroImage: '/envmaps/metro_noord_2k.hdr',
  rustigImage: '/envmaps/rustig_koppie_puresky_2k.hdr',
  warmRestaurantImage: '/envmaps/warm_restaurant_2k.hdr',
  nightSky007Image: '/envmaps/NightSkyHDRI007_4K-HDR.exr',
  nightSky008Image: '/envmaps/NightSkyHDRI008_4K-HDR.exr',
  nightSky014Image: '/envmaps/NightSkyHDRI014_2K-HDR.exr',
};

const loadCubeMap = (assetPath: string, cb: (t: CubeTexture) => void) =>
  new CubeTextureLoader()
    .setPath(assetPath)
    .load(
      ['posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'],
      cb
    );

const loadEnvMap = (
  renderer: WebGLRenderer,
  assetPath: string,
  cb: (t: Texture) => void
) => {
  if (assetPath.toLowerCase().endsWith('.exr')) {
    new EXRLoader().load(assetPath, (texture) => {
      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      pmremGenerator.dispose();
      cb(envMap);
    });
  } else {
    new RGBELoader().load(assetPath, (texture) => {
      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      pmremGenerator.dispose();
      cb(envMap);
    });
  }
};

export const useTexture = (
  renderer: WebGLRenderer,
  key: BackgroundKey,
  path: (src: string) => string,
  setLoading: () => void,
  setLoaded: () => void
) => {
  const [textures, setTextures] = useState<
    Record<string, Texture | CubeTexture>
  >({});

  useEffect(() => {
    if (textures[key]) {
      return;
    }
    const cb = (t: Texture | CubeTexture) => {
      setTextures((textures) => ({ ...textures, [key]: t }));
      setLoaded();
    };
    if (key in CubeMaps) {
      setLoading();
      loadCubeMap(path(CubeMaps[key]!), cb);
    } else if (key in HdrMaps) {
      setLoading();
      loadEnvMap(renderer, path(HdrMaps[key]!), cb);
    }
  }, [key, path, textures, setTextures, renderer, setLoading, setLoaded]);

  return [textures, setTextures] as const;
};
