import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getLocalHost = () => {
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return 'localhost';
};

const getApiUrl = () => {
  // Try to get the host URI from Expo constants (works for physical devices connected to the same network)
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];

  if (localhost) {
    return `http://${localhost}:8000`;
  }

  // Fallback for emulators if hostUri is not available
  return `http://${getLocalHost()}:8000`;
};

export const API_URL = getApiUrl();

console.log('API_URL configured as:', API_URL);
