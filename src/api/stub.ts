import { CurrentUser } from '../model';
import { ClientApi } from './ClientApi';
import { API } from './api';

// Stub API endpoints, called from the client side
export const stubApi: ClientApi = {
  getAssetsAndGroups: async () => {
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
