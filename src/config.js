// Configuration for backend URLs
const config = {
  // Production backend URL
  production: {
    backendUrl: 'http://35.247.83.89:8000'
  },
  // Development environment
  development: {
    backendUrl: 'http://localhost:8000'
  }
};

// Get the appropriate backend URL based on environment
export const getBackendUrl = () => {
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'local') {
    return config.development.backendUrl;
  }
  // Default to production
  return config.production.backendUrl;
};

// Fallback function to get alternative backend URLs if primary fails
export const getFallbackBackendUrl = () => {
  // If we're in development, try localhost
  if (process.env.NODE_ENV === 'development') {
    return config.development.backendUrl;
  }
  
  // For production, fall back to localhost if production fails
  return config.development.backendUrl;
};

export default config;
