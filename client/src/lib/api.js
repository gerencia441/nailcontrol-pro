const BASE = '/api';

async function request(method, path, body) {
  const token = localStorage.getItem('token');
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API Error');
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  login: (data) => request('POST', '/auth/login', data),

  // Clients
  getClients: (search) =>
    request('GET', `/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getClient: (id) => request('GET', `/clients/${id}`),
  createClient: (data) => request('POST', '/clients', data),
  updateClient: (id, data) => request('PUT', `/clients/${id}`, data),
  deleteClient: (id) => request('DELETE', `/clients/${id}`),

  // Services
  getServices: () => request('GET', '/services'),
  createService: (data) => request('POST', '/services', data),
  updateService: (id, data) => request('PUT', `/services/${id}`, data),
  deleteService: (id) => request('DELETE', `/services/${id}`),

  // Manicurists
  getManicurists: () => request('GET', '/manicurists'),
  createManicurist: (data) => request('POST', '/manicurists', data),
  updateManicurist: (id, data) => request('PUT', `/manicurists/${id}`, data),
  deleteManicurist: (id) => request('DELETE', `/manicurists/${id}`),

  // Appointments
  getAppointments: (params) =>
    request('GET', `/appointments?${new URLSearchParams(params || {})}`),
  createAppointment: (data) => request('POST', '/appointments', data),
  updateAppointment: (id, data) => request('PATCH', `/appointments/${id}`, data),
  completeAppointment: (id, data) =>
    request('PATCH', `/appointments/${id}/complete`, data),
  deleteAppointment: (id) => request('DELETE', `/appointments/${id}`),

  // Finances
  getFinances: (params) =>
    request('GET', `/finances?${new URLSearchParams(params || {})}`),
  createFinance: (data) => request('POST', '/finances', data),
  deleteFinance: (id) => request('DELETE', `/finances/${id}`),
  getDayClose: (date) => request('GET', `/finances/day-close?date=${date}`),

  // Dashboard
  getDashboard: () => request('GET', '/dashboard'),
};
