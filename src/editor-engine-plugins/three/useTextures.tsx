import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PMREMGenerator,
  CubeTexture,
  CubeTextureLoader,
  Texture,
  WebGLRenderer,
  WebGLCubeRenderTarget,
  ClampToEdgeWrapping,
  RepeatWrapping,
  TextureLoader,
  UnsignedByteType,
} from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader';
import {
  SamplerCubeNode,
  TextureNode,
  TextureNodeValueData,
} from '@core/graph';
import { AssetsAndGroups } from '@editor/model/Asset';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[36m(useTexture)\x1b[0m', ...args);

export type AssetAndVersion = { assetId: number; versionId: number };

const loadCubeMap = (
  assetPath: string,
  cb: (t: CubeTexture) => void = () => {}
) =>
  new CubeTextureLoader()
    .setPath(assetPath)
    .load(
      ['posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'],
      cb
    );

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
};

export const applyNodeProperties = (
  texture: Texture | CubeTexture,
  node: TextureNode | SamplerCubeNode
) => {
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

export const useTextures = (renderer: WebGLRenderer) => {
  const [textures, setTextures] = useState<
    Record<string, Texture | CubeTexture>
  >({});

  // setState is async so the idea is if we load the same texture twice
  // in the same frame, this prevents it from double loading. I'm not 100%
  // sure if this is needed though
  const texturesLoading = useRef<Record<string, boolean | Texture>>({});

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
        if (texturesLoading.current[key]) {
          if (textures[key]) {
            delete texturesLoading.current[key];
            return textures[key];
          }
          return texturesLoading.current[key] as Texture;
        }
        // log('loading cube map', { key }, version.url);
        // Otherwise, load the cube map
        const texture = loadCubeMap(version.url);
        setTextures((textures) => ({ ...textures, [key]: texture }));
        texturesLoading.current[key] = texture;
        return texture;
      } else if (asset.type === 'Envmap') {
        if (texturesLoading.current[key]) {
          // Handle race between setState and loading complete
          if (textures[key]) {
            delete texturesLoading.current[key];
            return textures[key];
          }
          // Nothing to do until the cubemap is generated
          return;
        }
        texturesLoading.current[key] = true;
        // log('loading envmap', { key }, version.url);
        // For envmaps, load as HDR/EXR
        const isExr = version.url.toLowerCase().endsWith('.exr');
        const loader = isExr ? new EXRLoader() : new RGBELoader();
        loader.load(version.url, (texture) => {
          // This code was here before, using fromEquirectangular().
          // Keeping for now as a backup
          // const pmremGenerator = new PMREMGenerator(renderer);
          // pmremGenerator.compileEquirectangularShader();
          // const x = pmremGenerator.fromEquirectangular(texture).texture;
          // pmremGenerator.dispose();
          // setTextures((textures) => ({ ...textures, [key]: x }));
          // return;

          // For samplerCube uniforms, we need a CubeTexture, not a PMREM DataTexture
          // Use WebGLCubeRenderTarget.fromEquirectangularTexture() to create a CubeTexture
          const cubeRenderTarget = new WebGLCubeRenderTarget(1024);
          cubeRenderTarget.fromEquirectangularTexture(renderer, texture);
          const envMap = cubeRenderTarget.texture;

          texture.dispose();
          // log('envmap loaded', {
          //   envMap,
          //   type: envMap.constructor.name,
          //   isCubeTexture: envMap instanceof CubeTexture,
          // });

          // Verify it's actually a CubeTexture at runtime
          // if (!(envMap instanceof CubeTexture)) {
          //   console.error(
          //     `Failed to create CubeTexture from equirectangular texture. ` +
          //       `Got ${
          //         (envMap as any).constructor.name
          //       } instead. This will cause WebGL errors when used with samplerCube uniforms.`
          //   );
          // }
          setTextures((textures) => ({ ...textures, [key]: envMap }));
        });
      } else {
        if (texturesLoading.current[key]) {
          if (textures[key]) {
            delete texturesLoading.current[key];
            return textures[key];
          }
          return texturesLoading.current[key] as Texture;
        }
        // log('loading texture', version.url, { key, asset, version });
        const tl = new TextureLoader();
        const texture = tl.load(version.url, () => {
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
