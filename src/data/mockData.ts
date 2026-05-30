export interface RenduItem {
  id: string;
  title: string;
  date: string;
  status: 'PRÊT' | 'EN_ATTENTE';
  substance: string;
  content: string;
  analysisId?: string | null;
}

export interface DraftItem {
  id: string;
  title: string;
  date: string;
  content: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  tag: string;
  url: string;
}

export const initialRendus: RenduItem[] = [
  {
    id: "PSYCHO266372",
    title: "PSYCHO266372 Crystal blanc vendu comme 3-MMC",
    date: "06/02/2026",
    status: "PRÊT",
    substance: "3-MMC",
    content: `[QUOTE][B]Rapport d'analyse - Psychonaut[/B]
[B]ID de la demande :[/B] PSYCHO266372
[B]Description de l'échantillon :[/B] Crystal blanc/translucide
[B]Substance déclarée :[/B] 3-MMC (3-Methylmethcathinone)[/QUOTE]

[B]Résultats obtenus par chromatographie (SINTES/DrugLab) :[/B]
[COLOR=#B478BD]• Molécule principale identifiée :[/COLOR] [B]3-MMC[/B] (pureté estimée à 85%)
[COLOR=#B478BD]• Produits de coupe / Impuretés :[/COLOR] Traces de synthèses, pas d'autres molécules actives détectées.

[QUOTE]La 3-MMC est une cathinone de synthèse stimulante et empathogène.
Rappel RDR (Réduction des Risques) : 
- Espacez vos prises de minimum 3 à 6 semaines.
- Attention à l'effet de compulsion (craving).
- Hydratez-vous régulièrement (eau/sels minéraux).[/QUOTE]`,
    analysisId: "PSYCHO266372"
  },
  {
    id: "2026-1687",
    title: "2026-1687 Poudre brune vendue comme Héroïne",
    date: "05/02/2026",
    status: "PRÊT",
    substance: "Héroïne",
    content: `[QUOTE][B]Rapport d'analyse - SINTES[/B]
[B]ID de la demande :[/B] 2026-1687
[B]Description de l'échantillon :[/B] Poudre marron clair / brune
[B]Substance déclarée :[/B] Héroïne[/QUOTE]

[B]Analyses de laboratoire :[/B]
[COLOR=#B478BD]• Molécule principale :[/COLOR] [B]Diacétylmorphine[/B] (Héroïne, pureté 22%)
[COLOR=#B478BD]• Produits de coupe identifiés :[/COLOR] [B]Caféine[/B] (45%), [B]Paracétamol[/B] (28%).

[QUOTE]Présence classique du mélange Caféine/Paracétamol utilisé pour abaissent le point de fusion lors de la consommation par inhalation (chasse au dragon).
[B]Attention :[/B] Risque élevé de surdosage en cas de mélange avec d'autres dépresseurs (alcool, benzodiazépines). Ayez toujours de la Naloxone à disposition.[/QUOTE]`,
    analysisId: "2026-1687"
  },
  {
    id: "PSYCHO266110",
    title: "PSYCHO266110 Buvard illustré vendu comme LSD-25",
    date: "04/02/2026",
    status: "EN_ATTENTE",
    substance: "LSD",
    content: `[QUOTE][B]Demande d'analyse en attente[/B]
[B]ID de la demande :[/B] PSYCHO266110
[B]Description de l'échantillon :[/B] Buvard avec illustration "Hoffman bicycle"
[B]Substance déclarée :[/B] LSD-25[/QUOTE]

[COLOR=#E11D48][B]Statut actuel :[/B] En attente de confirmation du laboratoire de cross-checking.[/COLOR]
Les résultats devraient être publiés dans les prochains jours. L'échantillon a été envoyé au laboratoire SINTES pour analyse quantitative et qualitative.`,
    analysisId: "PSYCHO266110"
  }
];


export const initialDrafts: DraftItem[] = [
  {
    id: "draft-1",
    title: "Brouillon 1 - Synthèse 3-MMC",
    date: "06/02/2026",
    content: "Voici les premiers éléments à intégrer dans le post du forum pour la 3-MMC..."
  },
  {
    id: "draft-2",
    title: "Brouillon 2 - Template standard",
    date: "06/02/2026",
    content: "[QUOTE][B]Rendu de l'échantillon :[/B]\n[B]Substance attendue :[/B]\n[B]Résultats :[/B]\n[/QUOTE]"
  },
  {
    id: "draft-3",
    title: "Brouillon 3 - Notes RDR Ketamine",
    date: "06/02/2026",
    content: "Rappels importants pour les consommateurs de Kétamine :\n- Effets sur le système urinaire (cystites à répétition en cas d'abus).\n- Crachat recommandé pour préserver l'estomac."
  }
];

export const initialResources: ResourceItem[] = [];
