import { NextResponse } from "next/server";
import { feePayer } from "@/app/lib/handlers";

export async function POST() {
  return NextResponse.json(await feePayer());
}
