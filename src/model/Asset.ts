import { ValueOf } from '@editor/util/types';

export const ASSET_TYPES = ['Image'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_VISIBILITIES = {
  PUBLIC: 0,
  PRIVATE: 1,
} as const;
export type AssetVisibility = ValueOf<typeof ASSET_VISIBILITIES>;

export const ASSET_SUBTYPES = [
  'Diffuse',
  'Displacement',
  'Normal',
  'AO',
  'ARM',
  'Roughness',
  'Bump',
  'Metal',
  'Mask',
  'Specular',
] as const;
export type AssetSubtype = (typeof ASSET_SUBTYPES)[number];

export type AssetOwner = {
  name: string;
  id: string;
};

export type AssetVersion = {
  id: number;
  assetId: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  url: string;
  thumbnail: string;
  size: number;
  resolution: string | null;
};

export type Asset = {
  id: number;
  name: string;
  owner: AssetOwner;
  createdAt: Date;
  updatedAt: Date;
  type: AssetType;
  subtype: AssetSubtype;
  description: string;
  groupId: number | null;
  versions: AssetVersion[];
  visibility: AssetVisibility;
};

export type AssetGroup = {
  id: number;
  name: string;
  owner: AssetOwner;
  createdAt: Date;
  updatedAt: Date;
  description: string;
  visibility: AssetVisibility;
};

export type AssetsAndGroups = {
  groups: Record<string, AssetGroup>;
  assets: Record<string, Asset>;
};
