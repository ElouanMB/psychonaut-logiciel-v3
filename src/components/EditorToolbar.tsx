import React, { useState } from "react";
import { Bold, Italic, Underline, Link, Quote, Code, List, Calculator } from "lucide-react";

interface EditorToolbarProps {
  onInsertBBCode: (tag: string, endTag?: string) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onInsertBBCode }) => {
  const [uncertaintyBase, setUncertaintyBase] = useState("");
  const [color, setColor] = useState("#B478BD");

  const val = parseFloat(uncertaintyBase);
  const isValid = !Number.isNaN(val);
  const min = isValid ? (val * 0.9).toFixed(1).replace(/\.0$/, '') : "";
  const max = isValid ? (val * 1.1).toFixed(1).replace(/\.0$/, '') : "";

  return (
    <div className="h-8 px-4 border-b border-border-main bg-editor-bg flex items-center gap-0.5 shrink-0 overflow-x-auto no-scrollbar">
      {/* Groupe Texte */}
      <button type="button" onClick={() => onInsertBBCode("B", "B")} title="Gras [B]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onInsertBBCode("I", "I")} title="Italique [I]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onInsertBBCode("U", "U")} title="Souligné [U]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <Underline className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-border-main mx-1.5 shrink-0" />

      {/* Groupe Structure */}
      <button type="button" onClick={() => onInsertBBCode("QUOTE", "QUOTE")} title="Citation [QUOTE]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <Quote className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onInsertBBCode("URL=https://...", "URL")} title="Lien [URL]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <Link className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onInsertBBCode("CODE", "CODE")} title="Code [CODE]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <Code className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onInsertBBCode("LIST", "LIST")} title="Liste [LIST]"
        className="h-6 w-6 flex items-center justify-center rounded text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors shrink-0">
        <List className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-border-main mx-1.5 shrink-0" />

      {/* Sélecteur de Couleur */}
      <div className="flex items-center gap-1 bg-sidebar-bg rounded border border-border-main px-1 h-6 shrink-0" title="Choisir et appliquer une couleur">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer rounded-sm [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-sm"
          title="Choisir la couleur"
        />
        <div className="w-px h-3 bg-border-main mx-0.5 shrink-0" />
        <button
          type="button"
          onClick={() => onInsertBBCode(`COLOR=${color.toUpperCase()}`, "COLOR")}
          className="text-[10px] font-medium text-fg-secondary hover:text-fg-main px-1"
          title="Appliquer la couleur au texte sélectionné"
        >
          Appliquer
        </button>
      </div>

      <div className="w-px h-4 bg-border-main mx-1.5 shrink-0" />

      {/* Calculatrice d'incertitude */}
      <div className="flex items-center gap-1.5 bg-sidebar-bg rounded border border-border-main px-1.5 h-6 shrink-0" title="Calcul d'incertitude à ±10%">
        <Calculator className="w-3 h-3 text-fg-muted" />
        <input
          type="number"
          placeholder="%"
          value={uncertaintyBase}
          onChange={(e) => setUncertaintyBase(e.target.value)}
          className="w-10 bg-transparent text-xs text-center text-fg-main outline-none placeholder:text-fg-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {isValid && (
          <div className="flex items-center gap-1 border-l border-border-main pl-1.5 text-[10px] font-medium text-fg-secondary">
            <span className="text-red-400">{min}</span>
            <span className="text-fg-muted">-</span>
            <span className="text-green-400">{max}</span>
          </div>
        )}
      </div>
    </div>
  );
};
