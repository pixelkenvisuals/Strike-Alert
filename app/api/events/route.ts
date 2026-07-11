import { NextRequest, NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/db";
import type { Category } from "@/lib/sources/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: Category[] = ["strike", "construction"];

export async function GET(request: NextRequest) {
  const categoryParam = request.nextUrl.searchParams.get("category") ?? "strike";
  if (!(VALID_CATEGORIES as string[]).includes(categoryParam)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  return NextResponse.json({ events: await getRecentEvents(categoryParam as Category) });
}
