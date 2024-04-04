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
};

// Stub data injected at page load time for SWR
export const stubApiData = {
  [API.assets]: [],
};
