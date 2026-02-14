import axios from 'axios';
import { useCuidStore } from '@/stores/cuid-store';

export const apiClient = axios.create({
  baseURL: '/api/v1',
});

apiClient.interceptors.request.use((config) => {
  const cuid = useCuidStore.getState().cuid;
  if (cuid) {
    config.headers['x-algoarena-cuid'] = cuid;
  }
  return config;
});
