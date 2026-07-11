import { NextResponse } from "next/server";
import { pollAllSources } from "@/lib/poll";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await pollAllSources();
  return NextResponse.json(result);
}
