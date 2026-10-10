import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "../../shared/api-error.js";
import { inspectFileEnvelope, MAX_FILE_BYTES, type FileEnvelope } from "./file-envelope.js";
import { materialStorageKey } from "./private-material-storage.js";
import { normalizeTextMaterial } from "./text-materials.js";

export interface ExtractedFilePage { readonly page: number | null; readonly text: string }
export interface ExtractedFileText {
  readonly method: "PDF_TEXT" | "OCR";
  readonly pages: readonly ExtractedFilePage[];
  readonly confidence: number | null;
}
/** Implementations must fully decode, honor abort, and release workers/resources before rejecting. */
export interface FileTextExtractor {
  extract(bytes: Uint8Array, file: FileEnvelope, signal: AbortSignal): Promise<ExtractedFileText>;
}
export interface PreparedFileMaterial {
  readonly id: string;
  readonly storageKey: string;
  readonly storageBucket: string;
  readonly file: FileEnvelope;
  readonly normalizedText: string;
  readonly normalizedHash: string;
  readonly extraction: ExtractedFileText;
}
export interface FileMaterialStore {
  assertActiveOwnedSession(sessionId: string): Promise<void>;
  reserve(sessionId: string, material: PreparedFileMaterial): Promise<void>;
  load(sessionId: string, materialId: string): Promise<{ state: "PENDING" | "FINALIZED" | "CANCELLED"; material: PreparedFileMaterial }>;
  /** Commit cancellation under the same parent lock used by save. Never cancel a READY receipt. */
  cancel(sessionId: string, material: PreparedFileMaterial): Promise<"CANCELLED" | "SAVED" | "UNKNOWN">;
  /** Recheck active ownership in the INSERT transaction; do not trust the earlier read. */
  save(sessionId: string, material: PreparedFileMaterial): Promise<void>;
  /** Serialize with save before determining absence. An unreadable/mismatched receipt is UNKNOWN. */
  resolveSave(sessionId: string, material: PreparedFileMaterial): Promise<"SAVED" | "NOT_SAVED" | "UNKNOWN">;
}
export interface FileObjectStorage {
  readonly bucketId: string;
  upload(key: string, bytes: Uint8Array, file: FileEnvelope): Promise<void>;
  remove(key: string): Promise<void>;
  verify(key: string, file: FileEnvelope): Promise<void>;
}

/** A durable intent is internal input, never a trusted teaching source. Validate before network access. */
export function validatePreparedFileMaterial(value: PreparedFileMaterial, sessionId: string, id: string, authUserId: string, bucket: string) {
  const file = value?.file;
  const mime = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" } as const;
  if (!file || !["pdf", "png", "jpg"].includes(file.extension) || mime[file.extension] !== file.mimeType ||
    file.type !== (file.extension === "pdf" ? "PDF" : "IMAGE") || !Number.isInteger(file.sizeBytes) ||
    file.sizeBytes < 1 || file.sizeBytes > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/u.test(file.contentHash) ||
    typeof file.filename !== "string" || !file.filename.trim() || file.filename.length > 128 || /[\u0000-\u001f\u007f/\\]/u.test(file.filename) ||
    value.id !== id || value.storageBucket !== bucket || value.storageKey !== materialStorageKey(authUserId, sessionId, id, file.extension)) {
    throw new ApiError("INVALID_UPLOAD_RECEIPT", 503, "The upload receipt could not be verified.");
  }
  const normalized = normalizeFileExtraction(value.extraction, file);
  if (normalized.normalizedHash !== value.normalizedHash || normalized.normalizedText !== value.normalizedText) {
    throw new ApiError("INVALID_UPLOAD_RECEIPT", 503, "The upload receipt could not be verified.");
  }
  return Object.freeze({ id, storageKey: value.storageKey, storageBucket: bucket, file: Object.freeze({ ...file }), ...normalized });
}

function readyResult(material: PreparedFileMaterial) {
  return { id: material.id, materialId: material.id, type: material.file.type, status: "READY" as const,
    normalizedText: material.normalizedText, contentHash: material.file.contentHash,
    mimeType: material.file.mimeType, sizeBytes: material.file.sizeBytes };
}

export function normalizeFileExtraction(value: ExtractedFileText, file: FileEnvelope) {
  if (!value || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > 10 ||
    !["PDF_TEXT", "OCR"].includes(value.method) ||
    (value.confidence !== null && (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 100))) {
    throw new ApiError("INVALID_EXTRACTION", 422, "The file extraction result is invalid or exceeds page limits.");
  }
  if (file.type === "IMAGE" && (value.method !== "OCR" || value.pages.length !== 1 || value.pages[0]?.page !== null)) {
    throw new ApiError("INVALID_EXTRACTION", 422, "Image input requires decoded OCR text.");
  }
  let length = 0;
  const pages = Array.from(value.pages).map((page, index) => {
    if (!page || typeof page.text !== "string" || page.text.length > 8000 ||
      (file.type === "PDF" && page.page !== index + 1)) throw new ApiError("INVALID_EXTRACTION", 422, "Extracted page metadata is invalid.");
    // Empty PDF pages retain their actual page numbers; no invented page/citation identity.
    const text = page.text.trim() ? normalizeTextMaterial(page.text) : "";
    length += text.length;
    if (length > 8000) throw new ApiError("EXTRACTED_TEXT_TOO_LARGE", 413, "Extracted text must be at most 8000 characters.");
    return Object.freeze({ page: page.page, text });
  });
  const joined = pages.map(page => page.text).filter(Boolean).join("\n\n");
  if (!joined) throw new ApiError("NO_EXTRACTABLE_TEXT", 422, "No readable text was found in the file.");
  if (joined.length > 8000) throw new ApiError("EXTRACTED_TEXT_TOO_LARGE", 413, "Extracted text must be at most 8000 characters.");
  const normalizedText = normalizeTextMaterial(joined);
  return Object.freeze({ normalizedText, normalizedHash: createHash("sha256").update(normalizedText, "utf8").digest("hex"),
    extraction: Object.freeze({ method: value.method, confidence: value.confidence, pages: Object.freeze(pages) }) });
}

/** No Mock/default extractor. Only wire this service after the real decoder/OCR and private RLS are verified. */
export class FileIngestion {
  constructor(private readonly store: FileMaterialStore, private readonly storage: FileObjectStorage,
    private readonly extractor: FileTextExtractor, private readonly authUserId: string,
    private readonly onCleanupFailure: (materialId: string) => void = () => {}) {}

  async ingest(sessionId: string, bytes: Uint8Array, mimeType: string, filename: string) {
    const file = inspectFileEnvelope(bytes, mimeType, filename);
    await this.store.assertActiveOwnedSession(sessionId);
    // Keep a request-owned byte snapshot; transport rechecks the original hash before upload.
    const snapshot = Buffer.from(bytes);
    if (createHash("sha256").update(snapshot).digest("hex") !== file.contentHash) throw new ApiError("INVALID_FILE", 400, "File changed before extraction.");
    const id = randomUUID(), storageKey = materialStorageKey(this.authUserId, sessionId, id, file.extension);
    const signal = AbortSignal.timeout(15000);
    let result: ExtractedFileText;
    try { result = await this.extractor.extract(snapshot, file, signal); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      if (signal.aborted) throw new ApiError("FILE_PROCESSING_TIMEOUT", 504, "File processing took too long.");
      throw new ApiError("INVALID_FILE", 422, "The file could not be decoded or read.");
    }
    if (signal.aborted) throw new ApiError("FILE_PROCESSING_TIMEOUT", 504, "File processing took too long.");
    const normalized = normalizeFileExtraction(result, file);
    // Extraction must not change the original binary file that is to be stored.
    if (createHash("sha256").update(snapshot).digest("hex") !== file.contentHash) throw new ApiError("INVALID_FILE", 400, "File changed during extraction.");
    const material = Object.freeze({ id, storageKey, storageBucket: this.storage.bucketId, file, ...normalized });
    // No Storage mutation before a confirmed durable intent. A lost reservation response
    // can leave an unused intent, but cannot leave an untracked object.
    try { await this.store.reserve(sessionId, material); }
    catch {
      this.notify(id);
      throw new ApiError("FILE_RECONCILIATION_REQUIRED", 503, "The upload preparation could not be confirmed. Please try again later.");
    }
    try { await this.storage.upload(storageKey, snapshot, file); }
    catch (error) {
      this.notify(id); // Keep the intent for a later exact-byte verification; never re-upload or blindly delete.
      if (error instanceof ApiError) throw error;
      throw new ApiError("STORAGE_UNAVAILABLE", 503, "Private file storage is temporarily unavailable.");
    }
    return this.persist(sessionId, material);
  }

  /** Explicit owner-triggered recovery, no background worker or automatic upload retry. */
  async resume(sessionId: string, id: string) {
    const receipt = await this.store.load(sessionId, id);
    const material = validatePreparedFileMaterial(receipt.material, sessionId, id, this.authUserId, this.storage.bucketId);
    if (receipt.state === "CANCELLED") {
      await this.cleanup(material);
      return { id, materialId: id, status: "CANCELLED" as const };
    }
    if (!["PENDING", "FINALIZED"].includes(receipt.state)) throw new ApiError("INVALID_UPLOAD_RECEIPT", 503, "The upload receipt could not be verified.");
    // A successful HTTP upload response is not required after restart. Exact bytes are.
    await this.storage.verify(material.storageKey, material.file);
    return this.persist(sessionId, material);
  }

  private notify(id: string) {
    try { this.onCleanupFailure(id); } catch { /* Diagnostics must not disclose or replace the controlled error. */ }
  }
  private async cleanup(material: PreparedFileMaterial) {
    try { await this.storage.remove(material.storageKey); }
    catch {
      this.notify(material.id);
      throw new ApiError("FILE_CLEANUP_REQUIRED", 503, "The file could not be saved. Please try again later.");
    }
  }

  private async persist(sessionId: string, material: PreparedFileMaterial) {
    const { id } = material;
    try {
      await this.store.save(sessionId, material);
    } catch (error) {
      // A rejected COMMIT response does not prove rollback. Never delete a committed file.
      let outcome: "SAVED" | "NOT_SAVED" | "UNKNOWN" = "UNKNOWN";
      try { outcome = await this.store.resolveSave(sessionId, material); } catch { /* Keep the file on an unavailable receipt read. */ }
      if (outcome !== "SAVED") {
        if (outcome !== "NOT_SAVED") {
          this.notify(id);
          throw new ApiError("FILE_RECONCILIATION_REQUIRED", 503, "The file save result could not be confirmed. Please try again later.");
        }
        // Persist cancellation BEFORE deleting. Other resumers must observe cancellation
        // under the parent lock, preventing a finalize-versus-delete race.
        let cancelled: "CANCELLED" | "SAVED" | "UNKNOWN" = "UNKNOWN";
        try { cancelled = await this.store.cancel(sessionId, material); } catch { /* A lost cancellation response is ambiguous. */ }
        if (cancelled === "SAVED") return readyResult(material);
        if (cancelled !== "CANCELLED") {
          this.notify(id);
          throw new ApiError("FILE_RECONCILIATION_REQUIRED", 503, "The file save result could not be confirmed. Please try again later.");
        }
        await this.cleanup(material);
        if (error instanceof ApiError) throw error;
        throw new ApiError("MATERIAL_PERSISTENCE_UNAVAILABLE", 503, "The file could not be saved. Please try again later.");
      }
    }
    return readyResult(material);
  }
}
