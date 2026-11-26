import { httpGetText } from './http';
import type { CompoundLine, ScrapedResultDetails } from './types';

const parseNumber = (s: string): number | undefined => {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Lit une ligne du commentaire labo, par ex. « MDMA 94% équivalent chlorhydrate »,
 * « + Caféine 19% » ou « 4CMC NQ ». Renvoie null si la ligne n'est pas une molécule.
 */
export function parseCompoundLine(raw: string): CompoundLine | null {
  const line = raw.replace(/^[\s+\-•*]+/, '').trim();
  if (!line) return null;

  const nq = line.match(/^(.+?)\s+NQ\b/i);
  if (nq) return { name: nq[1].trim(), notQuantified: true };

  const pct = line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*%\s*(?:(?:é|e)quivalent\s+([\p{L}-]+))?/iu);
  if (pct) {
    const percent = parseNumber(pct[2]);
    if (percent === undefined) return null;
    const salt = pct[3]?.toLowerCase();
    return {
      name: pct[1].trim(),
      percent,
      ...(salt && salt !== 'base' ? { saltEquivalent: salt } : {}),
    };
  }
  return null;
}

export async function scrapePsychoactifDetails(url: string): Promise<ScrapedResultDetails | null> {
  const res = await httpGetText(url);
  if (!res.ok) throw new Error(`Psychoactif a répondu HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(res.text, 'text/html');
  const postmsg = doc.querySelector('.postmsg');
  if (!postmsg) throw new Error("Page de résultat Psychoactif illisible (bloc du résultat introuvable)");

  const htmlContent = postmsg.innerHTML;
  const collectDateMatch = htmlContent.match(/Date de collecte\s*:\s*([^<]+)/i);
  const expectedProductMatch = htmlContent.match(/Produit attendu\s*:\s*(?:<b>)?([^<]+)(?:<\/b>)?/i);
  const percentageMatch = htmlContent.match(/Pourcentage[^:]*:\s*(?:<b>)?([^<]+)(?:<\/b>)?/i);
  const aspectMatch = htmlContent.match(/Aspect\s*:\s*([^<]+)/i);
  const supplyModeMatch = htmlContent.match(/Mode d'approvisionnement\s*:\s*([^<]+)/i);
  const processedByMatch = postmsg.textContent?.match(/Cette analyse a été traitée par\s+([^\n]+)/i);

  const commentsDiv = postmsg.querySelector('div[style*="margin-left:30px"]');
  let comments = '';
  if (commentsDiv) {
    const clone = commentsDiv.cloneNode(true) as HTMLElement;
    // textContent ignore les <br> : on les transforme en retours à la ligne pour garder une molécule par ligne
    clone.innerHTML = clone.innerHTML
      .replace(/Nos résultats sont rendus avec une incertitude de \+\/-10%;/gi, '')
      .replace(/<br\s*\/?>/gi, '\n');
    const iTags = clone.querySelectorAll('i');
    if (iTags.length > 0) {
      comments = Array.from(iTags).map((i) => i.textContent?.trim()).join('\n');
    } else {
      comments = clone.textContent?.replace('Produits de coupe et commentaires :', '').trim() || '';
    }
  }

  const compounds = comments
    .split(/\n+/)
    .map(parseCompoundLine)
    .filter((c): c is CompoundLine => c !== null);

  const percentage = percentageMatch ? percentageMatch[1].trim() : '';

  return {
    type: 'psychoactif',
    collectDate: collectDateMatch ? collectDateMatch[1].trim() : '',
    expectedProduct: expectedProductMatch ? expectedProductMatch[1].trim() : '',
    percentage,
    basePercent: percentage ? parseNumber(percentage) : undefined,
    compounds,
    aspect: aspectMatch ? aspectMatch[1].trim() : '',
    supplyMode: supplyModeMatch ? supplyModeMatch[1].trim() : '',
    processedBy: processedByMatch ? processedByMatch[1].split(/\s{2,}/)[0].trim() : '',
    comments: comments.trim(),
  };
}
