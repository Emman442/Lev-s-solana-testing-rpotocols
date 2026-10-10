"use client";

import { useMemo, useState } from "react";
import bs58 from "bs58";
import { toast } from "sonner";
import { useWallet } from "../lib/wallet/context";
import { inspectRaw, type Inspect } from "../lib/inspect";
import { signWithWallet, simulate, sendRaw, waitConfirmed, type Cluster } from "../lib/wallet-tools";

const LIMIT = 1232;
const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

function toBytes(s: string): Uint8Array | null {
  const text = s.trim();
  if (!/[+/=]/.test(text)) {
    try { return bs58.decode(text); } catch {}
  }
  try {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function Lanes({ info, me, tokenMint }: { info: Inspect; me?: string; tokenMint?: string }) {
  return (
    <div className="grid gap-2">
      {info.slots.map((s, i) => {
        const tone = s.filled
          ? s.valid ? "border-emerald-500/60 bg-emerald-500/10" : "border-red-500/60 bg-red-500/10"
          : "border-dashed border-amber-500/60 bg-amber-500/5";
        return (
          <div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${tone}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span>{s.filled ? "🔏" : "✍️"}</span>
              <span className="font-mono" title={s.pubkey}>{short(s.pubkey)}</span>
              {s.pubkey === me && <span className="rounded bg-foreground/10 px-1.5 text-xs">your wallet</span>}
              {s.pubkey === tokenMint && <span className="rounded bg-foreground/10 px-1.5 text-xs">token mint</span>}
              {i === 0 && <span className="rounded bg-foreground/10 px-1.5 text-xs">fee payer</span>}
            </div>
            <span className="text-xs">
              {s.filled ? (s.valid ? "signed and verified" : "signed but INVALID") : "waiting for signature"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Card({ b58, index, total, me, tokenMint, cluster }: {
  b58: string; index: number; total: number; me?: string; tokenMint?: string; cluster: Cluster;
}) {
  const { wallet } = useWallet();
  const raw = useMemo(() => toBytes(b58), [b58]);
  const info = useMemo<Inspect | null>(() => {
    if (!raw) return null;
    try { return inspectRaw(raw); } catch { return null; }
  }, [raw]);

  const [signed, setSigned] = useState<Uint8Array | null>(null);
  const [after, setAfter] = useState<Inspect | null>(null);
  const [simText, setSimText] = useState("");
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState("");
  const [stage, setStage] = useState<"fetched" | "signed" | "sent" | "confirmed">("fetched");
  const [busy, setBusy] = useState(false);

  if (!info || !raw) {
    return <div className="rounded-xl border p-4 text-sm">Could not decode this transaction as base58 or base64.</div>;
  }

  const preSigned = info.slots.some((s) => s.filled && s.valid && s.pubkey !== me);
  const pct = Math.min(100, (info.bytes / LIMIT) * 100);
  const explorer = (s: string) => `https://solscan.io/tx/${s}${cluster === "devnet" ? "?cluster=devnet" : ""}`;

  async function onSign() {
    setBusy(true);
    try {
      const out = await signWithWallet(wallet, raw!, cluster, me);
      setSigned(out);
      setAfter(inspectRaw(out));
      setSimText("");
      setStage("signed");
      toast.success("signed in Phantom, nothing was sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "wallet signing failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSimulate() {
    setBusy(true);
    try {
      const r = await simulate(signed ?? raw!, cluster, !!signed);
      setSimText(
        r.err
          ? `Simulation failed. ${JSON.stringify(r.err)}\n${(r.logs ?? []).slice(-4).join("\n")}`
          : `Simulation passed, ${r.unitsConsumed ?? "unknown"} compute units used.`
      );
    } catch (e) {
      setSimText(`Simulation request failed. ${e instanceof Error ? e.message : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!signed) return;
    setBusy(true);
    try {
      const s = await sendRaw(signed, cluster);
      setSig(s);
      setStage("sent");
      await waitConfirmed(s, cluster);
      setStage("confirmed");
      toast.success("confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Transaction {index + 1} of {total}, before the wallet signs</h3>
        <span className="text-xs opacity-70">
          {info.version === "legacy" ? "legacy" : `v${info.version}`} · {info.accounts} accounts · {cluster}
        </span>
      </div>

      <div className={`rounded-lg px-3 py-2 text-sm ${preSigned ? "bg-emerald-500/15" : "bg-foreground/10"}`}>
        {preSigned
          ? "A valid signature from another key is already on this transaction. Who owns that key is not shown here."
          : "No pre-filled signature from another key. Built for you, not pre-signed."}
      </div>

      <Lanes info={info} me={me} tokenMint={tokenMint} />

      {after && (
        <>
          <p className="text-xs font-semibold uppercase opacity-60">After your wallet</p>
          <Lanes info={after} me={me} tokenMint={tokenMint} />
        </>
      )}

      <div>
        <div className="h-2 overflow-hidden rounded bg-foreground/10">
          <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs opacity-70">{info.bytes} of {LIMIT} bytes</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy || !!signed} onClick={onSign}>
          Sign in Phantom
        </button>
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={onSimulate}>
          Simulate
        </button>
      </div>

      {simText && <pre className="whitespace-pre-wrap rounded bg-foreground/10 p-2 text-xs">{simText}</pre>}

      {signed && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            Broadcast to {cluster}. This can spend real funds and cannot be undone.
          </label>
          <button
            className="rounded border px-3 py-2 text-sm disabled:opacity-40"
            disabled={busy || !agree || stage !== "signed"}
            onClick={onSend}
          >
            Send
          </button>
          <span className="text-xs opacity-70">status, {stage}</span>
        </div>
      )}

      {sig && (
        <a className="break-all text-xs underline" href={explorer(sig)} target="_blank" rel="noreferrer">
          {sig}
        </a>
      )}

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-foreground/10 px-2 py-1 text-xs">{b58}</code>
        <button
          className="rounded border px-2 py-1 text-xs"
          onClick={() => { navigator.clipboard.writeText(b58); toast.success("copied raw transaction"); }}
        >
          Copy raw
        </button>
      </div>
    </div>
  );
}

export function TxProof({ txs, me, tokenMint, cluster = "mainnet" }: {
  txs: string[]; me?: string; tokenMint?: string; cluster?: Cluster;
}) {
  if (!txs.length) return null;
  return (
    <div className="grid gap-4">
      {txs.map((t, i) => (
        <Card key={t} b58={t} index={i} total={txs.length} me={me} tokenMint={tokenMint} cluster={cluster} />
      ))}
    </div>
  );
}