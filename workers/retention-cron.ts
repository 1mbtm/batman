/**
 * Scheduled Cloudflare Worker for Automated Analytics Retention Cleanup
 * Runs on a recurring Cron Trigger (e.g. daily at 03:00 UTC: "0 3 * * *")
 * so expired visits, sessions, consents, unreferenced visitors, and orphaned
 * records are purged automatically in production without requiring admin login.
 */

import { runScheduledRetentionCleanup, type D1Database } from '../functions/api/analytics/[[route]]';

export interface CronEnv {
  DB: D1Database;
  ANALYTICS_RETENTION_DAYS?: string;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  async scheduled(_event: ScheduledEvent, env: CronEnv, ctx: ExecutionContext): Promise<void> {
    if (!env.DB) {
      throw new Error('D1 Database binding (DB) is missing in scheduled retention worker.');
    }
    const retentionDays = Math.max(
      7,
      Math.min(3650, Number(env.ANALYTICS_RETENTION_DAYS || '90') || 90)
    );
    ctx.waitUntil(runScheduledRetentionCleanup(env.DB, retentionDays));
  },
};
