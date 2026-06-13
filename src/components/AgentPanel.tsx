import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Bot, User, Trash2, Loader2, ArrowRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { RenduItem } from "../data/mockData";
import { recueilApi } from "../utils/recueilApi";
import type { ResourceItem } from "../utils/recueilApi";
import { defaultTemplatePsychoactif, defaultTemplateDruglab } from "../utils/templates";
import type { AnalysisResult, EnrichedIdentifier, ScrapedResultDetails } from "../utils/scraper";
import { scrapePsychoactifDetails, scrapeDruglabDetails } from "../utils/scraper";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
}

interface AgentPanelProps {
  rendus: RenduItem[];
  scrapedResults: AnalysisResult[];
  onCreateRenduFromAI?: (title: string, content: string) => void;
}

type Step = "select_analysis" | "select_identifier" | "generating" | "idle";

export const AgentPanel: React.FC<AgentPanelProps> = ({ rendus, scrapedResults, onCreateRenduFromAI }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("select_analysis");
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResult | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isLocked, setIsLocked] = useState(() => localStorage.getItem("iaAccessKey") !== "IA-PSYCHO-2026-XQW9");

  useEffect(() => {
    const handleStorageUpdate = () => {
      setIsLocked(localStorage.getItem("iaAccessKey") !== "IA-PSYCHO-2026-XQW9");
    };
    window.addEventListener("recueilUpdated", handleStorageUpdate);
    
    const handleSintesUpdate = () => {
      setHideSintes(localStorage.getItem('results_hide_sintes') === 'true');
    };
    window.addEventListener("hideSintesChanged", handleSintesUpdate);
    
    const handleCheckedItemsUpdate = () => {
      try {
        const saved = localStorage.getItem('results_checked_items');
        setCheckedItems(saved ? new Set(JSON.parse(saved)) : new Set());
      } catch {
        setCheckedItems(new Set());
      }
    };
    window.addEventListener("checkedItemsChanged", handleCheckedItemsUpdate);
    
    return () => {
      window.removeEventListener("recueilUpdated", handleStorageUpdate);
      window.removeEventListener("hideSintesChanged", handleSintesUpdate);
      window.removeEventListener("checkedItemsChanged", handleCheckedItemsUpdate);
    };
  }, []);

  const [hideSintes, setHideSintes] = useState(() => {
    return localStorage.getItem('results_hide_sintes') === 'true';
  });

  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('results_checked_items');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Filter analyses that are ready/identified
  const readyAnalyses = scrapedResults.filter((r) => {
    const isReady = r.identifiers.some((id) => id.psychoFound || id.druglabFound);
    if (!isReady) return false;
    if (hideSintes && r.label?.toLowerCase().includes('sintes')) return false;
    if (checkedItems.has(r.url)) return false;
    return true;
  });

  // Initialize conversation
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    handleReset();
  }, []);

  // Auto scroll to bottom of chat
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll on messages change or typing state
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleReset = () => {
    setSelectedAnalysis(null);
    setCurrentStep("select_analysis");
    setMessages([
      {
        id: "init",
        sender: "agent",
        text: "Bonjour ! Je suis votre assistant IA Psychonaut.\n\nQuelle analyse souhaitez-vous rédiger aujourd'hui ? Veuillez choisir parmi la liste des analyses identifiées / prêtes ci-dessous :",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSelectAnalysis = (analysis: AnalysisResult) => {
    setSelectedAnalysis(analysis);
    
    // Add user message
    const userMsg: Message = {
      id: `user-ana-${Date.now()}`,
      sender: "user",
      text: `J'aimerais rédiger l'analyse : ${analysis.title}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const agentMsg: Message = {
      id: `agent-ana-${Date.now()}`,
      sender: "agent",
      text: "Parfait. Quel identifiant souhaitez-vous utiliser pour cette analyse ?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setCurrentStep("select_identifier");
  };

  const handleSelectIdentifier = async (identifier: EnrichedIdentifier) => {
    setCurrentStep("generating");

    // Add user message
    const userMsg: Message = {
      id: `user-id-${Date.now()}`,
      sender: "user",
      text: `Utiliser l'identifiant : ${identifier.canonical}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const agentMsg: Message = {
      id: `agent-gen-${Date.now()}`,
      sender: "agent",
      text: `Je lance la récupération des données pour l'identifiant ${identifier.canonical} et la génération du rendu avec l'IA. Veuillez patienter...`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setIsTyping(true);

    if (!selectedAnalysis) return;
    await runAIGeneration(selectedAnalysis, identifier);
  };

  const runAIGeneration = async (analysis: AnalysisResult, identifier: EnrichedIdentifier) => {
    let details: ScrapedResultDetails | null = null;
    const isPsychoactif = identifier.psychoFound && identifier.psychoUrl;
    const isDruglab = identifier.druglabFound && identifier.druglabUrl;

    // 1. Scrape details
    try {
      if (isPsychoactif) {
        details = await scrapePsychoactifDetails(identifier.psychoUrl || "");
      } else if (isDruglab) {
        details = await scrapeDruglabDetails(identifier.druglabUrl || "");
      }
    } catch (e) {
      console.error("Erreur lors du scraping des détails:", e);
    }

    // 2. Fetch templates
    let template = "";
    if (isPsychoactif) {
      template = localStorage.getItem("templatePsychoactif") || defaultTemplatePsychoactif;
    } else if (isDruglab) {
      template = localStorage.getItem("templateDruglab") || defaultTemplateDruglab;
    }

    // 3. Fetch recueil
    let recueilText = "Aucune information disponible dans le recueil.";
    const apiKey = localStorage.getItem("recueilApiKey");
    const apiPassword = localStorage.getItem("recueilApiPassword");
    if (apiKey && apiPassword) {
      try {
        const folders = await recueilApi.getResources();
        const folderTexts: string[] = [];
        for (const folder of folders) {
          const items = await recueilApi.getResourceItems(folder.id);
          const itemsText = items
            .map((item: ResourceItem) => {
              let line = `- [${item.type === "note" ? "Note" : "Lien"}] ${item.title}`;
              if (item.url) line += ` : ${item.url}`;
              if (item.content) line += ` (Contenu : ${item.content})`;
              return line;
            })
            .join("\n");
          folderTexts.push(`Dossier "${folder.title}":\n${itemsText}`);
        }
        if (folderTexts.length > 0) {
          recueilText = folderTexts.join("\n\n");
        }
      } catch (e) {
        console.warn("Erreur de récupération du recueil pour le prompt IA", e);
      }
    }

    // 4. Compile previous user rendus
    const userRendusText = rendus
      .filter((r) => r.content?.trim())
      .map((r) => `Titre: ${r.title}\nSubstance: ${r.substance}\nContenu:\n${r.content}`)
      .join("\n====================\n");

    // 5. Build prompt
    const detailsText = details
      ? JSON.stringify(details, null, 2)
      : "Aucun détail d'analyse n'a pu être récupéré sur le site source.";

    const prompt = `Vous êtes un assistant de rédaction spécialisé pour le forum Psychonaut. Votre tâche consiste à générer le contenu du rapport final d'analyse (rendu) à partir des données brutes récoltées et en respectant rigoureusement le modèle (template) adéquat ainsi que le style de l'utilisateur.

Voici les informations sur l'analyse en cours :
- Titre de l'analyse : ${analysis.title}
- Identifiant choisi : ${identifier.canonical}
- Source : ${isPsychoactif ? "Psychoactif" : "DrugLab"}

Données brutes récupérées pour l'analyse :
${detailsText}

Modèle (template) à remplir obligatoirement (conservez la structure, les balises de BBCode comme [B], [I], [URL], etc.) :
${template}

Voici des informations de contexte supplémentaires provenant du recueil de l'utilisateur :
${recueilText}

Voici des exemples de rendus rédigés précédemment par l'utilisateur (le texte à imiter se trouve sous "Contenu:"). Rédigez le nouveau rendu dans le même style d'écriture (ton, rigueur, vocabulaire, mise en page BBCode) :
${userRendusText || "Aucun exemple disponible."}

Rédigez UNIQUEMENT le contenu final rempli en BBCode (la partie "Contenu:" du modèle) dans votre réponse. N'incluez SURTOUT PAS les mentions "Titre:", "Substance:" ou "Contenu:", ni aucune phrase d'introduction ou de conclusion.`;

    // 6. Invoke call_gemini Tauri Command
    try {
      const generatedText = await invoke<string>("call_gemini", { prompt });
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-gen-res-${Date.now()}`,
          sender: "agent",
          text: generatedText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setCurrentStep("idle");
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-gen-err-${Date.now()}`,
          sender: "agent",
          text: `Désolé, une erreur est survenue lors de l'appel à l'API Gemini 3.1 Flash-Lite :\n\n${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setCurrentStep("idle");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: `user-msg-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Context message payload
    const recentMessages = messages
      .slice(-6)
      .map((m) => `${m.sender === "user" ? "Utilisateur" : "IA"}: ${m.text}`)
      .join("\n\n");

    const prompt = `Vous êtes l'assistant de rédaction du forum Psychonaut (IA Gemini 3.1 Flash-Lite).
Voici le contexte des derniers échanges de la conversation :
${recentMessages}

Nouveau message de l'utilisateur :
${textToSend}

Répondez à l'utilisateur de manière concise et pertinente. S'il vous demande de modifier le BBCode généré précédemment, faites-le et retournez le BBCode modifié en entier.`;

    try {
      const replyText = await invoke<string>("call_gemini", { prompt });
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-reply-${Date.now()}`,
          sender: "agent",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-reply-err-${Date.now()}`,
          sender: "agent",
          text: `Erreur lors de la réponse de l'IA : ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Find the last agent message to check if it has BBCode to inject
  const lastAgentMessage = [...messages]
    .reverse()
    .find((m) => m.sender === "agent" && (m.text.includes("[") || m.text.includes("]")));

  const extractBBCode = (txt: string) => {
    const startIndex = txt.indexOf("[");
    const endIndex = txt.lastIndexOf("]") + 1;
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return txt.slice(startIndex, endIndex);
    }
    return txt;
  };

  const handleInject = () => {
    if (lastAgentMessage) {
      const bbcode = extractBBCode(lastAgentMessage.text);
      window.dispatchEvent(new CustomEvent("insertEditorText", { detail: bbcode }));
    }
  };

  const handleCreateNewRendu = () => {
    if (lastAgentMessage && onCreateRenduFromAI && selectedAnalysis) {
      const bbcode = extractBBCode(lastAgentMessage.text);
      onCreateRenduFromAI(selectedAnalysis.title, bbcode);
    }
  };

  if (isLocked) {
    return (
      <aside className="w-80 h-full bg-sidebar-bg border-l border-border-main flex flex-col items-center justify-center select-none p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-accent" />
        </div>
        <h3 className="text-sm font-bold text-fg-main mb-2">Assistant IA Verrouillé</h3>
        <p className="text-[11px] text-fg-muted mb-6 leading-relaxed">
          L'accès à l'intelligence artificielle est restreint. Une clé d'accès secrète est requise.
        </p>
        <p className="text-[10px] text-fg-muted/60 italic">
          (Rendez-vous dans les Paramètres ⚙️ pour saisir la clé d'accès)
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 h-full bg-sidebar-bg border-l border-border-main flex flex-col select-none">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-border-main flex items-center justify-between bg-chrome-bg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-fg-main uppercase tracking-wider">Assistant IA Gemini</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          title="Réinitialiser la conversation"
          className="p-1 rounded text-fg-muted hover:text-red-400 hover:bg-list-hover transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 max-w-[85%] ${
              msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0
                ${msg.sender === "user" ? "bg-accent text-white" : "bg-border-main text-fg-main"}`}
            >
              {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className="flex flex-col gap-1 max-w-full">
              <div
                className={`p-2.5 rounded-lg text-xs leading-normal whitespace-pre-wrap text-left shadow-sm overflow-x-auto select-text
                  ${
                    msg.sender === "user"
                      ? "bg-accent/15 text-fg-main border border-accent/10 rounded-tr-none"
                      : "bg-editor-bg border border-border-main rounded-tl-none text-fg-main font-sans"
                  }`}
              >
                {msg.text}
              </div>
              <span className={`text-[8px] text-fg-muted/65 ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {/* Selection Step Analysis */}
        {currentStep === "select_analysis" && (
          <div className="p-3 bg-editor-bg border border-border-main rounded-lg flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Analyses prêtes :</span>
            {readyAnalyses.length === 0 ? (
              <div className="text-xs text-fg-muted italic p-2 text-center">
                Aucune analyse identifiée dans "Résultats & Demandes" pour le moment.
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
                {readyAnalyses.map((ana) => (
                  <button
                    key={ana.url}
                    type="button"
                    onClick={() => handleSelectAnalysis(ana)}
                    className="w-full text-left p-2 rounded bg-chrome-bg/40 border border-border-main/50 hover:border-accent/40 text-[11px] text-fg-secondary hover:text-fg-main transition-all flex items-center justify-between group"
                  >
                    <span className="truncate pr-2 font-medium">{ana.title}</span>
                    <ArrowRight className="w-3 h-3 text-fg-muted group-hover:text-accent shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selection Step Identifier */}
        {currentStep === "select_identifier" && selectedAnalysis && (
          <div className="p-3 bg-editor-bg border border-border-main rounded-lg flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Choisissez l'identifiant :</span>
            <div className="flex flex-wrap gap-1.5">
              {selectedAnalysis.identifiers
                .filter((id) => id.psychoFound || id.druglabFound)
                .map((id) => (
                  <button
                    key={id.canonical}
                    type="button"
                    onClick={() => handleSelectIdentifier(id)}
                    className="bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent text-accent text-[11px] px-2.5 py-1.5 rounded transition-all font-semibold"
                  >
                    {id.canonical}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2 self-start max-w-[85%]">
            <div className="w-6 h-6 rounded-full bg-border-main text-fg-main flex items-center justify-center text-[10px] shrink-0 animate-pulse">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-editor-bg border border-border-main p-2.5 rounded-lg rounded-tl-none text-xs text-fg-muted flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* BBCode Injection Buttons */}
      {lastAgentMessage && currentStep === "idle" && (
        <div className="p-2 border-t border-border-main bg-accent/5 flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInject}
            className="text-[10px] py-1.5 px-2 bg-chrome-bg border border-border-main rounded font-bold text-fg-main hover:text-accent hover:border-accent transition-colors flex items-center justify-center gap-1"
          >
            <span>✨ Injecter dans le document actuel</span>
          </button>
          
          <button
            type="button"
            onClick={handleCreateNewRendu}
            className="text-[10px] py-1.5 px-2 bg-accent/10 border border-accent/20 rounded font-bold text-accent hover:bg-accent/20 transition-colors flex items-center justify-center gap-1"
          >
            <span>📄 Créer un nouveau Rendu avec ce texte</span>
          </button>
        </div>
      )}

      {/* Chat Input */}
      <div className="p-3 border-t border-border-main bg-editor-bg/40 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            placeholder={
              currentStep === "select_analysis"
                ? "Sélectionnez une analyse ci-dessus..."
                : currentStep === "select_identifier"
                ? "Choisissez l'identifiant..."
                : "Ajuster ou poser une question à l'IA..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={currentStep !== "idle" && currentStep !== "generating"}
            className="flex-1 bg-input-bg border border-input-border text-fg-main text-xs px-3 py-1.5 rounded outline-none focus:border-border-accent placeholder:text-fg-muted/65 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={(currentStep !== "idle" && currentStep !== "generating") || isTyping || !input.trim()}
            className="p-1.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white rounded transition-all shadow-sm shadow-accent/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>
    </aside>
  );
};
