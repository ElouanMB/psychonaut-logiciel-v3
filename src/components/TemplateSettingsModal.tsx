import { useState } from "react";
import { X, FileText, Save } from "lucide-react";
import { defaultTemplatePsychoactif, defaultTemplateDruglab } from "../utils/templates";

interface TemplateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateSettingsModal: React.FC<TemplateSettingsModalProps> = ({ isOpen, onClose }) => {
  const [templatePsychoactif, setTemplatePsychoactif] = useState(() => localStorage.getItem('templatePsychoactif') || defaultTemplatePsychoactif);
  const [templateDruglab, setTemplateDruglab] = useState(() => localStorage.getItem('templateDruglab') || defaultTemplateDruglab);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('templatePsychoactif', templatePsychoactif);
    localStorage.setItem('templateDruglab', templateDruglab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl bg-sidebar-bg border border-border-main rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-border-main flex items-center justify-between bg-chrome-bg shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-bold text-fg-main uppercase tracking-wider">Personnalisation des Modèles de Rendus</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-fg-muted hover:text-fg-main hover:bg-list-hover transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto text-left flex flex-col gap-6">
          <p className="text-sm text-fg-muted">
            Personnalisez ici le contenu des modèles qui seront insérés lorsque vous ferez un clic droit dans l'éditeur.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 h-full min-h-[400px]">
            {/* Psychoactif */}
            <div className="flex flex-col h-full bg-chrome-bg/50 rounded-lg border border-border-main p-4">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <label htmlFor="tpl-psychoactif" className="flex items-center gap-2 text-xs font-bold text-fg-main uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm shadow-red-500/50" />
                  Modèle Psychoactif
                </label>
                <button type="button" onClick={() => setTemplatePsychoactif(defaultTemplatePsychoactif)} className="text-[10px] font-bold text-accent hover:underline px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 transition-colors">Réinitialiser par défaut</button>
              </div>
              <textarea
                id="tpl-psychoactif"
                value={templatePsychoactif}
                onChange={(e) => setTemplatePsychoactif(e.target.value)}
                className="w-full flex-1 bg-input-bg border border-input-border text-fg-main text-xs p-4 rounded-md outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all font-mono resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Druglab */}
            <div className="flex flex-col h-full bg-chrome-bg/50 rounded-lg border border-border-main p-4">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <label htmlFor="tpl-druglab" className="flex items-center gap-2 text-xs font-bold text-fg-main uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block shadow-sm shadow-yellow-500/50" />
                  Modèle Druglab
                </label>
                <button type="button" onClick={() => setTemplateDruglab(defaultTemplateDruglab)} className="text-[10px] font-bold text-accent hover:underline px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 transition-colors">Réinitialiser par défaut</button>
              </div>
              <textarea
                id="tpl-druglab"
                value={templateDruglab}
                onChange={(e) => setTemplateDruglab(e.target.value)}
                className="w-full flex-1 bg-input-bg border border-input-border text-fg-main text-xs p-4 rounded-md outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all font-mono resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-main flex items-center justify-end gap-3 bg-chrome-bg shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border-main hover:bg-hover text-fg-secondary hover:text-fg-main text-xs font-bold rounded-md transition-all"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-md shadow-md shadow-accent/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
