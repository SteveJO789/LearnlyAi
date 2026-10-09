import type { UserDb } from "./db.js";

export type ApiTransaction = Parameters<Parameters<UserDb["transaction"]>[0]>[0];

/** Trusted API SQL connection only, still JWT-bound and subject to ownership RLS.
 * No public RPC may expose arbitrary SQL or a setter for this transaction-local setting.
 * Never take this context from a header, body or user-editable JWT metadata. */
export function withApiWrite<T>(client: UserDb, work: (tx: ApiTransaction) => Promise<T>): Promise<T> {
  return client.transaction(async tx => {
    await tx.execute(client.raw.sql`SELECT set_config('learnly.api_write', '1', true)`.affectedCount().build());
    return work(tx);
  });
}
