import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const res = await fetch(`${API_URL}/api/stories/random`, { cache: "no-store" });
  if (!res.ok) return NextResponse.redirect(new URL("/stories", request.url));
  const { id } = (await res.json()) as { id: number };
  return NextResponse.redirect(new URL(`/stories/${id}`, request.url));
}
