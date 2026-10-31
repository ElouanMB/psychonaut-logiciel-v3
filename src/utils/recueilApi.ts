import { invoke } from '@tauri-apps/api/core';

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

// HTTPS sur le port 443 (Caddy sur le VPS) : passe aussi sur les réseaux qui bloquent le port 3000
export const DEFAULT_RECUEIL_SERVER_URL = 'https://164-132-194-10.sslip.io';
// Anciennes adresses (ancienne IP hors service, puis accès direct en HTTP sur le port 3000)
const LEGACY_SERVER_HOSTS = ['217.154.15.49', '164.132.194.10'];

export function getRecueilServerUrl(): string {
  const saved = (localStorage.getItem('recueilServerUrl') || '').trim();
  if (!saved || LEGACY_SERVER_HOSTS.some((h) => saved.includes(h))) {
    return DEFAULT_RECUEIL_SERVER_URL;
  }
  return saved;
}

/** Racine du serveur (sans /api), utilisée aussi par l'assistant IA */
export function getServerRootUrl(): string {
  let baseUrl = getRecueilServerUrl();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `http://${baseUrl}`;
  }
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
}

export function getApiBaseUrl(): string {
  return `${getServerRootUrl()}/api`;
}

async function fetchApi(endpoint: string, options: ApiOptions = {}) {
  const baseUrl = getApiBaseUrl();
  const apiKey = localStorage.getItem('recueilApiKey') || 'psychonaut-v3-key';
  const apiPassword = (localStorage.getItem('recueilApiPassword') || '').trim();
  const username = localStorage.getItem('userDisplayName') || localStorage.getItem('xfUser') || 'Anonymous';
  const owner = getSyncOwner();

  // On passe par Rust (reqwest) pour éviter le blocage Mixed Content de WebView2 en production.
  // Les noms sont encodés : un en-tête HTTP ne transporte pas correctement les accents (« L'élouan »).
  return invoke<any>('recueil_fetch', {
    url: `${baseUrl}${endpoint}`,
    method: options.method || 'GET',
    apiKey,
    apiPassword,
    username: encodeURIComponent(username),
    owner: owner ? encodeURIComponent(owner) : null,
    body: options.body ? JSON.stringify(options.body) : null,
  });
}

/**
 * Propriétaire des rendus synchronisés : le nom du compte sur le forum, tel que renvoyé par la connexion
 * (identique quel que soit l'identifiant saisi, pseudo ou e-mail). Vide tant que la connexion au forum n'a pas réussi.
 */
export function getSyncOwner(): string {
  return (localStorage.getItem('userDisplayName') || '').trim().toLowerCase();
}

export interface SyncRendu {
  id: string;
  title: string;
  date: string | null;
  status: string | null;
  substance: string | null;
  content: string | null;
  analysisId: string | null;
  updatedAt: number;
  deleted: boolean;
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

  // Rendus de l'utilisateur (synchronisation entre appareils)
  getRendus: (): Promise<SyncRendu[]> => fetchApi('/rendus'),
  pushRendus: (items: SyncRendu[]): Promise<{ received: number; changed: number }> =>
    fetchApi('/rendus/sync', { method: 'POST', body: { items } }),
};
