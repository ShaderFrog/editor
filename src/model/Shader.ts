import { Edge, GraphNode } from '@shaderfrog/core';
import { Tag } from './Tag';

export const SHADER_VISIBILITY = {
  PUBLIC: 1,
  UNLISTED: 2,
  PRIVTE: 3,
} as const;

export type Shader = {
  // Not persisted
  id?: string;
  engine: 'three' | 'babylon' | 'playcanvas';
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
  tags: Tag[];
  user: {
    name: string;
    isPro: boolean;
  };
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
  'createdAt' | 'updatedAt' | 'user' | 'tags'
> & { tags: string[]; imageData?: string; id: string };

export type ShaderCreateInput = Omit<
  Shader,
  'id' | 'createdAt' | 'updatedAt' | 'user' | 'tags'
> & { tags: string[]; imageData: string };
