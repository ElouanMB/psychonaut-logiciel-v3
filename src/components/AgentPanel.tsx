import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Bot, User, Trash2 } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
}

interface AgentPanelProps {
  onInsertText?: (text: string) => void;
  activeDocSubstance?: string;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ onInsertText, activeDocSubstance }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      sender: "agent",
      text: "Bonjour ! Je suis votre assistant IA Psychonaut. Sélectionnez une substance ou un rendu pour commencer, et je vous aiderai à rédiger le rapport final dans votre style habituel.",
      timestamp: "11:28",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll on messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      let replyText = "";
      if (textToSend.toLowerCase().includes("3-mmc") || textToSend.toLowerCase().includes("cathinone")) {
        replyText = `Voici une proposition de synthèse rédigée pour la **3-MMC** basée sur vos données :\n\n[QUOTE][B]Synthèse d'Analyse - 3-MMC[/B]\nL'échantillon identifié sous le code [B]PSYCHO266372[/B] a été analysé comme de la [B]3-MMC[/B] (pureté estimée à 85%).\n\n[B]Rappel de réduction des risques (RdR) :[/B]\nLa 3-MMC présente un fort potentiel addictif et un craving important. Espacez impérativement vos prises d'au moins 3 semaines et évitez l'injection ou le sniff pour limiter les dommages sur les muqueuses et le système cardiovasculaire.[/QUOTE]\n\nCliquez sur le bouton ci-dessous pour insérer ce texte dans votre éditeur.`;
      } else if (textToSend.toLowerCase().includes("héroïne") || textToSend.toLowerCase().includes("diacétylmorphine")) {
        replyText = `Voici un modèle de rédaction pour l'**Héroïne** (échantillon 2026-1687) :\n\n[QUOTE][B]Résultats SINTES - Héroïne[/B]\nL'analyse révèle une teneur en diacétylmorphine de [B]22%[/B], coupée avec de la [B]Caféine[/B] (45%) et du [B]Paracétamol[/B] (28%).\n\n[COLOR=#B478BD][B]Alerte RDR :[/B][/COLOR] Le mélange caféine/paracétamol est classique pour consommer le produit sur de l'aluminium (chasse au dragon) mais augmente la toxicité. Gardez toujours de la Naloxone à proximité.[/QUOTE]`;
      } else {
        replyText = `D'accord, je peux vous aider à formuler cela. Si vous souhaitez générer un rapport structuré, vous pouvez me donner le nom de la molécule (ex: LSD, 3-MMC, Héroïne) ou me demander de traduire vos notes en BBCode propre pour le forum.`;
      }

      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          sender: "agent",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1200);
  };

  const handlePresetPrompt = (substance: string) => {
    handleSend(`Générer une synthèse RDR rédigée pour la substance : ${substance}`);
  };

  const handleClear = () => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: "agent",
        text: "Conversation réinitialisée. Comment puis-je vous aider aujourd'hui ?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Find the last message containing BBCode block quotes or brackets
  const lastMessageText = [...messages].reverse().find((m) => m.sender === "agent" && m.text.includes("["))?.text;

  const extractBBCode = (txt: string) => {
    const startIndex = txt.indexOf("[");
    const endIndex = txt.lastIndexOf("]") + 1;
    if (startIndex !== -1 && endIndex !== -1) {
      return txt.slice(startIndex, endIndex);
    }
    return txt;
  };

  return (
    <aside className="w-80 h-full bg-sidebar-bg border-l border-border-main flex flex-col select-none">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-border-main flex items-center justify-between bg-chrome-bg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-fg-main uppercase tracking-wider">Assistant IA</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          title="Vider le chat"
          className="p-1 rounded text-fg-muted hover:text-red-400 hover:bg-list-hover transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Prompts Helper */}
      <div className="p-3 border-b border-border-main bg-editor-bg/20 flex flex-wrap gap-1.5">
        <span className="text-[10px] font-bold text-fg-muted w-full mb-1">Prompts suggérés :</span>
        <button
          type="button"
          onClick={() => handlePresetPrompt(activeDocSubstance || "3-MMC")}
          className="text-[10px] bg-list-active hover:bg-accent/15 border border-accent/20 text-accent px-2 py-1 rounded transition-all font-medium"
        >
          Synthetiser {activeDocSubstance || "3-MMC"}
        </button>
        <button
          type="button"
          onClick={() => handlePresetPrompt("Héroïne")}
          className="text-[10px] bg-list-active hover:bg-accent/15 border border-accent/20 text-accent px-2 py-1 rounded transition-all font-medium"
        >
          Synthetiser Héroïne
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 flex flex-col">
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

            <div className="flex flex-col gap-1">
              <div
                className={`p-2.5 rounded-lg text-xs leading-normal whitespace-pre-wrap text-left shadow-sm
                  ${
                    msg.sender === "user"
                      ? "bg-accent/15 text-fg-main border border-accent/10 rounded-tr-none"
                      : "bg-editor-bg border border-border-main rounded-tl-none text-fg-main"
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

      {/* Context Integration (Inject text) */}
      {lastMessageText && onInsertText && (
        <div className="p-2 border-t border-border-main bg-accent/5 flex items-center justify-center">
          <button
            type="button"
            onClick={() => onInsertText(extractBBCode(lastMessageText))}
            className="text-[10px] font-bold text-accent hover:text-accent-hover hover:underline transition-colors flex items-center gap-1"
          >
            <span>✨ Injecter le BBCode généré dans l'éditeur</span>
          </button>
        </div>
      )}

      {/* Chat Input */}
      <div className="p-3 border-t border-border-main bg-editor-bg/40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            placeholder="Demander à l'IA..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-input-bg border border-input-border text-fg-main text-xs px-3 py-1.5 rounded outline-none focus:border-border-accent placeholder:text-fg-muted/65 transition-all"
          />
          <button
            type="submit"
            className="p-1.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white rounded transition-all shadow-sm shadow-accent/15"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
