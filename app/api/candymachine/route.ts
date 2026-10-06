import { NextResponse } from "next/server";
import { candymachine } from "@/app/lib/handlers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await candymachine(body));
  } catch (e) {

    console.error("candy machine error", e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "candy machine failed",
    });
  }
}