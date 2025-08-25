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
  // Always try production first
  return config.production.backendUrl;
};

// Fallback function to get alternative backend URLs if production fails
export const getFallbackBackendUrl = () => {
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'development') {
    // If running on localhost (development), use localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return config.development.backendUrl;
    }
    // If running on a different device, use the same hostname but different port
    return `http://${window.location.hostname}:8000`;
  }
  
  // For production, fall back to localhost if production fails
  return config.development.backendUrl;
};

export default config;
