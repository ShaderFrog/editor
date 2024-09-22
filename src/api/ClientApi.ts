import { AssetsAndGroups } from '@editor/model/Asset';
import { Shader } from '@editor/model/Shader';

export interface ClientApi {
  getAssetsAndGroups: () => Promise<AssetsAndGroups>;
  searchShaders: ({
    text,
    engine,
    tags,
  }: {
    text: string;
    engine: string;
    tags: string[];
  }) => Promise<{ count: number; shaders: Shader[] }>;
  searchEffects: ({
    text,
    engine,
    includeMy,
    limit,
  }: {
    text: string;
    engine: string;
    includeMy: boolean;
    limit: number;
  }) => Promise<{ count: number; shaders: Shader[] }>;
}
