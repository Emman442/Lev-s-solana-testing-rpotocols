import { NextResponse } from "next/server";

function unwrap(input: string) {
  let s = input.trim();
  try {
    const a = new URL(s).searchParams.get("action");
    if (a) s = a;
  } catch {}
  return s.replace(/^solana-action:/, "");
}

export async function POST(req: Request) {
  const { actionUrl, wallet, href } = await req.json();
  const base = unwrap(String(actionUrl || ""));
  if (!base.startsWith("https://")) {
    return NextResponse.json({ ok: false, error: "need an https action url" });
  }

  if (!href) {
    const meta = await fetch(base, { headers: { accept: "application/json" } }).then((r) => r.json());
    return NextResponse.json({
      ok: true,
      label: "Blink actions",
      txs: [],
      actions: meta.links?.actions ?? [{ label: meta.label ?? "Run", href: base }],
    });
  }

  const target = new URL(href, base).toString();
  const res = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ account: wallet }),
  });
  const json = await res.json();
  if (!res.ok || typeof json.transaction !== "string") {
    return NextResponse.json({ ok: false, error: "blink did not return a transaction", status: res.status, json });
  }
  return NextResponse.json({ ok: true, label: "Blink", txs: [json.transaction], message: json.message });
}


