import axios from 'axios';

// Use the environment variable from .env
// This ensures the IP 192.168.0.11 is used instead of just localhost
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, 
});

// Interceptor to inject the token from local storage (to match your restored Login.jsx)
api.interceptors.request.use((config) => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user && user.token) {
        config.headers.Authorization = `Token ${user.token}`;
      }
    }
  } catch (e) {
    localStorage.removeItem('user');
  }
  return config;
});

export default api;