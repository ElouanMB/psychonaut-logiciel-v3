import React from "react";
import { Eye, EyeOff, Send } from "lucide-react";
import { Tab } from "./EditorArea";

interface EditorHeaderProps {
  activeTab: Tab;
  onUpdateTitle: (id: string, newTitle: string) => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  onPublish: (tab: Tab) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  activeTab,
  onUpdateTitle,
  showPreview,
  setShowPreview,
  onPublish,
}) => {
  return (
    <div className="px-6 py-4 border-b border-border-main bg-editor-bg flex items-center justify-between gap-4 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <input
          type="text"
          value={activeTab.title}
          onChange={(e) => onUpdateTitle(activeTab.id, e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-base font-semibold text-fg-main outline-none placeholder:text-fg-muted truncate"
          placeholder="Titre du document…"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          title={showPreview ? "Retour à l'éditeur" : "Aperçu BBCode"}
          className={`h-8 w-8 flex items-center justify-center rounded-md border transition-colors
            ${
              showPreview
                ? "bg-active border-border-accent text-fg-main"
                : "border-border-main text-fg-secondary hover:text-fg-main hover:bg-hover"
            }`}
        >
          {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => onPublish(activeTab)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover active:bg-accent-active text-white px-4.5 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm shadow-accent/25"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Publier</span>
        </button>
      </div>
    </div>
  );
};
