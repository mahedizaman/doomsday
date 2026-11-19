const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function formatFriendlyError(err) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'CIRCULAR_DEPENDENCY':
        return `Circular dependency blocked: ${err.message} A movie cannot depend on itself directly or indirectly.`;
      case 'DUPLICATE_TITLE':
        return `Duplicate movie title: ${err.message}`;
      case 'DUPLICATE_NAME':
        return `Duplicate cinema name: ${err.message}`;
      case 'VALIDATION_ERROR':
        return `Invalid input: ${err.message}`;
      case 'NOT_FOUND':
        return `Not found: ${err.message}`;
      default:
        return err.message || 'An unexpected API error occurred.';
    }
  }
  return err?.message || 'Unable to reach the server. Please check that the API is running.';
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error: unable to contact the Doomsday Ready API.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code = payload?.error?.code || 'REQUEST_FAILED';
    const message = payload?.error?.message || `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, code, message);
  }

  return payload;
}

export const api = {
  getMovies: () => request('/movies'),
  createMovie: (movie) => request('/movies', { method: 'POST', body: movie }),
  updateMovie: (id, patch) => request(`/movies/${id}`, { method: 'PATCH', body: patch }),
  deleteMovie: (id) => request(`/movies/${id}`, { method: 'DELETE' }),
  getRewatchOrder: (id) => request(`/movies/${id}/rewatch-order`),

  getCinemas: () => request('/cinemas'),
  createCinema: (cinema) => request('/cinemas', { method: 'POST', body: cinema }),
  deleteCinema: (id) => request(`/cinemas/${id}`, { method: 'DELETE' }),
  getBookingQuote: (id, groupSize) =>
    request(`/cinemas/${id}/booking?groupSize=${encodeURIComponent(groupSize)}`),
};
