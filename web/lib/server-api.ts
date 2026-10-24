// Server-side reads. Forwards the visitor's cookie so FastAPI knows who's asking.
import { cookies } from "next/headers";
import type { User } from "./types";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export async function apiGet<T>(path: string): Promise<T | null> {
  const cookie = (await cookies()).toString();
  const res = await fetch(`${API_URL}${path}`, { headers: { cookie }, cache: "no-store" });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

export async function currentUser(): Promise<User | null> {
  // Used by the root layout, so an unreachable API must not take the whole page down
  try {
    const res = await apiGet<{ user: User | null }>("/api/auth/me");
    return res?.user ?? null;
  } catch {
    return null;
  }
}

export function query(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
