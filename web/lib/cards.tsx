// Share images for stories, drawn on the server with next/og (Satori: flexbox only,
// and every element with more than one child needs display: flex).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { plainText } from "./markup";
import type { Story } from "./types";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const C = {
  bg: "#0c0a0b",
  panel: "#141012",
  line: "#2f2629",
  text: "#ddd7d6",
  bone: "#e4dcd7",
  muted: "#898185",
  blood: "#c4493b",
  brass: "#b0927a",
  red: "#e0392b",
};

let fontsLoaded: Promise<{ name: string; data: Buffer; weight: 400; style: "normal" | "italic" }[]> | null = null;

export function cardFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  fontsLoaded ??= Promise.all(
    [
      ["Elite", "SpecialElite-Regular.ttf", "normal"],
      ["Fell", "IMFellEnglishSC-Regular.ttf", "normal"],
      ["Garamond", "EBGaramond-Regular.ttf", "normal"],
      ["Garamond", "EBGaramond-Italic.ttf", "italic"],
    ].map(async ([name, file, style]) => ({
      name,
      data: await readFile(join(dir, file)),
      weight: 400 as const,
      style: style as "normal" | "italic",
    })),
  );
  return fontsLoaded;
}

/** Published stories only: no cookie is forwarded, so drafts can't end up on a card. */
export async function publicStory(id: string): Promise<Story | null> {
  if (!/^\d+$/.test(id)) return null;
  const res = await fetch(`${API_URL}/api/stories/${id}`, { cache: "no-store" });
  return res.ok ? ((await res.json()) as Story) : null;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, flat.lastIndexOf(" ", max)).replace(/[,;:—-]$/, "") + "…";
}

function titleSize(title: string, sizes: [number, number, number]) {
  return title.length <= 28 ? sizes[0] : title.length <= 60 ? sizes[1] : sizes[2];
}

function RatingBar({ value, width }: { value: number; width: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ display: "flex", width, height: 12, background: C.line }}>
        <div style={{ width: `${value * 10}%`, height: "100%", background: C.brass }} />
      </div>
      <span style={{ fontFamily: "Fell", color: C.brass }}>{value.toFixed(1)} / 10</span>
    </div>
  );
}

/** 1080×1920 for Instagram/Snapchat stories. Top and bottom ~250px stay calm: the apps draw over them. */
export function StoryCard({ story, host }: { story: Story; host: string }) {
  const title = clip(story.title, 110);
  // Longer titles and a subtitle leave less room for the excerpt
  const budget = (title.length <= 28 ? 300 : title.length <= 60 ? 230 : 170) - (story.subtitle ? 50 : 0);
  const excerpt = clip(plainText(story.body), budget);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 0, background: `radial-gradient(ellipse at 30% 10%, #22141a 0%, ${C.bg} 65%)`, padding: "250px 90px 260px", color: C.text, fontFamily: "Garamond" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Fell", fontSize: 36, letterSpacing: 5 }}>
        <span style={{ color: C.red }}>RECOVERED FROM THE STACKS</span>
        <span style={{ color: C.muted }}>#{String(story.id).padStart(4, "0")}</span>
      </div>

      <div style={{ display: "flex", fontFamily: "Elite", color: C.bone, fontSize: titleSize(title, [112, 92, 74]), lineHeight: 1.15, marginTop: 60 }}>{title}</div>
      {story.subtitle && <div style={{ display: "flex", fontSize: 42, color: C.muted, marginTop: 28, lineHeight: 1.4 }}>{clip(story.subtitle, 120)}</div>}

      <div style={{ display: "flex", fontFamily: "Fell", fontSize: 36, color: C.muted, marginTop: 40, gap: 30 }}>
        <span>BY {(story.author ?? "UNKNOWN").toUpperCase()}</span>
        <span>{story.reading_minutes} MIN READ</span>
      </div>

      <div style={{ display: "flex", flexShrink: 0, marginTop: 60, padding: "44px 48px", background: C.panel, border: `2px solid ${C.line}`, borderLeft: `8px solid ${C.brass}`, fontSize: 44, lineHeight: 1.55, fontStyle: "italic" }}>
        “{excerpt}”
      </div>

      {story.rating != null && (
        <div style={{ display: "flex", marginTop: 56, fontSize: 42 }}>
          <RatingBar value={story.rating} width={260} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "Fell", fontSize: 96, color: C.blood, letterSpacing: 12 }}>EIDOTHEA</span>
        <span style={{ fontFamily: "Fell", fontSize: 28, color: C.muted, letterSpacing: 5, marginTop: 8 }}>READ IT AT</span>
        {/* Lowercase, as people will type it, shrunk to fit one line (Garamond is ~0.5em per character) */}
        <span style={{ fontFamily: "Garamond", fontSize: Math.min(48, Math.floor((880 / host.length - 2) / 0.5)), color: C.text, letterSpacing: 2 }}>{host.toLowerCase()}</span>
      </div>
    </div>
  );
}

/** 1200×630 link preview for WhatsApp, Discord, iMessage, X… */
export function LinkCard({ story }: { story: Story }) {
  const title = clip(story.title, 90);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: `radial-gradient(ellipse at 20% 0%, #22141a 0%, ${C.bg} 70%)`, padding: "60px 70px", color: C.text, fontFamily: "Garamond", borderLeft: `10px solid ${story.source === "user" ? C.blood : C.brass}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Fell", fontSize: 28, letterSpacing: 3 }}>
        <span style={{ color: C.blood, letterSpacing: 8 }}>EIDOTHEA</span>
        <span style={{ color: C.muted }}>FILE #{String(story.id).padStart(4, "0")}</span>
      </div>
      <div style={{ display: "flex", fontFamily: "Elite", color: C.bone, fontSize: titleSize(title, [80, 64, 50]), lineHeight: 1.15, marginTop: 40 }}>{title}</div>
      <div style={{ display: "flex", fontSize: 32, color: C.muted, marginTop: 22, lineHeight: 1.4 }}>
        {clip(story.subtitle || plainText(story.body), 150)}
      </div>
      <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontFamily: "Fell", fontSize: 28, color: C.muted }}>
        <span>BY {(story.author ?? "UNKNOWN").toUpperCase()} · {story.reading_minutes} MIN READ</span>
        {story.rating != null && <RatingBar value={story.rating} width={150} />}
      </div>
    </div>
  );
}
