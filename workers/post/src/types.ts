export interface Env {
  DB: D1Database;
  SITE_URL: string;
  FROM_ADDRESS: string;
  RESEND_API_KEY: string;
  TOKEN_SECRET: string;
  POSTAL_ADDRESS: string;
  TURNSTILE_SECRET?: string;
  RESEND_WEBHOOK_SECRET?: string;
}

export type Program = 'weekly' | 'calendar';
export type SubscriberStatus = 'pending' | 'active' | 'paused' | 'unsubscribed';

export interface Subscriber {
  id: number;
  email: string;
  program: Program;
  status: SubscriberStatus;
  progress_index: number;
  send_dow: number;
  paused_until: string | null;
  token_secret: string;
  confirmed_at: string | null;
}

export interface PaperContent {
  number: number;
  title: string;
  publicationDate: string;
  datelineLabel: string;
  recipient: string;
  nutshell: string;
  talkItOver: string;
  excerptParagraphs: string[];
}
