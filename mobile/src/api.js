import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSessionItem } from './sessionStore';

export const apiBaseURL = process.env.EXPO_PUBLIC_API_URL
  || (Platform.OS === 'web' ? 'http://localhost:5001/api' : Constants.expoConfig?.extra?.apiUrl || 'http://10.0.2.2:5001/api');
const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 12000,
  headers: { Accept: 'application/json' }
});

api.interceptors.request.use(async (config) => {
  const token = await getSessionItem('session-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === 'ECONNABORTED') return 'Le serveur met trop de temps à répondre.';
  return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
}

export default api;