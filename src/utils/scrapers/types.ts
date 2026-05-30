export interface EnrichedIdentifier {
  raw: string;
  canonical: string;
  psychoUrl?: string;
  psychoFound?: boolean;
  druglabUrl?: string;
  druglabFound?: boolean;
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

export interface ScrapedResultDetails {
  type: 'psychoactif' | 'druglab';
  collectDate?: string;
  expectedProduct?: string;
  percentage?: string;
  aspect?: string;
  supplyMode?: string;
  comments?: string;
  analysisDate?: string;
  method?: string;
  location?: string;
  substances?: string[];
  risks?: string[];
}
