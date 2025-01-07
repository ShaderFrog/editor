import randomShaderName from '@/util/randomShaderName';
import { CurrentUser, Shader } from '../model';
import { ClientApi } from './ClientApi';
import { API } from './api';
import { outputNode } from '@core/graph';
import { makeId } from '@/util/id';

// Stub API endpoints, called from the client side
export const stubApi: ClientApi = {
  getEditorAssetsAndGroups: async () => {
    return { assets: {}, groups: {} };
  },
  searchShaders: async () => {
    return { count: 0, shaders: [] };
  },
  searchEffects: async () => {
    return { count: 0, shaders: [] };
  },
};

// Stub data injected at page load time for SWR
export const stubApiData = {
  [API.assets]: [],
};

export const STUB_USER: CurrentUser = {
  id: '1',
  isPro: false,
  name: 'Test User',
  image: null,
  email: null,
  roles: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const stubDefaultShader = (engine: Shader['engine']): Shader => ({
  user: {
    name: 'Fake User',
    isPro: false,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  engine,
  name: randomShaderName(),
  visibility: 0,
  tags: [],
  config: {
    graph: {
      nodes: [
        outputNode(makeId(), 'Output', { x: 0, y: 0 }, 'fragment'),
        outputNode(makeId(), 'Output', { x: 0, y: 100 }, 'vertex'),
      ],
      edges: [],
    },
    scene: {
      bg: '',
      lights: 'point',
      previewObject: 'sphere',
    },
  },
});
