import { Sun, Moon, Settings, Library, Minus, Square, X, ClipboardList, Lightbulb } from "lucide-react";

interface HeaderProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  openSettings: () => void;
  openResultsTab: () => void;
  openRecueilTab: () => void;
  user: {
    name: string;
    status: string;
    avatar: string;
  };
  isAgentOpen: boolean;
  toggleAgent: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  openSettings,
  openResultsTab,
  openRecueilTab,
  user,
  isAgentOpen,
  toggleAgent,
}) => {
  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) {
      console.warn("Tauri window control not available:", e);
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.warn("Tauri window control not available:", e);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) {
      console.warn("Tauri window control not available:", e);
    }
  };

  return (
    <header
      data-tauri-drag-region
      className="h-11 bg-chrome-bg border-b border-border-main flex items-center justify-between pl-4 pr-0 shrink-0 select-none cursor-default"
    >
      {/* Left side: Logo + App name */}
      <div className="flex items-center gap-2.5 pointer-events-none select-none">
        <img
          src="/logo.png"
          alt="Psychonaut Logo"
          className="w-5 h-5 object-contain"
        />
        <span className="text-sm font-semibold text-fg-main tracking-tight">Psychonaut</span>
      </div>

      {/* Right side: Actions, profile and window controls */}
      <div className="flex items-center gap-1.5 h-full">
        {/* User buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openResultsTab}
            title="Résultats et Demandes"
            className="h-8 w-8 flex items-center justify-center rounded-md text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors"
          >
            <ClipboardList className="w-4.5 h-4.5" />
          </button>

          <button
            type="button"
            onClick={openRecueilTab}
            title="Recueil de ressources"
            className="h-8 w-8 flex items-center justify-center rounded-md text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors"
          >
            <Library className="w-4.5 h-4.5" />
          </button>

          <button
            type="button"
            onClick={toggleAgent}
            title="Assistant IA"
            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
              isAgentOpen
                ? "text-accent bg-accent/15"
                : "text-fg-secondary hover:text-fg-main hover:bg-hover"
            }`}
          >
            <Lightbulb className="w-4.5 h-4.5" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
            className="h-8 w-8 flex items-center justify-center rounded-md text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>

          <button
            type="button"
            onClick={openSettings}
            title="Paramètres"
            className="h-8 w-8 flex items-center justify-center rounded-md text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border-main mx-1" />

        {/* Profil Connected */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-6 h-6 rounded-full border border-border-main object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-semibold text-[10px] uppercase">
                {user.name.slice(0, 2)}
              </div>
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-[1.5px] border-chrome-bg rounded-full ${user.status === "EN LIGNE" ? "bg-success" : "bg-fg-muted"}`} />
          </div>
          <span className="text-xs font-medium text-fg-main hidden md:block">{user.name}</span>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border-main mx-1.5" />

        {/* Window controls (Minimize, Maximize, Close) */}
        <div className="flex items-center h-full">
          <button
            type="button"
            onClick={handleMinimize}
            title="Réduire"
            className="h-full w-11 flex items-center justify-center text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors duration-150"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            title="Agrandir"
            className="h-full w-11 flex items-center justify-center text-fg-secondary hover:text-fg-main hover:bg-hover transition-colors duration-150"
          >
            <Square className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Fermer"
            className="h-full w-11 flex items-center justify-center text-fg-secondary hover:text-white hover:bg-[#e81123] active:bg-[#f1707a] transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
