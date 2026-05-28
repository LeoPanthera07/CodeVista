const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const { body, method = 'GET', headers = {}, retries = 2, ...rest } = options;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...rest,
  };

  if (body && !(body instanceof FormData)) {
    config.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    delete config.headers['Content-Type'];
    config.body = body;
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || errorData.message || `Request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status < 500) {
        throw error;
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// Streaming request for chat
async function streamRequest(endpoint, body, onChunk) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || 'Stream request failed',
      response.status,
      errorData
    );
  }

  const contentType = response.headers.get('content-type');

  // Handle SSE streaming
  if (contentType && contentType.includes('text/event-stream')) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            onChunk(parsed);
          } catch {
            onChunk({ content: data });
          }
        }
      }
    }
    return;
  }

  // Fall back to JSON response
  const data = await response.json();
  onChunk(data);
  return data;
}

const api = {
  // Repositories
  connectRepository: (url, options = {}) =>
    request('/repositories/connect', { method: 'POST', body: { url, ...options } }),

  uploadRepository: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/repositories/upload', { method: 'POST', body: formData, retries: 0 });
  },

  getRepositories: () =>
    request('/repositories'),

  getRepository: (id) =>
    request(`/repositories/${id}`),

  getRepositoryStatus: (id) =>
    request(`/repositories/${id}/status`),

  deleteRepository: (id) =>
    request(`/repositories/${id}`, { method: 'DELETE' }),

  // Analysis
  getRepositorySummary: (id) =>
    request(`/repositories/${id}/summary`),

  getRepositoryMap: (id) =>
    request(`/repositories/${id}/map`),

  getRepositoryFiles: (id) =>
    request(`/repositories/${id}/files`),

  // Chat
  sendChatMessage: (id, message, onChunk) =>
    streamRequest(`/repositories/${id}/chat`, { message }, onChunk),

  getChatHistory: (id) =>
    request(`/repositories/${id}/chat/history`),

  // Documentation
  generateDocumentation: (id, type) =>
    request(`/repositories/${id}/documentation`, { method: 'POST', body: { type } }),

  getDocumentation: (id) =>
    request(`/repositories/${id}/documentation`),
};

export default api;
export { ApiError };
