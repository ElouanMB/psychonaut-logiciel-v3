export interface EnrichedIdentifier {
  raw: string;
  canonical: string;
  psychoUrl?: string;
  psychoFound?: boolean;
  druglabUrl?: string;
  druglabFound?: boolean;
  /** Erreur réseau / HTTP rencontrée lors de la vérification (au lieu d'un simple "non trouvé") */
  checkError?: string;
}

export interface AnalysisResult {
  title: string;
  url: string;
  label: string | null;
  closed: boolean;
  createdAt: string | null;
  identifiers: EnrichedIdentifier[];
  missingIdentifier?: boolean;
}

/** Une molécule détectée, telle que publiée par le laboratoire */
export interface CompoundLine {
  name: string;
  /** Pourcentage publié (sans conversion) */
  percent?: number;
  /** Quantité publiée telle quelle (ex. "150 µg") */
  amount?: string;
  /** Psychoactif : forme saline dans laquelle le pourcentage est exprimé (ex. "chlorhydrate") */
  saltEquivalent?: string;
  /** Présente mais non quantifiée (NQ) */
  notQuantified?: boolean;
}

export interface ScrapedResultDetails {
  type: 'psychoactif' | 'druglab';
  collectDate?: string;
  expectedProduct?: string;
  /** Valeur brute affichée (Psychoactif : c'est un équivalent BASE) */
  percentage?: string;
  /** Psychoactif : « Pourcentage (equivalent base) » converti en nombre */
  basePercent?: number;
  /** Psychoactif : molécules listées dans « Produits de coupe et commentaires » */
  compounds?: CompoundLine[];
  /** DrugLab : produit attendu retrouvé (vide = aucun) */
  expectedFound?: CompoundLine[];
  /** DrugLab : produits non attendus */
  unexpectedFound?: CompoundLine[];
  /** DrugLab : composition en % */
  composition?: CompoundLine[];
  /** Psychoactif : « Cette analyse a été traitée par … » */
  processedBy?: string;
  aspect?: string;
  supplyMode?: string;
  comments?: string;
  analysisDate?: string;
  method?: string;
  location?: string;
  substances?: string[];
  risks?: string[];
}
