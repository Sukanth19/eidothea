import QRCode from "qrcode";
import type { NextRequest } from "next/server";

/** QR code for the share panel on computers: scanning it opens the story on a phone, panel already open. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const svg = await QRCode.toString(`${proto}://${host}/stories/${id}?share=1`, {
    type: "svg",
    margin: 2,
    color: { dark: "#0a0b09", light: "#cdd6c4" },
  });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
