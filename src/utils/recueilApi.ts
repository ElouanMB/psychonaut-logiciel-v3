import { fetch } from '@tauri-apps/plugin-http';

const API_BASE_URL = import.meta.env.VITE_RECUEIL_API_URL || 'http://localhost:3000/api';

interface ApiOptions {
  method?: string;
  body?: any;
}

export interface Resource {
  id: string;
  title: string;
  updated_at: number;
  last_editor: string;
}

export interface ResourceItem {
  id: string;
  resource_id: string;
  type: 'note' | 'link';
  title: string;
  url?: string;
  lang?: string;
  content?: string;
}

async function fetchApi(endpoint: string, options: ApiOptions = {}) {
  const apiKey = localStorage.getItem('recueilApiKey') || '';
  const apiPassword = localStorage.getItem('recueilApiPassword') || '';
  const username = localStorage.getItem('xfUser') || localStorage.getItem('userDisplayName') || 'Anonymous';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'x-api-password': apiPassword,
    'x-username': username,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Identifiants incorrects.');
    }
    throw new Error(`Erreur API: ${response.statusText}`);
  }

  return response.json();
}

export const recueilApi = {
  // Resources
  getResources: () => fetchApi('/resources'),
  createResource: (title: string) => fetchApi('/resources', { method: 'POST', body: { title } }),
  updateResource: (id: string, title: string) => fetchApi(`/resources/${id}`, { method: 'PUT', body: { title } }),
  deleteResource: (id: string) => fetchApi(`/resources/${id}`, { method: 'DELETE' }),

  // Items
  getResourceItems: (resourceId: string) => fetchApi(`/resources/${resourceId}/items`),
  createItem: (item: Omit<ResourceItem, 'id'>) => fetchApi('/items', { method: 'POST', body: item }),
  updateItem: (id: string, item: Partial<ResourceItem>) => fetchApi(`/items/${id}`, { method: 'PUT', body: item }),
  deleteItem: (id: string, resourceId: string) => fetchApi(`/items/${id}`, { method: 'DELETE', body: { resource_id: resourceId } }),
};
