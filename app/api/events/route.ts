import { NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: getRecentEvents() });
}
