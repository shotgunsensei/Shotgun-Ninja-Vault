import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Zap,
  Code2,
  Search,
  Network,
  Server,
  Copy,
  Check,
  RotateCcw,
  Send,
  Loader2,
  ChevronDown,
  Terminal,
  Trash2,
} from "lucide-react";

type OpsMode = "quick-fix" | "script-builder" | "deep-dive" | "network" | "system-design";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface QueryEntry {
  id: string;
  query: string;
  response: string;
  mode: OpsMode;
  timestamp: Date;
}

const MODES: { id: OpsMode; label: string; icon: typeof Zap; desc: string }[] = [
  { id: "quick-fix", label: "Quick Fix", icon: Zap, desc: "Fastest resolution path" },
  { id: "script-builder", label: "Script Builder", icon: Code2, desc: "Production-ready scripts" },
  { id: "deep-dive", label: "Deep Dive", icon: Search, desc: "Root cause analysis" },
  { id: "network", label: "Network", icon: Network, desc: "Layer-by-layer diagnostics" },
  { id: "system-design", label: "System Design", icon: Server, desc: "Architecture decisions" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
      data-testid="button-copy-code"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ResponseBlock({ content }: { content: string }) {
  const sections = parseResponse(content);

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <div key={i}>
          {section.type === "heading" && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                {section.content}
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          )}
          {section.type === "code" && (
            <div className="relative group">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-t text-[10px] text-zinc-500 font-mono">
                <span>{section.lang || "shell"}</span>
                <CopyButton text={section.content} />
              </div>
              <pre className="px-3 py-2 bg-zinc-950 border border-t-0 border-zinc-800 rounded-b overflow-x-auto text-[13px] leading-relaxed font-mono text-zinc-200">
                <code>{section.content}</code>
              </pre>
            </div>
          )}
          {section.type === "text" && (
            <div className="text-[13px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {section.content}
            </div>
          )}
          {section.type === "table" && (
            <div className="overflow-x-auto">
              <pre className="text-[12px] leading-relaxed text-zinc-300 font-mono">
                {section.content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface ParsedSection {
  type: "heading" | "code" | "text" | "table";
  content: string;
  lang?: string;
}

function parseResponse(raw: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\[.*\]$/.test(line.trim())) {
      sections.push({ type: "heading", content: line.trim().replace(/^\[|\]$/g, "") });
      i++;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const lang = line.trim().replace(/^```/, "").trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      sections.push({ type: "code", content: codeLines.join("\n"), lang });
      continue;
    }

    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      sections.push({ type: "table", content: tableLines.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const textLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trim().startsWith("```") &&
      !/^\[.*\]$/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && lines[i].trim().startsWith("|"))
    ) {
      if (lines[i].trim() === "" && textLines.length > 0) {
        textLines.push("");
        i++;
        continue;
      }
      textLines.push(lines[i]);
      i++;
    }

    const joined = textLines.join("\n").trim();
    if (joined) {
      sections.push({ type: "text", content: joined });
    }
  }

  return sections;
}

export function ItOpsConsolePage() {
  const [mode, setMode] = useState<OpsMode>("quick-fix");
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [history, setHistory] = useState<QueryEntry[]>([]);
  const [conversationHistory, setConversationHistory] = useState<HistoryMessage[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [currentResponse]);

  const handleSubmit = useCallback(async (queryText?: string) => {
    const q = queryText || query;
    if (!q.trim() || isStreaming) return;

    setIsStreaming(true);
    setCurrentResponse("");
    setQuery("");

    let accumulated = "";

    try {
      const res = await fetch("/api/itops/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: q.trim(),
          mode,
          beginnerMode,
          history: conversationHistory.slice(-10),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              accumulated += event.content;
              setCurrentResponse(accumulated);
            }
            if (event.error) {
              throw new Error(event.error);
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }

      const entry: QueryEntry = {
        id: Date.now().toString(),
        query: q.trim(),
        response: accumulated,
        mode,
        timestamp: new Date(),
      };

      setHistory((prev) => [entry, ...prev].slice(0, 50));
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: q.trim() },
        { role: "assistant", content: accumulated },
      ].slice(-20));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process query",
        variant: "destructive",
      });
      setCurrentResponse("");
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }, [query, mode, beginnerMode, conversationHistory, isStreaming, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReuseLast = () => {
    if (history.length > 0) {
      const last = history[0];
      setMode(last.mode);
      setQuery(last.query);
      inputRef.current?.focus();
    }
  };

  const clearSession = () => {
    setCurrentResponse("");
    setConversationHistory([]);
    setHistory([]);
  };

  const modeConfig = MODES.find((m) => m.id === mode)!;

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      <div className="w-48 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
        <div className="px-3 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">IT Ops</span>
          </div>
        </div>

        <div className="flex-1 py-2 px-2 space-y-0.5">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                data-testid={`button-mode-${m.id}`}
                className={`
                  w-full flex items-center gap-2 px-2.5 py-2 rounded text-left transition-all
                  ${active
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent"
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{m.label}</div>
                  {active && (
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{m.desc}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-zinc-800 px-2 py-2 space-y-2">
          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Recent</span>
                <button
                  onClick={clearSession}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                  title="Clear history"
                  data-testid="button-clear-session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {history.slice(0, 5).map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setCurrentResponse(entry.response)}
                    data-testid={`button-history-${entry.id}`}
                    className="w-full text-left px-2 py-1.5 rounded text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 truncate transition-all"
                    title={entry.query}
                  >
                    {entry.query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <modeConfig.icon className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-zinc-200">{modeConfig.label}</span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500">{modeConfig.desc}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="beginner-toggle" className="text-[11px] text-zinc-500 uppercase tracking-wider cursor-pointer">
                {beginnerMode ? "Beginner" : "Expert"}
              </Label>
              <Switch
                id="beginner-toggle"
                checked={!beginnerMode}
                onCheckedChange={(v) => setBeginnerMode(!v)}
                data-testid="switch-expert-mode"
                className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-amber-500"
              />
            </div>
          </div>
        </div>

        <div ref={responseRef} className="flex-1 overflow-auto px-6 py-4">
          {!currentResponse && history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <modeConfig.icon className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-200 mb-1">
                {modeConfig.label}
              </h2>
              <p className="text-sm text-zinc-500 max-w-md mb-6">
                {modeConfig.desc}. Type a query below or pick a starter.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-w-lg w-full">
                {getExamples(mode).map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(ex);
                      inputRef.current?.focus();
                    }}
                    data-testid={`button-example-${i}`}
                    className="text-left px-3 py-2.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentResponse && (
            <div className="max-w-3xl">
              <ResponseBlock content={currentResponse} />
              {isStreaming && (
                <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          )}

          {!currentResponse && history.length > 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-xl bg-zinc-800/50 border border-zinc-800 flex items-center justify-center mb-4">
                <modeConfig.icon className="w-7 h-7 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-500 mb-2">
                Ready for your next query.
              </p>
              <p className="text-[11px] text-zinc-600">
                {history.length} {history.length === 1 ? "query" : "queries"} in session · Select from Recent in sidebar
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="max-w-3xl">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={getPlaceholder(mode)}
                  disabled={isStreaming}
                  rows={1}
                  data-testid="input-query"
                  className="resize-none bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-sm font-mono min-h-[40px] max-h-[120px] focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50"
                  style={{ fieldSizing: "content" } as any}
                />
              </div>
              <Button
                onClick={() => handleSubmit()}
                disabled={!query.trim() || isStreaming}
                size="sm"
                data-testid="button-submit-query"
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-10 px-3"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
              {history.length > 0 && (
                <Button
                  onClick={handleReuseLast}
                  disabled={isStreaming}
                  variant="outline"
                  size="sm"
                  data-testid="button-reuse-last"
                  className="border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 h-10"
                  title="Reuse last query"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-zinc-600 font-mono">
                Enter to send · Shift+Enter for new line
              </span>
              <span className="text-[10px] text-zinc-600 font-mono">
                {beginnerMode ? "BEGINNER" : "EXPERT"} · {modeConfig.label.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPlaceholder(mode: OpsMode): string {
  switch (mode) {
    case "quick-fix":
      return "Describe the issue... (e.g., DNS resolution failing on Windows Server 2022)";
    case "script-builder":
      return "What script do you need? (e.g., PowerShell to audit AD user last logon dates)";
    case "deep-dive":
      return "Describe the symptoms... (e.g., Exchange 2019 queuing mail, CPU at 95%)";
    case "network":
      return "Describe the network issue... (e.g., Intermittent packet loss between VLAN 10 and 20)";
    case "system-design":
      return "What are you designing? (e.g., Multi-site backup architecture for 50 endpoints)";
  }
}

function getExamples(mode: OpsMode): string[] {
  switch (mode) {
    case "quick-fix":
      return [
        "BSOD IRQL_NOT_LESS_OR_EQUAL after Windows update",
        "RDP disconnects after exactly 1 minute",
        "Exchange 365 mail flow stuck in queue",
        "GPO not applying to new OU",
      ];
    case "script-builder":
      return [
        "PowerShell: bulk disable inactive AD users (90 days)",
        "Bash: monitor disk space and alert via Slack",
        "Python: parse Windows Event Log for failed logins",
        "PowerShell: automated workstation inventory report",
      ];
    case "deep-dive":
      return [
        "Server intermittently unreachable, no pattern in logs",
        "SQL Server deadlocks occurring every 2 hours",
        "Hyper-V VM performance degraded after host migration",
        "WSUS clients not reporting for 30+ days",
      ];
    case "network":
      return [
        "High latency on VPN tunnel between sites",
        "DHCP exhaustion in /24 subnet",
        "Asymmetric routing after adding second WAN link",
        "802.1X authentication failing for specific VLANs",
      ];
    case "system-design":
      return [
        "DR plan for 200-user office with RTO < 4 hours",
        "Zero-trust network architecture for MSP client",
        "Migrate on-prem Exchange to M365 with hybrid coexistence",
        "Multi-tenant RMM monitoring stack design",
      ];
  }
}
