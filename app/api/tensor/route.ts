import { NextResponse } from "next/server";
import { tensor } from "@/app/lib/handlers";

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.wallet) return NextResponse.json({ ok: false, error: "wallet required" }, { status: 400 });
  return NextResponse.json(await tensor(body));
}