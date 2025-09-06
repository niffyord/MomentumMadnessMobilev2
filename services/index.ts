export * from './config';
export * from './apiService';
export * from './websocketService';
export * from './backendTypes';
export * from './backendConfig';

// Export default instances via named exports are already covered by `export *` above.
// Helper to create an API service instance (kept for convenience)
export const createApiService = () => {
  return new (require('./apiService').default)();
}; 
