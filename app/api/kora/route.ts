import { NextResponse } from "next/server";
import { kora } from "@/app/lib/handlers";

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json(await kora(body));
}
