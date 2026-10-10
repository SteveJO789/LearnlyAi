import { ApiError } from "../../shared/api-error.js";
import { createHash } from "node:crypto";
import { MAX_FILE_BYTES, type FileEnvelope } from "./file-envelope.js";

const segment = (value: string) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/u.test(value);
const authUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
export function materialStorageKey(authUserId: string, sessionId: string, materialId: string, extension: FileEnvelope["extension"]): string {
  if (!authUuid(authUserId) || !segment(sessionId) || !segment(materialId) || !["pdf","png","jpg"].includes(extension)) throw new ApiError("VALIDATION_ERROR", 400, "Invalid owned file identity.");
  return `${authUserId}/${sessionId}/${materialId}.${extension}`;
}

/** User-JWT Storage transport. Caller must verify session ownership and configure a PRIVATE bucket/RLS. */
export class PrivateMaterialStorage {
  private readonly base: string;
  private readonly bucket: string;
  private readonly headers: Record<string,string>;
  private readonly authUserId: string;
  private readonly fetchImpl: typeof fetch;
  get bucketId(): string { return this.bucket; }
  constructor(options: { url: string; bucket: string; publishableKey: string; token: string; authUserId: string; fetchImpl?: typeof fetch }) {
    const url = new URL(options.url);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      !segment(options.bucket) || !authUuid(options.authUserId) || !options.publishableKey.trim() || !options.token.trim()) throw new Error("Private material storage configuration is invalid.");
    this.base = url.origin + "/storage/v1/object/";
    this.bucket = options.bucket; this.authUserId = options.authUserId;
    this.headers = { apikey: options.publishableKey, Authorization: `Bearer ${options.token}` };
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  private ownedKey(key: string): void {
    const parts = key.split("/");
    if (parts.length !== 3 || parts[0] !== this.authUserId || !segment(parts[1]!) || !/^[a-zA-Z0-9_-]{1,128}\.(?:pdf|png|jpg)$/u.test(parts[2]!)) throw new ApiError("FORBIDDEN", 403, "File key is outside the verified user's prefix.");
  }
  async upload(key: string, bytes: Uint8Array, file: FileEnvelope): Promise<void> {
    this.ownedKey(key);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
      throw new ApiError("INVALID_FILE", 400, "File bytes exceed upload limits.");
    }
    const body = Buffer.from(bytes);
    const mimeByExtension = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" } as const;
    if (body.byteLength !== file.sizeBytes || body.byteLength > MAX_FILE_BYTES || !key.endsWith("."+file.extension) ||
      mimeByExtension[file.extension] !== file.mimeType || createHash("sha256").update(body).digest("hex") !== file.contentHash) {
      throw new ApiError("INVALID_FILE", 400, "File envelope changed before upload.");
    }
    await this.request(this.bucket + "/" + key.split("/").map(encodeURIComponent).join("/"), {
      method: "POST", headers: { ...this.headers, "content-type": file.mimeType, "cache-control": "max-age=0", "x-upsert": "false" },
      body,
    });
  }
  async remove(key: string): Promise<void> {
    this.ownedKey(key);
    await this.request(this.bucket, { method: "DELETE", headers: { ...this.headers, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [key] }) });
  }
  /** Authenticated download, streamed and hashed without retaining educational/file bytes. */
  async verify(key: string, file: FileEnvelope): Promise<void> {
    await this.readVerified(key, file, false);
  }
  async download(key: string, file: FileEnvelope): Promise<Buffer> {
    return this.readVerified(key, file, true);
  }
  private async readVerified(key: string, file: FileEnvelope, retain: boolean): Promise<Buffer> {
    this.ownedKey(key);
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 1 || file.sizeBytes > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/u.test(file.contentHash)) {
      throw new ApiError("INVALID_UPLOAD_RECEIPT", 503, "The upload receipt could not be verified.");
    }
    let response: Response | undefined;
    const signal = AbortSignal.timeout(10000);
    try {
      response = await this.fetchImpl(this.base + "authenticated/" + this.bucket + "/" + key.split("/").map(encodeURIComponent).join("/"), {
        method: "GET", headers: { ...this.headers, "cache-control": "no-cache" }, redirect: "error", signal,
      });
      if (!response.ok || !response.body) throw new Error("Storage receipt unavailable");
      if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== file.mimeType) {
        throw new ApiError("FILE_INTEGRITY_ERROR", 422, "The stored file does not match its upload receipt.");
      }
      const reader = response.body.getReader(), hash = createHash("sha256");
      let length = 0;
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > file.sizeBytes || length > MAX_FILE_BYTES || signal.aborted) {
            throw new ApiError("FILE_INTEGRITY_ERROR", 422, "The stored file does not match its upload receipt.");
          }
          hash.update(chunk.value);
          if (retain) chunks.push(chunk.value);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (signal.aborted || length !== file.sizeBytes || hash.digest("hex") !== file.contentHash) {
        throw new ApiError("FILE_INTEGRITY_ERROR", 422, "The stored file does not match its upload receipt.");
      }
      return retain ? Buffer.concat(chunks, length) : Buffer.alloc(0);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("STORAGE_UNAVAILABLE", 503, "The stored file could not be verified. Please try again later.");
    } finally { await response?.body?.cancel().catch(() => {}); }
  }
  private async request(path: string, init: RequestInit): Promise<void> {
    try {
      const response = await this.fetchImpl(this.base + path, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) });
      // Do not retain upstream error bodies, file names, credentials or user data.
      await response.body?.cancel();
      if (!response.ok) throw new Error("Storage request failed");
    } catch { throw new ApiError("STORAGE_UNAVAILABLE", 503, "Private file storage is temporarily unavailable."); }
  }
}
