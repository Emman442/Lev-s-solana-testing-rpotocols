import { NextResponse } from "next/server";
import { candymachine } from "@/app/lib/handlers";

export async function POST() {
  return NextResponse.json(await candymachine());
}