import type React from "react";
import { useState, useMemo } from "react";
import { ClipboardList, CheckCircle2, Clock, Globe, ExternalLink, CheckSquare, Square, PenLine, Loader2 } from "lucide-react";
import type { AnalysisResult, ScrapedResultDetails } from "../utils/scraper";
import { scrapePsychoactifDetails, scrapeDruglabDetails } from "../utils/scraper";
import { openUrl } from "@tauri-apps/plugin-opener";

interface ResultsTabProps {
  scrapedResults: AnalysisResult[];
  onCreateRenduFromResult?: (item: AnalysisResult, details: ScrapedResultDetails) => void;
}

const getStatus = (r: AnalysisResult) => {
  return r.identifiers.some(id => id.psychoFound || id.druglabFound) ? "PRÊT" : "EN_ATTENTE";
};

export const ResultsTab: React.FC<ResultsTabProps> = ({ scrapedResults, onCreateRenduFromResult }) => {
  const [hideSintes, setHideSintes] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('results_checked_items');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleCheck = (url: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      localStorage.setItem('results_checked_items', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const sortedResults = useMemo(() => {
    return [...scrapedResults].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [scrapedResults]);

  const filteredResults = useMemo(() => {
    if (!hideSintes) return sortedResults;
    return sortedResults.filter(r => !r.label?.toLowerCase().includes('sintes'));
  }, [sortedResults, hideSintes]);

  const identified = useMemo(() => {
    const list = filteredResults.filter(r => getStatus(r) === "PRÊT");
    return list.sort((a, b) => {
      const aChecked = checkedItems.has(a.url);
      const bChecked = checkedItems.has(b.url);
      return (aChecked ? 1 : 0) - (bChecked ? 1 : 0);
    });
  }, [filteredResults, checkedItems]);

  const pending = filteredResults.filter(r => getStatus(r) === "EN_ATTENTE");

  const openInBrowser = async (url: string) => {
    try {
      const fullUrl = url.startsWith("http") ? url : `https://www.psychonaut.fr${url}`;
      await openUrl(fullUrl);
    } catch (e) {
      console.error("Failed to open link", e);
    }
  };

  const getTagStyle = (label: string | null) => {
    if (!label) return null;
    const l = label.toLowerCase();
    if (l.includes("druglab")) return { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/20", label: "DrugLab" };
    if (l.includes("atpidf")) return { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20", label: "ATPIDF" };
    if (l.includes("checklabs")) return { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20", label: "CheckLabs" };
    if (l.includes("sintes")) return { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20", label: "SINTES" };
    return null;
  };

  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, ScrapedResultDetails | null>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isWritingId, setIsWritingId] = useState<string | null>(null);

  const handleWriteRendu = async (item: AnalysisResult, psychoUrl?: string, druglabUrl?: string) => {
    if (!onCreateRenduFromResult) return;
    setIsWritingId(item.url);
    
    let details = detailsCache[item.url];
    if (!details) {
      try {
        if (psychoUrl) {
          details = await scrapePsychoactifDetails(psychoUrl);
        } else if (druglabUrl) {
          details = await scrapeDruglabDetails(druglabUrl);
        }
        if (details) {
          setDetailsCache(prev => ({ ...prev, [item.url]: details }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    setIsWritingId(null);
    if (details) {
      onCreateRenduFromResult(item, details);
    }
  };

  const toggleExpand = async (itemUrl: string, psychoUrl?: string, druglabUrl?: string) => {
    if (expandedUrl === itemUrl) {
      setExpandedUrl(null);
      return;
    }
    setExpandedUrl(itemUrl);
    if ((!psychoUrl && !druglabUrl) || detailsCache[itemUrl]) return;
    
    setIsLoadingDetails(true);
    try {
      let details: ScrapedResultDetails | null = null;
      if (psychoUrl) {
        details = await scrapePsychoactifDetails(psychoUrl);
      } else if (druglabUrl) {
        details = await scrapeDruglabDetails(druglabUrl);
      }
      setDetailsCache(prev => ({ ...prev, [itemUrl]: details }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const renderRow = (item: AnalysisResult, idx: number, status: "PRÊT" | "EN_ATTENTE") => {
    const isReady = status === "PRÊT";
    const tag = getTagStyle(item.label);
    const isChecked = checkedItems.has(item.url);
    const isExpanded = expandedUrl === item.url;
    
    const firstPsychoUrl = item.identifiers.find(id => id.psychoUrl)?.psychoUrl;
    const firstDruglabUrl = item.identifiers.find(id => id.druglabUrl)?.druglabUrl;
    const hasDetailsUrl = firstPsychoUrl || firstDruglabUrl;

    return (
      <div key={`${item.url}-${idx}`} className={`group flex flex-col p-2.5 border border-border-main/50 rounded-md transition-all duration-200 shadow-sm ${isChecked ? 'bg-chrome-bg/10 opacity-60' : 'bg-chrome-bg/30 hover:bg-chrome-bg'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isReady && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleCheck(item.url); }}
                className={`transition-colors shrink-0 outline-none ${isChecked ? 'text-success' : 'text-fg-muted hover:text-success'}`}
                title={isChecked ? "Marquer comme non traité" : "Marquer comme traité"}
              >
                {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            )}

            {/* Tag (fixed width to align titles) */}
            <div className="w-16 shrink-0 flex justify-center">
              {tag ? (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tag.bg} ${tag.text} ${tag.border} uppercase truncate max-w-full tracking-wider ${isChecked ? 'opacity-70' : ''}`}>
                  {tag.label}
                </span>
              ) : (
                <span className="w-2 h-0.5 bg-border-main/40 rounded-full"></span>
              )}
            </div>

            <button 
              type="button" 
              className={`flex flex-col min-w-0 gap-0.5 flex-1 text-left focus:outline-none ${isReady && hasDetailsUrl ? 'cursor-pointer' : 'cursor-default'}`} 
              onClick={() => isReady && hasDetailsUrl && toggleExpand(item.url, firstPsychoUrl, firstDruglabUrl)}
            >
              <h4 className={`text-[13px] font-semibold text-fg-main truncate transition-colors ${isChecked ? 'line-through text-fg-muted' : (isReady ? 'group-hover:text-success' : 'group-hover:text-yellow-500')}`} title={item.title}>
                {item.title}
              </h4>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-fg-muted/70 whitespace-nowrap">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString("fr-FR", { year: 'numeric', month: 'short', day: 'numeric' }) : "Inconnu"}
                </span>
                {item.identifiers && item.identifiers.length > 0 && (
                  <>
                    <span className="text-border-main/60">•</span>
                    <span className="font-mono text-fg-secondary">
                      {item.identifiers.map(id => id.canonical).join(", ")}
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Actions (always slightly visible, fully visible on hover) */}
          <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ml-3">
            {isReady && onCreateRenduFromResult && hasDetailsUrl && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleWriteRendu(item, firstPsychoUrl, firstDruglabUrl); }}
                disabled={isWritingId === item.url}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-semibold text-white bg-accent/80 hover:bg-accent hover:shadow-sm hover:shadow-accent/20 transition-all focus:outline-none disabled:opacity-50"
                title="Rédiger le rendu"
              >
                {isWritingId === item.url ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                <span className="hidden xl:inline">Rédiger</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openInBrowser(item.url); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-semibold text-fg-secondary hover:text-white hover:bg-fg-muted/20 transition-all focus:outline-none"
              title="Demande"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Demande</span>
            </button>
            
            {item.identifiers.map((id, index) => {
              const resultUrl = (id.druglabFound && id.druglabUrl) ? id.druglabUrl :
                                (id.psychoFound && id.psychoUrl) ? id.psychoUrl :
                                id.druglabUrl || id.psychoUrl;
              if (!resultUrl) return null;

              return (
                <button
                  key={id.canonical}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openInBrowser(resultUrl); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-semibold text-white transition-all focus:outline-none ${isReady ? 'bg-success/80 hover:bg-success hover:shadow-sm hover:shadow-success/20' : 'bg-accent/80 hover:bg-accent hover:shadow-sm hover:shadow-accent/20'}`}
                  title={`Résultat ${id.canonical}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">
                    Résultat {item.identifiers.length > 1 ? index + 1 : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Expanded details */}
        {isExpanded && hasDetailsUrl && (
          <div className="mt-3 pt-3 border-t border-border-main/40 pl-[84px] text-xs">
            {isLoadingDetails && !detailsCache[item.url] ? (
              <div className="text-fg-muted animate-pulse">Chargement des détails...</div>
            ) : detailsCache[item.url] ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-fg-main bg-chrome-bg/40 p-3 rounded border border-border-main/30 shadow-inner">
                {detailsCache[item.url]!.collectDate && (
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Date de collecte</span><span>{detailsCache[item.url]!.collectDate}</span></div>
                )}
                
                {/* Psychoactif Specific */}
                {detailsCache[item.url]!.type === 'psychoactif' && (
                  <>
                    {detailsCache[item.url]!.expectedProduct && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Produit attendu</span><span className="font-semibold">{detailsCache[item.url]!.expectedProduct}</span></div>
                    )}
                    {detailsCache[item.url]!.percentage && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Pourcentage</span><span className="font-mono text-accent">{detailsCache[item.url]!.percentage}</span></div>
                    )}
                    {detailsCache[item.url]!.supplyMode && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Mode d'approvisionnement</span><span>{detailsCache[item.url]!.supplyMode}</span></div>
                    )}
                  </>
                )}

                {/* DrugLab Specific */}
                {detailsCache[item.url]!.type === 'druglab' && (
                  <>
                    {detailsCache[item.url]!.analysisDate && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Date d'analyse</span><span>{detailsCache[item.url]!.analysisDate}</span></div>
                    )}
                    {detailsCache[item.url]!.method && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Méthode</span><span>{detailsCache[item.url]!.method}</span></div>
                    )}
                    {detailsCache[item.url]!.location && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Lieu de collecte</span><span>{detailsCache[item.url]!.location}</span></div>
                    )}
                    {detailsCache[item.url]!.expectedProduct && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Acheté comme</span><span className="font-semibold">{detailsCache[item.url]!.expectedProduct}</span></div>
                    )}
                    {detailsCache[item.url]!.substances && detailsCache[item.url]!.substances!.length > 0 && (
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">Substances détectées</span><span className="font-mono text-accent">{detailsCache[item.url]!.substances!.join(', ')}</span></div>
                    )}
                  </>
                )}

                {/* Shared Aspect */}
                {detailsCache[item.url]!.aspect && (
                  <div className="flex flex-col"><span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-0.5">{detailsCache[item.url]!.type === 'druglab' ? 'Galénique' : 'Aspect'}</span><span>{detailsCache[item.url]!.aspect}</span></div>
                )}

                {/* DrugLab Risks */}
                {detailsCache[item.url]!.risks && detailsCache[item.url]!.risks!.length > 0 && (
                  <div className="col-span-2 flex flex-col mt-1 pt-1 border-t border-border-main/20">
                    <span className="text-[10px] uppercase text-red-500 font-bold tracking-wider mb-1">Risques</span>
                    <ul className="list-disc list-inside text-fg-secondary text-xs">
                      {detailsCache[item.url]!.risks!.map((risk, i) => <li key={i}>{risk}</li>)}
                    </ul>
                  </div>
                )}

                {/* Shared Comments */}
                {detailsCache[item.url]!.comments && (
                  <div className="col-span-2 flex flex-col mt-1 pt-1 border-t border-border-main/20">
                    <span className="text-[10px] uppercase text-fg-muted font-bold tracking-wider mb-1">{detailsCache[item.url]!.type === 'psychoactif' ? 'Coupe et commentaires' : 'Commentaires'}</span>
                    <div className="text-fg-secondary italic whitespace-pre-wrap leading-relaxed">{detailsCache[item.url]!.comments}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-yellow-500">Impossible de charger les détails.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-editor-bg overflow-y-hidden p-6 select-none animate-in fade-in duration-300 flex flex-col">
      <div className="w-full mx-auto flex flex-col gap-4 flex-1 min-h-0">
        
        <div className="flex flex-col gap-1 border-b border-border-main/60 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent/10 rounded-md text-accent">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-fg-main tracking-tight">Résultats & Demandes</h2>
            </div>

            <label className="flex items-center gap-2 text-xs text-fg-muted hover:text-fg-main cursor-pointer select-none transition-colors">
              <input 
                type="checkbox" 
                checked={hideSintes} 
                onChange={(e) => setHideSintes(e.target.checked)}
                className="rounded border-border-main bg-chrome-bg text-accent focus:ring-accent/50"
              />
              Masquer SINTES
            </label>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Identified Section (Moved to the left) */}
          <section className="flex flex-col gap-3 min-h-0 bg-chrome-bg/10 rounded-lg p-3 border border-border-main/30">
            <div className="flex items-center justify-between shrink-0 px-1">
              <h3 className="text-xs font-bold text-fg-main uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> 
                Identifiés / Prêts
                <span className="bg-success/10 text-success py-0.5 px-1.5 rounded text-[10px]">
                  {identified.length}
                </span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {identified.length === 0 ? (
                <div className="p-6 border border-dashed border-border-main rounded-lg flex flex-col items-center justify-center text-center gap-2 bg-chrome-bg/30 h-full">
                  <CheckCircle2 className="w-6 h-6 text-fg-muted/30" />
                  <p className="text-xs text-fg-muted">Aucun résultat prêt à être publié.</p>
                </div>
              ) : (
                identified.map((item, idx) => renderRow(item, idx, "PRÊT"))
              )}
            </div>
          </section>

          {/* Pending Section (Moved to the right) */}
          <section className="flex flex-col gap-3 min-h-0 bg-chrome-bg/10 rounded-lg p-3 border border-border-main/30">
            <div className="flex items-center justify-between shrink-0 px-1">
              <h3 className="text-xs font-bold text-fg-main uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-yellow-500" /> 
                En attente
                <span className="bg-yellow-500/10 text-yellow-500 py-0.5 px-1.5 rounded text-[10px]">
                  {pending.length}
                </span>
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {pending.length === 0 ? (
                <div className="p-6 border border-dashed border-border-main rounded-lg flex flex-col items-center justify-center text-center gap-2 bg-chrome-bg/30 h-full">
                  <Clock className="w-6 h-6 text-fg-muted/30" />
                  <p className="text-xs text-fg-muted">Aucun résultat en attente pour le moment.</p>
                </div>
              ) : (
                pending.map((item, idx) => renderRow(item, idx, "EN_ATTENTE"))
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};

