import { fetch } from '@tauri-apps/plugin-http';
import type { ScrapedResultDetails } from './types';

export async function scrapeDruglabDetails(url: string): Promise<ScrapedResultDetails | null> {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const buyAs = doc.querySelector('.buy-as .name');
    const expectedProduct = buyAs ? buyAs.textContent?.replace('Acheté comme', '').trim() : '';

    const substancesNodes = doc.querySelectorAll('.substance');
    const substances: string[] = [];
    substancesNodes.forEach(node => {
      const name = node.childNodes[0]?.textContent?.trim() || node.textContent?.trim() || '';
      if (name && !substances.includes(name)) substances.push(name);
    });

    const infoCol = Array.from(doc.querySelectorAll('.columns .column.is-narrow')).find(col => col.textContent?.includes('Date de collecte'));
    let collectDate = '';
    let analysisDate = '';
    let method = '';
    let location = '';
    
    if (infoCol) {
      const divs = infoCol.querySelectorAll('div');
      divs.forEach(div => {
        const text = div.textContent || '';
        if (text.includes('Date de collecte')) collectDate = text.replace(/Date de collecte\s*:/, '').trim();
        else if (text.includes('Date d\'analyse')) analysisDate = text.replace(/Date d'analyse\s*:/, '').trim();
        else if (text.includes('Méthode d\'analyse')) method = text.replace(/Méthode d'analyse\s*:/, '').trim();
        else if (text.includes('Lieu de collecte')) location = text.replace(/Lieu de collecte\s*:/, '').trim();
      });
    }

    const risksNodes = doc.querySelectorAll('.risque-liste .texte');
    const risks: string[] = [];
    risksNodes.forEach(node => {
      if (node.textContent) risks.push(node.textContent.trim());
    });

    const dimensionsNodes = doc.querySelectorAll('.dimensions li');
    const aspects: string[] = [];
    dimensionsNodes.forEach(node => {
      const label = node.querySelector('.label')?.textContent?.trim();
      const value = node.querySelector('.value')?.textContent?.trim();
      if (label && value) aspects.push(`${label}: ${value}`);
    });
    const aspect = aspects.join(', ');

    let comments = '';
    const commentSection = Array.from(doc.querySelectorAll('.titre_sub')).find(el => el.textContent?.includes('Commentaire'));
    if (commentSection && commentSection.parentElement) {
      const parent = commentSection.parentElement;
      comments = parent.textContent?.replace(commentSection.textContent || '', '').trim() || '';
    }

    return {
      type: 'druglab',
      expectedProduct: expectedProduct || '',
      substances,
      collectDate,
      analysisDate,
      method,
      location,
      risks,
      aspect,
      comments
    };
  } catch (e) {
    console.error("Failed to scrape DrugLab details", e);
    return null;
  }
}
