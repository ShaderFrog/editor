import useSWR from 'swr';
import { API } from './api';
import { AssetsAndGroups } from '@editor/model/Asset';

export const useAssetsAndGroups = () => {
  const { data } = useSWR(API.assets);
  return data as AssetsAndGroups;
};
