import { NextRequest, NextResponse } from "next/server";
import { addSubscriptionCategory, getSubscriptionCategories, removeSubscriptionCategory } from "@/lib/db";
import type { Category } from "@/lib/sources/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: Category[] = ["strike", "construction"];

function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && (VALID_CATEGORIES as string[]).includes(value);
}

interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint query param" }, { status: 400 });
  }

  const categories = await getSubscriptionCategories(endpoint);
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { subscription: PushSubscriptionBody; category: string };

  if (!body?.subscription?.endpoint) {
    return NextResponse.json({ error: "Missing subscription endpoint" }, { status: 400 });
  }
  if (!isValidCategory(body.category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await addSubscriptionCategory(JSON.stringify(body.subscription), body.subscription.endpoint, body.category);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as { endpoint: string; category: string };

  if (!body?.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  if (!isValidCategory(body.category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await removeSubscriptionCategory(body.endpoint, body.category);
  return NextResponse.json({ ok: true });
}
