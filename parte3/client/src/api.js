const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'No se pudo completar la solicitud');
  return payload.data;
}

export const authApi = {
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) })
};

export const ticketApi = {
  create: (data) => apiRequest('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  list: (query = '') => apiRequest(`/tickets${query ? `?${query}` : ''}`),
  get: (id) => apiRequest(`/tickets/${id}`),
  changeStatus: (id, status) => apiRequest(`/tickets/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assign: (id, agentId) => apiRequest(`/tickets/${id}/asignar`, { method: 'PATCH', body: JSON.stringify(agentId ? { agentId } : {}) }),
  comments: (id) => apiRequest(`/tickets/${id}/comentarios`),
  addComment: (id, data) => apiRequest(`/tickets/${id}/comentarios`, { method: 'POST', body: JSON.stringify(data) }),
  stats: () => apiRequest('/tickets/stats')
};

export const usersApi = {
  list: () => apiRequest('/users'),
  update: (id, data) => apiRequest(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
};
