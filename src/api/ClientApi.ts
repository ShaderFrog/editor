import { AssetsAndGroups } from '@/model/Asset';
import { Shader } from '@model/Shader';

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
}
