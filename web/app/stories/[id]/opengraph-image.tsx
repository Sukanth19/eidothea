import { ImageResponse } from "next/og";
import { cardFonts, LinkCard, publicStory } from "@/lib/cards";

// The preview shown when a story link is pasted into WhatsApp, Discord, iMessage…
export const alt = "A story from the Eidothea archive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const story = await publicStory((await params).id);
  if (!story) return new Response("Not found", { status: 404 });
  return new ImageResponse(<LinkCard story={story} />, { ...size, fonts: await cardFonts() });
}
