import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { AgentPanel } from "./components/AgentPanel";
import { SettingsModal } from "./components/SettingsModal";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import {
  initialRendus,
  initialDrafts,
  initialResources,
} from "./data/mockData";
import type {
  RenduItem,
  DraftItem,
} from "./data/mockData";
import {
  dbLoadData,
  dbSaveRendu,
  dbSaveDraft,
  dbDeleteRendu,
  dbDeleteDraft,
  dbPublishToForum,
  extractAnalysisId,
} from "./utils/db";
import { scrapeForum, AnalysisResult, ScrapedResultDetails } from "./utils/scraper";
import { defaultTemplatePsychoactif, defaultTemplateDruglab } from "./utils/templates";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
interface Tab {
  id: string;
  title: string;
  content: string;
  status?: "PRÊT" | "EN_ATTENTE";
  isDirty?: boolean;
  type?: "editor" | "results" | "recueil";
}

interface Toast {
  message: string;
  type: "success" | "info" | "error";
  visible: boolean;
}

export default function App() {
  // Theme Management
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Sidebar Toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [refreshingScan, setRefreshingScan] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Agent Sidebar Toggle
  const [isAgentOpen, setIsAgentOpen] = useState<boolean>(() => {
    return localStorage.getItem("sidebar_agentOpen") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_agentOpen", isAgentOpen.toString());
  }, [isAgentOpen]);
  
  const [scrapedResults, setScrapedResults] = useState<AnalysisResult[]>(() => {
    const saved = localStorage.getItem('scrapedResults');
    return saved ? JSON.parse(saved) : [];
  });

  // Core Lists
  const [rendus, setRendus] = useState<RenduItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [resources] = useState(initialResources);

  // Tabs System
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<Toast>({ message: "", type: "info", visible: false });

  // Scan footer info
  const [lastScanTime, setLastScanTime] = useState(() => {
    const saved = localStorage.getItem('lastScanTime');
    if (saved) {
      const d = new Date(saved);
      return `Le ${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})}`;
    }
    return "Aucune récupération récente";
  });

  // Load data from SQLite database on mount
  useEffect(() => {
    async function load() {
      const data = await dbLoadData();
      if (data.rendus.length === 0 && data.drafts.length === 0) {
        // La base de données est vide, on l'initialise avec les données mockées
        for (const r of initialRendus) {
          await dbSaveRendu(r);
        }
        for (const d of initialDrafts) {
          await dbSaveDraft(d);
        }
        setRendus(initialRendus);
        setDrafts(initialDrafts);
        setTabs([
          {
            id: initialRendus[0].id,
            title: initialRendus[0].title,
            content: initialRendus[0].content,
            status: initialRendus[0].status,
            isDirty: false,
          },
          {
            id: initialRendus[1].id,
            title: initialRendus[1].title,
            content: initialRendus[1].content,
            status: initialRendus[1].status,
            isDirty: false,
          },
        ]);
        setActiveTabId(initialRendus[0].id);
      } else {
        const parseDate = (d: string) => {
          if (!d) return 0;
          if (d.includes("/")) {
            const parts = d.split("/");
            if (parts.length === 3) {
              const [day, month, year] = parts;
              return new Date(`${year}-${month}-${day}`).getTime();
            }
          }
          const t = new Date(d).getTime();
          return isNaN(t) ? 0 : t;
        };

        const sortedRendus = [...data.rendus].sort((a, b) => parseDate(b.date) - parseDate(a.date));
        const sortedDrafts = [...data.drafts].sort((a, b) => parseDate(b.date) - parseDate(a.date));

        setRendus(sortedRendus);
        setDrafts(sortedDrafts);
        if (sortedRendus.length > 0) {
          setTabs([
            {
              id: sortedRendus[0].id,
              title: sortedRendus[0].title,
              content: sortedRendus[0].content,
              status: sortedRendus[0].status,
              isDirty: false,
            },
          ]);
          setActiveTabId(sortedRendus[0].id);
        } else if (sortedDrafts.length > 0) {
          setTabs([
            {
              id: sortedDrafts[0].id,
              title: sortedDrafts[0].title,
              content: sortedDrafts[0].content,
              isDirty: false,
            },
          ]);
          setActiveTabId(sortedDrafts[0].id);
        }
      }
    }
    load();
  }, []);

  const showToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3500);
  }, []);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) {
          if (window.confirm(`Une nouvelle mise à jour (${update.version}) est disponible !\n\nVoulez-vous la télécharger et l'installer maintenant ?\n\nNotes :\n${update.body || 'Corrections de bugs et améliorations.'}`)) {
            showToast("Téléchargement de la mise à jour en cours...", "info");
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (error) {
        console.error("Erreur lors de la vérification des mises à jour :", error);
      }
    }
    
    if (!import.meta.env.DEV) {
      checkForUpdates();
    }
  }, [showToast]);

  const handleRefreshScan = async () => {
    setRefreshingScan(true);
    setScanProgress(0);
    showToast("Scraping en cours (cette opération peut prendre quelques minutes)...", "info");
    
    try {
      const results = await scrapeForum(0, (p) => setScanProgress(p)); // 0 = Parse ALL pages
      
      const openResults = results.filter(t => !t.closed);
      
      setScrapedResults(openResults);
      localStorage.setItem('scrapedResults', JSON.stringify(openResults));

      const now = new Date();
      localStorage.setItem('lastScanTime', now.toISOString());
      setLastScanTime(`Le ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})}`);
      
      showToast(`${openResults.length} demandes trouvées.`, "success");
    } catch (e: any) {
      console.error(e);
      showToast("Erreur lors du scraping : " + e.message, "error");
    } finally {
      setRefreshingScan(false);
    }
  };

  // Tab selections
  const openRenduInTab = (item: RenduItem) => {
    const existing = tabs.find((t) => t.id === item.id);
    if (!existing) {
      setTabs((prev) => [
        ...prev,
        {
          id: item.id,
          title: item.title,
          content: item.content,
          status: item.status,
          isDirty: false,
        },
      ]);
    }
    setActiveTabId(item.id);
  };

  const openDraftInTab = (item: DraftItem) => {
    const existing = tabs.find((t) => t.id === item.id);
    if (!existing) {
      setTabs((prev) => [
        ...prev,
        {
          id: item.id,
          title: item.title,
          content: item.content,
          isDirty: false,
        },
      ]);
    }
    setActiveTabId(item.id);
  };

  // Creation buttons
  const handleCreateRendu = async () => {
    const newId = `PSYCHO-${Math.floor(100000 + Math.random() * 900000)}`;
    const newItem: RenduItem = {
      id: newId,
      title: "Nouveau Rendu",
      date: new Date().toLocaleDateString("fr-FR"),
      status: "EN_ATTENTE",
      substance: "Substance",
      content: "",
      analysisId: newId,
    };
    await dbSaveRendu(newItem);
    setRendus((prev) => [newItem, ...prev]);
    openRenduInTab(newItem);
    showToast("Nouveau rendu créé avec succès.");
  };

  const handleCreateRenduFromResult = async (item: AnalysisResult, details: ScrapedResultDetails) => {
    const newId = `PSYCHO-${Math.floor(100000 + Math.random() * 900000)}`;
    let content = "";
    
    if (details.type === 'psychoactif') {
      let aspectClean = details.aspect || '';
      if (aspectClean.toLowerCase().startsWith('forme: ')) aspectClean = aspectClean.substring(7);
      else if (aspectClean.toLowerCase().startsWith('forme:')) aspectClean = aspectClean.substring(6);

      let tpl = localStorage.getItem('templatePsychoactif') || defaultTemplatePsychoactif;
      tpl = tpl.replace('Produit présumé : [B][/B]', `Produit présumé : [B]${details.expectedProduct || ''}[/B]`);
      tpl = tpl.replace('Forme du produit : ', `Forme du produit : ${aspectClean}`);
      tpl = tpl.replace("Mode d'acquisition : ", `Mode d'acquisition : ${details.supplyMode || ''}`);
      content = tpl;
    } else if (details.type === 'druglab') {
      let aspectClean = details.aspect || '';
      if (aspectClean.toLowerCase().startsWith('forme: ')) aspectClean = aspectClean.substring(7);
      else if (aspectClean.toLowerCase().startsWith('forme:')) aspectClean = aspectClean.substring(6);

      let tpl = localStorage.getItem('templateDruglab') || defaultTemplateDruglab;
      tpl = tpl.replace('Forme du produit : ', `Forme du produit : ${aspectClean}`);
      
      let substancesStr = '';
      if (details.substances && details.substances.length > 0) {
        if (details.substances.length === 1) {
          substancesStr = `[B]${details.substances[0]}[/B]`;
        } else {
          substancesStr = '\n' + details.substances.map(s => `[B]- ${s}[/B]`).join('\n');
        }
      }
      tpl = tpl.replace('Molécule.s trouvée.s : [B][/B]', `Molécule.s trouvée.s : ${substancesStr}`);
      content = tpl;
    }

    const newItem: RenduItem = {
      id: newId,
      title: item.title,
      date: new Date().toLocaleDateString("fr-FR"),
      status: "EN_ATTENTE",
      substance: details.expectedProduct || "Substance",
      content: content,
      analysisId: newId,
    };

    await dbSaveRendu(newItem);
    setRendus((prev) => [newItem, ...prev]);
    openRenduInTab(newItem);
    showToast("Rendu généré à partir de l'analyse.", "success");
  };

  const handleCreateDraft = async () => {
    const newId = `draft-${Date.now()}`;
    const newItem: DraftItem = {
      id: newId,
      title: "Nouveau Brouillon",
      date: new Date().toLocaleDateString("fr-FR"),
      content: "Nouveau brouillon de texte...",
    };
    await dbSaveDraft(newItem);
    setDrafts((prev) => [newItem, ...prev]);
    openDraftInTab(newItem);
    showToast("Nouveau brouillon créé.");
  };

  // Tab updates
  const handleUpdateContent = (id: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, content, isDirty: true } : t))
    );
    // Met à jour la liste locale (sans écrire directement dans SQLite à chaque touche)
    setRendus((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const analysisId = extractAnalysisId(r.title, content);
          return { ...r, content, analysisId };
        }
        return r;
      })
    );
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, content } : d))
    );
  };

  const handleUpdateTitle = (id: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title, isDirty: true } : t))
    );
    // Met à jour la liste locale
    setRendus((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const analysisId = extractAnalysisId(title, r.content);
          return { ...r, title, analysisId };
        }
        return r;
      })
    );
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title } : d))
    );
  };

  const handleSaveActiveTab = useCallback(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.isDirty) return;

    const rendu = rendus.find((r) => r.id === activeTabId);
    if (rendu) {
      dbSaveRendu(rendu);
    } else {
      const draft = drafts.find((d) => d.id === activeTabId);
      if (draft) {
        dbSaveDraft(draft);
      }
    }

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
    );
    showToast("Document sauvegardé.", "success");
  }, [activeTabId, tabs, rendus, drafts, showToast]);



  // Sauvegarde automatique régulière toutes les 15 secondes pour tous les onglets modifiés
  useEffect(() => {
    const interval = setInterval(() => {
      let savedAny = false;
      setTabs((prevTabs) => {
        prevTabs.forEach((tab) => {
          if (tab.isDirty) {
            const rendu = rendus.find((r) => r.id === tab.id);
            if (rendu) {
              dbSaveRendu(rendu);
              savedAny = true;
            } else {
              const draft = drafts.find((d) => d.id === tab.id);
              if (draft) {
                dbSaveDraft(draft);
                savedAny = true;
              }
            }
          }
        });

        if (savedAny) {
          showToast("Sauvegarde automatique effectuée.", "info");
          return prevTabs.map((t) => (t.isDirty ? { ...t, isDirty: false } : t));
        }
        return prevTabs;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [rendus, drafts, showToast]);

  const performCloseTab = useCallback((id: string) => {
    const filtered = tabs.filter((t) => t.id !== id);
    setTabs(filtered);

    // If active tab was closed, switch to another tab if available
    if (activeTabId === id && filtered.length > 0) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  }, [tabs, activeTabId]);

  const handleCloseTab = useCallback((id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab?.isDirty) {
      setPendingCloseTabId(id);
    } else {
      performCloseTab(id);
    }
  }, [tabs, performCloseTab]);

  // Écouteurs Raccourcis clavier (Ctrl+S, Ctrl+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveActiveTab();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveActiveTab, handleCloseTab, activeTabId]);

  const handleConfirmClose = async (action: "save" | "discard" | "cancel") => {
    if (!pendingCloseTabId) return;

    if (action === "cancel") {
      setPendingCloseTabId(null);
      return;
    }

    if (action === "save") {
      const tab = tabs.find((t) => t.id === pendingCloseTabId);
      if (tab) {
        const rendu = rendus.find((r) => r.id === pendingCloseTabId);
        if (rendu) {
          await dbSaveRendu(rendu);
        } else {
          const draft = drafts.find((d) => d.id === pendingCloseTabId);
          if (draft) {
            await dbSaveDraft(draft);
          }
        }
      }
      showToast("Document sauvegardé et fermé.", "success");
    } else if (action === "discard") {
      // Revenir à l'état de la base de données
      const data = await dbLoadData();
      const dbRendu = data.rendus.find((r) => r.id === pendingCloseTabId);
      const dbDraft = data.drafts.find((d) => d.id === pendingCloseTabId);

      if (dbRendu) {
        setRendus((prev) => prev.map((r) => (r.id === pendingCloseTabId ? dbRendu : r)));
      } else if (dbDraft) {
        setDrafts((prev) => prev.map((d) => (d.id === pendingCloseTabId ? dbDraft : d)));
      }
      showToast("Modifications ignorées.", "info");
    }

    performCloseTab(pendingCloseTabId);
    setPendingCloseTabId(null);
  };

  // Publish trigger — ouvre le forum dans le navigateur système
  const handlePublish = async (tab: Tab) => {
    try {
      const url = `https://www.psychonaut.fr/forums/resultats.161/post-thread?title=${encodeURIComponent(tab.title)}&prefix_id=6`;

      // Copier le contenu dans le presse-papiers car nous ne pouvons plus l'injecter 
      // directement dans un navigateur externe via Tauri
      await navigator.clipboard.writeText(tab.content);

      await dbPublishToForum(url);
      showToast("Contenu copié ! Collez-le (Ctrl+V) sur le forum.", "info");

      // Marquer le rendu comme PRÊT
      setRendus((prev) =>
        prev.map((r) => {
          if (r.id === tab.id) {
            const updated = { ...r, status: "PRÊT" as const };
            dbSaveRendu(updated);
            return updated;
          }
          return r;
        })
      );
    } catch (error) {
      console.error("Erreur lors de la publication :", error);
      showToast("Erreur lors de la publication.", "error");
    }
  };

  const handleDeleteRendu = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce rendu d'analyse définitivement ?")) {
      await dbDeleteRendu(id);
      setRendus((prev) => prev.filter((r) => r.id !== id));
      handleCloseTab(id);
      showToast("Rendu supprimé avec succès.", "info");
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce brouillon définitivement ?")) {
      await dbDeleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      handleCloseTab(id);
      showToast("Brouillon supprimé.", "info");
    }
  };

  const [mockUser, setMockUser] = useState(() => {
    const savedName = localStorage.getItem('userDisplayName') || localStorage.getItem('xfUser');
    return {
      name: savedName || "Visiteur",
      status: savedName ? "EN LIGNE" : "HORS LIGNE",
      avatar: localStorage.getItem('userAvatar') || "",
    };
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      const savedName = localStorage.getItem('userDisplayName') || localStorage.getItem('xfUser');
      setMockUser({
        name: savedName || "Visiteur",
        status: savedName ? "EN LIGNE" : "HORS LIGNE",
        avatar: localStorage.getItem('userAvatar') || "",
      });
    };
    window.addEventListener('userProfileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('userProfileUpdated', handleProfileUpdate);
  }, []);

  return (
    <div className="h-screen w-screen bg-editor-bg text-fg-main flex flex-col font-sans overflow-hidden">
      {/* 1. HEADER */}
      <Header
        theme={theme}
        toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        openSettings={() => setIsSettingsOpen(true)}
        openResultsTab={() => {
          const id = "results-tab";
          const existing = tabs.find(t => t.id === id);
          if (!existing) {
            setTabs(prev => [...prev, { id, title: "Résultats & Demandes", content: "", type: "results" }]);
          }
          setActiveTabId(id);
        }}
        openRecueilTab={() => {
          const id = "recueil-tab";
          const existing = tabs.find(t => t.id === id);
          if (!existing) {
            setTabs(prev => [...prev, { id, title: "Recueil de ressources", content: "", type: "recueil" }]);
          }
          setActiveTabId(id);
        }}
        user={mockUser}
        isAgentOpen={isAgentOpen}
        toggleAgent={() => setIsAgentOpen(!isAgentOpen)}
      />

      {/* 2. BODY WORKSPACE */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Sidebar */}
        <Sidebar
          rendus={rendus}
          drafts={drafts}
          resources={resources}
          activeDocId={activeTabId}
          onSelectRendu={openRenduInTab}
          onSelectDraft={openDraftInTab}
          onCreateRendu={handleCreateRendu}
          onCreateDraft={handleCreateDraft}
          onDeleteRendu={handleDeleteRendu}
          onDeleteDraft={handleDeleteDraft}
        />

        {/* Center Editor */}
        <EditorArea
          tabs={tabs}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          onCloseTab={handleCloseTab}
          onUpdateContent={handleUpdateContent}
          onUpdateTitle={handleUpdateTitle}
          onPublish={handlePublish}
          theme={theme}
          scrapedResults={scrapedResults}
          onCreateRenduFromResult={handleCreateRenduFromResult}
        />

        {/* Right AI Sidebar */}
        {isAgentOpen && (
          <AgentPanel
            rendus={rendus}
            scrapedResults={scrapedResults}
          />
        )}
      </div>

      {/* 3. FOOTER */}
      <footer className="h-6 bg-chrome-bg border-t border-border-main flex items-center px-5 select-none shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-[10px] text-fg-muted">Dernière récupération : {lastScanTime}</span>
        </div>
        <button
          type="button"
          onClick={handleRefreshScan}
          disabled={refreshingScan}
          title="Vérifier toutes les pages du forum et écraser la dernière sauvegarde"
          className="flex items-center gap-1.5 text-[10px] text-fg-muted hover:text-accent disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshingScan ? "animate-spin text-accent" : ""}`} />
          <span>Actualiser</span>
        </button>
        {refreshingScan && (
          <div className="w-24 h-1.5 bg-border-main rounded-full overflow-hidden relative ml-2 shadow-inner">
            <div 
              className="absolute inset-y-0 left-0 bg-accent transition-all duration-300 ease-out" 
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        )}
        <div className="flex-1" />
      </footer>

      {/* 4. SETTINGS MODAL */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* 5. UNSAVED CHANGES CONFIRMATION DIALOG */}
      {pendingCloseTabId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-chrome-bg border border-border-main rounded-xl max-w-md w-full mx-4 overflow-hidden shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left">
            <div>
              <h3 className="text-sm font-semibold text-fg-main">Enregistrer les modifications ?</h3>
              <p className="text-xs text-fg-muted mt-2">
                Le document "{tabs.find(t => t.id === pendingCloseTabId)?.title}" contient des modifications non enregistrées. Voulez-vous les enregistrer avant de le fermer ?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleConfirmClose("cancel")}
                className="px-4 py-2 border border-border-main rounded-md text-xs font-semibold text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose("discard")}
                className="px-4 py-2 border border-red-500/20 bg-red-500/10 text-red-500 rounded-md text-xs font-semibold hover:bg-red-500/20 transition-colors"
              >
                Ne pas enregistrer
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose("save")}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-xs font-semibold transition-colors shadow-sm shadow-accent/25"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TOAST NOTIFICATION */}
      {toast.visible && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-chrome-bg border border-border-main/60 text-fg-main text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
