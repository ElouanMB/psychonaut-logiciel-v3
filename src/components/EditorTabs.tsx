import React from "react";
import { X } from "lucide-react";
import { Tab } from "./EditorArea";

interface EditorTabsProps {
  tabs: Tab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  tabs,
  activeTabId,
  setActiveTabId,
  onCloseTab,
}) => {
  return (
    <div className="h-10 bg-chrome-bg border-b border-border-main flex items-end overflow-x-auto scrollbar-none shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            role="button"
            tabIndex={0}
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveTabId(tab.id);
              }
            }}
            className={`h-full px-4 flex items-center gap-2 border-r border-border-main text-xs cursor-pointer transition-all shrink-0 outline-none relative
              ${
                isActive
                  ? "bg-editor-bg text-fg-main font-medium"
                  : "text-fg-muted hover:text-fg-secondary hover:bg-hover/50"
              }`}
          >
            {/* Indicateur actif */}
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />
            )}

            <span className="max-w-[160px] truncate">
              {tab.title.length > 28 ? tab.title.slice(0, 28) + "…" : tab.title}
            </span>

            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Non enregistré" />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="p-0.5 rounded text-fg-muted/50 hover:text-fg-main hover:bg-hover transition-all shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
