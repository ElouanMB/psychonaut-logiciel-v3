import type { AnalysisResult, EnrichedIdentifier } from './types';
import { httpGetText, errorMessage, normalizeIsoDate } from './http';

export const psychoBase = 'https://www.psychoactif.org';
export const druglabBase = 'https://druglab.fr';
export const psychonautBase = 'https://www.psychonaut.fr';

export function druglabResultUrl(canonical: string): string {
  return `${druglabBase}/echantillon/${encodeURIComponent(canonical)}/`;
}

export function psychoactifResultUrl(canonical: string): string {
  return `${psychoBase}/forum/analyse-a-distance.php?identification=${encodeURIComponent(canonical)}#divid`;
}

// Messages d'erreur XenForo (le forum est en français, on garde l'anglais au cas où)
const LOGIN_ERROR_PATTERNS = [
  /mot de passe incorrect/i,
  /n'a pu .{0,3}tre trouv/i,
  /Incorrect password/i,
  /requested user could not be found/i,
];

export async function loginToPsychonaut(user?: string, pass?: string): Promise<{ success: boolean; username?: string; avatar?: string; error?: string }> {
  const username = user || localStorage.getItem('xfUser');
  const password = pass || localStorage.getItem('xfPass');

  if (!username || !password) {
    return { success: false, error: 'Identifiants manquants' };
  }

  try {
    const loginPage = await httpGetText(`${psychonautBase}/login/`);
    const parser = new DOMParser();
    let doc = parser.parseFromString(loginPage.text, 'text/html');
    const tokenInput = doc.querySelector('input[name="_xfToken"]') as HTMLInputElement;
    const token = tokenInput ? tokenInput.value : '';

    if (!token) return { success: false, error: `Token CSRF introuvable (HTTP ${loginPage.status})` };

    const formData = new URLSearchParams();
    formData.append('login', username);
    formData.append('password', password);
    formData.append('remember', '1');
    formData.append('_xfToken', token);
    formData.append('_xfRedirect', '/');

    const loginRes = await httpGetText(`${psychonautBase}/login/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (LOGIN_ERROR_PATTERNS.some((re) => re.test(loginRes.text))) {
      return { success: false, error: 'Identifiants incorrects' };
    }

    const profileRes = await httpGetText(`${psychonautBase}/account/`);
    if (profileRes.status === 302 || profileRes.url.includes('/login')) {
       return { success: false, error: 'Connexion échouée' };
    }

    doc = parser.parseFromString(profileRes.text, 'text/html');

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
    return { success: false, error: errorMessage(e) };
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

export async function checkIdentifier(id: { raw: string; canonical: string }): Promise<EnrichedIdentifier> {
  const isDruglab = /^\d{4}-\d{3,6}$/.test(id.canonical);

  if (isDruglab) {
    const dlUrl = druglabResultUrl(id.canonical);
    try {
      const res = await httpGetText(dlUrl);
      if (res.ok) return { ...id, druglabUrl: dlUrl, druglabFound: true };
      // 404 = résultat pas encore publié ; tout autre code est une vraie erreur
      return { ...id, druglabUrl: dlUrl, druglabFound: false, ...(res.status !== 404 ? { checkError: `DrugLab HTTP ${res.status}` } : {}) };
    } catch (e) {
      return { ...id, druglabUrl: dlUrl, druglabFound: false, checkError: `DrugLab : ${errorMessage(e)}` };
    }
  }

  const first = await checkPsychoactif(id);
  if (first.psychoFound || first.checkError || !hasGuessedPrefix(id)) return first;

  // Numéro sans préfixe et rien en PSYCHO : on essaie les autres séries
  const digits = id.canonical.replace(/^\D+/, '');
  for (const prefix of PSYCHOACTIF_PREFIXES.filter((p) => p !== 'PSYCHO')) {
    const alt = await checkPsychoactif({ raw: id.raw, canonical: `${prefix}${digits}` });
    if (alt.psychoFound) return alt;
  }
  return first;
}

async function checkPsychoactif(id: { raw: string; canonical: string }): Promise<EnrichedIdentifier> {
  const psyUrl = psychoactifResultUrl(id.canonical);
  try {
    const res = await httpGetText(psyUrl);
    if (!res.ok) {
      return { ...id, psychoUrl: psyUrl, psychoFound: false, checkError: `Psychoactif HTTP ${res.status}` };
    }
    const html = res.text;
    const found = !/Il semble qu'il n'y ai[t]? pas encore de r.sultat/i.test(html) &&
        (/R.sultats de l'analyse/.test(html) || /Mol.cule attendue/.test(html));
    return { ...id, psychoUrl: psyUrl, psychoFound: found };
  } catch (e) {
    return { ...id, psychoUrl: psyUrl, psychoFound: false, checkError: `Psychoactif : ${errorMessage(e)}` };
  }
}

export async function scrapeForum(pages: number = 1, onProgress?: (p: number) => void): Promise<AnalysisResult[]> {
  if (onProgress) onProgress(0);

  // Le forum "Demandes" est privé : sans connexion valide, la liste serait vide sans aucune erreur.
  const login = await loginToPsychonaut();
  if (!login.success) {
    throw new Error(`connexion au forum impossible (${login.error}). Vérifiez vos identifiants dans les paramètres.`);
  }

  const forumPath = '/forums/demandes.160/';
  const threads: ParsedThread[] = [];

  const firstPage = await httpGetText(`${psychonautBase}${forumPath}`);

  if (!firstPage.ok) {
    throw new Error(`Failed to fetch forum: HTTP ${firstPage.status} ${firstPage.statusText}`);
  }

  const parser = new DOMParser();
  const firstDoc = parser.parseFromString(firstPage.text, 'text/html');

  // Uniquement la pagination du forum (les liens "page-N" des sujets eux-mêmes faussaient le total)
  let maxPage = 1;
  firstDoc.querySelectorAll(`a[href*="${forumPath}page-"]`).forEach((a) => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/page-(\d+)/);
    if (m) {
      maxPage = Math.max(maxPage, parseInt(m[1], 10));
    }
  });

  const endPage = pages > 0 ? Math.min(pages, maxPage) : maxPage;
  threads.push(...parseThreads(firstDoc));

  if (firstDoc.querySelectorAll('.structItem--thread').length === 0) {
    throw new Error("aucun sujet visible dans le forum Demandes (accès refusé pour ce compte ?)");
  }

  for (let i = 2; i <= endPage; i++) {
    try {
      const page = await httpGetText(`${psychonautBase}${forumPath}page-${i}`);
      if (page.ok) {
        const doc = parser.parseFromString(page.text, 'text/html');
        threads.push(...parseThreads(doc));
      }
    } catch (e) {
      console.warn(`Page ${i} du forum ignorée :`, e);
    }
    if (onProgress) onProgress(10 + Math.floor((i / endPage) * 20));
  }

  // Un sujet peut apparaître sur deux pages si la liste bouge pendant le scan
  const seenUrls = new Set<string>();
  const uniqueThreads = threads.filter((t) => {
    if (seenUrls.has(t.url)) return false;
    seenUrls.add(t.url);
    return true;
  });

  let done = 0;
  const results = await mapWithConcurrency(uniqueThreads, CHECK_CONCURRENCY, async (t): Promise<AnalysisResult> => {
    const enriched: EnrichedIdentifier[] = [];
    for (const id of t.identifiers) {
      enriched.push(await checkIdentifier(id));
    }

    done++;
    if (onProgress) onProgress(30 + Math.floor((done / uniqueThreads.length) * 70));

    return {
      ...t,
      identifiers: enriched,
      ...(enriched.length === 0 ? { missingIdentifier: true } : {})
    };
  });

  if (onProgress) onProgress(100);
  return results;
}

// Vérifications en parallèle, en nombre limité pour ne pas se faire bloquer par Psychoactif / DrugLab
const CHECK_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
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
      createdAt = normalizeIsoDate(timeEl.getAttribute('datetime'));
    }

    const isUtility = title.includes("Collecte mode d'emploi !") || title === "Sauvegardes";
    if (isUtility) return;

    arr.push({ title, url: href, label, closed, createdAt, identifiers });
  });

  return arr;
}

export function extractIdentifiers(title: string) {
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
  // PSYCHO, PSY et RDRAD sont trois séries distinctes sur Psychoactif : PSY254920 et PSYCHO254920
  // sont deux échantillons différents, le préfixe doit donc être conservé tel quel.
  const rePrefixed = /(PSYCHO|PSY|RDRAD)\s*-?\s*(\d{5,10})/gi;
  for (const match of title.matchAll(rePrefixed)) {
    add(match[0].toUpperCase(), `${match[1].toUpperCase()}${match[2]}`);
  }

  // On retire les identifiants déjà reconnus avant de chercher les numéros nus :
  // sinon "2026-12345" produisait aussi un faux PSYCHO12345, et "RDRAD267949" un faux PSYCHO267949.
  const rest = title.replace(reDrug, ' ').replace(rePrefixed, ' ');

  // Numéros sans préfixe : PSYCHO par défaut, les autres séries sont essayées à la vérification
  const reInBr = /\[(\d{5,8})\]/g;
  for (const match of rest.matchAll(reInBr)) {
    add(`[${match[1]}]`, `PSYCHO${match[1]}`);
  }

  const reBare = /\b(\d{5,8})\b/g;
  for (const match of rest.matchAll(reBare)) {
    add(match[1], `PSYCHO${match[1]}`);
  }

  return found;
}

const PSYCHOACTIF_PREFIXES = ['PSYCHO', 'PSY', 'RDRAD'];

/** Vrai si le titre ne donnait que le numéro (ex. "[266373]") : le préfixe PSYCHO a alors été supposé */
function hasGuessedPrefix(id: { raw: string }): boolean {
  return /^\[?\d+\]?$/.test(id.raw.trim());
}

export async function scrapePsychonautRequest(threadUrl: string): Promise<string | null> {
  try {
    const fullUrl = threadUrl.startsWith('http') ? threadUrl : `${psychonautBase}${threadUrl}`;
    const res = await httpGetText(fullUrl);
    if (!res.ok) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(res.text, 'text/html');
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
