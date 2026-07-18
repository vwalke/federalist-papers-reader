// workers/post/src/db.ts
import type { Program, Subscriber } from './types';

export interface Db {
  getSubscriberById(id: number): Promise<Subscriber | null>;
  getSubscriberByEmail(email: string): Promise<Subscriber | null>;
  upsertPending(email: string, program: Program, tokenSecret: string): Promise<Subscriber>;
  activate(id: number, confirmIp: string | null): Promise<void>;
  setStatus(id: number, status: 'active' | 'paused', pausedUntil?: string | null): Promise<void>;
  setProgram(id: number, program: Program, progressIndex: number): Promise<void>;
  setProgress(id: number, progressIndex: number): Promise<void>;
  unsubscribe(id: number): Promise<void>;
  unsubscribeByEmail(email: string): Promise<void>;
  listDeliverable(): Promise<Subscriber[]>;
  autoResume(todayIso: string): Promise<void>;
  claimDelivery(subscriberId: number, paperNumber: number, scheduledFor: string): Promise<boolean>;
  markDelivery(subscriberId: number, paperNumber: number, scheduledFor: string,
    status: 'sent' | 'failed', providerMessageId?: string): Promise<void>;
  listRetryable(): Promise<Array<{ subscriber_id: number; paper_number: number; scheduled_for: string }>>;
  purgeUnsubscribed(olderThanDays: number): Promise<void>;
  purgeStalePending(olderThanDays: number): Promise<void>;
}

export function makeDb(d1: D1Database): Db {
  const one = async (stmt: D1PreparedStatement) => ((await stmt.first()) as Subscriber | null) ?? null;
  return {
    getSubscriberById: (id) => one(d1.prepare('SELECT * FROM subscribers WHERE id = ?').bind(id)),
    getSubscriberByEmail: (email) =>
      one(d1.prepare('SELECT * FROM subscribers WHERE email = ?').bind(email.toLowerCase())),
    async upsertPending(email, program, tokenSecret) {
      const row = await d1.prepare(
        `INSERT INTO subscribers (email, program, token_secret) VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           program = CASE WHEN subscribers.status IN ('pending','unsubscribed') THEN excluded.program ELSE subscribers.program END,
           status = CASE WHEN subscribers.status = 'unsubscribed' THEN 'pending' ELSE subscribers.status END,
           token_secret = CASE WHEN subscribers.status = 'unsubscribed' THEN excluded.token_secret ELSE subscribers.token_secret END,
           unsubscribed_at = CASE WHEN subscribers.status = 'unsubscribed' THEN NULL ELSE subscribers.unsubscribed_at END
         RETURNING *`
      ).bind(email.toLowerCase(), program, tokenSecret).first();
      if (!row) throw new Error('upsertPending returned no row');
      return row as unknown as Subscriber;
    },
    async activate(id, confirmIp) {
      await d1.prepare(
        `UPDATE subscribers SET status = 'active', confirmed_at = datetime('now'), confirm_ip = ?
         WHERE id = ? AND status = 'pending'`).bind(confirmIp, id).run();
    },
    async setStatus(id, status, pausedUntil = null) {
      await d1.prepare('UPDATE subscribers SET status = ?, paused_until = ? WHERE id = ?')
        .bind(status, pausedUntil, id).run();
    },
    async setProgram(id, program, progressIndex) {
      await d1.prepare('UPDATE subscribers SET program = ?, progress_index = ? WHERE id = ?')
        .bind(program, progressIndex, id).run();
    },
    async setProgress(id, progressIndex) {
      await d1.prepare('UPDATE subscribers SET progress_index = ? WHERE id = ?')
        .bind(progressIndex, id).run();
    },
    async unsubscribe(id) {
      await d1.prepare(
        `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE id = ?`
      ).bind(id).run();
    },
    async unsubscribeByEmail(email) {
      await d1.prepare(
        `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE email = ?`
      ).bind(email.toLowerCase()).run();
    },
    async listDeliverable() {
      const { results } = await d1.prepare(`SELECT * FROM subscribers WHERE status = 'active'`).all();
      return results as unknown as Subscriber[];
    },
    async autoResume(todayIso) {
      await d1.prepare(
        `UPDATE subscribers SET status = 'active', paused_until = NULL
         WHERE status = 'paused' AND paused_until IS NOT NULL AND paused_until <= ?`
      ).bind(todayIso).run();
    },
    async claimDelivery(subscriberId, paperNumber, scheduledFor) {
      const result = await d1.prepare(
        `INSERT OR IGNORE INTO deliveries (subscriber_id, paper_number, scheduled_for) VALUES (?, ?, ?)`
      ).bind(subscriberId, paperNumber, scheduledFor).run();
      return (result.meta.changes ?? 0) > 0;
    },
    async markDelivery(subscriberId, paperNumber, scheduledFor, status, providerMessageId) {
      await d1.prepare(
        `UPDATE deliveries SET status = ?, provider_message_id = ?
         WHERE subscriber_id = ? AND paper_number = ? AND scheduled_for = ?`
      ).bind(status, providerMessageId ?? null, subscriberId, paperNumber, scheduledFor).run();
    },
    async listRetryable() {
      // Stale queued rows are retried too (claimed, then the worker died mid-send):
      // at-least-once semantics — a rare duplicate email beats a silently lost paper.
      const { results } = await d1.prepare(
        `SELECT d.subscriber_id, d.paper_number, d.scheduled_for FROM deliveries d
         JOIN subscribers s ON s.id = d.subscriber_id AND s.status = 'active'
         WHERE (d.status = 'failed' OR (d.status = 'queued' AND d.created_at < datetime('now','-1 hour')))
           AND d.created_at >= datetime('now','-2 days')`).all();
      return results as unknown as Array<{ subscriber_id: number; paper_number: number; scheduled_for: string }>;
    },
    async purgeUnsubscribed(olderThanDays) {
      await d1.prepare(
        `DELETE FROM subscribers WHERE status = 'unsubscribed'
         AND unsubscribed_at < datetime('now', ?)`
      ).bind(`-${olderThanDays} days`).run();
    },
    async purgeStalePending(olderThanDays) {
      await d1.prepare(
        `DELETE FROM subscribers WHERE status = 'pending'
         AND created_at < datetime('now', ?)`
      ).bind(`-${olderThanDays} days`).run();
    }
  };
}
