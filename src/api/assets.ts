import useSWR from 'swr';
import { API, useApi } from './api';

export const useAssetsAndGroups = () => {
  const api = useApi();
  const { data } = useSWR(API.assets, api.getAssetsAndGroups);
  return data!;
};
