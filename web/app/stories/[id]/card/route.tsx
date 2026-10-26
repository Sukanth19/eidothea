import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardFonts, publicStory, StoryCard } from "@/lib/cards";

/** The 1080×1920 image people post to their Instagram/Snapchat story. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const story = await publicStory((await params).id);
  if (!story) return new Response("Not found", { status: 404 });
  // The address people type in after seeing the card, as they reached the site
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "eidothea";
  return new ImageResponse(<StoryCard story={story} host={host} />, {
    width: 1080,
    height: 1920,
    fonts: await cardFonts(),
    headers: { "cache-control": "public, max-age=600" },
  });
}
