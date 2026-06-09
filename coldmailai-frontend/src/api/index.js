import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1`;

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

const unwrap = (request) => request.then((response) => response.data?.data ?? response.data);

export const register = (name, email, password) =>
  unwrap(api.post('/auth/register', { name, email, password }));

export const login = async (email, password) => {
  const data = await unwrap(api.post('/auth/login', { email, password }));
  if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  return data;
};

export const logout = async () => {
  await api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') });
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  return true;
};

export const getMe = () => unwrap(api.get('/auth/me'));
export const verifyEmail = (token) => unwrap(api.get('/auth/verify-email', { params: { token } }));
export const resendVerification = (email) => unwrap(api.post('/auth/resend-verification', { email }));
export const forgotPassword = (email) => unwrap(api.post('/auth/forgot-password', { email }));
export const resetPassword = (token, password) => unwrap(api.post('/auth/reset-password', { token, password }));

export const refreshTokens = async () => {
  const data = await unwrap(api.post('/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') }));
  if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  return data;
};

export const getProfile = () => unwrap(api.get('/users/me'));
export const updateProfile = (data) => unwrap(api.patch('/users/me', data));
export const getSubscription = () => unwrap(api.get('/users/me/subscription'));
export const getUsageInfo = () => unwrap(api.get('/users/me/usage'));
export const submitBugReport = (data) => unwrap(api.post('/users/bug-reports', data));
export const getBugReports = () => unwrap(api.get('/users/me/bug-reports'));

export const getCurrentUsage = () => unwrap(api.get('/usage/current'));

export const generateEmail = (data) => unwrap(api.post('/emails/generate', data));
export const getEmails = (page = 1, limit = 12) => unwrap(api.get('/emails', { params: { page, limit } }));
export const getEmailById = (id) => unwrap(api.get(`/emails/${id}`));
export const deleteEmail = (id) => unwrap(api.delete(`/emails/${id}`));
export const favoriteEmail = (id) => unwrap(api.patch(`/emails/${id}/favorite`));

export const getPlans = () => unwrap(api.get('/billing/plans'));
export const createCheckout = (plan) => unwrap(api.post('/billing/checkout', { plan }));
export const getBillingPortal = () => unwrap(api.post('/billing/portal'));
export const getBillingStatus = () => unwrap(api.get('/billing/status'));

export const getHealth = () => unwrap(axios.get(`${baseURL}/system/health`));

export default api;
