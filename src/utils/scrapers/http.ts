import { fetch } from '@tauri-apps/plugin-http';

// Certains sites (psychoactif.org notamment) renvoient 403 aux clients sans User-Agent « navigateur ».
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_TIMEOUT_MS = 20000;

export interface HttpTextResponse {
  ok: boolean;
  status: number;
  statusText: string;
  /** URL finale, après redirections */
  url: string;
  text: string;
}

/**
 * Requête via le plugin HTTP de Tauri, avec des en-têtes identiques sur toutes les plateformes
 * et un délai maximum couvrant aussi la lecture du corps (sans cela, une requête bloquée fige tout le scan).
 */
export async function httpGetText(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HttpTextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', BROWSER_USER_AGENT);
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'fr-FR,fr;q=0.9');

  try {
    const res = await fetch(url, { method: 'GET', ...init, headers, signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, statusText: res.statusText, url: res.url || url, text };
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)} s) pour ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * XenForo fournit des dates du type "2026-10-20T09:11:40+0100" : V8 (Windows) les accepte,
 * mais JavaScriptCore (WebKitGTK sous Linux, macOS) renvoie "Invalid Date" sans les deux-points du fuseau.
 */
export function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
}

export function parseDateSafe(value: string | null | undefined): number {
  const normalized = normalizeIsoDate(value);
  if (!normalized) return 0;
  const t = new Date(normalized).getTime();
  return Number.isNaN(t) ? 0 : t;
}
