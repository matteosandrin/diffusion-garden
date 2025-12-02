import type {
  CanvasState,
  GenerateTextResponse,
  DescribeResponse,
  GenerateImageResponse,
  AppSettings,
  TextModel,
  Prompts,
} from '../types';

const API_BASE = '/api';

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// Canvas API
export const canvasApi = {
  create: () => apiFetch<{ id: string }>('/canvas', { method: 'POST' }),
  
  load: (id: string) => apiFetch<CanvasState>(`/canvas/${id}`),
  
  save: (id: string, state: Partial<CanvasState>) =>
    apiFetch<{ success: boolean }>(`/canvas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(state),
    }),
    
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/canvas/${id}`, { method: 'DELETE' }),
};

// AI Tools API
export const toolsApi = {

  generateText: (prompt: string, input: string | undefined, model: TextModel) =>
    apiFetch<GenerateTextResponse>('/tools/generate-text', {
      method: 'POST',
      body: JSON.stringify({ prompt, input: input || undefined, model }),
    }),

  describe: (imageBase64: string) =>
    apiFetch<DescribeResponse>('/tools/describe', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64 }),
    }),

  generateImage: (prompt: string) =>
    apiFetch<GenerateImageResponse>('/tools/generate-image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
};

// Image API
export const imageApi = {
  upload: async (file: File): Promise<{ imageId: string; imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/images/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  },

  getUrl: (imageId: string) => `${API_BASE}/images/${imageId}`,
};

// Settings API
export const settingsApi = {
  get: () => apiFetch<AppSettings>('/settings'),
  
  update: (settings: Partial<AppSettings>) =>
    apiFetch<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
    
  checkApiKeys: () =>
    apiFetch<{ openai: boolean; google: boolean }>('/settings/api-keys/status'),

  getPrompts: () => apiFetch<Prompts>('/settings/prompts'),
};

