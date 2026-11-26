import { httpGetText } from './http';
import type { CompoundLine, ScrapedResultDetails } from './types';

const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();

/** Bloc « Produit attendu » / « Produit(s) non attendu(s) » : une ligne nom + quantité par molécule */
function readProductBlock(doc: Document, title: RegExp): CompoundLine[] {
  const heading = Array.from(doc.querySelectorAll('h3.titre_sub')).find((h) => title.test(clean(h.textContent)));
  const block = heading?.parentElement;
  if (!block) return [];
  return Array.from(block.querySelectorAll('.columns'))
    .map((row) => {
      const name = clean(row.querySelector('.column:not(.is-narrow)')?.textContent);
      const amount = clean(row.querySelector('.column.is-narrow')?.textContent);
      return name ? { name, ...(amount ? { amount } : {}) } : null;
    })
    .filter((c): c is CompoundLine => c !== null);
}

export async function scrapeDruglabDetails(url: string): Promise<ScrapedResultDetails | null> {
  const res = await httpGetText(url);
  if (!res.ok) throw new Error(`DrugLab a répondu HTTP ${res.status}`);
  const doc = new DOMParser().parseFromString(res.text, 'text/html');

  const buyAs = doc.querySelector('.buy-as .name');
  if (!buyAs) throw new Error("Page de résultat DrugLab illisible (bloc « Acheté comme » introuvable)");
  const expectedProduct = clean(buyAs.textContent?.replace('Acheté comme', ''));

  const substances: string[] = [];
  doc.querySelectorAll('.substance').forEach((node) => {
    const name = node.childNodes[0]?.textContent?.trim() || node.textContent?.trim() || '';
    if (name && !substances.includes(name)) substances.push(name);
  });

  const infoCol = Array.from(doc.querySelectorAll('.columns .column.is-narrow')).find((col) =>
    col.textContent?.includes('Date de collecte')
  );
  let collectDate = '';
  let analysisDate = '';
  let method = '';
  let location = '';
  if (infoCol) {
    infoCol.querySelectorAll('div').forEach((div) => {
      const text = div.textContent || '';
      if (text.includes('Date de collecte')) collectDate = clean(text.replace(/Date de collecte\s*:/, ''));
      else if (text.includes("Date d'analyse")) analysisDate = clean(text.replace(/Date d'analyse\s*:/, ''));
      else if (text.includes("Méthode d'analyse")) method = clean(text.replace(/Méthode d'analyse\s*:/, ''));
      else if (text.includes('Lieu de collecte')) location = clean(text.replace(/Lieu de collecte\s*:/, ''));
    });
  }

  const expectedFound = readProductBlock(doc, /^Produit attendu$/i);
  const unexpectedFound = readProductBlock(doc, /^Produit\(s\) non attendu\(s\)$/i);

  const composition: CompoundLine[] = [];
  doc.querySelectorAll('ul.legende li').forEach((li) => {
    const qty = clean(li.querySelector('.quantite')?.textContent);
    const name = clean(li.querySelector('.texte_value')?.textContent);
    const pct = Number.parseFloat(qty.replace(',', '.'));
    if (name) composition.push({ name, ...(Number.isFinite(pct) ? { percent: pct } : { amount: qty }) });
  });

  const risks: string[] = [];
  doc.querySelectorAll('.risque-liste .texte').forEach((node) => {
    if (node.textContent) risks.push(node.textContent.trim());
  });

  const aspects: string[] = [];
  doc.querySelectorAll('.dimensions li').forEach((node) => {
    const label = node.querySelector('.label')?.textContent?.trim();
    const value = node.querySelector('.value')?.textContent?.trim();
    if (label && value) aspects.push(`${label}: ${value}`);
  });

  let comments = '';
  const commentSection = Array.from(doc.querySelectorAll('.titre_sub')).find((el) => el.textContent?.includes('Commentaire'));
  if (commentSection?.parentElement) {
    comments = commentSection.parentElement.textContent?.replace(commentSection.textContent || '', '').trim() || '';
  }

  return {
    type: 'druglab',
    expectedProduct,
    substances,
    expectedFound,
    unexpectedFound,
    composition,
    collectDate,
    analysisDate,
    method,
    location,
    risks,
    aspect: aspects.join(', '),
    comments,
  };
}
