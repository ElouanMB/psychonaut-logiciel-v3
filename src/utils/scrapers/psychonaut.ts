import { fetch } from '@tauri-apps/plugin-http';
import type { AnalysisResult, EnrichedIdentifier } from './types';

export const psychoBase = 'https://www.psychoactif.org';
export const druglabBase = 'https://druglab.fr';
export const psychonautBase = 'https://www.psychonaut.fr';

export async function loginToPsychonaut(user?: string, pass?: string): Promise<{ success: boolean; username?: string; avatar?: string; error?: string }> {
  const username = user || localStorage.getItem('xfUser');
  const password = pass || localStorage.getItem('xfPass');
  
  if (!username || !password) {
    return { success: false, error: 'Identifiants manquants' };
  }

  try {
    const loginPageRes = await fetch(`${psychonautBase}/login/`, { method: 'GET' });
    const loginPageHtml = await loginPageRes.text();
    const parser = new DOMParser();
    let doc = parser.parseFromString(loginPageHtml, 'text/html');
    const tokenInput = doc.querySelector('input[name="_xfToken"]') as HTMLInputElement;
    const token = tokenInput ? tokenInput.value : '';

    if (!token) return { success: false, error: 'Token CSRF introuvable' };

    const formData = new URLSearchParams();
    formData.append('login', username);
    formData.append('password', password);
    formData.append('remember', '1');
    formData.append('_xfToken', token);
    formData.append('_xfRedirect', '/');

    const loginRes = await fetch(`${psychonautBase}/login/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const loginResText = await loginRes.text();
    if (loginResText.includes('Incorrect password') || loginResText.includes('The requested user could not be found')) {
      return { success: false, error: 'Identifiants incorrects' };
    }

    const profileRes = await fetch(`${psychonautBase}/account/`, { method: 'GET' });
    if (profileRes.status === 302 || profileRes.url.includes('/login/')) {
       return { success: false, error: 'Connexion échouée' };
    }

    const profileHtml = await profileRes.text();
    doc = parser.parseFromString(profileHtml, 'text/html');

    const nameEl = doc.querySelector('.p-navgroup-link--user .p-navgroup-linkText');
    const displayName = nameEl ? nameEl.textContent?.trim() : username;

    let avatar = '';
    const avatarImg = doc.querySelector('.p-navgroup-link--user .avatar img') as HTMLImageElement;
    if (avatarImg) {
      const src = avatarImg.getAttribute('src');
      if (src) {
        avatar = src.startsWith('http') ? src : `${psychonautBase}${src}`;
      }
    }

    return { success: true, username: displayName || username, avatar };
  } catch (e) {
    console.error('Login error', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

interface ParsedThread {
  title: string;
  url: string;
  label: string | null;
  closed: boolean;
  createdAt: string | null;
  identifiers: { raw: string; canonical: string }[];
}

export async function scrapeForum(pages: number = 1, onProgress?: (p: number) => void): Promise<AnalysisResult[]> {
  if (onProgress) onProgress(0);

  await loginToPsychonaut();

  const forumPath = '/forums/demandes.160/';
  const threads: ParsedThread[] = [];

  const firstPageRes = await fetch(`${psychonautBase}${forumPath}`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  
  if (!firstPageRes.ok) {
    throw new Error(`Failed to fetch forum: ${firstPageRes.statusText}`);
  }
  
  const firstPageHtml = await firstPageRes.text();
  const parser = new DOMParser();
  const firstDoc = parser.parseFromString(firstPageHtml, 'text/html');

  let maxPage = 1;
  firstDoc.querySelectorAll('a[href*="/page-"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/page-(\d+)/);
    if (m) {
      maxPage = Math.max(maxPage, parseInt(m[1], 10));
    }
  });

  const endPage = pages > 0 ? Math.min(pages, maxPage) : maxPage;
  threads.push(...parseThreads(firstDoc));

  for (let i = 2; i <= endPage; i++) {
    const htmlRes = await fetch(`${psychonautBase}${forumPath}page-${i}`);
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const doc = parser.parseFromString(html, 'text/html');
      threads.push(...parseThreads(doc));
    }
    if (onProgress) onProgress(10 + Math.floor((i / endPage) * 20));
  }

  const results: AnalysisResult[] = [];

  for (let i = 0; i < threads.length; i++) {
    const t = threads[i];
    const enriched: EnrichedIdentifier[] = [];

    for (const id of t.identifiers) {
      const isDruglab = /^\d{4}-\d{3,6}$/.test(id.canonical);
      
      if (isDruglab) {
        const dlUrl = `${druglabBase}/resultats/${encodeURIComponent(id.canonical)}`;
        try {
          const res = await fetch(dlUrl, { method: 'GET' });
          enriched.push({ ...id, druglabUrl: dlUrl, druglabFound: res.status >= 200 && res.status < 300 });
        } catch {
          enriched.push({ ...id, druglabUrl: dlUrl, druglabFound: false });
        }
      } else {
        const psyUrl = `${psychoBase}/forum/analyse-a-distance.php?identification=${encodeURIComponent(id.canonical)}#divid`;
        try {
          const res = await fetch(psyUrl, { method: 'GET' });
          const html = await res.text();
          const found = !/Il semble qu'il n'y ai pas encore de résultat/i.test(html) &&
              (html.includes("Résultats de l'analyse") || html.includes('Molécule attendue'));
          enriched.push({ ...id, psychoUrl: psyUrl, psychoFound: found });
        } catch {
          enriched.push({ ...id, psychoUrl: psyUrl, psychoFound: false });
        }
      }
    }

    results.push({
      ...t,
      identifiers: enriched,
      ...(enriched.length === 0 ? { missingIdentifier: true } : {})
    });

    if (onProgress) onProgress(30 + Math.floor(((i + 1) / threads.length) * 70));
  }

  if (onProgress) onProgress(100);
  return results;
}

function parseThreads(doc: Document): ParsedThread[] {
  const arr: ParsedThread[] = [];
  const items = doc.querySelectorAll('.structItem.structItem--thread');
  
  items.forEach((el) => {
    let titleEl = el.querySelector('.structItem-title a[data-tp-primary="on"]');
    if (!titleEl) {
      titleEl = el.querySelector('.structItem-title a[href*="/threads/"]');
    }
    if (!titleEl) return;

    const title = titleEl.textContent?.trim() || '';
    const href = titleEl.getAttribute('href') || '';
    const labelEl = el.querySelector('.structItem-title .label');
    const label = labelEl ? labelEl.textContent?.trim() || null : null;

    const itemClass = el.getAttribute('class') || '';
    const closed = /is-locked|is-deleted/i.test(itemClass) ||
        el.querySelectorAll('.structItem-status--locked, .structItem-status--deleted').length > 0;

    const identifiers = extractIdentifiers(title);

    let createdAt = null;
    const timeEl = el.querySelector('.structItem-startDate time');
    if (timeEl) {
      createdAt = timeEl.getAttribute('datetime') || null;
    }

    const isUtility = title.includes("Collecte mode d'emploi !") || title === "Sauvegardes";
    if (isUtility) return;

    arr.push({ title, url: href, label, closed, createdAt, identifiers });
  });

  return arr;
}

function extractIdentifiers(title: string) {
  const found: { raw: string; canonical: string }[] = [];
  const seen = new Set<string>();

  const add = (raw: string, canonical: string) => {
    if (!seen.has(canonical)) {
      seen.add(canonical);
      found.push({ raw, canonical });
    }
  };

  const reDrug = /\b(ATP-?)?(\d{4}-\d{3,6})\b/gi;
  for (const match of title.matchAll(reDrug)) {
    add(match[0], match[2]);
  }

  const rePsy = /PSY(?:CHO)?\s*(\d{5,7})/gi;
  for (const match of title.matchAll(rePsy)) {
    add(match[0].toUpperCase(), `PSYCHO${match[1]}`);
  }

  const reInBr = /\[(\d{5,7})\]/g;
  for (const match of title.matchAll(reInBr)) {
    add(`[${match[1]}]`, `PSYCHO${match[1]}`);
  }

  const reBare = /\b(\d{5,7})\b/g;
  for (const match of title.matchAll(reBare)) {
    if (!/^\d{4}-/.test(match[1])) {
      add(match[1], `PSYCHO${match[1]}`);
    }
  }

  return found;
}

export async function scrapePsychonautRequest(threadUrl: string): Promise<string | null> {
  try {
    const fullUrl = threadUrl.startsWith('http') ? threadUrl : `${psychonautBase}${threadUrl}`;
    const res = await fetch(fullUrl, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const firstPost = doc.querySelector('.message-body .bbWrapper');
    if (firstPost) {
      // Copy the node to avoid mutating the parsed DOM unnecessarily
      const clone = firstPost.cloneNode(true) as HTMLElement;
      
      // Remove quotes to only get the original author's request
      clone.querySelectorAll('.bbCodeBlock--quote').forEach(quote => { quote.remove(); });
      
      // Replace <br> with newlines to preserve formatting in textContent
      clone.querySelectorAll('br').forEach(br => { br.replaceWith('\n'); });
      
      return clone.textContent?.trim() || null;
    }
    return null;
  } catch (e) {
    console.error("Erreur lors de la récupération de la demande:", e);
    return null;
  }
}

