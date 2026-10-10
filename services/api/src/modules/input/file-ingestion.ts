import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "../../shared/api-error.js";
import { inspectFileEnvelope, type FileEnvelope } from "./file-envelope.js";
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
  readonly file: FileEnvelope;
  readonly normalizedText: string;
  readonly normalizedHash: string;
  readonly extraction: ExtractedFileText;
}
export interface FileMaterialStore {
  assertActiveOwnedSession(sessionId: string): Promise<void>;
  /** Recheck active ownership in the INSERT transaction; do not trust the earlier read. */
  save(sessionId: string, material: PreparedFileMaterial): Promise<void>;
}
export interface FileObjectStorage {
  upload(key: string, bytes: Uint8Array, file: FileEnvelope): Promise<void>;
  remove(key: string): Promise<void>;
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
    const normalized = normalizeFileExtraction(result, file);
    // Extraction must not change the original binary file that is to be stored.
    if (createHash("sha256").update(snapshot).digest("hex") !== file.contentHash) throw new ApiError("INVALID_FILE", 400, "File changed during extraction.");
    await this.storage.upload(storageKey, snapshot, file);
    try {
      await this.store.save(sessionId, Object.freeze({ id, storageKey, file, ...normalized }));
    } catch (error) {
      // Compensate only a confirmed successful upload. Ambiguous transport outcomes need reconciliation.
      try { await this.storage.remove(storageKey); }
      catch {
        try { this.onCleanupFailure(id); } catch { /* Logging must not expose or replace a controlled failure. */ }
        throw new ApiError("FILE_CLEANUP_REQUIRED", 503, "The file could not be saved. Please try again later.");
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError("MATERIAL_PERSISTENCE_UNAVAILABLE", 503, "The file could not be saved. Please try again later.");
    }
    return { id, materialId: id, type: file.type, status: "READY" as const, normalizedText: normalized.normalizedText,
      contentHash: file.contentHash, mimeType: file.mimeType, sizeBytes: file.sizeBytes };
  }
}
