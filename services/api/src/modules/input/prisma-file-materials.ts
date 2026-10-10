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
        ("id", "learningSessionId", "type", "status", "storageKey", "normalizedText", "contentHash", "mimeType", "sizeBytes", "metadata")
        VALUES (${material.id}, ${sessionId}, ${material.file.type}::public."SourceMaterialType", 'READY', ${material.storageKey},
          ${material.normalizedText}, ${material.file.contentHash}, ${material.file.mimeType}, ${material.file.sizeBytes}, ${metadata}::jsonb)`
        .affectedCount().build());
      await tx.execute(this.client.raw.sql`UPDATE public."LearningSession" SET "state" = 'PRE_TEST'
        WHERE "id" = ${sessionId} AND "userId" = ${this.appUserId} AND "stage" = 'EXPLAIN' AND "version" = 0`.affectedCount().build());
    });
  }
}
