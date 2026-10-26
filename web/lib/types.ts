export type Role = "user" | "mod" | "admin" | "overseer";

export const ROLE_LABEL: Record<Role, string> = {
  user: "User",
  mod: "Moderator",
  admin: "Admin",
  overseer: "Overseer",
};

export const ROLE_LEVEL: Record<Role, number> = { user: 0, mod: 1, admin: 2, overseer: 3 };

/** Content warnings a writer can put on a story (the API's ContentWarning) */
export const WARNING_LABEL = {
  gore: "Gore",
  "body-horror": "Body horror",
  "self-harm": "Self-harm",
  suicide: "Suicide",
  abuse: "Abuse",
  "sexual-content": "Sexual content",
  "animal-harm": "Harm to animals",
  "child-harm": "Harm to children",
  "substance-use": "Drugs and alcohol",
} as const;

export type ContentWarning = keyof typeof WARNING_LABEL;

/** Why a reader reports something (the API's moderation.Reason) */
export const REPORT_REASON = {
  spam: "Spam or advertising",
  harassment: "Harassment or bullying",
  hate: "Hateful",
  sexual: "Sexual content that crosses the line",
  "self-harm": "Someone may be in danger",
  stolen: "Stolen from another writer",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASON;

/** Open reports about one story or comment, for the keepers */
export interface OpenReport {
  kind: "story" | "comment";
  story_id: number | null;
  comment_id: number | null;
  /** The story to open: the reported one, or the one the comment is on */
  link_story: number;
  story_title: string | null;
  comment_body: string | null;
  author: string | null;
  author_id: number | null;
  first_at: string;
  reasons: Record<string, number>;
  notes: { by: string; note: string }[];
}

export interface User {
  id: number;
  username: string;
  role: Role;
  created_at: string;
  /** May open /insights: the overseer, plus whoever they let in */
  insights: boolean;
  /** unverified: email not confirmed yet · reader: can read and follow · member: can also post, comment and rate */
  tier: "unverified" | "reader" | "member";
  member: boolean;
  email_verified: boolean;
  /** Only on the logged-in user's own record */
  email?: string | null;
  /** False when the server has no email account set up, so nothing is actually sent */
  mail_ready?: boolean;
  /** Unread notifications, on the logged-in user's own record */
  unread?: number;
}

export interface SocialInfo {
  followers: number;
  following: number;
  is_following: boolean;
  recommends: number;
}

export interface Notification {
  id: number;
  kind: "follow" | "story" | "comment" | "reply" | "mention" | "recommend" | "invite_used" | "member" | "rejected";
  created_at: string;
  read: boolean;
  story_id: number | null;
  comment_id: number | null;
  actor: string | null;
  story_title: string | null;
}

export interface InviteList {
  /** null: no limit (staff) */
  left: number | null;
  invites: { code: string; created_at: string; used_at: string | null; used_by: string | null }[];
}

export interface Application {
  id: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
}

export interface QueuedApplication extends Application {
  user_id: number;
  username: string;
  joined: string;
  decided_by: string | null;
}

interface StoryBase {
  id: number;
  title: string;
  subtitle: string;
  author: string | null;
  author_id: number | null;
  author_public: boolean;
  tags: string[];
  categories: string[];
  warnings: ContentWarning[];
  /** Readers' 1-10 scores, blended with the dataset's rating for imported stories */
  rating: number | null;
  archive_rating: number | null;
  rating_count: number;
  comment_count: number;
  recommend_count: number;
  reading_minutes: number;
  source: "user" | "import";
  truncated: boolean;
  status: "draft" | "published";
  published_at: string;
  updated_at: string | null;
  can_edit: boolean;
  /** How far the logged-in reader got (confirmed accounts only); null if never opened */
  my_read?: { progress: number; finished: boolean } | null;
}

export interface StorySummary extends StoryBase {
  excerpt: string;
}

export interface Story extends StoryBase {
  body: string;
  my_rating?: number | null;
  recommended?: boolean;
  /** Saved to the logged-in reader's list */
  bookmarked?: boolean;
}

export interface RatingState {
  rating: number | null;
  rating_count: number;
  my_rating: number | null;
}

export interface Comment {
  id: number;
  /** Set on replies: the top-level comment whose thread it's in */
  parent_id: number | null;
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

export interface ForYou {
  items: StorySummary[];
  /** The genres the picks are based on */
  based_on: string[];
}

export interface Category {
  name: string;
  count: number;
}

/** A genre writers can pick, on top of the dataset's categories */
export interface Genre extends Category {
  blurb: string;
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

export interface Profile {
  username: string;
  role: Role;
  created_at: string;
  display_name: string;
  bio: string;
  instagram: string;
  profile_public: boolean;
  member: boolean;
  story_count?: number;
  /** Own profile only: email me when someone I follow publishes */
  email_follows?: boolean;
}

export interface InsightWindow {
  views: number;
  visitors: number;
  signups: number;
}

export interface Insights {
  days: number;
  today: InsightWindow;
  week: InsightWindow;
  month: InsightWindow;
  daily: { day: string; visitors: number; views: number; signups: number }[];
  top_stories: { id: number; title: string; views: number; readers: number }[];
  sources: { source: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  heard_from: { source: string; users: number }[];
  new_users: { id: number; username: string; created_at: string; source: string | null; landing: string | null }[];
  totals: { users: number; community_stories: number; comments: number; ratings: number };
}

export interface InsightUser {
  id: number;
  username: string;
  role: Role;
  created_at: string;
  last_seen_at: string | null;
  source: string | null;
  landing: string | null;
  display_name: string;
  insights: boolean;
  profile_public: boolean;
  stories: number;
  drafts: number;
  comments: number;
  ratings: number;
}

export interface InsightUserDetail extends InsightUser {
  bio: string;
  instagram: string;
  average_rating_given: number | null;
  recent_stories: { id: number; title: string; status: "draft" | "published"; published_at: string; updated_at: string | null }[];
  recent_comments: { id: number; body: string; created_at: string; story_id: number; story_title: string }[];
}
