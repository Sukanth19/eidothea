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
  subtitle: string;
  author: string | null;
  author_id: number | null;
  tags: string[];
  categories: string[];
  /** Readers' 1-10 scores, blended with the dataset's rating for imported stories */
  rating: number | null;
  archive_rating: number | null;
  rating_count: number;
  comment_count: number;
  reading_minutes: number;
  source: "user" | "import";
  truncated: boolean;
  status: "draft" | "published";
  published_at: string;
  updated_at: string | null;
  can_edit: boolean;
}

export interface StorySummary extends StoryBase {
  excerpt: string;
}

export interface Story extends StoryBase {
  body: string;
  my_rating?: number | null;
}

export interface RatingState {
  rating: number | null;
  rating_count: number;
  my_rating: number | null;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  author: string;
  author_id: number;
  author_role: Role;
  likes: number;
  dislikes: number;
  my_vote: -1 | 0 | 1;
  can_delete: boolean;
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
