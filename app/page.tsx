"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useWallet } from "./lib/wallet/context";
import { GridBackground } from "./components/grid-background";
import { ThemeToggle } from "./components/theme-toggle";
import { WalletButton } from "./components/wallet-button";
import { TxProof } from "./components/tx-proof";

type Cluster = "devnet" | "mainnet-beta";

const OTHER = [
  { id: "jupiter", label: "Jupiter", needsWallet: true },
  { id: "jupiter-order", label: "Jupiter Ultra", needsWallet: true },
  { id: "raydium", label: "Raydium", needsWallet: true },
  // { id: "dflow", label: "DFlow", needsWallet: true },
  { id: "candymachine", label: "Candy Machine (devnet only)", needsWallet: true },
  { id: "metaplex", label: "Metaplex Genesis", needsWallet: true },
  { id: "solana-pay-mint", label: "Solana Pay mint", needsWallet: true },
] as const;

type ApiJson = {
  ok?: boolean;
  error?: string;
  label?: string;
  cluster?: string;
  txs?: string[];
  configKey?: string;
  info?: { tokenMint?: string; tokenMetadata?: string };
};

export default function Home() {
  const { wallet } = useWallet();
  const address = wallet?.account.address;

  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [txs, setTxs] = useState<string[]>([]);
  const [proofLabel, setProofLabel] = useState("");
  const [proofCluster, setProofCluster] = useState<"devnet" | "mainnet">("mainnet");
  const [cluster, setCluster] = useState<Cluster>("devnet");

  const [name, setName] = useState("Inspect Only");
  const [symbol, setSymbol] = useState("INSP");
  const [description, setDescription] = useState("Inspection only. Do not launch.");
  const [image, setImage] = useState<File | null>(null);

  const [tokenMint, setTokenMint] = useState("");
  const [ipfs, setIpfs] = useState("");
  const [configKey, setConfigKey] = useState("");

  const [tQuery, setTQuery] = useState("");
  const [tColl, setTColl] = useState("");
  const [tMint, setTMint] = useState("");
  const [tOwner, setTOwner] = useState("");
  const [tMax, setTMax] = useState("");

  function show(json: ApiJson) {
    setResult(json);
    setTxs(json.txs ?? []);
    setProofLabel(json.label || "");
    setProofCluster(json.cluster === "devnet" ? "devnet" : "mainnet");
    if (json.info?.tokenMint) setTokenMint(json.info.tokenMint);
    if (json.info?.tokenMetadata) setIpfs(json.info.tokenMetadata);
    if (json.configKey) setConfigKey(json.configKey);
    if (!json.ok) toast.error(json.error || "failed");
    else toast.success(`${json.label || "ok"}, ${(json.txs || []).length} tx, not sent`);
  }

  async function post(path: string, body: unknown, id: string) {
    setBusy(id);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!json) {
        toast.error(`route returned ${res.status} with no JSON`);
        return;
      }
      show(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  async function createInfo() {
    if (!image) return toast.error("Pick an image file");
    setBusy("bags");
    const form = new FormData();
    form.set("name", name);
    form.set("symbol", symbol);
    form.set("description", description);
    form.set("image", image);
    try {
      const json = await fetch("/api/bags", { method: "POST", body: form }).then((r) => r.json());
      show(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  const buildConfig = () => {
    if (!address) return toast.error("Connect wallet");
    if (!tokenMint) return toast.error("Create token info first");
    return post("/api/bags-config", { wallet: address, tokenMint }, "bags-config");
  };

  const buildLaunch = () => {
    if (!address) return toast.error("Connect wallet");
    return post("/api/bags-launch", { wallet: address, tokenMint, ipfs, configKey }, "bags-launch");
  };

  const run = (id: string) => post(`/api/${id}`, { wallet: address }, id);

  const browseCollections = () => post("/api/tensor-listings", {}, "tensor-find");
  const findCollections = () => post("/api/tensor-listings", { query: tQuery }, "tensor-find");
  const findListings = () => post("/api/tensor-listings", { collId: tColl }, "tensor-find");
  const buildTensor = () => {
    if (!address) return toast.error("Connect wallet");
    return post("/api/tensor", { wallet: address, mint: tMint, owner: tOwner, maxPrice: tMax }, "tensor");
  };

  const input = "rounded border px-3 py-2 text-sm";
  const btn = "w-fit rounded border px-3 py-2 text-sm disabled:opacity-40";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GridBackground />
      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">Lev tx inspect</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <WalletButton />
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-2">
          {/* Left column */}
          <div className="grid content-start gap-8">
            <p className="text-sm text-amber-500">
              Builds and inspects transactions. Nothing is broadcast unless you sign and tick the send box on a card.
            </p>

            <section className="grid gap-2">
              <h2 className="text-sm font-semibold">1. Bags token info</h2>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
              <input className={input} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="symbol" />
              <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setImage(e.target.files?.[0] || null)} />
              <button className={btn} disabled={busy !== null} onClick={createInfo}>
                {busy === "bags" ? "…" : "Create token info"}
              </button>
              {tokenMint && <p className="break-all text-xs opacity-70">mint {tokenMint}</p>}
            </section>

            <section className="grid gap-2">
              <h2 className="text-sm font-semibold">2. Bags fee-share config</h2>
              <p className="text-xs text-amber-500">Builds a mainnet transaction. The config key is filled in for you.</p>
              <button className={btn} disabled={busy !== null || !address || !tokenMint} onClick={buildConfig}>
                {busy === "bags-config" ? "…" : "Build config tx"}
              </button>
              {configKey && <p className="break-all text-xs opacity-70">config key {configKey}</p>}
            </section>

            <section className="grid gap-2">
              <h2 className="text-sm font-semibold">3. Bags launch plan</h2>
              <input className={input} value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} placeholder="tokenMint from step 1" />
              <input className={input} value={ipfs} onChange={(e) => setIpfs(e.target.value)} placeholder="metadata url from step 1" />
              <input className={input} value={configKey} onChange={(e) => setConfigKey(e.target.value)} placeholder="config key from step 2" />
              <button className={btn} disabled={busy !== null || !address || !tokenMint || !ipfs || !configKey} onClick={buildLaunch}>
                {busy === "bags-launch" ? "…" : "Build launch tx"}
              </button>
            </section>

            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm font-semibold">Other methods</summary>

              <label className="mt-3 flex items-center gap-2 text-xs">
                Network for Metaplex Genesis
                <select
                  className="rounded border bg-background px-2 py-1"
                  value={cluster}
                  onChange={(e) => {
                    setCluster(e.target.value as Cluster);
                    setTxs([]);
                  }}
                >
                  <option value="devnet">devnet</option>
                  <option value="mainnet-beta">mainnet</option>
                </select>
              </label>
              <p className="mt-1 text-xs opacity-70">
                Candy Machine and Solana Pay mint always build on devnet. Jupiter and Raydium always build on mainnet.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {OTHER.map((m) => (
                  <button
                    key={m.id}
                    className={btn}
                    disabled={busy !== null || (m.needsWallet && !address)}
                    onClick={() => run(m.id)}
                  >
                    {busy === m.id ? "…" : m.label}
                  </button>
                ))}
              </div>
            </details>

            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm font-semibold">Tensor buy</summary>
              <div className="mt-3 grid gap-2">
                <p className="text-xs opacity-70">
                  Browse or search a collection, copy its id, list the cheapest listings, then copy one listing's mint, owner and price below.
                </p>
                <button className={btn} disabled={busy !== null} onClick={browseCollections}>
                  Browse most-listed collections
                </button>
                <input className={input} value={tQuery} onChange={(e) => setTQuery(e.target.value)} placeholder="collection name to search" />
                <button className={btn} disabled={busy !== null || !tQuery} onClick={findCollections}>Search collections</button>
                <input className={input} value={tColl} onChange={(e) => setTColl(e.target.value)} placeholder="collection id from the result" />
                <button className={btn} disabled={busy !== null || !tColl} onClick={findListings}>Show cheapest listings</button>

                <input className={input} value={tMint} onChange={(e) => setTMint(e.target.value)} placeholder="NFT mint" />
                <input className={input} value={tOwner} onChange={(e) => setTOwner(e.target.value)} placeholder="current owner, the seller" />
                <input className={input} value={tMax} onChange={(e) => setTMax(e.target.value)} placeholder="max price" />
                <button
                  className={btn}
                  disabled={busy !== null || !address || !tMint || !tOwner || !tMax}
                  onClick={buildTensor}
                >
                  {busy === "tensor" ? "…" : "Build Tensor buy"}
                </button>
              </div>
            </details>
          </div>

          {/* Right column, the proof panel */}
          <div className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold">
              Proof{proofLabel ? `, ${proofLabel}` : ""}{txs.length ? ` · ${proofCluster}` : ""}
            </h2>
            {txs.length ? (
              <TxProof txs={txs} me={address} tokenMint={tokenMint} cluster={proofCluster} />
            ) : (
              <p className="rounded border border-dashed p-4 text-sm opacity-70">
                Build a transaction and its signature slots will show up here.
              </p>
            )}
            <details open={!txs.length && !!result}>
              <summary className="cursor-pointer text-xs opacity-70">raw response</summary>
              <pre className="mt-2 overflow-auto rounded border p-3 text-xs">
                {result ? JSON.stringify(result, null, 2) : "no result yet"}
              </pre>
            </details>
          </div>
        </main>
      </div>
    </div>
  );
}