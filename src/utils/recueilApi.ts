import { invoke } from '@tauri-apps/api/core';

const API_BASE_URL = 'http://217.154.15.49:3000/api';

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

  // On passe par Rust (reqwest) pour éviter le blocage Mixed Content de WebView2 en production
  return invoke<any>('recueil_fetch', {
    url: `${API_BASE_URL}${endpoint}`,
    method: options.method || 'GET',
    apiKey,
    apiPassword,
    username,
    body: options.body ? JSON.stringify(options.body) : null,
  });
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
