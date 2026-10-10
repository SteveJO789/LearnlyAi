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
export async function resumeFileUpload(sessionId: string, id: string) {
  const value = await authenticatedRequest<unknown>(base(sessionId) + `/uploads/${encodeURIComponent(id)}/resume`, { method: "POST", body: "{}" });
  const result = value as { id?: string; materialId?: string; status?: string } | null;
  if (result?.status === "CANCELLED" && result.id === id && result.materialId === id) return { status: "CANCELLED" as const, id };
  return ready(value);
}
export async function reviewFileMaterial(sessionId: string, id: string, text: string) {
  const value = await authenticatedRequest<{ materialId: string; status: string; normalizedText: string }>(base(sessionId) + `/${encodeURIComponent(id)}/review`,
    { method: "PATCH", body: JSON.stringify({ text }) });
  if (value.materialId !== id || value.status !== "READY" || typeof value.normalizedText !== "string" || !value.normalizedText.trim() || value.normalizedText.length > 8000) {
    throw new Error("File API returned an invalid response.");
  }
  return value;
}
export async function downloadFileMaterial(sessionId: string, id: string) {
  const response = await authenticatedFetch(base(sessionId) + `/${encodeURIComponent(id)}/file`);
  if (!response.ok) await readResponse(response);
  const file = await response.blob();
  if (file.size > 3 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("Stored file response is invalid.");
  return file;
}
