import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export function getSessionItem(key) {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.localStorage.getItem(key));
  return SecureStore.getItemAsync(key);
}

export function setSessionItem(key, value) {
  if (Platform.OS === 'web') {
    globalThis.localStorage.setItem(key, value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value);
}

export function deleteSessionItem(key) {
  if (Platform.OS === 'web') {
    globalThis.localStorage.removeItem(key);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(key);
}
