import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Role = "merchant" | "shopper";
type Msg = { role: "user" | "assistant"; content: string };

const storageKey = (role: Role, wallet?: string | null) =>
  `ls_concierge_${role}_${(wallet || "anon").toLowerCase()}`;

interface Props {
  role: Role;
  className?: string;
  title?: string;
}

/**
 * In-app Concierge: Loyal Spark only. Forwards to `chat-bridge`
 * (OpenServ when configured, otherwise scoped local stub).
 */
export function LoyalSparkConcierge({ role, className, title }: Props) {
  const { session } = useAuth();
  const { address } = useAccount();
  const wallet = address?.toLowerCase() ?? null;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(role, wallet));
      if (raw) setMessages(JSON.parse(raw) as Msg[]);
    } catch {
      /* ignore */
    }
  }, [role, wallet]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(role, wallet), JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, role, wallet]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || disabled) return;
    if (!session?.access_token) {
      setError("Sign in to use the assistant.");
      return;
    }

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("chat-bridge", {
        body: { role, messages: next },
      });

      if (fnErr) {
        // Non-2xx from chat-bridge: surface its friendly message if present.
        const friendly =
          (data && typeof data === "object" && (data as { message?: string }).message) ||
          "Assistant is temporarily unavailable. Please try again in a few minutes.";
        setError(friendly);
        return;
      }
      if (data?.disabled) {
        setDisabled(true);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply || "Assistant temporarily unavailable." },
        ]);
        return;
      }
      if (data?.error === "daily_limit") {
        setError(data.message || "Daily limit reached.");
        return;
      }
      if (data?.error) {
        setError(String(data.error));
        return;
      }
      const reply = typeof data?.reply === "string" ? data.reply : "No reply.";
      if (data?.source === "serv") setEngine("OpenServ SERV Reasoning");
      else if (data?.source === "openserv") setEngine("OpenServ Concierge");
      else if (data?.refused) setEngine("Loyal Spark scope");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("[concierge] send failed", e);
      setError("Assistant is temporarily unavailable. Please try again in a few minutes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex h-[min(70vh,560px)] min-h-0 flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">{title ?? (role === "merchant" ? "Merchant assistant" : "Shopper assistant")}</p>
          <p className="text-xs text-muted-foreground">
            {engine ?? "Understands the question, then stays on Loyal Spark"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask about programs, minting, rewards, vouchers, certificates, or balances on Base.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={cn(
              "max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
            )}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-destructive">{error}</p>}
      {disabled && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">Assistant temporarily unavailable.</p>
      )}

      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Loyal Spark…"
          className="min-h-[44px] max-h-28 resize-none"
          disabled={busy || disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="button" size="icon" className="shrink-0" disabled={busy || disabled || !input.trim()} onClick={() => void send()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
