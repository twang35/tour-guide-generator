// Configuration for backend URLs
const config = {
  // Production backend URL — uses /api prefix, reverse-proxied by Caddy to port 8000
  production: {
    backendUrl: '/api'
  },
  // Development environment — direct connection to backend
  development: {
    backendUrl: 'http://localhost:8000'
  }
};

// Get the appropriate backend URL based on environment
export const getBackendUrl = () => {
  if (process.env.REACT_APP_ENVIRONMENT === 'local' || process.env.NODE_ENV === 'development') {
    return config.development.backendUrl;
  }
  return config.production.backendUrl;
};

// Fallback function to get alternative backend URLs if primary fails
export const getFallbackBackendUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return config.development.backendUrl;
  }
  return config.production.backendUrl;
};

export default config;
