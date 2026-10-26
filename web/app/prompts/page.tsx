import type { Metadata } from "next";
import { PromptCard } from "@/components/Prompts";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Prompt } from "@/lib/types";

export const metadata: Metadata = { title: "Prompts" };

export default async function PromptsPage() {
  const [user, prompts] = await Promise.all([currentUser(), apiGet<Prompt[]>("/api/prompts")]);
  const live = (prompts ?? []).filter(p => p.status !== "closed");
  const past = (prompts ?? []).filter(p => p.status === "closed");

  return (
    <>
      <h1 className="flicker">Prompts</h1>
      <p className="muted" style={{ maxWidth: "70ch" }}>
        The keepers set a theme and a deadline. Members write to it. Everyone reads what crawled out.
      </p>
      {live.length === 0 && <p className="empty">NO PROMPT IS OPEN RIGHT NOW. THE NEXT ONE IS BEING DUG UP.</p>}
      <div className="prompt-list">
        {live.map(p => <PromptCard key={p.id} prompt={p} user={user} />)}
      </div>
      {past.length > 0 && (
        <>
          <div className="section-head"><h2>Past prompts</h2></div>
          <div className="prompt-list">
            {past.map(p => <PromptCard key={p.id} prompt={p} user={user} />)}
          </div>
        </>
      )}
    </>
  );
}
