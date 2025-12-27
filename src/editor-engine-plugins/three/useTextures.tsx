import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PMREMGenerator,
  CubeTexture,
  CubeTextureLoader,
  Texture,
  WebGLRenderer,
  ClampToEdgeWrapping,
  RepeatWrapping,
  TextureLoader,
} from 'three';
// @ts-ignore
// @ts-ignore
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader';
import {
  SamplerCubeNode,
  TextureNode,
  TextureNodeValueData,
} from '@core/graph';
import { AssetsAndGroups } from '@/model';

export type AssetAndVersion = { assetId: number; versionId: number };

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

// TOOD: Change to Asset IDs
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

// const CubeMaps: Partial<Record<BackgroundKey, string>> = {
//   pondCubeMap: '/envmaps/pond/',
// };
// const HdrMaps: Partial<Record<BackgroundKey, string>> = {
//   warehouseImage: '/envmaps/empty_warehouse_01_1k.hdr',
//   skyImage: '/envmaps/industrial_sunset_puresky_1k.hdr',
//   roglandImage: '/envmaps/rogland_clear_night_2k.hdr',
//   drachenfelsImage: '/envmaps/drachenfels_cellar_2k.hdr',
//   kloofendalImage: '/envmaps/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
//   metroImage: '/envmaps/metro_noord_2k.hdr',
//   rustigImage: '/envmaps/rustig_koppie_puresky_2k.hdr',
//   warmRestaurantImage: '/envmaps/warm_restaurant_2k.hdr',
//   nightSky007Image: '/envmaps/NightSkyHDRI007_4K-HDR.exr',
//   nightSky008Image: '/envmaps/NightSkyHDRI008_4K-HDR.exr',
//   nightSky014Image: '/envmaps/NightSkyHDRI014_2K-HDR.exr',
// };

const loadCubeMap = (assetPath: string, cb: (t: CubeTexture) => void) => {
  console.log('loading cube map', assetPath);
  return new CubeTextureLoader()
    .setPath(assetPath)
    .load(
      ['posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'],
      (t) => {
        console.log('cube map loaded', assetPath, t);
        cb(t);
      }
    );
};

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

export const textureCacheKey = (value: AssetAndVersion) =>
  `asset-${value.assetId}-${value.versionId}`;

const getAssetVersion = (
  assets: AssetsAndGroups['assets'],
  value: AssetAndVersion
) => {
  const { assetId, versionId } = value;
  if (assetId !== undefined && assetId in assets) {
    const { versions } = assets[assetId];
    return versions.find((v) => v.id === versionId);
  }
  return undefined;
};

export const applyNodeProperties = (
  texture: Texture | CubeTexture,
  node: TextureNode | SamplerCubeNode
) => {
  const value = node.value as TextureNodeValueData;
  if (!value || !value.assetId || !value.versionId) {
    console.error(`I don't know how to load texture`, node);
    return;
  }
  const properties = (node.value as TextureNodeValueData)?.properties;
  if (!properties || (texture as any).__properties === properties) {
    return;
  }

  if (properties?.repeatTexure || !properties) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(properties.repeat?.x || 1, properties.repeat?.y || 1);
  } else {
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
  }

  texture.anisotropy = properties.anisotropy || 16;

  (texture as any).__properties = properties;
  texture.needsUpdate = true;

  return texture;
};

export const useTextures = (
  // assets: AssetsAndGroups['assets'],
  renderer: WebGLRenderer
  // key: BackgroundKey,
  // path: (src: string) => string,
  // setLoading: () => void,
  // setLoaded: () => void
) => {
  const [textures, setTextures] = useState<
    Record<string, Texture | CubeTexture>
  >({});

  // setState is async so the idea is if we load the same texture twice
  // in the same frame, this prevents it from double loading. I'm not 100%
  // sure if this is needed though
  const texturesLoading = useRef<Record<string, boolean | Texture>>({});

  // TODO: Replace loading in the UI?
  // useEffect(() => {
  //   if (textures[key]) {
  //     return;
  //   }
  //   const cb = (t: Texture | CubeTexture) => {
  //     setTextures((textures) => ({ ...textures, [key]: t }));
  //     setLoaded();
  //   };
  //   if (key in CubeMaps) {
  //     console.log('loading cube map', key);
  //     setLoading();
  //     loadCubeMap(path(CubeMaps[key]!), cb);
  //   } else if (key in HdrMaps) {
  //     setLoading();
  //     loadEnvMap(renderer, path(HdrMaps[key]!), cb);
  //   } else {
  //     console.error('unknown background key', key);
  //   }
  // }, [key, path, textures, setTextures, renderer, setLoading, setLoaded]);

  // const textureCache = useRef<Record<string, Texture>>({});

  /**
   * Given an asset and its version, if the asset exists in the texture cache,
   * return it as is. If it doesn't, start loading it.
   *
   * If an asset isn't found, in some cases a Texture can be returned that
   * Three.js automagically hydrates when the asset is loaded. For others like
   * environment maps, they first need to be loaded and then converted to a
   * cubemap before the asset can be used.
   *
   * Calling this function multiple times for an asset that is still loading
   * is a noop.
   *
   * This function bails if it doesn't know how to resolve the asset.
   */
  const getOrLoadAsset = useCallback(
    (
      assets: AssetsAndGroups['assets'],
      assetVersion: AssetAndVersion
    ): CubeTexture | Texture | undefined => {
      // if (!textureCache.current) {
      //   return;
      // }
      // if (typeof value !== 'object') {
      //   console.warn(`I don't know how to getOrLoadAsset() on`, value);
      //   return;
      // }
      const key = textureCacheKey(assetVersion);
      if (textures[key]) {
        return textures[key];
      }
      const asset = assets[assetVersion.assetId];
      const version = getAssetVersion(assets, assetVersion);
      if (!version) {
        console.error(`Asset version not found`, { assetVersion, assets });
        return;
      }

      if (asset.type === 'CubeMap') {
        if (typeof texturesLoading.current[key] !== 'boolean') {
          return texturesLoading.current[key] as Texture;
        }
        // Otherwise, load the cube map
        const texture = loadCubeMap(version.url, (t) => {
          delete texturesLoading.current[key];
        });
        setTextures((textures) => ({ ...textures, [key]: texture }));
        texturesLoading.current[key] = texture;
        return texture;
      } else if (asset.type === 'Envmap') {
        if (texturesLoading.current[key]) {
          // Nothing to do until the cubemap is generated
          return;
        }
        texturesLoading.current[key] = true;
        // For envmaps, load as HDR/EXR
        const isExr = version.url.toLowerCase().endsWith('.exr');
        const loader = isExr ? new EXRLoader() : new RGBELoader();
        loader.load(version.url, (texture) => {
          const pmremGenerator = new PMREMGenerator(renderer);
          pmremGenerator.compileEquirectangularShader();
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          pmremGenerator.dispose();
          console.log('envmap loaded');
          // textures[key] = envMap;
          setTextures((textures) => ({ ...textures, [key]: envMap }));
          delete texturesLoading.current[key];
        });
      } else {
        if (texturesLoading.current[key]) {
          return texturesLoading.current[key] as Texture;
        }
        const tl = new TextureLoader();
        const texture = tl.load(version.url, (t) => {
          delete texturesLoading.current[key];
          setTextures((textures) => ({ ...textures, [key]: texture }));
        });
        texturesLoading.current[key] = texture;
        return texture;
      }
    },
    [textures, renderer]
  );

  return [textures, getOrLoadAsset] as const;
};
