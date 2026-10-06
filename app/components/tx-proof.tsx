"use client";

import { useMemo } from "react";
import bs58 from "bs58";
import { toast } from "sonner";
import { inspectRaw, type Inspect } from "../lib/inspect";

const LIMIT = 1232;
const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

function Card({ b58, index, total, me, tokenMint }: {
  b58: string; index: number; total: number; me?: string; tokenMint?: string;
}) {
  function toBytes(s: string): Uint8Array | null {
    const text = s.trim();
    // base64 uses + / = which base58 never contains
    const looksBase64 = /[+/=]/.test(text);
    if (!looksBase64) {
      try { return bs58.decode(text); } catch { }
    }
    try {
      const bin = atob(text);
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  }

  const info = useMemo<Inspect | null>(() => {
    const bytes = toBytes(b58);
    if (!bytes) return null;
    try { return inspectRaw(bytes); } catch { return null; }
  }, [b58]);

  if (!info) {
    <div className="rounded-xl border p-4 text-sm">Could not decode this transaction as base58 or base64.</div>
  }

  const preSigned = info?.slots.some((s) => s.filled && s.valid && s.pubkey !== me);
  const pct = Math.min(100, (info?.bytes / LIMIT) * 100);
  
  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Transaction {index + 1} of {total}, before the wallet signs</h3>
        <span className="text-xs opacity-70">
          {info?.version === "legacy" ? "legacy" : `v${info?.version}`} · {info?.accounts} accounts
        </span>
      </div>

      <div className={`rounded-lg px-3 py-2 text-sm ${preSigned ? "bg-emerald-500/15" : "bg-foreground/10"}`}>
        {preSigned
          ? "A valid signature from another key is already on this transaction. The project signed first."
          : "No pre-filled signature from another key. Built for you, not pre-signed."}
      </div>

      <div className="grid gap-2">
        {info?.slots.map((s, i) => {
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

      <div>
        <div className="h-2 overflow-hidden rounded bg-foreground/10">
          <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs opacity-70">{info?.bytes} of {LIMIT} bytes</p>
      </div>

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

export function TxProof({ txs, me, tokenMint }: { txs: string[]; me?: string; tokenMint?: string }) {
  if (!txs.length) return null;
  return (
    <div className="grid gap-4">
      {txs.map((t, i) => (
        <Card key={t} b58={t} index={i} total={txs.length} me={me} tokenMint={tokenMint} />
      ))}
    </div>
  );
}