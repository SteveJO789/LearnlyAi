import type { UserDb } from "../../prisma/db.js";
import { ApiError } from "../../shared/api-error.js";

export interface FileHistoryQuery { after: string; from: string; to: string }
export function fileHistoryQuery(value: Record<string, unknown>): FileHistoryQuery {
  if (Object.keys(value).some(key => !["after", "from", "to"].includes(key))) throw new ApiError("VALIDATION_ERROR", 400, "Use file cursor and date filters only.");
  const after = value.after ?? "", from = value.from ?? "", to = value.to ?? "";
  if (typeof after !== "string" || after && !/^[a-zA-Z0-9_-]{1,128}$/u.test(after)) throw new ApiError("VALIDATION_ERROR", 400, "A valid file cursor is required.");
  for (const date of [from, to]) {
    if (typeof date !== "string" || date && (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || date < '1900-01-01' || date > '9998-12-31' || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) {
      throw new ApiError("VALIDATION_ERROR", 400, "Use valid ISO dates for file history.");
    }
  }
  if (from && to && from > to) throw new ApiError("VALIDATION_ERROR", 400, "The start date must not follow the end date.");
  return { after, from: from as string, to: to as string };
}

export class PrismaFileHistory {
  constructor(private readonly client: UserDb, private readonly appUserId: string) {}
  async list(query: FileHistoryQuery) {
    const from = query.from ? new Date(`${query.from}T00:00:00.000+07:00`).toISOString() : "";
    const until = query.to ? new Date(Date.parse(`${query.to}T00:00:00.000+07:00`) + 86400000).toISOString() : "";
    const plan = this.client.raw.sql`SELECT m.id, m."learningSessionId" AS "sessionId", s.title AS "sessionTitle", m.type, m."mimeType", m."sizeBytes",
      COALESCE(m.metadata->>'filename', '') AS filename, COALESCE(f."createdAt"::text, '') AS "uploadedAt",
      LEFT(COALESCE(m.metadata->>'learningText', m."normalizedText", ''), 8001) AS "normalizedText",
      (COALESCE(m.metadata->>'reviewedByLearner', 'false') = 'true') AS "reviewedByLearner",
      (s."lifecycleState" = 'ACTIVE' AND s.stage = 'EXPLAIN' AND s.version = 0 AND s.state IN ('INPUT', 'PRE_TEST')) AS "canReview"
      FROM public."SourceMaterial" m JOIN public."LearningSession" s ON s.id = m."learningSessionId"
      LEFT JOIN public."FileUpload" f ON f.id = m.id AND f."learningSessionId" = m."learningSessionId" AND f.state = 'FINALIZED'
      WHERE s."userId" = ${this.appUserId} AND m.status = 'READY' AND m.type IN ('PDF', 'IMAGE')
        AND m."storageKey" IS NOT NULL AND m."storageBucket" IS NOT NULL
        AND (${query.after}::text = '' OR m.id > ${query.after})
        AND (${from}::text = '' OR f."createdAt" >= NULLIF(${from}, '')::timestamptz)
        AND (${until}::text = '' OR f."createdAt" < NULLIF(${until}, '')::timestamptz)
      ORDER BY m.id ASC LIMIT 26`
      .returnsRow({ id: "pg/text@1", sessionId: "pg/text@1", sessionTitle: "pg/text@1", type: "pg/text@1", mimeType: "pg/text@1",
        sizeBytes: "pg/int4@1", filename: "pg/text@1", uploadedAt: "pg/text@1", normalizedText: "pg/text@1",
        reviewedByLearner: "pg/bool@1", canReview: "pg/bool@1" }).build();
    const rows = await this.client.query(plan).toArray();
    const items = rows.slice(0, 25).map(row => ({ ...row,
      uploadedAt: row.uploadedAt ? new Date(row.uploadedAt).toISOString() : null,
      normalizedText: row.normalizedText || null,
    }));
    return { items, nextCursor: rows.length > 25 ? items.at(-1)!.id : null };
  }
  async listReceipts(query: FileHistoryQuery) {
    const from = query.from ? new Date(`${query.from}T00:00:00.000+07:00`).toISOString() : "";
    const until = query.to ? new Date(Date.parse(`${query.to}T00:00:00.000+07:00`) + 86400000).toISOString() : "";
    const plan = this.client.raw.sql`SELECT f.id, f."learningSessionId" AS "sessionId", s.title AS "sessionTitle", f.state,
      COALESCE(f.material->'file'->>'filename', '') AS filename, f.material->'file'->>'type' AS type, f."createdAt",
      (f.state = 'PENDING' AND s."lifecycleState" = 'ACTIVE' AND s.stage = 'EXPLAIN' AND s.version = 0 AND s.state IN ('INPUT', 'PRE_TEST')) AS "canResume"
      FROM public."FileUpload" f JOIN public."LearningSession" s ON s.id = f."learningSessionId"
      WHERE s."userId" = ${this.appUserId} AND f.state IN ('PENDING', 'CANCELLED') AND f."cleanupAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM public."SourceMaterial" m WHERE m.id = f.id AND m."learningSessionId" = f."learningSessionId")
        AND (${query.after}::text = '' OR f.id > ${query.after})
        AND (${from}::text = '' OR f."createdAt" >= NULLIF(${from}, '')::timestamptz)
        AND (${until}::text = '' OR f."createdAt" < NULLIF(${until}, '')::timestamptz)
      ORDER BY f.id ASC LIMIT 26`.returnsRow({ id: "pg/text@1", sessionId: "pg/text@1", sessionTitle: "pg/text@1", state: "pg/text@1",
        filename: "pg/text@1", type: "pg/text@1", createdAt: "pg/timestamptz-string@1", canResume: "pg/bool@1" }).build();
    const rows = await this.client.query(plan).toArray(), items = rows.slice(0, 25);
    return { items, nextCursor: rows.length > 25 ? items.at(-1)!.id : null };
  }
}
