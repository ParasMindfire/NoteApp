import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { getNavigate } from '@/lib/navigation';

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableRequestConfig;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (config._retry || config.url?.includes('/auth/refresh')) {
      useAuthStore.getState().clearAuth();
      getNavigate()?.('/login');
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setAuth(data.accessToken, currentUser);
      }
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${data.accessToken}`,
      };
      return api(config);
    } catch {
      useAuthStore.getState().clearAuth();
      getNavigate()?.('/login');
      return Promise.reject(error);
    }
  },
);
