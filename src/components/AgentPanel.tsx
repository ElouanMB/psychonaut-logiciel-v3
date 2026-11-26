import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Bot, User, Trash2, Loader2, ArrowRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { RenduItem } from "../data/mockData";
import { recueilApi, getServerRootUrl } from "../utils/recueilApi";
import type { ResourceItem } from "../utils/recueilApi";
import { defaultTemplatePsychoactif, defaultTemplateDruglab } from "../utils/templates";
import type { AnalysisResult, EnrichedIdentifier, ScrapedResultDetails } from "../utils/scraper";
import { scrapePsychoactifDetails, scrapeDruglabDetails, scrapePsychonautRequest } from "../utils/scraper";
import {
  buildExamplesText,
  buildFacts,
  buildFollowUpPrompt,
  buildGenerationPrompt,
  buildRecueilText,
  cleanAiText,
  extractDraft,
  finalizeDraft,
  type GenerationContext,
} from "../utils/aiRendu";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  /** Message contenant un rendu complet (déjà transmis à part dans les prompts suivants) */
  isDraft?: boolean;
}

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
  // Contexte de la génération (faits, demande, modèle), réutilisé pour chaque correction demandée ensuite
  const [genContext, setGenContext] = useState<GenerationContext | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  const pushAgent = (text: string, extra: Partial<Message> = {}) =>
    setMessages((prev) => [
      ...prev,
      { id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sender: "agent", text, timestamp: now(), ...extra },
    ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // La clé d'accès est vérifiée par le serveur (elle n'est plus écrite dans le code, qui est public)
  const [isLocked, setIsLocked] = useState(true);
  const [lockError, setLockError] = useState("");

  const callAI = (prompt: string) =>
    invoke<string>("call_gemini", {
      prompt,
      serverUrl: getServerRootUrl(),
      iaKey: localStorage.getItem("iaAccessKey") || "",
    });

  useEffect(() => {
    const checkAccess = async () => {
      const iaKey = localStorage.getItem("iaAccessKey") || "";
      if (!iaKey) {
        setIsLocked(true);
        setLockError("");
        return;
      }
      try {
        const ok = await invoke<boolean>("verify_ia_key", { serverUrl: getServerRootUrl(), iaKey });
        setIsLocked(!ok);
        setLockError(ok ? "" : "Clé d'accès refusée par le serveur.");
      } catch (e) {
        setIsLocked(true);
        setLockError(e instanceof Error ? e.message : String(e));
      }
    };
    checkAccess();

    const handleStorageUpdate = () => {
      checkAccess();
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

  // Incrémenté à chaque réinitialisation / nouvelle requête : une réponse arrivée après coup est ignorée
  const runIdRef = useRef(0);

  const handleReset = () => {
    runIdRef.current++;
    setIsTyping(false);
    setSelectedAnalysis(null);
    setGenContext(null);
    setDraft(null);
    setCurrentStep("select_analysis");
    setMessages([
      {
        id: "init",
        sender: "agent",
        text: "Bonjour ! Je suis votre assistant IA Psychonaut.\n\nQuelle analyse souhaitez-vous rédiger aujourd'hui ? Veuillez choisir parmi la liste des analyses identifiées / prêtes ci-dessous :",
        timestamp: now(),
      },
    ]);
  };

  const handleSelectAnalysis = (analysis: AnalysisResult) => {
    setSelectedAnalysis(analysis);
    setMessages((prev) => [
      ...prev,
      { id: `user-ana-${Date.now()}`, sender: "user", text: `J'aimerais rédiger l'analyse : ${analysis.title}`, timestamp: now() },
      { id: `agent-ana-${Date.now()}`, sender: "agent", text: "Parfait. Quel identifiant souhaitez-vous utiliser pour cette analyse ?", timestamp: now() },
    ]);
    setCurrentStep("select_identifier");
  };

  const handleSelectIdentifier = async (identifier: EnrichedIdentifier) => {
    if (!selectedAnalysis) return;
    setCurrentStep("generating");
    setMessages((prev) => [
      ...prev,
      { id: `user-id-${Date.now()}`, sender: "user", text: `Utiliser l'identifiant : ${identifier.canonical}`, timestamp: now() },
      {
        id: `agent-gen-${Date.now()}`,
        sender: "agent",
        text: `Je récupère les données de ${identifier.canonical} et je rédige le rendu. Veuillez patienter...`,
        timestamp: now(),
      },
    ]);
    setIsTyping(true);
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;
    try {
      await runAIGeneration(selectedAnalysis, identifier, isStale);
    } finally {
      if (!isStale()) setIsTyping(false);
    }
  };

  const runAIGeneration = async (analysis: AnalysisResult, identifier: EnrichedIdentifier, isStale: () => boolean) => {
    const isPsychoactif = !!(identifier.psychoFound && identifier.psychoUrl);
    const sourceUrl = isPsychoactif ? identifier.psychoUrl : identifier.druglabUrl;
    const warnings: string[] = [];

    // 1. Résultat du labo : sans lui, l'IA inventerait. On s'arrête et on le dit.
    let details: ScrapedResultDetails | null = null;
    try {
      if (!sourceUrl) throw new Error("aucune adresse de résultat pour cet identifiant");
      details = isPsychoactif ? await scrapePsychoactifDetails(sourceUrl) : await scrapeDruglabDetails(sourceUrl);
      if (!details) throw new Error("page de résultat vide");
    } catch (e) {
      if (isStale()) return;
      pushAgent(
        `Impossible de récupérer le résultat de ${identifier.canonical} sur ${isPsychoactif ? "Psychoactif" : "DrugLab"} : ${errorText(e)}\n\nRien n'a été envoyé à l'IA. Réessayez en choisissant l'identifiant.`
      );
      setCurrentStep("select_identifier");
      return;
    }
    if (isStale()) return;
    const facts = buildFacts(details, identifier.canonical);

    // 2. Demande initiale sur le forum
    let brief = "";
    try {
      brief = (analysis.url && (await scrapePsychonautRequest(analysis.url))) || "";
    } catch {
      brief = "";
    }
    if (isStale()) return;
    if (!brief) warnings.push("La demande initiale du forum n'a pas pu être récupérée : l'IA ne sait pas ce qui avait été annoncé.");

    // 3. Modèle
    const template = isPsychoactif
      ? localStorage.getItem("templatePsychoactif") || defaultTemplatePsychoactif
      : localStorage.getItem("templateDruglab") || defaultTemplateDruglab;

    // 4. Recueil, trié par pertinence
    let recueil = "";
    if (localStorage.getItem("recueilApiPassword")) {
      try {
        const folders = await recueilApi.getResources();
        const folderItems: ResourceItem[][] = await Promise.all(
          folders.map((folder: { id: string }) => recueilApi.getResourceItems(folder.id))
        );
        recueil = buildRecueilText(folders, folderItems, facts.keywords);
      } catch (e) {
        warnings.push(`Recueil non chargé (${errorText(e)}) : la partie Documentations risque d'être pauvre.`);
      }
    }

    if (isStale()) return;

    // 5. Exemples de style (sans leurs chiffres)
    const examples = buildExamplesText(rendus, facts.keywords);

    const ctx: GenerationContext = { analysisTitle: analysis.title, facts, brief, template };
    const prompt = buildGenerationPrompt(ctx, recueil, examples);

    try {
      const generated = await callAI(prompt);
      if (isStale()) return;
      const { text, warnings: draftWarnings } = finalizeDraft(generated, facts);
      setGenContext(ctx);
      setDraft(text);
      pushAgent(text, { isDraft: true });
      const allWarnings = [...warnings, ...draftWarnings];
      if (allWarnings.length) pushAgent(`⚠️ À vérifier :\n${allWarnings.map((w) => `• ${w}`).join("\n")}`);
    } catch (err) {
      console.error(err);
      if (isStale()) return;
      pushAgent(`Désolé, une erreur est survenue lors de l'appel à l'IA :\n\n${errorText(err)}`);
    } finally {
      if (!isStale()) setCurrentStep("idle");
    }
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;

    const history = messages.filter((m) => !m.isDraft && m.id !== "init").map((m) => ({ sender: m.sender, text: m.text }));
    setMessages((prev) => [...prev, { id: `user-msg-${Date.now()}`, sender: "user", text: textToSend, timestamp: now() }]);
    setInput("");
    setIsTyping(true);
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;

    try {
      const reply = await callAI(buildFollowUpPrompt(genContext, draft, history, textToSend));
      if (isStale()) return;
      const { draft: newDraft, rest } = extractDraft(reply, genContext?.template);
      if (rest) pushAgent(cleanAiText(rest));
      if (newDraft) {
        const { text, warnings } = finalizeDraft(newDraft, genContext?.facts ?? null);
        setDraft(text);
        pushAgent(text, { isDraft: true });
        if (warnings.length) pushAgent(`⚠️ À vérifier :\n${warnings.map((w) => `• ${w}`).join("\n")}`);
      }
    } catch (err) {
      console.error(err);
      if (!isStale()) pushAgent(`Erreur lors de la réponse de l'IA : ${errorText(err)}`);
    } finally {
      if (!isStale()) setIsTyping(false);
    }
  };

  const handleInject = () => {
    if (draft) window.dispatchEvent(new CustomEvent("insertEditorText", { detail: draft }));
  };

  const handleCreateNewRendu = () => {
    const title = genContext?.analysisTitle || selectedAnalysis?.title;
    if (draft && onCreateRenduFromAI && title) onCreateRenduFromAI(title, draft);
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
        {lockError && (
          <p className="text-[10px] text-red-500 mb-3 leading-relaxed">{lockError}</p>
        )}
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
      {draft && currentStep === "idle" && (
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
