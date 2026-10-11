import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCandyMachine, mintV1 } from "@metaplex-foundation/mpl-core-candy-machine";
import { mplCore } from "@metaplex-foundation/mpl-core";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import {
  createNoopSigner, createSignerFromKeypair, generateSigner,
  publicKey, signerIdentity, some, transactionBuilder,
} from "@metaplex-foundation/umi";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import {
  createLaunch,
  genesis,
  isGenesisApiError,
  isGenesisApiNetworkError,
  isGenesisValidationError,
  type CreateLaunchInput,
} from "@metaplex-foundation/genesis";

type Cluster = "devnet" | "mainnet-beta";

const RPC = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": process.env.SOLANA_RPC_MAINNET || "https://api.mainnet-beta.solana.com",
} as const;

export type InspectResult = {
  ok: boolean;
  label?: string;
  cluster?: Cluster;
  pattern?: string;
  doNotSend?: boolean;
  txs?: string[];
  note?: string;
  error?: string;
  info?: unknown;
  json?: unknown;
  signer?: string;
};

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

type Body = Record<string, string | undefined>;

function ok(label: string, pattern: string, txs: string[], extra: Partial<InspectResult> = {}): InspectResult {
  return { ok: true, label, pattern, doNotSend: true, txs, ...extra };
}
function fail(error: string, extra: Partial<InspectResult> = {}): InspectResult {
  return { ok: false, error, ...extra };
}
const missingKey = (name: string) => fail(`set ${name} in .env.local and restart the dev server`);

export async function bags(body: Body): Promise<InspectResult> {
  const key = "bags_prod_iciJDmcuPJn--Uyv_wDnSJT1U5et_sG_UEJEFHoeK8w";
  if (!key) return missingKey("BAGS_API_KEY");

  const form = new FormData();
  form.set("name", body.name || "Inspect Only");
  form.set("symbol", body.symbol || "INSP");
  form.set("description", "Inspection only. Do not launch.");
  if (body.imageUrl) form.set("imageUrl", body.imageUrl);

  const res = await fetch("https://public-api-v2.bags.fm/api/v1/token-launch/create-token-info", {
    method: "POST",
    headers: { "x-api-key": key },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || json.success === false) return fail("bags token-info failed", { json });
  return ok("Bags token info", "prep", [], { info: json.response || json });
}

export async function bagsLaunch(body: Body): Promise<InspectResult> {
  const key = "bags_prod_iciJDmcuPJn--Uyv_wDnSJT1U5et_sG_UEJEFHoeK8w"
  if (!body.configKey || !body.tokenMint || !body.wallet || !body.ipfs) {
    return fail("needs wallet, tokenMint, ipfs, configKey");
  }
  const res = await fetch("https://public-api-v2.bags.fm/api/v1/token-launch/create-launch-transaction", {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      ipfs: body.ipfs,
      tokenMint: body.tokenMint,
      wallet: body.wallet,
      initialBuyLamports: 0,
      configKey: body.configKey,
    }),
  });
  const json = await res.json();
  const raw = json.response;
  if (!res.ok || typeof raw !== "string") {
    return fail("bags launch failed", {
      json: { status: res.status, trace: res.headers.get("x-trace-id"), response: json },
    });
  }
  return ok("Bags launch", "B-candidate", [raw], {
    note: "Docs say already signed with token mint. Read the slot table. Do not send.",
  });
}

export async function jupiter(body: Body): Promise<InspectResult> {
  const key = process.env.JUPITER_API_KEY;
  if (!key) return missingKey("JUPITER_API_KEY");

  const headers = { "x-api-key": key };
  const q = new URLSearchParams({
    inputMint: SOL,
    outputMint: USDC,
    amount: body.amount || "1000000",
    slippageBps: "50",
  });
  const quote = await fetch("https://api.jup.ag/swap/v1/quote?" + q, { headers }).then((r) => r.json());
  const swap = await fetch("https://api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: body.wallet,
      dynamicComputeUnitLimit: true,
    }),
  }).then((r) => r.json());
  if (!swap.swapTransaction) return fail("jupiter swap failed", { json: { quote, swap } });
  return ok("Jupiter swap", "A", [swap.swapTransaction]);
}

export async function jupiterOrder(body: Body): Promise<InspectResult> {
  const key = "jup_57a58fb7d360e993811ac6e59023b81b808eb904e3afa76b47fb7ee5a9d1fc20"

  const q = new URLSearchParams({
    inputMint: SOL,
    outputMint: USDC,
    amount: body.amount || "1000000",
    taker: body.wallet || "",
  });
  const json = await fetch("https://api.jup.ag/ultra/v1/order?" + q, {
    headers: { "x-api-key": key },
  }).then((r) => r.json());
  if (!json.transaction) return fail("jupiter ultra order failed", { json });
  return ok("Jupiter Ultra order", "A + execute signer", [json.transaction], {
    note: "User signs this. /execute can add another signer. This route does not call execute.",
  });
}

export async function raydium(body: Body): Promise<InspectResult> {
  const q = new URLSearchParams({
    inputMint: SOL,
    outputMint: USDC,
    amount: body.amount || "1000000",
    slippageBps: "50",
    txVersion: "V0",
  });
  const quote = await fetch("https://transaction-v1.raydium.io/compute/swap-base-in?" + q).then((r) => r.json());
  const built = await fetch("https://transaction-v1.raydium.io/transaction/swap-base-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      swapResponse: quote,
      wallet: body.wallet,
      txVersion: "V0",
      wrapSol: true,
      unwrapSol: false,
      computeUnitPriceMicroLamports: "50000",
    }),
  }).then((r) => r.json());
  const txs = (built.data || []).map((d: { transaction?: string }) => d.transaction).filter(Boolean) as string[];
  if (!txs.length) return fail("raydium failed", { json: { quote, built } });
  return ok("Raydium swap", "A", txs);
}

export async function dflow(body: Body): Promise<InspectResult> {
  const q = new URLSearchParams({
    inputMint: SOL,
    outputMint: USDC,
    amount: body.amount || "100000000",
    slippageBps: "50",
    userPublicKey: body.wallet || "",
    transactionVersion: "v0",
  });
  if (body.maxTransactionSize) q.set("maxTransactionSize", body.maxTransactionSize);
  const json = await fetch("https://quote-api.dflow.net/order?" + q, {
    headers: process.env.DFLOW_API_KEY ? { "x-api-key": process.env.DFLOW_API_KEY } : {},
  }).then((r) => r.json());
  if (!json.transaction) return fail("dflow order failed", { json });
  return ok("DFlow order", "A", [json.transaction]);
}

async function latestBlockhash(url: string): Promise<string | undefined> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "confirmed" }] }),
  }).then((x) => x.json());
  return r?.result?.value?.blockhash;
}

function txToB64(t: unknown): string | null {
  if (typeof t === "string") return t;
  const data = (t as { data?: number[] } | null)?.data;
  return Array.isArray(data) ? Buffer.from(data).toString("base64") : null;
}

export async function tensor(body: Body): Promise<InspectResult> {
  const key = "89fecaad-af57-4d3e-9d03-e822507aa93a";
  if (!body.wallet) return fail("connect wallet first");
  if (!body.mint || !body.owner || !body.maxPrice) {
    return fail("needs mint, owner and maxPrice of a live Tensor listing");
  }

  const blockhash = body.blockhash || (await latestBlockhash(RPC["mainnet-beta"]));
  if (!blockhash) return fail("could not fetch a recent blockhash");

  const q = new URLSearchParams({
    buyer: body.wallet, mint: body.mint, owner: body.owner, maxPrice: body.maxPrice, blockhash,
  });
  const res = await fetch("https://api.mainnet.tensordev.io/api/v1/tx/buy?" + q, {
    headers: { "x-tensor-api-key": key },
  });
  const json = await res.json().catch(() => null);
  const txs = ((json?.txs ?? []) as { tx?: unknown; txV0?: unknown }[])
    .map((t) => txToB64(t.txV0) || txToB64(t.tx))
    .filter(Boolean) as string[];
  if (!txs.length) return fail("tensor buy failed", { json: { status: res.status, response: json } });
  return ok("Tensor buy", "A", txs);
}

export async function magiceden(body: Body): Promise<InspectResult> {
  if (!body.mint || !body.price) return fail("needs mint and price");
  const q = new URLSearchParams({ buyer: body.wallet || "", tokenMint: body.mint, price: body.price });
  const json = await fetch("https://api-mainnet.magiceden.dev/v2/instructions/buy?" + q, {
    headers: process.env.MAGIC_EDEN_API_KEY
      ? { Authorization: "Bearer " + process.env.MAGIC_EDEN_API_KEY }
      : {},
  }).then((r) => r.json());
  const data: number[] | undefined = json.txSigned?.data || json.tx?.data;
  if (!data) return fail("magic eden did not return tx bytes", { json });
  return ok("Magic Eden buy", "check slots", [Buffer.from(data).toString("base64")]);
}

export async function feePayer(): Promise<InspectResult> {
  return fail("Devnet control. partialSign a memo with FEE_PAYER_SECRET on the server. Do not use a mainnet key.");
}

function readSecret(): Uint8Array {
  const raw = process.env.THIRD_PARTY_SECRET;
  if (!raw) throw new Error("THIRD_PARTY_SECRET is not set, check .env.local and restart dev");
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
  return Uint8Array.from(JSON.parse(cleaned));
}

export async function metaplexGenesis(body: Body): Promise<InspectResult> {
  if (!body.wallet) return fail("connect wallet first");

  try {
    const umi = createUmi(RPC["mainnet-beta"]).use(genesis());
    umi.use(signerIdentity(createNoopSigner(publicKey(body.wallet))));

    const input: CreateLaunchInput = {
      wallet: body.wallet,
      network: "solana-mainnet",
      token: {
        name: "Lev Inspect",
        symbol: "LEVI",
        image:
          process.env.GENESIS_IMAGE_URL ||
          "https://res.cloudinary.com/alchemy-website/image/upload/v1694675413/dapp-store/dapp-logos/Metaplex.jpg",
        description: "Inspection only, mainnet",
      },
      launchType: "launchpool",
      launch: {
        launchpool: {
          tokenAllocation: 500_000_000,
          depositStartTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          raiseGoal: 250,
          raydiumLiquidityBps: 5000,
          fundsRecipient: body.wallet,
        },
      },
    };

    const res = await createLaunch(umi, {}, input);
    const txs = res.transactions.map((tx) =>
      Buffer.from(umi.transactions.serialize(tx)).toString("base64")
    );
    return ok("Metaplex Genesis launch (mainnet-beta)", "unverified", txs, {
      cluster: "mainnet-beta",
      note: [
        `mint ${res.mintAddress}`,
        `genesis ${res.genesisAccount}`,
        `${txs.length} transactions, send in order`,
        "Mainnet build. Sending creates a real launch and spends SOL. Do not send unless Lev asks.",
      ].join(". "),
    });
  } catch (e) {
    if (isGenesisValidationError(e)) {
      return fail(`genesis rejected the input on "${e.field}", ${e.message}`);
    }
    if (isGenesisApiError(e)) {
      return fail(`genesis API error ${e.statusCode}`, { json: e.responseBody });
    }
    if (isGenesisApiNetworkError(e)) {
      return fail(`genesis network error, ${e.cause.message}`);
    }
    return fail(`genesis failed, ${e instanceof Error ? e.message : String(e)}`);
  }
}


export async function solanaPayMint(body: Body): Promise<InspectResult> {
  if (!body.wallet) return fail("connect wallet first");
  try {
    const user = new PublicKey(body.wallet);
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=36630f30-eb16-4b14-90bd-1de494fdddbd", "confirmed");
    const mint = Keypair.generate(); // used once, never stored

    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    const { blockhash } = await connection.getLatestBlockhash();

    const tx = new Transaction();
    tx.feePayer = user;
    tx.recentBlockhash = blockhash;
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: user,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint.publicKey, 0, user, user)
    );
    tx.partialSign(mint);

    const b64 = tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");
    return ok("Solana Pay style mint (mainnet)", "B", [b64], {
      cluster: "mainnet-beta",
      note: `reference build on mainnet. mint ${mint.publicKey.toBase58()}, key discarded after signing. Sending spends real SOL for rent and fees. Do not send unless Lev asks.`,
    });
  } catch (e) {
    return fail(`mint build failed, ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function candymachine(body: Body): Promise<InspectResult> {
  if (!body.wallet) return fail("connect wallet first");

  const missing = ["THIRD_PARTY_SECRET", "CM_ID", "CM_COLLECTION", "CM_GUARD"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) return fail(`missing env vars ${missing.join(", ")}`);

  try {
    const umi = createUmi(RPC.devnet).use(mplCore()).use(mplCandyMachine());
    umi.use(signerIdentity(createNoopSigner(publicKey(body.wallet))));

    const thirdParty = createSignerFromKeypair(
      umi,
      umi.eddsa.createKeypairFromSecretKey(readSecret())
    );
    const asset = generateSigner(umi);

    const txBuilder = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        mintV1(umi, {
          candyMachine: publicKey(process.env.CM_ID!),
          collection: publicKey(process.env.CM_COLLECTION!),
          candyGuard: publicKey(process.env.CM_GUARD!),
          asset,
          mintArgs: { thirdPartySigner: some({ signer: thirdParty }) },
        })
      )
      .setLatestBlockhash(umi);
    const tx = await txBuilder.buildAndSign(umi);

    const b64 = Buffer.from(umi.transactions.serialize(tx)).toString("base64");
    return ok("Candy Machine mint (devnet)", "B", [b64], {
      cluster: "devnet",
      note: `reference build. asset ${asset.publicKey}, third party signer ${thirdParty.publicKey}`,
    });
  } catch (e) {
    return fail(`candy machine build failed, ${e instanceof Error ? e.message : String(e)}`);
  }
}

export const handlers = {
  bags,
  "bags-launch": bagsLaunch,
  jupiter,
  "jupiter-order": jupiterOrder,
  raydium,
  dflow,
  tensor,
  magiceden,
  "fee-payer": feePayer,
  candymachine,
  metaplex: metaplexGenesis,
  "solana-pay-mint": solanaPayMint,
};
