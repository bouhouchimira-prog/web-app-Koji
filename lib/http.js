import { NextResponse } from "next/server";

export function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function paywallRequired(message) {
  return NextResponse.json({ error: message, upgradeRequired: true }, { status: 402 });
}
