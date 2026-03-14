import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
    baseURL: `${API_BASE.replace(/\/+$/, '')}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach JWT token to every request if it exists
api.interceptors.request.use((config) => {
    const stored = localStorage.getItem('dental-auth-storage');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            const token = parsed?.state?.token;
            if (token) config.headers.Authorization = `Bearer ${token}`;
        } catch { /* ignore */ }
    }
    return config;
});

// Unwrap the global TransformInterceptor envelope { data, statusCode, message }
// so that res.data everywhere in the app is the actual payload
api.interceptors.response.use(
    (response) => {
        if (
            response.data &&
            typeof response.data === 'object' &&
            'data' in response.data &&
            'statusCode' in response.data
        ) {
            response.data = response.data.data;
        }
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Only redirect if NOT already on an auth page
            const isAuthPage = window.location.pathname.startsWith('/auth');
            if (!isAuthPage) {
                localStorage.removeItem('dental-auth-storage');
                window.location.href = '/auth/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

