import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { parseUnits, type Hex } from "viem";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ConciergeRedeemActions,
  type ConciergeAction,
  type ConfirmRedeemAction,
  type RedeemableReward,
} from "@/components/assistant/ConciergeRedeemActions";
import { CONTRACTS } from "@/config/contracts";
import { encodeWithBuilderCode } from "@/config/builder-code";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveCustomerWallet } from "@/hooks/useActiveCustomerWallet";
import { supabase } from "@/integrations/supabase/client";
import { createVerifiedVoucher } from "@/lib/verifiedVoucher";
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
 * In-app Concierge. Shopper can pick a reward, sign the loyalty transfer, and get a voucher.
 */
export function LoyalSparkConcierge({ role, className, title }: Props) {
  const { session } = useAuth();
  const { address, isConnected } = useAccount();
  const { activeAddress, isMismatch } = useActiveCustomerWallet();
  const wallet = address?.toLowerCase() ?? null;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [action, setAction] = useState<ConciergeAction | null>(null);
  const [signing, setSigning] = useState(false);
  const pendingRedeem = useRef<ConfirmRedeemAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { sendTransaction, data: txHash, reset: resetTx, error: txError } = useSendTransaction();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

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
  }, [messages, busy, action, signing]);

  useEffect(() => {
    if (txError) {
      setSigning(false);
      setError(txError.message || "Wallet rejected the transaction.");
      pendingRedeem.current = null;
    }
  }, [txError]);

  useEffect(() => {
    if (!confirmed || !txHash || !pendingRedeem.current || !wallet) return;
    const pending = pendingRedeem.current;
    pendingRedeem.current = null;

    void (async () => {
      setSigning(true);
      setError(null);
      const result = await createVerifiedVoucher({
        transactionHash: txHash,
        rewardId: pending.reward.id,
        tokenAddress: pending.reward.token_address,
        tokenSymbol: pending.reward.token_symbol || pending.reward.program_name,
        customerAddress: wallet,
        merchantAddress: pending.reward.merchant_address,
        cost: pending.reward.cost,
      });
      setSigning(false);
      resetTx();
      setAction(null);

      if (result.success && result.voucher) {
        window.dispatchEvent(new Event("vouchersUpdated"));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: [
              `Ваучер готов: ${result.voucher!.code}`,
              `Награда: ${result.voucher!.rewardName}`,
              `Транзакция: https://basescan.org/tx/${result.voucher!.transactionHash}`,
              "Код также появился во вкладке Loyalty → My Vouchers.",
            ].join("\n"),
          },
        ]);
        setEngine("Redeem + verify-voucher");
        return;
      }
      setError(result.error || "Voucher verification failed.");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: result.error
            ? `Перевод, похоже, прошёл, но ваучер не создался: ${result.error}. Проверьте My Vouchers или повторите позже.`
            : "Перевод отправлен, но ваучер ещё не подтвердился. Откройте My Vouchers через минуту.",
        },
      ]);
    })();
  }, [confirmed, txHash, wallet, resetTx]);

  const applyBridgePayload = useCallback((data: Record<string, unknown>) => {
    const reply = typeof data.reply === "string" ? data.reply : "No reply.";
    if (data.source === "serv") setEngine("OpenServ SERV Reasoning");
    else if (data.source === "openserv") setEngine("OpenServ Concierge");
    else if (data.source === "redeem") setEngine("Shopper redeem");
    else if (data.source === "explorer") setEngine("Base explorer");
    else if (data.refused) setEngine("Loyal Spark scope");
    setMessages((m) => [...m, { role: "assistant", content: reply }]);
    const nextAction = data.action as ConciergeAction | undefined;
    if (nextAction?.type === "pick_reward" || nextAction?.type === "confirm_redeem") {
      setAction(nextAction);
    } else {
      setAction(null);
    }
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || disabled || signing) return;
    if (!session?.access_token) {
      setError("Sign in to use the assistant.");
      return;
    }

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    setAction(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("chat-bridge", {
        body: { role, messages: next },
      });

      if (fnErr) {
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
      applyBridgePayload(data as Record<string, unknown>);
    } catch (e) {
      console.error("[concierge] send failed", e);
      setError("Assistant is temporarily unavailable. Please try again in a few minutes.");
    } finally {
      setBusy(false);
    }
  };

  const prepareReward = async (reward: RedeemableReward) => {
    if (!session?.access_token || busy || signing) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "user", content: `Выбрать: ${reward.name}` }]);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("chat-bridge", {
        body: {
          role: "shopper",
          action: { type: "prepare_redeem", reward_id: reward.id },
        },
      });
      if (fnErr || data?.error) {
        setError(
          (data && typeof data === "object" && (data as { message?: string }).message) ||
            String(data?.error || fnErr?.message || "Prepare failed"),
        );
        return;
      }
      applyBridgePayload(data as Record<string, unknown>);
    } catch (e) {
      console.error("[concierge] prepare failed", e);
      setError("Could not prepare the voucher. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const signAndIssue = () => {
    if (!action || action.type !== "confirm_redeem") return;
    if (!isConnected || !wallet) {
      setError("Connect the same wallet that holds the points, then try again.");
      return;
    }
    setError(null);
    setSigning(true);
    pendingRedeem.current = action;
    try {
      const data = (action.transfer.data ||
        encodeWithBuilderCode(
          CONTRACTS.LOYAL_SPARK_ERC20.abi,
          "transfer",
          [action.reward.merchant_address as `0x${string}`, parseUnits(String(action.reward.cost), 18)],
        )) as Hex;
      sendTransaction({
        to: action.transfer.to as `0x${string}`,
        data,
        value: 0n,
      });
    } catch (e) {
      console.error("[concierge] sign", e);
      setSigning(false);
      pendingRedeem.current = null;
      setError("Could not open the wallet for signing.");
    }
  };

  const locked = busy || disabled || signing || confirming;

  const clearHistory = () => {
    if (locked || messages.length === 0) return;
    setMessages([]);
    setAction(null);
    setError(null);
    setEngine(null);
    setInput("");
    pendingRedeem.current = null;
    try {
      localStorage.removeItem(storageKey(role, wallet));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("flex h-[min(70vh,560px)] min-h-0 flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title ?? (role === "merchant" ? "Merchant assistant" : "Shopper assistant")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {engine ?? "Understands the question, then stays on Loyal Spark"}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            disabled={locked}
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {role === "shopper"
              ? "Ask about balances, last spend, or say “выпусти ваучер” to redeem a reward."
              : "Ask about programs, minting, rewards, vouchers, certificates, or balances on Base."}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={cn(
              "max-w-[90%] min-w-0 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
            )}
          >
            {m.content}
          </div>
        ))}

        {action && (
          <ConciergeRedeemActions
            action={action}
            locked={locked}
            isConnected={isConnected}
            isMismatch={isMismatch}
            activeAddress={activeAddress}
            signing={signing}
            confirming={confirming}
            onPick={(r) => void prepareReward(r)}
            onSign={signAndIssue}
            onCancel={() => {
              setAction(null);
              pendingRedeem.current = null;
            }}
          />
        )}

        {(busy || signing || confirming) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {signing || confirming ? "Waiting for wallet / Base…" : "Thinking…"}
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
          placeholder={role === "shopper" ? "Баланс, списание, ваучер…" : "Ask about Loyal Spark…"}
          className="min-h-[44px] max-h-28 min-w-0 flex-1 resize-none"
          disabled={locked}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="button" size="icon" className="shrink-0" disabled={locked || !input.trim()} onClick={() => void send()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
