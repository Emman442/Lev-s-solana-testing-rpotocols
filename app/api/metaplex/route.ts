import { NextResponse } from "next/server";
import { metaplexGenesis } from "@/app/lib/handlers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await metaplexGenesis(body));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" });
  }
}