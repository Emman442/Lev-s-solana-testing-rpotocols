import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const incoming = await req.formData();
  const image = incoming.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ ok: false, error: "image file required" }, { status: 400 });
  }

  const form = new FormData();
  form.set("name", String(incoming.get("name") || "Inspect Only"));
  form.set("symbol", String(incoming.get("symbol") || "INSP"));
  form.set("description", String(incoming.get("description") || "Inspection only. Do not launch."));
  form.set("image", image, image.name || "token.png");

  const res = await fetch("https://public-api-v2.bags.fm/api/v1/token-launch/create-token-info", {
    method: "POST",
    headers: { "x-api-key": "bags_prod_iciJDmcuPJn--Uyv_wDnSJT1U5et_sG_UEJEFHoeK8w" },
    body: form,
  });
  const json = await res.json();

  
  if (!res.ok || json.success === false) {
    return NextResponse.json({ ok: false, error: "bags token-info failed", json });
  }
  return NextResponse.json({
    ok: true,
    label: "Bags token info",
    pattern: "prep",
    doNotSend: true,
    txs: [],
    info: json.response || json,
  });
}