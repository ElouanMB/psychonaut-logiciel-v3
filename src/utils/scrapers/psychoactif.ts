import { fetch } from '@tauri-apps/plugin-http';
import type { ScrapedResultDetails } from './types';

export async function scrapePsychoactifDetails(url: string): Promise<ScrapedResultDetails | null> {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const postmsg = doc.querySelector('.postmsg');
    if (!postmsg) return null;

    const htmlContent = postmsg.innerHTML;
    
    const collectDateMatch = htmlContent.match(/Date de collecte\s*:\s*([^<]+)/i);
    const expectedProductMatch = htmlContent.match(/Produit attendu\s*:\s*(?:<b>)?([^<]+)(?:<\/b>)?/i);
    const percentageMatch = htmlContent.match(/Pourcentage[^:]*:\s*(?:<b>)?([^<]+)(?:<\/b>)?/i);
    const aspectMatch = htmlContent.match(/Aspect\s*:\s*([^<]+)/i);
    const supplyModeMatch = htmlContent.match(/Mode d'approvisionnement\s*:\s*([^<]+)/i);
    
    const commentsDiv = postmsg.querySelector('div[style*="margin-left:30px"]');
    let comments = '';
    if (commentsDiv) {
      let clone = commentsDiv.cloneNode(true) as HTMLElement;
      clone.innerHTML = clone.innerHTML.replace(/Nos résultats sont rendus avec une incertitude de \+\/-10%;/gi, '');
      const iTags = clone.querySelectorAll('i');
      if (iTags.length > 0) {
        comments = Array.from(iTags).map(i => i.textContent?.trim()).join('\n');
      } else {
        comments = clone.textContent?.replace('Produits de coupe et commentaires :', '').trim() || '';
      }
    }

    return {
      type: 'psychoactif',
      collectDate: collectDateMatch ? collectDateMatch[1].trim() : '',
      expectedProduct: expectedProductMatch ? expectedProductMatch[1].trim() : '',
      percentage: percentageMatch ? percentageMatch[1].trim() : '',
      aspect: aspectMatch ? aspectMatch[1].trim() : '',
      supplyMode: supplyModeMatch ? supplyModeMatch[1].trim() : '',
      comments: comments.trim()
    };
  } catch (e) {
    console.error("Failed to scrape Psychoactif details", e);
    return null;
  }
}
