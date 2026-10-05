export type InspectResult = {
    ok: boolean;
    label?: string;
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

export async function bags(body: Body): Promise<InspectResult> {
    const form = new FormData();
    form.set("name", body.name || "Inspect Only");
    form.set("symbol", body.symbol || "INSP");
    form.set("description", "Inspection only. Do not launch.");
    if (body.imageUrl) form.set("imageUrl", body.imageUrl);

    const res = await fetch("https://public-api-v2.bags.fm/api/v1/token-launch/create-token-info", {
        method: "POST",
        headers: { "x-api-key": "bags_prod_iciJDmcuPJn--Uyv_wDnSJT1U5et_sG_UEJEFHoeK8w" },
        body: form,
    });
    const json = await res.json();

    console.log(json)
    if (!res.ok || json.success === false) return fail("bags token-info failed", { json });
    return ok("Bags token info", "prep", [], { info: json.response || json });
}

export async function bagsLaunch(body: Body): Promise<InspectResult> {
  if (!body.configKey || !body.tokenMint || !body.wallet || !body.ipfs) {
    return fail("needs wallet, tokenMint, ipfs, configKey");
  }
  const res = await fetch("https://public-api-v2.bags.fm/api/v1/token-launch/create-launch-transaction", {
    method: "POST",
    headers: { "x-api-key": process.env.BAGS_API_KEY!, "content-type": "application/json" },
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
    json: {
      status: res.status,
      trace: res.headers.get("x-trace-id"),
      response: json,
    },
  });
}
  return ok("Bags launch", "B-candidate", [raw], {
    note: "Docs say already signed with token mint. Read the slot table. Do not send.",
  });
}

export async function jupiter(body: Body): Promise<InspectResult> {
    const headers = { "x-api-key": process.env.JUPITER_API_KEY || "" };
    const q = new URLSearchParams({
        inputMint: SOL,
        outputMint: USDC,
        amount: body.amount || "100000000",
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
    const q = new URLSearchParams({
        inputMint: SOL,
        outputMint: USDC,
        amount: body.amount || "100000000",
        taker: body.wallet || "",
    });
    const json = await fetch("https://api.jup.ag/ultra/v1/order?" + q, {
        headers: { "x-api-key": process.env.JUPITER_API_KEY || "" },
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
        amount: body.amount || "100000000",
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

export async function tensor(body: Body): Promise<InspectResult> {
    if (!body.mint || !body.owner || !body.maxPrice || !body.blockhash) {
        return fail("needs mint, owner, maxPrice, blockhash of a live listing");
    }
    const q = new URLSearchParams({
        buyer: body.wallet || "",
        mint: body.mint,
        owner: body.owner,
        maxPrice: body.maxPrice,
        blockhash: body.blockhash,
    });
    const json = await fetch("https://api.mainnet.tensordev.io/api/v1/tx/buy?" + q, {
        headers: { "x-tensor-api-key": process.env.TENSOR_API_KEY || "" },
    }).then((r) => r.json());
    const txs = (json.txs || []).map((t: { tx?: string; txV0?: string }) => t.tx || t.txV0).filter(Boolean) as string[];
    if (!txs.length) return fail("tensor buy failed", { json });
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

export async function kora(body: Body): Promise<InspectResult> {
    if (!body.signedTx) return fail("user must sign first, then post signedTx");
    if (!process.env.KORA_URL) return fail("set KORA_URL");
    const json = await fetch(process.env.KORA_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "signTransaction",
            params: { transaction: body.signedTx },
        }),
    }).then((r) => r.json());
    const signed = json.result?.signed_transaction as string | undefined;
    if (!signed) return fail("kora did not sign", { json });
    return ok("Kora fee payer", "B-after-user", [signed], { signer: json.result.signer_pubkey });
}

export async function feePayer(): Promise<InspectResult> {
    return fail("Devnet control. partialSign a memo with FEE_PAYER_SECRET on the server. Do not use a mainnet key.");
}
export async function candymachine(): Promise<InspectResult> {
    return fail("Needs your devnet Candy Machine and third-party signer. Not a public API.");
}
export async function okx(body: Body): Promise<InspectResult> {
    return fail("Needs OKX API credentials.", { info: { wallet: body.wallet } });
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
    kora,
    "fee-payer": feePayer,
    candymachine,
    okx,
};