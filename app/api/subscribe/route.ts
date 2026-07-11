import { NextRequest, NextResponse } from "next/server";
import { removeSubscription, saveSubscription } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function POST(request: NextRequest) {
  const subscription = (await request.json()) as PushSubscriptionBody;

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Missing subscription endpoint" }, { status: 400 });
  }

  await saveSubscription(JSON.stringify(subscription), subscription.endpoint);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { endpoint } = (await request.json()) as { endpoint: string };

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
