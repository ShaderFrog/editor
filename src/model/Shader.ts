import { Edge, GraphNode } from '@core';
import { Tag } from './Tag';
import { ValueOf } from '../util/types';

export const SHADER_VISIBILITY = {
  PUBLIC: 1,
  UNLISTED: 2,
  PRIVTE: 3,
} as const;
export type ShaderVisibility = ValueOf<typeof SHADER_VISIBILITY>;

export type ShaderUser = {
  name: string;
  isPro: boolean;
};

export type Shader = {
  // Not persisted
  id?: string;
  engine: 'three' | 'babylon' | 'playcanvas';
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
  tags: Tag[];
  user: ShaderUser;
  name: string;
  // Description is not an optional key, but there's a bug in Zod, see note in
  // src/pages/api/shader/index.ts
  description?: string | null;
  config: {
    graph: {
      nodes: GraphNode[];
      edges: Edge[];
    };
    // Base config
    scene: {
      bg: string | null;
      lights: string;
      previewObject: string;
      // Support custom engine scene configs
    } & Record<string, any>;
  };
  visibility: number;
  likeCount?: number;
  commentCount?: number;
};

export type UserShader = {
  id: string;
  engine: string;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
  tags: Tag[];
  user: {
    name: string;
  };
  name: string;
  // Description is not an optional key, but there's a bug in Zod, see note in
  // src/pages/api/shader/index.ts
  description?: string | null;
  visibility: number;
};

export type ShaderUpdateInput = Omit<
  Shader,
  'createdAt' | 'updatedAt' | 'user' | 'tags' | 'likeCount' | 'commentCount'
> & { tags: string[]; imageData?: string; id: string };

export type ShaderCreateInput = Omit<
  Shader,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'user'
  | 'tags'
  | 'likeCount'
  | 'commentCount'
> & { tags: string[]; imageData: string };
