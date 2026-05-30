import React from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Settings } from "lucide-react";
import { markdown } from "@codemirror/lang-markdown";
import { parseBBCode } from "../utils/bbcode";
import { EditorTabs } from "./EditorTabs";
import { EditorHeader } from "./EditorHeader";
import { EditorToolbar } from "./EditorToolbar";
import { RecueilTab } from "./RecueilTab";

import { ResultsTab } from "./ResultsTab";
import type { AnalysisResult, ScrapedResultDetails } from "../utils/scraper";
import { defaultTemplatePsychoactif, defaultTemplateDruglab } from "../utils/templates";
import { TemplateSettingsModal } from "./TemplateSettingsModal";

export interface Tab {
  id: string;
  title: string;
  content: string;
  status?: "PRÊT" | "EN_ATTENTE";
  isDirty?: boolean;
  type?: "editor" | "results" | "recueil";
}

interface EditorAreaProps {
  tabs: Tab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  onCloseTab: (id: string) => void;
  onUpdateContent: (id: string, newContent: string) => void;
  onUpdateTitle: (id: string, newTitle: string) => void;
  onPublish: (tab: Tab) => void;
  theme: "light" | "dark";
  scrapedResults?: AnalysisResult[];
  onCreateRenduFromResult?: (item: AnalysisResult, details: ScrapedResultDetails) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  tabs,
  activeTabId,
  setActiveTabId,
  onCloseTab,
  onUpdateContent,
  onUpdateTitle,
  onPublish,
  theme,
  scrapedResults,
  onCreateRenduFromResult,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [showPreview, setShowPreview] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number } | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const editorRef = React.useRef<ReactCodeMirrorRef>(null);

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const activeTabIdRef = React.useRef(activeTabId);
  React.useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  React.useEffect(() => {
    const handleInsertText = (e: CustomEvent<string>) => {
      const text = e.detail;
      const view = editorRef.current?.view;
      if (view) {
        const { from } = view.state.selection.main;
        view.dispatch({
          changes: { from, insert: text },
          selection: { anchor: from + text.length }
        });
        onUpdateContent(activeTabIdRef.current, view.state.doc.toString());
        view.focus();
      }
    };
    
    window.addEventListener("insertEditorText", handleInsertText as EventListener);
    return () => window.removeEventListener("insertEditorText", handleInsertText as EventListener);
  }, [onUpdateContent]);


  if (!activeTab) {
    return (
      <div className="flex-1 bg-editor-bg flex flex-col items-center justify-center select-none text-fg-muted gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center">
          <span className="text-lg font-bold font-mono leading-none">Ψ</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-fg-secondary">Aucun document ouvert</p>
          <p className="text-xs text-fg-muted mt-1">Sélectionnez un document dans la barre latérale</p>
        </div>
      </div>
    );
  }

  if (activeTab.type === "results") {
    return (
      <div className="flex-1 bg-editor-bg flex flex-col min-w-0 select-none">
        <EditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          onCloseTab={onCloseTab}
        />
        <ResultsTab 
          scrapedResults={scrapedResults || []} 
          onCreateRenduFromResult={onCreateRenduFromResult}
        />
      </div>
    );
  }

  if (activeTab.type === "recueil") {
    return (
      <div className="flex-1 bg-editor-bg flex flex-col min-w-0 select-none">
        <EditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          setActiveTabId={setActiveTabId}
          onCloseTab={onCloseTab}
        />
        <RecueilTab theme={theme} />
      </div>
    );
  }

  const insertBBCode = (tag: string, endTag?: string) => {
    const view = editorRef.current?.view;
    if (view) {
      const { from, to } = view.state.selection.main;
      const selectedText = view.state.sliceDoc(from, to);
      
      let replacement = "";
      let newCursorPos = from;
      
      if (endTag) {
        replacement = `[${tag}]${selectedText}[/${endTag}]`;
        newCursorPos = selectedText ? from + replacement.length : from + tag.length + 2;
      } else {
        replacement = `[${tag}]`;
        newCursorPos = from + replacement.length;
      }
      
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: newCursorPos }
      });
      onUpdateContent(activeTabId, view.state.doc.toString());
      view.focus();
    } else {
      const insertion = endTag ? `[${tag}]sélection[/${endTag}]` : `[${tag}]`;
      onUpdateContent(activeTabId, activeTab.content + insertion);
    }
  };

  const insertTemplate = (templateName: 'psychoactif' | 'druglab') => {
    const template = templateName === 'psychoactif' 
      ? (localStorage.getItem('templatePsychoactif') || defaultTemplatePsychoactif)
      : (localStorage.getItem('templateDruglab') || defaultTemplateDruglab);
      
    const view = editorRef.current?.view;
    if (view) {
      const { from } = view.state.selection.main;
      view.dispatch({
        changes: { from, insert: template },
        selection: { anchor: from + template.length }
      });
      onUpdateContent(activeTabId, view.state.doc.toString());
      view.focus();
    } else {
      onUpdateContent(activeTabId, activeTab.content + template);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const previewHtml = parseBBCode(activeTab.content);

  return (
    <div className="flex-1 bg-editor-bg flex flex-col min-w-0 select-none">
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        onCloseTab={onCloseTab}
      />

      <EditorHeader
        activeTab={activeTab}
        onUpdateTitle={onUpdateTitle}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        onPublish={onPublish}
      />

      <EditorToolbar onInsertBBCode={insertBBCode} />

      {/* ── ZONE D'ÉDITION ── */}
      <div className="flex-1 relative min-h-0" onContextMenu={handleContextMenu}>
        <div className="absolute inset-0 overflow-auto text-left">
          <CodeMirror
            ref={editorRef}
            value={activeTab.content}
            height="100%"
            theme={theme}
            extensions={[markdown()]}
            onChange={(val) => onUpdateContent(activeTabId, val)}
            className="h-full"
          />
        </div>

        {/* Aperçu BBCode */}
        {showPreview && (
          <div className="absolute inset-0 bg-editor-bg border-t border-border-main p-8 overflow-y-auto z-10 animate-in slide-in-from-bottom-4 duration-200">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border-main">
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Aperçu BBCode</span>
                <span className="text-[11px] text-fg-muted">Formaté pour XenForo</span>
              </div>
              <div
                className="text-sm text-fg-main leading-relaxed text-left break-words font-sans space-y-3"
                dangerouslySetInnerHTML={{
                  __html: previewHtml || '<p class="italic text-fg-muted">Aucun contenu à prévisualiser.</p>',
                }}
              />
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div 
            className="fixed z-50 bg-sidebar-bg border border-border-main rounded-md shadow-xl py-1.5 w-56 text-xs text-fg-main animate-in fade-in zoom-in-95 duration-100"
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 80), left: Math.min(contextMenu.x, window.innerWidth - 220) }}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-hover transition-colors flex items-center gap-2 font-medium"
              onClick={(e) => { e.stopPropagation(); insertTemplate('psychoactif'); }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Importer modèle Psychoactif
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-hover transition-colors flex items-center gap-2 font-medium"
              onClick={(e) => { e.stopPropagation(); insertTemplate('druglab'); }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
              Importer modèle Druglab
            </button>
            <div className="h-px bg-border-main my-1" />
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-hover transition-colors flex items-center gap-2 font-medium text-fg-muted hover:text-fg-main"
              onClick={(e) => { 
                e.stopPropagation(); 
                setContextMenu(null);
                setIsTemplateModalOpen(true); 
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              Personnaliser les modèles
            </button>
          </div>
        )}
      </div>

      <TemplateSettingsModal 
        isOpen={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)} 
      />
    </div>
  );
};
