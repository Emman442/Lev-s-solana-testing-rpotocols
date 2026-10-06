"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useWallet } from "./lib/wallet/context";
import { GridBackground } from "./components/grid-background";
import { ThemeToggle } from "./components/theme-toggle";
import { ClusterSelect } from "./components/cluster-select";
import { WalletButton } from "./components/wallet-button";
import { TxProof } from "./components/tx-proof";

const OTHER = [
  { id: "jupiter", label: "Jupiter", needsWallet: true },
  { id: "jupiter-order", label: "Jupiter Ultra", needsWallet: true },
  { id: "raydium", label: "Raydium", needsWallet: true },
  { id: "dflow", label: "DFlow", needsWallet: true },
  { id: "tensor", label: "Tensor", needsWallet: true },
  { id: "magiceden", label: "Magic Eden", needsWallet: true },
  { id: "fee-payer", label: "Fee payer", needsWallet: false },
  { id: "candymachine", label: "Candy Machine", needsWallet: false },
] as const;

type ApiJson = {
  ok?: boolean;
  error?: string;
  label?: string;
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

  const [name, setName] = useState("Inspect Only");
  const [symbol, setSymbol] = useState("INSP");
  const [description, setDescription] = useState("Inspection only. Do not launch.");
  const [image, setImage] = useState<File | null>(null);

  const [tokenMint, setTokenMint] = useState("");
  const [ipfs, setIpfs] = useState("");
  const [configKey, setConfigKey] = useState("");

  function show(json: ApiJson) {
    setResult(json);
    setTxs(json.txs ?? []);
    setProofLabel(json.label || "");
    if (json.info?.tokenMint) setTokenMint(json.info.tokenMint);
    if (json.info?.tokenMetadata) setIpfs(json.info.tokenMetadata);
    if (json.configKey) setConfigKey(json.configKey);
    if (!json.ok) toast.error(json.error || "failed");
    else toast.success(`${json.label || "ok"}, ${(json.txs || []).length} tx, not sent`);
  }

  async function post(path: string, body: unknown, id: string) {
    setBusy(id);
    try {
      const json = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
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
            {/* <ClusterSelect /> */}
            <WalletButton />
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-2">
          {/* Left column, the Bags flow */}
          <div className="grid content-start gap-8">
            <p className="text-sm text-amber-500">Fetch and inspect only. Nothing on this page broadcasts a transaction.</p>

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
          </div>

          {/* Right column, the proof panel */}
          <div className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold">
              Proof{proofLabel ? `, ${proofLabel}` : ""}
            </h2>
            {txs.length ? (
              <TxProof txs={txs} me={address} tokenMint={tokenMint} />
            ) : (
              <p className="rounded border border-dashed p-4 text-sm opacity-70">
                Build a transaction and its signature slots will show up here.
              </p>
            )}
            <details>
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

































// "use client";

// import { useState } from "react";
// import { toast } from "sonner";
// import { useWallet } from "./lib/wallet/context";
// import { GridBackground } from "./components/grid-background";
// import { ThemeToggle } from "./components/theme-toggle";
// import { ClusterSelect } from "./components/cluster-select";
// import { WalletButton } from "./components/wallet-button";

// const OTHER = [
//   { id: "jupiter", label: "Jupiter", needsWallet: true },
//   { id: "jupiter-order", label: "Jupiter Ultra", needsWallet: true },
//   { id: "raydium", label: "Raydium", needsWallet: true },
//   { id: "dflow", label: "DFlow", needsWallet: true },
//   { id: "tensor", label: "Tensor", needsWallet: true },
//   { id: "magiceden", label: "Magic Eden", needsWallet: true },
//   { id: "kora", label: "Kora", needsWallet: false },
//   { id: "fee-payer", label: "Fee payer", needsWallet: false },
//   { id: "candymachine", label: "Candy Machine", needsWallet: false },
//   { id: "okx", label: "OKX", needsWallet: false },
// ] as const;

// export default function Home() {
//   const { wallet } = useWallet();
//   const address = wallet?.account.address;

//   const [busy, setBusy] = useState<string | null>(null);
//   const [result, setResult] = useState<unknown>(null);

//   const [name, setName] = useState("Inspect Only");
//   const [symbol, setSymbol] = useState("INSP");
//   const [description, setDescription] = useState("Inspection only. Do not launch.");
//   const [image, setImage] = useState<File | null>(null);

//   const [tokenMint, setTokenMint] = useState("");
//   const [ipfs, setIpfs] = useState("");
//   const [configKey, setConfigKey] = useState("");

//   function show(json: { ok?: boolean; error?: string; label?: string; txs?: string[]; info?: { tokenMint?: string; tokenMetadata?: string } }) {
//     setResult(json);
//     if (json.info?.tokenMint) setTokenMint(json.info.tokenMint);
//     if (json.info?.tokenMetadata) setIpfs(json.info.tokenMetadata);
//     if (!json.ok) toast.error(json.error || "failed");
//     else toast.success(`${json.label || "ok"}: ${(json.txs || []).length} tx, not sent`);
//   }

//   async function createInfo() {
//     if (!image) return toast.error("Pick an image file");
//     setBusy("bags");
//     const form = new FormData();
//     form.set("name", name);
//     form.set("symbol", symbol);
//     form.set("description", description);
//     form.set("image", image);
//     try {
//       const json = await fetch("/api/bags", { method: "POST", body: form }).then((r) => r.json());
//       show(json);
//     } finally {
//       setBusy(null);
//     }
//   }

//   async function buildLaunch() {
//     if (!address) return toast.error("Connect wallet");
//     setBusy("bags-launch");
//     try {
//       const json = await fetch("/api/bags-launch", {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ wallet: address, tokenMint, ipfs, configKey }),
//       }).then((r) => r.json());
//       show(json);
//     } finally {
//       setBusy(null);
//     }
//   }

//   async function run(id: string) {
//     setBusy(id);
//     try {
//       const json = await fetch(`/api/${id}`, {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ wallet: address }),
//       }).then((r) => r.json());
//       show(json);
//     } finally {
//       setBusy(null);
//     }
//   }

//   async function buildConfig() {
//   if (!address) return toast.error("Connect wallet");
//   if (!tokenMint) return toast.error("Create token info first");
//   setBusy("bags-config");
//   try {
//     const json = await fetch("/api/bags-config", {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify({ wallet: address, tokenMint }),
//     }).then((r) => r.json());
//     if (json.configKey) setConfigKey(json.configKey);
//     show(json);
//   } finally {
//     setBusy(null);
//   }
// }

//   return (
//     <div className="relative min-h-screen bg-background text-foreground">
//       <GridBackground />
//       <div className="relative z-10">
//         <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
//           <span className="text-sm font-semibold tracking-tight">Lev tx inspect</span>
//           <div className="flex items-center gap-3">
//             <ThemeToggle />
//             <ClusterSelect />
//             <WalletButton />
//           </div>
//         </header>

//         <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8">
//           <p className="text-sm text-amber-500">Fetch and inspect only. Do not broadcast a Bags launch.</p>

//           <section className="grid gap-2">
//             <h2 className="text-sm font-semibold">1. Bags token info</h2>
//             <input className="rounded border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="name" />
//             <input className="rounded border px-3 py-2 text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="symbol" />
//             <input className="rounded border px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" />
//             <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setImage(e.target.files?.[0] || null)} />
//             <button className="w-fit rounded border px-3 py-2 text-sm" disabled={busy !== null} onClick={createInfo}>
//               {busy === "bags" ? "…" : "Create token info"}
//             </button>
//           </section>


//           <section className="grid gap-2">
//             <h2 className="text-sm font-semibold">2. Bags fee-share config</h2>
//             <p className="text-sm text-amber-500">
//               This builds a mainnet transaction. Signing and sending it spends SOL. It does not launch the token.
//             </p>
//             <button className="w-fit rounded border px-3 py-2 text-sm" disabled={busy !== null || !address} onClick={buildConfig}>
//               {busy === "bags-config" ? "…" : "Build config tx"}
//             </button>
//           </section>

//           <section className="grid gap-2">
//             <h2 className="text-sm font-semibold">2. Bags launch plan</h2>
//             <input className="rounded border px-3 py-2 text-sm" value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} placeholder="tokenMint from step 1" />
//             <input className="rounded border px-3 py-2 text-sm" value={ipfs} onChange={(e) => setIpfs(e.target.value)} placeholder="metadata url from step 1" />
//             <input className="rounded border px-3 py-2 text-sm" value={configKey} onChange={(e) => setConfigKey(e.target.value)} placeholder="configKey, only if you already have one" />
//             <button className="w-fit rounded border px-3 py-2 text-sm" disabled={busy !== null || !address} onClick={buildLaunch}>
//               {busy === "bags-launch" ? "…" : "Build launch tx, do not send"}
//             </button>
//           </section>

//           <section className="flex flex-wrap gap-2">
//             {OTHER.map((m) => (
//               <button key={m.id} className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy !== null || (m.needsWallet && !address)} onClick={() => run(m.id)}>
//                 {busy === m.id ? "…" : m.label}
//               </button>
//             ))}
//           </section>

//           <pre className="overflow-auto rounded border p-3 text-xs">{result ? JSON.stringify(result, null, 2) : "no result yet"}</pre>
//         </main>
//       </div>
//     </div>
//   );
// }