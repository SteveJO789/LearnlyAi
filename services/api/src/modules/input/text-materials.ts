import { createHash, randomUUID } from "node:crypto";
import type { UserDb } from "../../prisma/db.js";
import { withApiWrite } from "../../prisma/api-write.js";
import { ApiError } from "../../shared/api-error.js";
import type { SourceMaterialRepository } from "../learning/repositories.js";

export function normalizeTextMaterial(value: unknown): string {
  if (typeof value !== "string" || value.length > 8000 || !value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new ApiError("VALIDATION_ERROR", 400, "Use nonblank text of at most 8000 characters without control characters.", [{ path: "/text", message: "Invalid text input." }]);
  }
  // NFC preserves mathematical superscripts/notation; NFKC would turn x² into x2.
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

export class PrismaTextMaterials implements SourceMaterialRepository {
  constructor(private readonly client: UserDb, private readonly userId: string) {}

  async list(sessionId: string) {
    const plan = this.client.raw.sql`SELECT m."id", m."type", m."status", COALESCE(m."normalizedText", '') AS "normalizedText",
      m."contentHash", m."mimeType", m."sizeBytes"
      FROM public."SourceMaterial" m JOIN public."LearningSession" s ON s."id" = m."learningSessionId"
      WHERE m."learningSessionId" = ${sessionId} AND s."userId" = ${this.userId}
      ORDER BY m."metadata"->>'createdAt' DESC, m."id" DESC LIMIT 20`
      .returnsRow({ id: "pg/text@1", type: "pg/text@1", status: "pg/text@1", normalizedText: "pg/text@1",
        contentHash: "pg/text@1", mimeType: "pg/text@1", sizeBytes: "pg/int4@1" }).build();
    return this.client.query(plan).toArray();
  }

  async create(sessionId: string, value: unknown) {
    const text = normalizeTextMaterial(value);
    const id = randomUUID(), at = new Date().toISOString();
    const contentHash = createHash("sha256").update(text, "utf8").digest("hex");
    const sizeBytes = Buffer.byteLength(text, "utf8");
    const metadata = JSON.stringify({ schemaVersion: "1.0", createdAt: at, origin: "LEARNER_INPUT", reviewed: false });
    const created = await withApiWrite(this.client, async tx => {
      const plan = this.client.raw.sql`INSERT INTO public."SourceMaterial"
        ("id", "learningSessionId", "type", "status", "normalizedText", "contentHash", "mimeType", "sizeBytes", "metadata")
        SELECT ${id}, ${sessionId}, 'TEXT', 'READY', ${text}, ${contentHash}, 'text/plain', ${sizeBytes}, ${metadata}::jsonb
        WHERE EXISTS (SELECT 1 FROM public."LearningSession" WHERE "id" = ${sessionId} AND "userId" = ${this.userId} AND "lifecycleState" = 'ACTIVE')`
        .affectedCount().build();
      const inserted = (await tx.execute(plan)).affectedRows === 1;
      if (inserted) await tx.execute(this.client.raw.sql`UPDATE public."LearningSession" SET "state" = 'PRE_TEST'
        WHERE "id" = ${sessionId} AND "userId" = ${this.userId} AND "stage" = 'EXPLAIN' AND "version" = 0`.affectedCount().build());
      return inserted;
    });
    if (!created) throw new ApiError("NOT_FOUND", 404, "Active learning session was not found.");
    return { id, materialId: id, type: "TEXT", status: "READY", normalizedText: text, contentHash, mimeType: "text/plain", sizeBytes };
  }

  async findBySessionId(sessionId: string) {
    const rows = await this.list(sessionId);
    return rows.filter(row => row.status === "READY" && row.normalizedText && row.normalizedText.length <= 8000).slice(0, 4).map(row => ({
      citation: { id: `material_${row.id}`, title: "Learner-provided material", sourceType: "USER_MATERIAL" as const },
      content: row.normalizedText,
    }));
  }
}
