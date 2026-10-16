import type { UserDb } from "../../prisma/db.js";
import { orderConversationMessages } from "./message-order.js";

export type PersistedMessage = {
  id: string;
  learningSessionId: string;
  role: "USER" | "TUTOR" | "SYSTEM";
  content: unknown;
  createdAt: string;
  /** Exact database ordering clock; never included in the public DTO. */
  orderingTimestamp?: string;
};

type RawMessage = {
  id: string;
  learningSessionId: string;
  role: string;
  contentJson: string;
  createdAt: string;
  orderingTimestamp: string;
};

/**
 * Explicitly decode JSON from the Postgres json column. This avoids relying
 * on the Prisma 8 RC ORM's JSON row materialization in session restoration.
 * Both the API history view and the learning engine use the same decoder.
 */
export function decodePersistedMessageRow(row: RawMessage): PersistedMessage {
  if (row.role !== "USER" && row.role !== "TUTOR" && row.role !== "SYSTEM") {
    throw new Error("Unsupported persisted message role.");
  }

  let content: unknown;
  try {
    content = JSON.parse(row.contentJson);
  } catch {
    throw new Error("Persisted message content is not valid JSON.");
  }

  return {
    id: row.id,
    learningSessionId: row.learningSessionId,
    role: row.role,
    content,
    createdAt: row.createdAt,
    orderingTimestamp: row.orderingTimestamp,
  };
}

/**
 * Read messages through a parameterized query on the JWT-bound Supabase
 * client. RLS remains active and only exposes the requesting user's messages.
 * Returning json::text avoids a runtime JSON codec mismatch on ORM reads.
 */
export async function readPersistedMessages(
  client: UserDb,
  sessionId: string,
): Promise<PersistedMessage[]> {
  const plan = client.raw.sql`
    SELECT
      m."id" AS "id",
      m."learningSessionId" AS "learningSessionId",
      m."role" AS "role",
      m."content"::text AS "contentJson",
      to_char(
        m."createdAt" AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS "createdAt",
      to_char(
        m."createdAt" AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ) AS "orderingTimestamp"
    FROM public."Message" m
    WHERE m."learningSessionId" = ${sessionId}
    ORDER BY m."createdAt" ASC, m."id" ASC
  `
    .returnsRow({
      id: "pg/text@1",
      learningSessionId: "pg/text@1",
      role: "pg/text@1",
      contentJson: "pg/text@1",
      createdAt: "pg/text@1",
      orderingTimestamp: "pg/text@1",
    })
    .build();

  const rows = await client.query(plan).toArray();
  return orderConversationMessages(rows.map(decodePersistedMessageRow));
}
