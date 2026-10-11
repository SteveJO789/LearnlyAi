"use client";
import { authenticatedFetch, authenticatedRequest, readResponse } from "./learning-sessions";

export type FileMaterialDto = { id: string; materialId: string; type: "PDF" | "IMAGE"; status: "READY"; normalizedText: string;
  contentHash: string; mimeType: string; sizeBytes: number };
export type UploadReceiptDto = { id: string; state: "PENDING" | "FINALIZED" | "CANCELLED"; type: string; filename: string; createdAt: string };
const base = (sessionId: string) => `/api/learning-sessions/${encodeURIComponent(sessionId)}/materials`;
export function validateSelectedFile(file: File) {
  if (!file.size || file.size > 3 * 1024 * 1024) throw new Error("Files must be at most 3 MiB.");
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("Use PDF, PNG or JPEG files.");
  if (!file.name.trim() || file.name.length > 128 || /[\u0000-\u001f\u007f/\\]/u.test(file.name)) throw new Error("Use a plain filename of at most 128 characters.");
}
function ready(value: unknown): FileMaterialDto {
  const m = value as FileMaterialDto | null;
  if (!m || typeof m.id !== "string" || !m.id || m.materialId !== m.id || m.status !== "READY" || !["PDF", "IMAGE"].includes(m.type) ||
    typeof m.normalizedText !== "string" || !m.normalizedText.trim() || m.normalizedText.length > 8000 ||
    !/^[a-f0-9]{64}$/u.test(m.contentHash) || !["application/pdf", "image/png", "image/jpeg"].includes(m.mimeType) ||
    !Number.isInteger(m.sizeBytes) || m.sizeBytes < 1 || m.sizeBytes > 3 * 1024 * 1024) throw new Error("File API returned an invalid response.");
  return m;
}
export async function uploadFileMaterial(sessionId: string, file: File, signal?: AbortSignal) {
  validateSelectedFile(file);
  return ready(await readResponse(await authenticatedFetch(base(sessionId) + "/files", { method: "POST", body: file, signal }, file.type,
    { "x-file-name": encodeURIComponent(file.name) })));
}
export async function listUploadReceipts(sessionId: string): Promise<UploadReceiptDto[]> {
  const value = await authenticatedRequest<unknown>(base(sessionId) + "/uploads");
  if (!Array.isArray(value) || value.length > 20 || value.some(m => !m || typeof m.id !== "string" || !["PENDING", "FINALIZED", "CANCELLED"].includes(m.state) ||
    !["PDF", "IMAGE"].includes(m.type) || typeof m.filename !== "string" || typeof m.createdAt !== "string")) throw new Error("File API returned an invalid response.");
  return value;
}
export async function resumeFileUpload(sessionId: string, id: string, signal?: AbortSignal) {
  const value = await authenticatedRequest<unknown>(base(sessionId) + `/uploads/${encodeURIComponent(id)}/resume`, { method: "POST", body: "{}", signal });
  const result = value as { id?: string; materialId?: string; status?: string } | null;
  if (result?.status === "CANCELLED" && result.id === id && result.materialId === id) return { status: "CANCELLED" as const, id };
  return ready(value);
}
export async function cancelFileUpload(sessionId: string, id: string, signal?: AbortSignal) {
  const value = await authenticatedRequest<unknown>(base(sessionId) + `/uploads/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}", signal });
  const result = value as { id?: string; materialId?: string; status?: string } | null;
  if (result?.status === "CANCELLED" && result.id === id && result.materialId === id) return { status: "CANCELLED" as const, id };
  const material = ready(value);
  if (material.id !== id) throw new Error("File API returned an invalid cancellation response.");
  return material;
}
export async function reviewFileMaterial(sessionId: string, id: string, text: string, signal?: AbortSignal) {
  const value = await authenticatedRequest<{ materialId: string; status: string; normalizedText: string }>(base(sessionId) + `/${encodeURIComponent(id)}/review`,
    { method: "PATCH", body: JSON.stringify({ text }), signal });
  if (value.materialId !== id || value.status !== "READY" || typeof value.normalizedText !== "string" || !value.normalizedText.trim() || value.normalizedText.length > 8000) {
    throw new Error("File API returned an invalid response.");
  }
  return value;
}
export async function downloadFileMaterial(sessionId: string, id: string, signal?: AbortSignal) {
  const response = await authenticatedFetch(base(sessionId) + `/${encodeURIComponent(id)}/file`, { signal });
  if (!response.ok) await readResponse(response);
  const mime = response.headers.get("content-type")?.split(";", 1)[0] ?? "";
  if (!["application/pdf", "image/png", "image/jpeg"].includes(mime) || Number(response.headers.get("content-length")) > 3 * 1024 * 1024) {
    await response.body?.cancel(); throw new Error("Stored file response is invalid.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Stored file response is invalid.");
  let size = 0; const parts: Uint8Array<ArrayBuffer>[] = [];
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 3 * 1024 * 1024) { await reader.cancel(); throw new Error("Stored file response is invalid."); }
      parts.push(new Uint8Array(next.value));
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new Error("Stored file response is invalid.");
  return new Blob(parts, { type: mime });
}

export interface FileHistoryItem { id: string; sessionId: string; sessionTitle: string; type: "PDF" | "IMAGE";
  mimeType: string; sizeBytes: number; filename: string; uploadedAt: string | null; normalizedText: string | null;
  reviewedByLearner: boolean; canReview: boolean }
export interface FileHistoryPage { items: FileHistoryItem[]; nextCursor: string | null }
const validId = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/u.test(value);
export async function listFileHistory(filters: { after?: string; from?: string; to?: string } = {}, signal?: AbortSignal): Promise<FileHistoryPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const value = await readResponse<unknown>(await authenticatedFetch(`/api/users/me/files${query.size ? `?${query}` : ""}`, { signal }));
  const page = value as FileHistoryPage | null;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && !validId(page.nextCursor) ||
    new Set(page.items.map(item => item?.id)).size !== page.items.length || page.items.some(item => !item || !validId(item.id) || !validId(item.sessionId) ||
      typeof item.sessionTitle !== "string" || item.sessionTitle.length > 200 || !["PDF", "IMAGE"].includes(item.type) ||
      !["application/pdf", "image/png", "image/jpeg"].includes(item.mimeType) || (item.type === "PDF") !== (item.mimeType === "application/pdf") ||
      !Number.isInteger(item.sizeBytes) || item.sizeBytes < 1 || item.sizeBytes > 3 * 1024 * 1024 ||
      typeof item.filename !== "string" || item.filename.length > 128 || /[\u0000-\u001f\u007f/\\]/u.test(item.filename) ||
      item.uploadedAt !== null && (typeof item.uploadedAt !== "string" || !Number.isFinite(Date.parse(item.uploadedAt))) ||
      item.normalizedText !== null && (typeof item.normalizedText !== "string" || !item.normalizedText.trim() || item.normalizedText.length > 8000) ||
      typeof item.reviewedByLearner !== "boolean" || typeof item.canReview !== "boolean")) throw new Error("File API returned an invalid response.");
  if (page.nextCursor !== null && (!page.items.length || page.nextCursor !== page.items.at(-1)!.id)) throw new Error("File API returned an invalid cursor.");
  return page;
}
export interface UploadHistoryItem { id: string; sessionId: string; sessionTitle: string; state: "PENDING" | "CANCELLED";
  filename: string; type: "PDF" | "IMAGE"; createdAt: string; canResume: boolean }
export interface UploadHistoryPage { items: UploadHistoryItem[]; nextCursor: string | null }
export async function listUploadHistory(filters: { after?: string; from?: string; to?: string } = {}, signal?: AbortSignal): Promise<UploadHistoryPage> {
  const query = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const value = await readResponse<unknown>(await authenticatedFetch(`/api/users/me/files/uploads${query.size ? `?${query}` : ""}`, { signal }));
  const page = value as UploadHistoryPage | null;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && !validId(page.nextCursor) ||
    new Set(page.items.map(item => item?.id)).size !== page.items.length || page.items.some(item => !item || !validId(item.id) || !validId(item.sessionId) ||
      typeof item.sessionTitle !== "string" || item.sessionTitle.length > 200 || !["PENDING", "CANCELLED"].includes(item.state) || !["PDF", "IMAGE"].includes(item.type) ||
      typeof item.filename !== "string" || item.filename.length > 128 || /[\u0000-\u001f\u007f/\\]/u.test(item.filename) ||
      typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) || typeof item.canResume !== "boolean" ||
      item.state === "CANCELLED" && item.canResume)) throw new Error("File API returned an invalid upload-history response.");
  if (page.nextCursor !== null && (!page.items.length || page.nextCursor !== page.items.at(-1)!.id)) throw new Error("File API returned an invalid upload-history cursor.");
  return page;
}
