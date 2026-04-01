import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;
    if (status === 401) { localStorage.removeItem('cb_token'); window.location.href = '/login'; return Promise.reject(error); }
    if (status === 402) toast.error(message || 'Limite do plano atingido.', { icon: '🔒' });
    else if (status === 429) toast.error('Muitas requisições. Aguarde um momento.');
    else if (status >= 500) toast.error('Erro interno. Tente novamente.');
    return Promise.reject(error);
  }
);

export const authService = {
  login: (email, password) => api.post('/tenant/login', { email, password }),
  register: (data) => api.post('/tenant/register', data),
  refreshToken: (token) => api.post('/tenant/refresh-token', { token }),
  getMe: () => api.get('/tenant/me'),
};

export const botService = {
  list: () => api.get('/tenant/bots'),
  create: (data) => api.post('/tenant/bots', data),
  getById: (id) => api.get(`/tenant/bots/${id}`),
  update: (id, data) => api.patch(`/tenant/bots/${id}`, data),
  delete: (id) => api.delete(`/tenant/bots/${id}`),
};

export const billingService = {
  listPlans: () => api.get('/billing/plans'),
  getSubscription: () => api.get('/billing/subscription'),
  subscribe: (planId) => api.post('/billing/subscribe', { planId }),
  cancel: () => api.post('/billing/cancel'),
  listInvoices: () => api.get('/billing/invoices'),
  getUsage: () => api.get('/billing/usage'),
};

export const chatService = {
  sendMessage: (botId, sessionId, message) => api.post('/chat/message', { botId, sessionId, message }),
  getHistory: (sessionId, botId) => api.get(`/chat/history/${sessionId}`, { params: { botId } }),
};

export default api;
