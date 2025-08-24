// Configuration for backend URLs
const config = {
  // Development environment
  development: {
    backendUrl: 'http://localhost:8000'
  },
  // Production environment (you can change this to your actual backend URL)
  production: {
    backendUrl: 'http://localhost:8000' // Change this to your production backend URL
  }
};

// Get the appropriate backend URL based on environment
export const getBackendUrl = () => {
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'development') {
    // If running on localhost (development), use localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return config.development.backendUrl;
    }
    // If running on a different device, use the same hostname but different port
    return `http://${window.location.hostname}:8000`;
  }
  
  // Production environment
  return config.production.backendUrl;
};

export default config;
