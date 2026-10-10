import { VersionedTransaction } from "@solana/web3.js";

export type Cluster = "devnet" | "mainnet";

const rpcUrl = (c: Cluster) =>
  c === "devnet"
    ? "https://api.devnet.solana.com"
    : process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

async function rpc(cluster: Cluster, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl(cluster), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const toB64 = (raw: Uint8Array) => btoa(String.fromCharCode(...raw));

function getPhantom(): any | null {
  const w = window as any;
  const p = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
  return p?.isPhantom ? p : null;
}

export async function signWithWallet(
  wallet: any,
  raw: Uint8Array,
  cluster: Cluster,
  expectedAddress?: string
): Promise<Uint8Array> {
  // 1) wallet-standard signing, if your wallet context exposes it
  const feature = wallet?.features?.["solana:signTransaction"];
  if (feature && wallet?.account) {
    const [out] = await feature.signTransaction({
      account: wallet.account,
      transaction: raw,
      chain: cluster === "devnet" ? "solana:devnet" : "solana:mainnet",
    });
    return out.signedTransaction;
  }

  // 2) Phantom's injected provider
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom extension not found. Install it and reload the page.");
  if (!phantom.publicKey) {
    try { await phantom.connect({ onlyIfTrusted: true }); } catch { await phantom.connect(); }
  }
  const active: string | undefined = phantom.publicKey?.toBase58();
  if (expectedAddress && active && active !== expectedAddress) {
    throw new Error(`Phantom's active account ${active.slice(0, 4)}…${active.slice(-4)} is not the connected wallet. Switch accounts in Phantom.`);
  }
  const signed = await phantom.signTransaction(VersionedTransaction.deserialize(raw));
  return signed.serialize();
}

export async function simulate(raw: Uint8Array, cluster: Cluster, sigVerify: boolean) {
  const r = await rpc(cluster, "simulateTransaction", [
    toB64(raw),
    { encoding: "base64", sigVerify, commitment: "confirmed" },
  ]);
  return r.value as { err: unknown; logs: string[] | null; unitsConsumed?: number };
}

export async function sendRaw(signed: Uint8Array, cluster: Cluster): Promise<string> {
  return rpc(cluster, "sendTransaction", [
    toB64(signed),
    { encoding: "base64", preflightCommitment: "confirmed" },
  ]);
}

export async function waitConfirmed(sig: string, cluster: Cluster, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const r = await rpc(cluster, "getSignatureStatuses", [[sig], { searchTransactionHistory: true }]);
    const s = r?.value?.[0];
    if (s?.err) throw new Error(JSON.stringify(s.err));
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      return s.confirmationStatus as string;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error("not confirmed yet, check the explorer");
}