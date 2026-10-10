import type { UserDb } from "./db.js";
import { validateEmbedding } from "../modules/knowledge/embedding-port.js";
import { sha256 } from "../modules/knowledge/reviewed-chunks.js";
import type { ReviewedVectorPublisher, ReviewedVectorRow } from "../modules/knowledge/reviewed-vector-publication.js";

/** Operator-only writer. Authenticated/anon roles have no publication policies or grants. */
export class PrismaVectorPublication implements ReviewedVectorPublisher {
  constructor(private readonly client: Pick<UserDb, "raw" | "transaction">) {}
  async replace(documentId: string, rows: readonly ReviewedVectorRow[]): Promise<void> {
    if (!documentId || documentId.length > 200 || rows.length < 1 || rows.length > 8 ||
      new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Invalid Knowledge publication.");
    for (const row of rows) {
      if (row.documentId !== documentId || row.reviewed !== true || row.dimensions !== 1536 ||
        row.contentHash !== sha256(row.content) || row.page !== null || row.ordinal < 0 || !Number.isInteger(row.ordinal) ||
        !row.sources.length || ![row.id, row.passageHash, row.contentHash, row.embeddingInputHash, row.provenanceHash].every(hash => /^[a-f0-9]{64}$/u.test(hash)) ||
        row.embeddingModel !== rows[0]!.embeddingModel || row.documentVersion !== rows[0]!.documentVersion) throw new Error("Invalid Knowledge publication.");
      validateEmbedding(row.embedding, 1536);
    }
    await this.client.transaction(async tx => {
      await tx.execute(this.client.raw.sql`SET LOCAL lock_timeout = '3s'`.affectedCount().build());
      await tx.execute(this.client.raw.sql`SET LOCAL statement_timeout = '5s'`.affectedCount().build());
      // Serialize publications of the same document, including the initially empty index.
      await tx.execute(this.client.raw.sql`SELECT pg_advisory_xact_lock(hashtextextended(${documentId}, 0))`.affectedCount().build());
      await tx.execute(this.client.raw.sql`DELETE FROM public."KnowledgeChunk" WHERE "documentId" = ${documentId}`.affectedCount().build());
      for (const row of rows) {
        await tx.execute(this.client.raw.sql`INSERT INTO public."KnowledgeChunk"
          (id,"documentId","documentVersion","passageId","passageHash","contentHash","embeddingInputHash","provenanceHash",
           ordinal,content,subject,language,page,sources,"embeddingModel",dimensions,embedding,reviewed)
          VALUES (${row.id},${documentId},${row.documentVersion},${row.passageId},${row.passageHash},${row.contentHash},
          ${row.embeddingInputHash},${row.provenanceHash},${row.ordinal},${row.content},${row.subject},${row.language},NULL,
          ${JSON.stringify(row.sources)}::json,${row.embeddingModel},1536,${JSON.stringify(row.embedding)}::extensions.vector,true)`
          .affectedCount().build());
      }
    });
  }
}
