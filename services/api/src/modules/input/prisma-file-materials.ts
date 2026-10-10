import type { UserDb } from "../../prisma/db.js";
import { withApiWrite } from "../../prisma/api-write.js";
import { ApiError } from "../../shared/api-error.js";
import type { FileMaterialStore, PreparedFileMaterial } from "./file-ingestion.js";

export class PrismaFileMaterials implements FileMaterialStore {
  constructor(private readonly client: UserDb, private readonly appUserId: string) {}
  async assertActiveOwnedSession(sessionId: string): Promise<void> {
    const plan = this.client.raw.sql`SELECT "id" FROM public."LearningSession"
      WHERE "id" = ${sessionId} AND "userId" = ${this.appUserId} AND "lifecycleState" = 'ACTIVE'`
      .returnsRow({ id: "pg/text@1" }).build();
    if (!(await this.client.query(plan).toArray()).length) throw new ApiError("NOT_FOUND", 404, "Active learning session was not found.");
  }
  async save(sessionId: string, material: PreparedFileMaterial): Promise<void> {
    const metadata = JSON.stringify({ schemaVersion: "1.0", createdAt: new Date().toISOString(), origin: "LEARNER_INPUT", reviewed: false,
      filename: material.file.filename, normalizedHash: material.normalizedHash, extraction: material.extraction });
    await withApiWrite(this.client, async tx => {
      // Lock the row so a concurrent completion cannot occur between active check and material insert.
      const session = this.client.raw.sql`SELECT "id" FROM public."LearningSession"
        WHERE "id" = ${sessionId} AND "userId" = ${this.appUserId} AND "lifecycleState" = 'ACTIVE' FOR UPDATE`
        .returnsRow({ id: "pg/text@1" }).build();
      if (!(await tx.query(session).toArray()).length) throw new ApiError("NOT_FOUND", 404, "Active learning session was not found.");
      await tx.execute(this.client.raw.sql`INSERT INTO public."SourceMaterial"
        ("id", "learningSessionId", "type", "status", "storageKey", "storageBucket", "normalizedText", "contentHash", "mimeType", "sizeBytes", "metadata")
        VALUES (${material.id}, ${sessionId}, ${material.file.type}, 'READY', ${material.storageKey}, ${material.storageBucket},
          ${material.normalizedText}, ${material.file.contentHash}, ${material.file.mimeType}, ${material.file.sizeBytes}, ${metadata}::jsonb)`
        .affectedCount().build());
      await tx.execute(this.client.raw.sql`UPDATE public."LearningSession" SET "state" = 'PRE_TEST'
        WHERE "id" = ${sessionId} AND "userId" = ${this.appUserId} AND "stage" = 'EXPLAIN' AND "version" = 0`.affectedCount().build());
    });
  }
  async resolveSave(sessionId: string, material: PreparedFileMaterial): Promise<"SAVED" | "NOT_SAVED" | "UNKNOWN"> {
    return this.client.transaction(async tx => {
      // Absence is conclusive only with a fresh snapshot after the parent lock. Never
      // make a cleanup decision using a REPEATABLE READ snapshot from before COMMIT.
      const isolation = this.client.raw.sql`SELECT current_setting('transaction_isolation') AS "level"`
        .returnsRow({ level: "pg/text@1" }).build();
      if ((await tx.query(isolation).toArray())[0]?.level !== "read committed") return "UNKNOWN" as const;
      await tx.execute(this.client.raw.sql`SET LOCAL lock_timeout = '3s'`.affectedCount().build());
      await tx.execute(this.client.raw.sql`SET LOCAL statement_timeout = '5s'`.affectedCount().build());
      const session = this.client.raw.sql`SELECT "id" FROM public."LearningSession"
        WHERE "id" = ${sessionId} AND "userId" = ${this.appUserId} FOR UPDATE`
        .returnsRow({ id: "pg/text@1" }).build();
      // Closed sessions may still contain a committed material. Missing ownership never
      // proves absence: RLS can hide an existing row, so keep the original object.
      if (!(await tx.query(session).toArray()).length) return "UNKNOWN" as const;
      const receipt = this.client.raw.sql`SELECT CASE WHEN
        "type" = ${material.file.type} AND "status" = 'READY'
        AND "storageKey" = ${material.storageKey} AND "storageBucket" = ${material.storageBucket}
        AND "contentHash" = ${material.file.contentHash} AND "normalizedText" = ${material.normalizedText}
        AND "mimeType" = ${material.file.mimeType} AND "sizeBytes" = ${material.file.sizeBytes}
        AND "metadata"->>'origin' = 'LEARNER_INPUT' AND "metadata"->>'reviewed' = 'false'
        AND "metadata"->>'normalizedHash' = ${material.normalizedHash}
        AND ("metadata"->'extraction')::jsonb = ${JSON.stringify(material.extraction)}::jsonb
        THEN 'SAVED' ELSE 'UNKNOWN' END AS "outcome"
        FROM public."SourceMaterial" WHERE "id" = ${material.id} AND "learningSessionId" = ${sessionId}`
        .returnsRow({ outcome: "pg/text@1" }).build();
      const rows = await tx.query(receipt).toArray();
      if (!rows.length) return "NOT_SAVED" as const;
      return rows.length === 1 && rows[0]?.outcome === "SAVED" ? "SAVED" as const : "UNKNOWN" as const;
    });
  }
}
