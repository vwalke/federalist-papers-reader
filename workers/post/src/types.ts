export interface Env {
  DB: D1Database;
  SITE_URL: string;
  FROM_ADDRESS: string;
  RESEND_API_KEY: string;
  TOKEN_SECRET: string;
  POSTAL_ADDRESS: string;
  TURNSTILE_SECRET?: string;
  RESEND_WEBHOOK_SECRET?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ANALYTICS_TOKEN?: string;
}

export type Program = 'weekly' | 'calendar';
export type SubscriberStatus = 'pending' | 'active' | 'paused' | 'unsubscribed';

export interface Subscriber {
  id: number;
  email: string;
  program: Program;
  status: SubscriberStatus;
  /** weekly: count of merged debate items consumed (0..93). */
  progress_index: number;
  send_dow: number;
  paused_until: string | null;
  token_secret: string;
  confirmed_at: string | null;
  /** weekly: 1 when a make-up email for the Journal essays is still owed. */
  makeup_pending: number;
}

interface SharedContent {
  title: string;
  publicationDate: string;
  datelineLabel: string;
  recipient: string;
  nutshell: string;
  talkItOver: string;
  excerptParagraphs: string[];
}

export interface PaperContent extends SharedContent {
  kind: 'paper';
  /** Shared id space: a paper's id is its number (1–85). */
  id: number;
  number: number;
}

/** An Anti-Federalist essay from the New-York Journal. */
export interface EssayContent extends SharedContent {
  kind: 'essay';
  /** Shared id space: Brutus 100+n, Cato 150+n. */
  id: number;
  series: string;
  seriesNumber: number;
  /** e.g. "Brutus No. I". */
  displayName: string;
  /** Site route segment, e.g. "brutus-1". */
  slug: string;
}

export type DebateItem = PaperContent | EssayContent;
