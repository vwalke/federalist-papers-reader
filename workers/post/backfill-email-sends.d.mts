export interface RetainedSend {
  id: string;
  createdAt: string;
  recipientCount: number;
}

export function listRetainedSends(
  apiKey: string,
  fetchImpl?: typeof fetch
): Promise<RetainedSend[]>;

export function renderBackfillSql(rows: RetainedSend[]): string;

export function main(options?: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  runSql?: (sql: string) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void>;
