const defaultBaseUrl = 'http://127.0.0.1:4000';

function getBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload?.message || payload || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export const api = {
  health: () => request('/health'),
  signIn: (phone, password) => request('/auth/signin', { method: 'POST', body: { phone, password } }),
  signUp: (name, phone, password) =>
    request('/auth/signup', { method: 'POST', body: { name, phone, password } }),
  getRestaurants: () => request('/restaurants'),
  getOrders: (token) => request('/orders', { token }),
  createOrder: (token, body) => request('/orders', { method: 'POST', token, body }),
  createRestaurant: (token, body) => request('/restaurants', { method: 'POST', token, body }),
  updateRestaurant: (token, id, body) =>
    request(`/restaurants/${id}`, { method: 'PUT', token, body }),
  updateOrderStatus: (token, orderCode, body) =>
    request(`/orders/${orderCode}/status`, { method: 'PATCH', token, body }),
};
