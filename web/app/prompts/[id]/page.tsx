import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { PromptCard } from "@/components/Prompts";
import { StoryGrid } from "@/components/StoryCard";
import { apiGet, currentUser, query } from "@/lib/server-api";
import type { Prompt, StoryPage } from "@/lib/types";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> };

async function load(id: string) {
  return /^\d+$/.test(id) ? apiGet<Prompt>(`/api/prompts/${id}`) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const prompt = await load((await params).id);
  return { title: prompt ? `Prompt: ${prompt.title}` : "Not found", description: prompt?.body.slice(0, 180) };
}

export default async function PromptPage({ params, searchParams }: Props) {
  const prompt = await load((await params).id);
  if (!prompt) notFound();
  const { page } = await searchParams;
  // While it's open, newest entries first; once it's closed, the best
  const [user, entries] = await Promise.all([
    currentUser(),
    apiGet<StoryPage>(`/api/stories${query({ prompt: prompt.id, sort: prompt.status === "closed" ? "rating" : undefined, page })}`),
  ]);

  return (
    <>
      <p><Link href="/prompts">← all prompts</Link></p>
      <PromptCard prompt={prompt} user={user} full />
      <div className="section-head"><h2>Entries</h2></div>
      {entries && entries.total > 0 ? (
        <>
          <StoryGrid stories={entries.items} />
          <Pagination page={entries.page} pages={entries.pages} params={page ? { page } : {}} />
        </>
      ) : (
        <p className="empty">{prompt.status === "upcoming" ? "IT HASN'T OPENED YET." : "NO ENTRIES YET. SOMEONE HAS TO GO FIRST."}</p>
      )}
    </>
  );
}
