import type { CompoundLine, ScrapedResultDetails } from './scrapers/types';
import type { ResourceItem } from './recueilApi';
import type { RenduItem } from '../data/mockData';

// Limites du prompt envoyé à l'IA (au-delà, plus lent et plus coûteux sans améliorer le résultat)
const MAX_EXAMPLES = 5;
const MAX_EXAMPLE_CHARS = 3500;
const MAX_NOTE_CHARS = 2000;
const MAX_RECUEIL_CHARS = 12000;

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n[…]` : text);

/** "3-CMC", "3CMC" et "3 cmc" deviennent "3cmc" ; "Cocaïne" devient "cocaine" */
export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Format français d'un pourcentage : 1 décimale au plus, virgule */
export const fmtPct = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

// ---------------------------------------------------------------------------
// Règles d'écriture
// ---------------------------------------------------------------------------

const WRITING_RULES = `RÈGLES D'ÉCRITURE (pour tout le texte libre du rendu, et pour tes réponses dans la conversation) :
Varie la longueur des phrases, jamais deux constructions identiques à la suite.
Pas de listes à puces sauf si le modèle en contient ou si l'utilisateur le demande explicitement.
Transitions scolaires interdites : « De plus », « Par ailleurs », « Ainsi », « En effet », « Il convient de », « Dans un premier temps », « En conclusion ». Enchaîne les idées par reformulation ou rupture de rythme.
Pas de symétrie entre paragraphes.
Pas de « Bien sûr », « Absolument », « Certainement ».
Les petites imperfections stylistiques sont acceptées si elles sonnent humain.
Tu ne préviens pas, tu ne commentes pas, tu écris.
Interdiction totale des tirets longs (—) et moyens (–). Toute séparation passe par une virgule, un point ou une nouvelle phrase.
Tout en français, aucun mot anglais (« between », etc.).`;

const NUMBER_RULES = `RÈGLES SUR LES CHIFFRES (prioritaires sur tout le reste) :
Tu n'utilises que les chiffres présents dans les FAITS. Tu n'en calcules aucun, tu ne convertis jamais une valeur base en sel ni l'inverse.
Un pourcentage « équivalent base » n'est jamais un pourcentage de sel (chlorhydrate, etc.), et inversement. Ne les intervertis pas.
Les nombres décimaux s'écrivent toujours avec une virgule (85,5%), jamais avec un point.
Quand une LIGNE DE QUANTIFICATION est fournie, recopie-la mot pour mot sous « [I]Quantification[/I] : ».
Les rendus d'exemple servent uniquement pour le style. Ne reprends jamais leurs chiffres, leurs molécules ni leurs conclusions.
Si une information manque, laisse le champ du modèle vide plutôt que d'inventer.`;

// ---------------------------------------------------------------------------
// Quantification (calculée par le code, jamais par l'IA)
// ---------------------------------------------------------------------------

/** Molécules neutres : on n'écrit pas « base » (ex. « 25% de THC ») */
const NEUTRAL_MOLECULES = ['thc', 'cbd', 'cbn', 'hhc', 'lsd', 'psilocybine', 'psilocine'];

/** « de MDMA », « d'héroïne », « de cocaïne » */
function deMolecule(name: string): string {
  const isAcronym = name === name.toUpperCase();
  const label = isAcronym ? name : name.charAt(0).toLowerCase() + name.slice(1);
  const startsWithVowel = /^[aeiouyh]/i.test(normalizeName(label));
  return !isAcronym && startsWithVowel ? `d'${label}` : `de ${label}`;
}

const interval = (value: number) =>
  `(entre ${fmtPct(value * 0.9)}% et ${fmtPct(value * 1.1)}% si l'on tient compte des 10% d'incertitude)`;

export interface Quantification {
  /** Ligne à placer sous « [I]Quantification[/I] : » (BBCode compris) */
  line: string;
  /** Chiffres autorisés dans cette ligne */
  numbers: number[];
}

/**
 * Psychoactif publie le « Pourcentage (equivalent base) » dans un champ, et l'équivalent sel
 * (quand il existe) dans le commentaire. On assemble la phrase à partir des deux, sans conversion.
 */
export function computePsychoactifQuantification(d: ScrapedResultDetails): Quantification | null {
  const base = d.basePercent;
  const compounds = d.compounds ?? [];
  if (base === undefined) return null;

  if (base > 0) {
    const salted = compounds.find((c) => c.saltEquivalent && c.percent !== undefined);
    if (salted?.percent !== undefined && salted.saltEquivalent) {
      const s = salted.percent;
      return {
        line: `[I]${fmtPct(base)}% base, donc ${fmtPct(s)}% ${salted.saltEquivalent} ${interval(s)}.[/I]`,
        numbers: [base, s, s * 0.9, s * 1.1],
      };
    }

    const expected = normalizeName(d.expectedProduct || '');
    const main =
      compounds.find((c) => c.percent !== undefined && Math.abs(c.percent - base) < 0.51) ??
      compounds.find((c) => expected && normalizeName(c.name) === expected);
    const name = main?.name || (d.expectedProduct || '').replace(/\(.*\)/, '').trim();
    const neutral = NEUTRAL_MOLECULES.some((m) => normalizeName(name).includes(m));
    const what = name ? ` ${deMolecule(name)}` : '';
    // Le champ Psychoactif est un équivalent base, même au-delà de 100% (base pure + 10% d'incertitude)
    const form = neutral ? '' : ' base';
    return {
      line: `[I]${fmtPct(base)}%${what}${form} ${interval(base)}.[/I]`,
      numbers: [base, base * 0.9, base * 1.1],
    };
  }

  if (compounds.length > 0 && compounds.every((c) => c.notQuantified)) {
    return { line: 'Non quantifiable', numbers: [] };
  }
  return null;
}

const QUANT_HEADER = /\[I\]\s*Quantification\s*\[\/I\]\s*:?/i;
const LOOKS_LIKE_QUANT = /%|\bNQ\b|quantifi|µg|mg\b/i;

/** Remplace (ou insère) la ligne de quantification dans le rendu. Renvoie null si l'en-tête est introuvable. */
export function enforceQuantification(text: string, q: Quantification): string | null {
  const m = QUANT_HEADER.exec(text);
  if (!m) return null;
  const headerEnd = m.index + m[0].length;
  const lineEnd = text.indexOf('\n', headerEnd);
  const restOfHeader = lineEnd === -1 ? text.slice(headerEnd) : text.slice(headerEnd, lineEnd);
  const before = text.slice(0, headerEnd);

  // L'IA a mis la valeur sur la même ligne que l'en-tête
  if (restOfHeader.trim()) {
    const after = lineEnd === -1 ? '' : text.slice(lineEnd);
    return `${before}\n${q.line}${after}`;
  }
  if (lineEnd === -1) return `${before}\n${q.line}`;

  const nextStart = lineEnd + 1;
  const nextEnd = text.indexOf('\n', nextStart);
  const nextLine = nextEnd === -1 ? text.slice(nextStart) : text.slice(nextStart, nextEnd);
  const isStructural = /^\s*\[(URL|HEADING)/i.test(nextLine);
  if (!isStructural && (LOOKS_LIKE_QUANT.test(nextLine) || /^\s*(\[I\])?\s*(\[\/I\])?\s*$/.test(nextLine))) {
    return `${text.slice(0, nextStart)}${q.line}${nextEnd === -1 ? '' : text.slice(nextEnd)}`;
  }
  return `${text.slice(0, nextStart)}${q.line}\n${text.slice(nextStart)}`;
}

/** Chiffres de la ligne de quantification qui ne figurent pas dans les faits (sert d'alerte, DrugLab surtout) */
export function findUnknownQuantNumbers(text: string, allowed: number[]): string[] {
  const m = QUANT_HEADER.exec(text);
  if (!m) return [];
  const after = text.slice(m.index + m[0].length).split('\n').slice(0, 3).join(' ');
  const quantText = after.split(/\[URL|\[HEADING/i)[0];
  const found = quantText.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return found.filter((raw) => {
    const n = Number.parseFloat(raw.replace(',', '.'));
    if (n === 10) return false; // « 10% d'incertitude »
    return !allowed.some((a) => Math.abs(a - n) < 0.06);
  });
}

// ---------------------------------------------------------------------------
// Faits
// ---------------------------------------------------------------------------

const describeCompound = (c: CompoundLine, saltContext: boolean) => {
  if (c.notQuantified) return `${c.name} : présente mais non quantifiée (NQ)`;
  if (c.percent !== undefined) {
    if (c.saltEquivalent) return `${c.name} : ${fmtPct(c.percent)}% exprimé en équivalent ${c.saltEquivalent} (valeur en SEL)`;
    return `${c.name} : ${fmtPct(c.percent)}%${saltContext ? ' (forme non précisée par le labo)' : ''}`;
  }
  return `${c.name}${c.amount ? ` : ${c.amount}` : ''}`;
};

export interface RenduFacts {
  /** Texte des faits, injecté tel quel dans le prompt */
  text: string;
  quantification: Quantification | null;
  /** Chiffres que l'IA a le droit d'écrire dans la quantification */
  allowedNumbers: number[];
  /** Noms normalisés des produits concernés (pour trier recueil et exemples) */
  keywords: string[];
}

export function buildFacts(d: ScrapedResultDetails, identifier: string): RenduFacts {
  const lines: string[] = [];
  const keywords = new Set<string>();
  const allowed: number[] = [];
  const addKeyword = (name?: string) => {
    for (const part of (name || '').replace(/\(.*?\)/g, '').split('/')) {
      const k = normalizeName(part);
      if (k.length >= 3 && k !== 'inerte') keywords.add(k);
    }
  };
  let quantification: Quantification | null = null;

  if (d.type === 'psychoactif') {
    const expected = (d.expectedProduct || '').replace(/\(Psychowiki\)/i, '').trim();
    addKeyword(expected);
    lines.push(`Source : Psychoactif (analyse à distance), identifiant ${identifier}`);
    if (d.collectDate) lines.push(`Date de collecte : ${d.collectDate}`);
    lines.push(
      `Produit attendu selon la fiche du labo : ${expected || 'non indiqué'} (la fiche peut afficher la molécule trouvée ; le produit annoncé par la personne est dans sa demande)`
    );
    if (d.basePercent !== undefined) {
      lines.push(
        `Pourcentage publié dans le champ « équivalent BASE » : ${fmtPct(d.basePercent)}%${d.basePercent === 0 ? ' (0 = aucune quantification)' : ''}`
      );
      allowed.push(d.basePercent);
    }
    if (d.compounds?.length) {
      lines.push('Molécules listées par le labo :');
      for (const c of d.compounds) {
        lines.push(`  ${describeCompound(c, true)}`);
        addKeyword(c.name);
        if (c.percent !== undefined) allowed.push(c.percent);
      }
    }
    if (d.comments) lines.push(`Commentaire brut du labo : ${d.comments.replace(/\n+/g, ' / ')}`);
    if (d.aspect) lines.push(`Aspect : ${d.aspect}`);
    if (d.supplyMode) lines.push(`Mode d'approvisionnement : ${d.supplyMode}`);
    if (d.processedBy) lines.push(`Analyse traitée par : ${d.processedBy}`);
    quantification = computePsychoactifQuantification(d);
  } else {
    addKeyword(d.expectedProduct);
    lines.push(`Source : DrugLab, identifiant ${identifier}`);
    lines.push(`Acheté comme : ${d.expectedProduct || 'non indiqué'}`);
    const expectedFound = d.expectedFound ?? [];
    lines.push(
      `Produit attendu retrouvé : ${expectedFound.length ? expectedFound.map((c) => describeCompound(c, false)).join(', ') : 'AUCUN (le produit attendu est absent)'}`
    );
    if (d.unexpectedFound?.length) {
      lines.push(`Produit(s) non attendu(s) : ${d.unexpectedFound.map((c) => describeCompound(c, false)).join(', ')}`);
    }
    if (d.composition?.length) {
      lines.push(
        `Composition publiée (DrugLab exprime généralement ses pourcentages en SEL, selon le produit ; ne présente jamais ce chiffre comme une base et ne calcule aucune base) : ${d.composition.map((c) => describeCompound(c, false)).join(', ')}`
      );
    }
    for (const c of [...expectedFound, ...(d.unexpectedFound ?? []), ...(d.composition ?? [])]) {
      addKeyword(c.name);
      if (c.percent !== undefined) allowed.push(c.percent);
      const amount = c.amount?.match(/\d+(?:[.,]\d+)?/);
      if (amount) allowed.push(Number.parseFloat(amount[0].replace(',', '.')));
    }
    if (d.risks?.length) {
      // « Risque de base » = niveau de risque ordinaire chez DrugLab, sans rapport avec la forme base d'une molécule
      const risks = d.risks.map((r) => (/^risque de base$/i.test(r) ? 'risque ordinaire (aucun risque particulier signalé)' : r));
      lines.push(`Risques signalés : ${risks.join(', ')}`);
    }
    if (d.aspect) lines.push(`Galénique : ${d.aspect}`);
    if (d.method) lines.push(`Méthode d'analyse : ${d.method}`);
    if (d.collectDate) lines.push(`Date de collecte : ${d.collectDate}`);
    if (d.analysisDate) lines.push(`Date d'analyse : ${d.analysisDate}`);
    if (d.location) lines.push(`Lieu de collecte : ${d.location}`);
    if (d.comments) lines.push(`Commentaire du labo : ${d.comments.replace(/\s+/g, ' ')}`);
  }

  if (quantification) {
    lines.push(`LIGNE DE QUANTIFICATION (déjà calculée, à recopier telle quelle) : ${quantification.line}`);
    allowed.push(...quantification.numbers);
  }

  return { text: lines.join('\n'), quantification, allowedNumbers: allowed, keywords: [...keywords] };
}

// ---------------------------------------------------------------------------
// Recueil et exemples
// ---------------------------------------------------------------------------

const mentions = (text: string, keywords: string[]) => {
  const n = normalizeName(text);
  return keywords.some((k) => n.includes(k));
};

/** Le recueil entier si il tient dans le budget, sinon en priorité ce qui parle des produits concernés */
export function buildRecueilText(
  folders: { title: string }[],
  folderItems: ResourceItem[][],
  keywords: string[]
): string {
  const entries: { text: string; relevant: boolean }[] = [];
  folders.forEach((folder, i) => {
    const folderRelevant = mentions(folder.title, keywords);
    for (const item of folderItems[i] ?? []) {
      let line = `[${folder.title}] ${item.type === 'note' ? 'Note' : 'Lien'} « ${item.title} »`;
      if (item.url) line += ` : ${item.url}`;
      if (item.content) line += `\n${truncate(item.content, MAX_NOTE_CHARS)}`;
      entries.push({ text: line, relevant: folderRelevant || mentions(`${item.title} ${item.content || ''}`, keywords) });
    }
  });
  const ordered = [...entries.filter((e) => e.relevant), ...entries.filter((e) => !e.relevant)];
  const kept: string[] = [];
  let size = 0;
  for (const e of ordered) {
    if (size + e.text.length > MAX_RECUEIL_CHARS) break;
    kept.push(e.text);
    size += e.text.length;
  }
  return kept.join('\n\n');
}

/** Retire la ligne de quantification des exemples : leurs chiffres ne doivent pas déteindre sur le nouveau rendu */
const stripQuantification = (content: string) =>
  content.replace(/(\[I\]\s*Quantification\s*\[\/I\]\s*:?)[^\n]*\n[^\n]*/i, '$1\n[I](retiré de l\'exemple)[/I]');

export function buildExamplesText(rendus: RenduItem[], keywords: string[]): string {
  const withContent = rendus.filter((r) => r.content?.trim());
  const sameProduct = keywords.length
    ? withContent.filter((r) => mentions(`${r.title} ${r.substance} ${r.content.slice(0, 400)}`, keywords))
    : [];
  const examples = [...new Set([...sameProduct, ...withContent])].slice(0, MAX_EXAMPLES);
  return examples
    .map((r, i) => `--- Exemple ${i + 1} ---\n${truncate(stripQuantification(r.content), MAX_EXAMPLE_CHARS)}`)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export interface GenerationContext {
  analysisTitle: string;
  facts: RenduFacts | null;
  brief: string;
  template: string;
}

const ROLE =
  "Tu rédiges des rendus d'analyse de produits pour le forum de réduction des risques Psychonaut, à la place de l'utilisateur et avec sa voix.";

export function buildGenerationPrompt(ctx: GenerationContext, recueil: string, examples: string): string {
  return `${ROLE}

${NUMBER_RULES}

${WRITING_RULES}

=== FAITS (données du laboratoire, seule source pour les chiffres) ===
Titre du sujet sur le forum : ${ctx.analysisTitle}
${ctx.facts?.text ?? "Aucune donnée de laboratoire n'a pu être récupérée."}

=== DEMANDE INITIALE DE LA PERSONNE SUR LE FORUM ===
${ctx.brief || 'Non récupérée.'}

=== MODÈLE À REMPLIR (garde sa structure et ses balises BBCode : [B], [I], [URL], [HEADING]...) ===
${ctx.template}

=== RECUEIL DE L'UTILISATEUR (liens et notes à réutiliser quand ils concernent le produit, notamment pour la partie Documentations) ===
${recueil || 'Vide.'}

=== EXEMPLES DE RENDUS DE L'UTILISATEUR (style uniquement) ===
${examples || 'Aucun.'}

Réponds uniquement par le rendu complet en BBCode. Pas de bloc de code, pas de phrase avant ou après.`;
}

export interface ChatTurn {
  sender: 'user' | 'agent';
  text: string;
}

export function buildFollowUpPrompt(
  ctx: GenerationContext | null,
  draft: string | null,
  history: ChatTurn[],
  message: string
): string {
  const historyText = history
    .slice(-6)
    .map((m) => `${m.sender === 'user' ? 'Utilisateur' : 'Toi'} : ${truncate(m.text, 1500)}`)
    .join('\n');

  const context = ctx
    ? `=== FAITS (données du laboratoire, seule source pour les chiffres) ===
Titre du sujet sur le forum : ${ctx.analysisTitle}
${ctx.facts?.text ?? "Aucune donnée de laboratoire n'a pu être récupérée."}

=== DEMANDE INITIALE DE LA PERSONNE SUR LE FORUM ===
${ctx.brief || 'Non récupérée.'}

=== MODÈLE ===
${ctx.template}
`
    : '';

  return `${ROLE}

${NUMBER_RULES}

${WRITING_RULES}

${context}
=== RENDU ACTUEL ===
${draft ? `<rendu>\n${draft}\n</rendu>` : 'Aucun rendu pour le moment.'}

=== ÉCHANGES RÉCENTS ===
${historyText || 'Aucun.'}

=== NOUVEAU MESSAGE DE L'UTILISATEUR ===
${message}

Si ce message demande de modifier ou de réécrire le rendu, renvoie le rendu complet modifié entre <rendu> et </rendu>, et rien d'autre. Sinon, réponds en quelques phrases, sans balises <rendu>.`;
}

// ---------------------------------------------------------------------------
// Nettoyage de la réponse
// ---------------------------------------------------------------------------

/** Supprime blocs de code et tirets longs/moyens (règle absolue, appliquée même si l'IA l'oublie) */
export function cleanAiText(text: string): string {
  let t = text.trim();
  t = t.replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  t = t.replace(/(\d)\s*[–—]\s*(\d)/g, '$1 à $2');
  t = t.replace(/^\s*[–—]\s*/gm, '');
  t = t.replace(/\s*[–—]\s*([.,;:!?])/g, '$1');
  t = t.replace(/\s*[–—]+\s*/g, ', ');
  t = t.replace(/,\s*,/g, ',');
  // Virgule décimale devant une unité (85.5% → 85,5%), hors des balises [URL] pour ne pas casser les liens
  t = t
    .split(/(\[URL[^\]]*\])/i)
    .map((part) => (/^\[URL/i.test(part) ? part : part.replace(/(\d)\.(\d+)(?=\s*(?:%|µg|μg|mg|g\b))/g, '$1,$2')))
    .join('');
  return t.trim();
}

/** Sépare un éventuel rendu (<rendu>…</rendu>) du reste de la réponse */
export function extractDraft(text: string): { draft: string | null; rest: string } {
  const m = text.match(/<rendu>\s*([\s\S]*?)\s*<\/rendu>/i);
  if (m) return { draft: m[1].trim(), rest: text.replace(m[0], '').trim() };
  if (QUANT_HEADER.test(text) || /\[HEADING=/i.test(text)) return { draft: text.trim(), rest: '' };
  return { draft: null, rest: text.trim() };
}

/** Post-traitement commun : nettoyage, quantification imposée, alertes */
export function finalizeDraft(raw: string, facts: RenduFacts | null): { text: string; warnings: string[] } {
  let text = cleanAiText(raw);
  const warnings: string[] = [];
  if (facts?.quantification) {
    const fixed = enforceQuantification(text, facts.quantification);
    if (fixed === null) {
      warnings.push(
        `La ligne « Quantification » est introuvable dans le texte généré. Valeur attendue : ${facts.quantification.line}`
      );
    } else {
      text = fixed;
    }
  } else if (facts) {
    const unknown = findUnknownQuantNumbers(text, facts.allowedNumbers);
    if (unknown.length) {
      warnings.push(
        `Chiffres de la quantification absents des données du labo : ${unknown.join(', ')}. À vérifier avant de publier.`
      );
    }
  }
  return { text, warnings };
}
