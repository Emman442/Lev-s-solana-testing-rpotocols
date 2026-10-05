import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const payer = String(body.wallet || "");
  const baseMint = String(body.tokenMint || "");

  console.log({ payer, baseMint, payerType: typeof body.wallet, mintType: typeof body.tokenMint });

  if (!payer || !baseMint) {
    return NextResponse.json({ ok: false, error: "wallet and tokenMint required" }, { status: 400 });
  }

  const payload = {
    payer,
    baseMint,
    claimersArray: [payer],
    basisPointsArray: [10000],
    bagsConfigType: "fa29606e-5e48-4c37-827f-4b03d58ee23d",
  };

  const res = await fetch("https://public-api-v2.bags.fm/api/v1/fee-share/config", {
    method: "POST",
    headers: {
      "x-api-key": "bags_prod_iciJDmcuPJn--Uyv_wDnSJT1U5et_sG_UEJEFHoeK8w",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  console.log(res)
  const json = await res.json();
const docUrl = res.headers.get("x-documentation-url");
const traceId = res.headers.get("x-trace-id");

console.log({ status: res.status, docUrl, traceId, json });

if (!res.ok || json.success === false) {
  return NextResponse.json(
    { ok: false, error: "config build failed", docUrl, traceId, json },
    { status: res.status }
  );
}
  const txs = (json.response?.transactions || [])
    .map((t: { transaction?: string }) => t.transaction)
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    label: "Bags fee-share config",
    configKey: json.response?.meteoraConfigKey,
    txs,
    note: "Sign and send these config txs. Do not send the later launch tx. These strings are base58.",
  });
}