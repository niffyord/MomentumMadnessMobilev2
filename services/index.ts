export * from './config';
export * from './apiService';
export * from './websocketService';
export * from './backendTypes';
export * from './backendConfig';
export * from './types';

// Export default instances
export { apiService } from './apiService'
export { websocketService } from './websocketService'

// Helper function to create an API service instance
export const createApiService = () => {
  return new (require('./apiService').default)();
}; 