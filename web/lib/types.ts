export type Role = "user" | "mod" | "admin" | "overseer";

export const ROLE_LABEL: Record<Role, string> = {
  user: "User",
  mod: "Moderator",
  admin: "Admin",
  overseer: "Overseer",
};

export const ROLE_LEVEL: Record<Role, number> = { user: 0, mod: 1, admin: 2, overseer: 3 };

export interface User {
  id: number;
  username: string;
  role: Role;
  created_at: string;
}

interface StoryBase {
  id: number;
  title: string;
  author: string | null;
  author_id: number | null;
  tags: string[];
  categories: string[];
  rating: number | null;
  reading_minutes: number;
  source: "user" | "import";
  truncated: boolean;
  published_at: string;
  updated_at: string | null;
  can_edit: boolean;
}

export interface StorySummary extends StoryBase {
  excerpt: string;
}

export interface Story extends StoryBase {
  body: string;
}

export interface StoryPage {
  items: StorySummary[];
  total: number;
  page: number;
  pages: number;
}

export interface Category {
  name: string;
  count: number;
}

export interface Stats {
  stories: number;
  community: number;
  users: number;
  minutes: number;
}

export interface ManagedUser extends User {
  story_count: number;
  can_manage: boolean;
}
