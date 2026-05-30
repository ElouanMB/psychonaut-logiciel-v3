import { useState } from "react";
import { X, Shield, Check, RefreshCw, XCircle, Database } from "lucide-react";
import { loginToPsychonaut } from "../utils/scraper";
import { recueilApi } from "../utils/recueilApi";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [xfUser, setXfUser] = useState(() => localStorage.getItem('xfUser') || "");
  const [xfPass, setXfPass] = useState(() => localStorage.getItem('xfPass') || "");


  const [recueilApiKey, setRecueilApiKey] = useState(() => localStorage.getItem('recueilApiKey') || "");
  const [recueilApiPassword, setRecueilApiPassword] = useState(() => localStorage.getItem('recueilApiPassword') || "");

  const [testingXf, setTestingXf] = useState(false);
  const [xfStatus, setXfStatus] = useState<"none" | "success" | "error">("none");
  const [xfError, setXfError] = useState("");

  const [testingRecueil, setTestingRecueil] = useState(false);
  const [recueilStatus, setRecueilStatus] = useState<"none" | "success" | "error">("none");
  const [recueilErrorMsg, setRecueilErrorMsg] = useState("");

  if (!isOpen) return null;

  const testXenForo = async () => {
    setTestingXf(true);
    setXfStatus("none");
    setXfError("");
    
    const result = await loginToPsychonaut(xfUser, xfPass);
    setTestingXf(false);
    
    if (result.success) {
      setXfStatus("success");
      // Update local storage explicitly so App.tsx can read it
      localStorage.setItem('xfUser', xfUser);
      localStorage.setItem('xfPass', xfPass);
      localStorage.setItem('userAvatar', result.avatar || "");
      localStorage.setItem('userDisplayName', result.username || "");
      
      // Dispatch event to update App.tsx immediately
      window.dispatchEvent(new Event('userProfileUpdated'));
    } else {
      setXfStatus("error");
      setXfError(result.error || "Erreur inconnue");
    }
  };

  const testRecueil = async () => {
    setTestingRecueil(true);
    setRecueilStatus("none");
    setRecueilErrorMsg("");
    
    const oldKey = localStorage.getItem('recueilApiKey');
    const oldPass = localStorage.getItem('recueilApiPassword');
    
    localStorage.setItem('recueilApiKey', recueilApiKey);
    localStorage.setItem('recueilApiPassword', recueilApiPassword);
    
    try {
      await recueilApi.getResources();
      setRecueilStatus("success");
    } catch (err: any) {
      setRecueilStatus("error");
      setRecueilErrorMsg(err.message || "Erreur de connexion");
      
      if (oldKey !== null) localStorage.setItem('recueilApiKey', oldKey);
      if (oldPass !== null) localStorage.setItem('recueilApiPassword', oldPass);
    } finally {
      setTestingRecueil(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem('xfUser', xfUser);
    localStorage.setItem('xfPass', xfPass);
    localStorage.setItem('recueilApiKey', recueilApiKey);
    localStorage.setItem('recueilApiPassword', recueilApiPassword);
    window.dispatchEvent(new CustomEvent('recueilUpdated'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-sidebar-bg border border-border-main rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border-main flex items-center justify-between bg-chrome-bg">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <h2 className="text-xs font-bold text-fg-main uppercase tracking-wider">Paramètres de connexion</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-fg-muted hover:text-fg-main hover:bg-list-hover transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-left overflow-y-auto">
          {/* XenForo Section */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-accent uppercase tracking-wide flex items-center gap-1.5">
              <span>👤</span> Forum XenForo (Psychonaut)
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="xf-user" className="block text-[10px] font-semibold text-fg-muted mb-1">Identifiant</label>
                <input
                  id="xf-user"
                  type="text"
                  value={xfUser}
                  onChange={(e) => setXfUser(e.target.value)}
                  className="w-full bg-input-bg border border-input-border text-fg-main text-xs px-3 py-1.5 rounded outline-none focus:border-border-accent transition-all font-medium"
                />
              </div>
              <div>
                <label htmlFor="xf-pass" className="block text-[10px] font-semibold text-fg-muted mb-1">Mot de passe</label>
                <input
                  id="xf-pass"
                  type="password"
                  value={xfPass}
                  onChange={(e) => setXfPass(e.target.value)}
                  className="w-full bg-input-bg border border-input-border text-fg-main text-xs px-3 py-1.5 rounded outline-none focus:border-border-accent transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={testXenForo}
              disabled={testingXf}
              className="w-full py-1.5 rounded text-xs font-medium border border-border-main text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors flex items-center justify-center gap-2"
            >
              {testingXf ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : xfStatus === "success" ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : xfStatus === "error" ? (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              ) : null}
              <span>{testingXf ? "Connexion..." : xfStatus === "success" ? "Connecté avec succès" : xfStatus === "error" ? `Erreur: ${xfError}` : "Tester la connexion au forum"}</span>
            </button>
          </div>

          <div className="h-px bg-border-main my-2" />

          {/* Database Connection Section */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-accent uppercase tracking-wide flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Connexion Base de Donnée (Recueil)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="recueil-key" className="block text-[10px] font-semibold text-fg-muted mb-1">Clé API</label>
                <input
                  id="recueil-key"
                  type="text"
                  value={recueilApiKey}
                  onChange={(e) => setRecueilApiKey(e.target.value)}
                  className="w-full bg-input-bg border border-input-border text-fg-main text-xs px-3 py-1.5 rounded outline-none focus:border-border-accent transition-all font-medium font-mono"
                />
              </div>
              <div>
                <label htmlFor="recueil-pass" className="block text-[10px] font-semibold text-fg-muted mb-1">Mot de passe</label>
                <input
                  id="recueil-pass"
                  type="password"
                  value={recueilApiPassword}
                  onChange={(e) => setRecueilApiPassword(e.target.value)}
                  className="w-full bg-input-bg border border-input-border text-fg-main text-xs px-3 py-1.5 rounded outline-none focus:border-border-accent transition-all font-medium font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={testRecueil}
              disabled={testingRecueil}
              className="w-full py-1.5 rounded text-xs font-medium border border-border-main text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors flex items-center justify-center gap-2"
            >
              {testingRecueil ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : recueilStatus === "success" ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : recueilStatus === "error" ? (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              ) : null}
              <span>{testingRecueil ? "Connexion..." : recueilStatus === "success" ? "Connecté avec succès" : recueilStatus === "error" ? `Erreur: ${recueilErrorMsg}` : "Tester la connexion à la base"}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-main flex items-center justify-end gap-2 bg-chrome-bg">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded shadow-md shadow-accent/15 transition-all"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
