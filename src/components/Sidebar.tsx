import { useState, useEffect } from "react";
import { Plus, Link as LinkIcon, FileText, Search, ChevronDown, ChevronRight, Trash2, Folder } from "lucide-react";
import type { RenduItem, DraftItem, ResourceItem } from "../data/mockData";
import { recueilApi, Resource, ResourceItem as ApiResourceItem } from '../utils/recueilApi';

interface SidebarProps {
  rendus: RenduItem[];
  drafts: DraftItem[];
  resources: ResourceItem[];
  activeDocId?: string;
  onSelectRendu: (item: RenduItem) => void;
  onSelectDraft: (item: DraftItem) => void;
  onCreateRendu: () => void;
  onCreateDraft: () => void;
  onDeleteRendu: (id: string) => void;
  onDeleteDraft: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rendus,
  drafts,
  resources: _resources,
  activeDocId,
  onSelectRendu,
  onSelectDraft,
  onCreateRendu,
  onCreateDraft,
  onDeleteRendu,
  onDeleteDraft,
}) => {
  const [search, setSearch] = useState("");
  const [rendusOpen, setRendusOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar_rendusOpen");
    return saved !== null ? saved === "true" : true;
  });
  const [draftsOpen, setDraftsOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar_draftsOpen");
    return saved !== null ? saved === "true" : true;
  });
  const [recueilOpen, setRecueilOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar_recueilOpen");
    return saved !== null ? saved === "true" : true;
  });
  
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? parseInt(saved, 10) : 256;
  });

  useEffect(() => {
    localStorage.setItem("sidebarWidth", width.toString());
  }, [width]);

  useEffect(() => {
    localStorage.setItem("sidebar_rendusOpen", rendusOpen.toString());
  }, [rendusOpen]);

  useEffect(() => {
    localStorage.setItem("sidebar_draftsOpen", draftsOpen.toString());
  }, [draftsOpen]);

  useEffect(() => {
    localStorage.setItem("sidebar_recueilOpen", recueilOpen.toString());
  }, [recueilOpen]);

  const [apiResources, setApiResources] = useState<Resource[]>([]);
  const [apiItems, setApiItems] = useState<Record<string, ApiResourceItem[]>>({});
  const [loadingRecueil, setLoadingRecueil] = useState(false);
  const [recueilAuthError, setRecueilAuthError] = useState(false);

  const fetchRecueil = async () => {
    const apiKey = localStorage.getItem('recueilApiKey');
    const apiPassword = localStorage.getItem('recueilApiPassword');
    if (apiKey && apiPassword) {
      try {
        setLoadingRecueil(true);
        setRecueilAuthError(false);
        const res = await recueilApi.getResources();
        setApiResources(res);
        
        const itemsMap: Record<string, ApiResourceItem[]> = {};
        for (const r of res) {
           const items = await recueilApi.getResourceItems(r.id);
           itemsMap[r.id] = items;
        }
        setApiItems(itemsMap);
      } catch (err) {
        setRecueilAuthError(true);
      } finally {
        setLoadingRecueil(false);
      }
    } else {
      setRecueilAuthError(true);
    }
  };

  useEffect(() => {
    if (recueilOpen) {
      fetchRecueil();
    }
  }, [recueilOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      if (recueilOpen) fetchRecueil();
    };
    window.addEventListener('recueilUpdated', handleUpdate);
    return () => window.removeEventListener('recueilUpdated', handleUpdate);
  }, [recueilOpen]);

  const handleInsertRecueilItem = (item: ApiResourceItem) => {
    let textToInsert = '';
    if (item.type === 'note' && item.content) {
      textToInsert = item.content;
    } else if (item.type === 'link' && item.url) {
      const langText = item.lang?.toLowerCase() === 'anglais' ? 'ENG' : 'FR';
      textToInsert = `[URL='${item.url}']${item.title}[/URL] [${langText}]`;
    }
    
    if (textToInsert) {
      window.dispatchEvent(new CustomEvent("insertEditorText", { detail: textToInsert }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(startWidth + moveEvent.pageX - startX, 800));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const q = search.toLowerCase();

  const filteredRendus = rendus.filter(
    (r) => r.title.toLowerCase().includes(q) || r.substance.toLowerCase().includes(q)
  );
  const filteredDrafts = drafts.filter((d) => d.title.toLowerCase().includes(q));

  return (
    <aside 
      style={{ width: `${width}px` }}
      className="h-full bg-sidebar-bg border-r border-border-main flex flex-col select-none shrink-0 relative"
    >
      {/* Resizer Handle */}
      <div 
        className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize z-10 hover:bg-accent/50 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* Barre de recherche globale */}
      <div className="px-4 py-3 border-b border-border-main shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-fg-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-input-bg border border-input-border text-fg-main text-sm pl-8 pr-3 py-2 rounded-md outline-none focus:border-border-accent placeholder:text-fg-muted transition-colors"
          />
        </div>
      </div>

      {/* Conteneur des sections (style VSCode) */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* ── Mes rendus ── */}
        <section className={`flex flex-col ${rendusOpen ? 'flex-1 min-h-0' : 'shrink-0'}`}>
          <div 
            className="flex items-center justify-between px-4 py-2 hover:bg-hover cursor-pointer border-b border-transparent group shrink-0"
            onClick={() => setRendusOpen(!rendusOpen)}
          >
            <div className="flex items-center gap-1">
              {rendusOpen ? <ChevronDown className="w-3.5 h-3.5 text-fg-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />}
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-widest group-hover:text-fg-secondary transition-colors">
                Mes rendus
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateRendu();
              }}
              title="Créer un rendu"
              className="w-6 h-6 flex items-center justify-center rounded text-fg-muted hover:text-fg-main hover:bg-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {rendusOpen && (
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-0.5">
              {filteredRendus.length > 0 ? (
                filteredRendus.map((item) => {
                  const isActive = activeDocId === item.id;
                  const itemClass = isActive
                    ? "bg-active border-l-2 border-accent pl-[calc(0.625rem-2px)]"
                    : "hover:bg-hover";

                  return (
                    <div
                      key={item.id}
                      className={`group relative w-full rounded-md transition-colors flex items-center justify-between ${itemClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectRendu(item)}
                        className="flex-1 text-left px-2.5 py-2 text-sm text-fg-secondary hover:text-fg-main transition-colors flex flex-col gap-0.5 min-w-0"
                      >
                        <span className="truncate leading-snug w-full">{item.title}</span>
                        <span className="text-xs text-fg-muted">{item.date}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRendu(item.id);
                        }}
                        title="Supprimer le rendu"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-fg-muted hover:text-red-500 hover:bg-red-500/10 mr-1.5 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-fg-muted italic py-2 px-2.5">Aucun rendu trouvé</p>
              )}
            </div>
          )}
        </section>

        <div className="border-t border-border-main shrink-0" />

        {/* ── Mes brouillons ── */}
        <section className={`flex flex-col ${draftsOpen ? 'flex-1 min-h-0' : 'shrink-0'}`}>
          <div 
            className="flex items-center justify-between px-4 py-2 hover:bg-hover cursor-pointer border-b border-transparent group shrink-0"
            onClick={() => setDraftsOpen(!draftsOpen)}
          >
            <div className="flex items-center gap-1">
              {draftsOpen ? <ChevronDown className="w-3.5 h-3.5 text-fg-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />}
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-widest group-hover:text-fg-secondary transition-colors">
                Brouillons
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateDraft();
              }}
              title="Créer un brouillon"
              className="w-6 h-6 flex items-center justify-center rounded text-fg-muted hover:text-fg-main hover:bg-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {draftsOpen && (
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-0.5">
              {filteredDrafts.length > 0 ? (
                filteredDrafts.map((item) => {
                  const isActive = activeDocId === item.id;
                  const itemClass = isActive
                    ? "bg-active border-l-2 border-accent pl-[calc(0.625rem-2px)]"
                    : "hover:bg-hover";

                  return (
                    <div
                      key={item.id}
                      className={`group relative w-full rounded-md transition-colors flex items-center justify-between ${itemClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectDraft(item)}
                        className="flex-1 text-left px-2.5 py-2 text-sm text-fg-secondary hover:text-fg-main transition-colors flex flex-col gap-0.5 min-w-0"
                      >
                        <span className="truncate leading-snug w-full">{item.title}</span>
                        <span className="text-xs text-fg-muted">{item.date}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDraft(item.id);
                        }}
                        title="Supprimer le brouillon"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-fg-muted hover:text-red-500 hover:bg-red-500/10 mr-1.5 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-fg-muted italic py-2 px-2.5">Aucun brouillon trouvé</p>
              )}
            </div>
          )}
        </section>

        <div className="border-t border-border-main shrink-0" />

        {/* ─── RECUEIL (anciennement RESSOURCES) ─── */}
        <section className={`flex flex-col ${recueilOpen ? 'flex-1 min-h-0' : 'shrink-0'}`}>
          <div 
            className="flex items-center justify-between px-4 py-2 hover:bg-hover cursor-pointer group shrink-0"
            onClick={() => setRecueilOpen(!recueilOpen)}
          >
            <div className="flex items-center gap-1">
              {recueilOpen ? <ChevronDown className="w-3.5 h-3.5 text-fg-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-fg-muted" />}
              <span className="text-xs font-semibold text-fg-muted uppercase tracking-widest group-hover:text-fg-secondary transition-colors">
                Recueil
              </span>
            </div>
          </div>

          {recueilOpen && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {loadingRecueil && <p className="text-xs text-fg-muted italic py-2 px-2.5">Chargement...</p>}
              {!loadingRecueil && recueilAuthError && (
                <p className="text-xs text-red-500/80 italic py-2 px-2.5">Non connecté au recueil. Utilisez l'onglet principal.</p>
              )}
              {!loadingRecueil && !recueilAuthError && apiResources.map((res) => {
                const items = apiItems[res.id] || [];
                const folderMatches = res.title.toLowerCase().includes(q);
                const filteredItems = items.filter(item => 
                  folderMatches ||
                  item.title.toLowerCase().includes(q) || 
                  (item.content && item.content.toLowerCase().includes(q))
                );

                if (q && !folderMatches && filteredItems.length === 0) return null;

                return (
                  <div key={res.id} className="mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-muted uppercase tracking-widest mb-1 px-1">
                      <Folder className="w-3.5 h-3.5" /> {res.title}
                    </div>
                    <div className="space-y-0.5">
                      {filteredItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleInsertRecueilItem(item)}
                          className="w-full text-left group flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors"
                          title="Cliquer pour insérer"
                        >
                          <div className={`shrink-0 ${item.type === 'note' ? 'text-accent' : 'text-blue-500'}`}>
                            {item.type === 'note' ? <FileText className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                          </div>
                          <span className="truncate flex-1 text-xs">{item.title}</span>
                          <Plus className="w-3 h-3 text-fg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      ))}
                      {items.length === 0 && !q && (
                        <div className="px-2 py-1 text-xs text-fg-muted italic">Vide</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {!loadingRecueil && !recueilAuthError && apiResources.length === 0 && !q && (
                <p className="text-xs text-fg-muted italic py-2 px-2.5">Aucun recueil trouvé</p>
              )}
            </div>
          )}
        </section>

      </div>
    </aside>
  );
};
