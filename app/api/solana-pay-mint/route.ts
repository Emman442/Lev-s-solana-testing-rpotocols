import { NextResponse } from "next/server";
import { solanaPayMint } from "@/app/lib/handlers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await solanaPayMint(body));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" });
  }
}