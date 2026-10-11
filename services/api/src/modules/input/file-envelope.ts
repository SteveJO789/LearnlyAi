import { createHash } from "node:crypto";
import { ApiError } from "../../shared/api-error.js";

export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export type FileMime = "application/pdf" | "image/png" | "image/jpeg";
export interface FileEnvelope {
  readonly type: "PDF" | "IMAGE";
  readonly mimeType: FileMime;
  readonly extension: "pdf" | "png" | "jpg";
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly filename: string;
}
const invalid = () => new ApiError("INVALID_FILE", 400, "The file header/content does not match a supported format.");

/** Preliminary envelope checks. A real decoder/extractor MUST succeed before READY/storage ingestion. */
export function inspectFileEnvelope(bytes: Uint8Array, declaredMime: string, filename: string): FileEnvelope {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw invalid();
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ApiError("FILE_TOO_LARGE", 413, "Files must be at most 3 MiB.");
  if (typeof filename !== "string" || !filename.trim() || filename.length > 128 || /[\u0000-\u001f\u007f/\\]/u.test(filename) || filename === "." || filename === "..") {
    throw new ApiError("VALIDATION_ERROR", 400, "Use a plain filename of at most 128 characters.");
  }
  const mime = typeof declaredMime === "string" ? declaredMime.trim().toLowerCase() : "";
  if (!["application/pdf", "image/png", "image/jpeg"].includes(mime)) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", 415, "Only PDF, PNG and JPEG files are supported.");
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let detected: FileMime, extension: FileEnvelope["extension"];
  if (buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
    buffer.readUInt32BE(8) === 13 && buffer.subarray(12,16).toString("ascii") === "IHDR") {
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    if (!width || !height || width > 10000 || height > 10000 || width * height > 12000000) throw new ApiError("IMAGE_TOO_LARGE", 413, "Images must be at most 12 million pixels.");
    detected = "image/png"; extension = "png";
  } else if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 &&
    buffer[buffer.length-2] === 255 && buffer[buffer.length-1] === 217) {
    detected = "image/jpeg"; extension = "jpg";
  } else if (/^%PDF-\d\.\d(?:\r?\n|\r)/u.test(buffer.subarray(0,16).toString("ascii")) &&
    /%%EOF\s*$/u.test(buffer.subarray(Math.max(0,buffer.length-1024)).toString("latin1"))) {
    detected = "application/pdf"; extension = "pdf";
  } else throw invalid();
  if (detected !== mime) throw invalid();
  return Object.freeze({ type: detected === "application/pdf" ? "PDF" : "IMAGE", mimeType: detected, extension,
    sizeBytes: bytes.byteLength, contentHash: createHash("sha256").update(buffer).digest("hex"), filename: filename.normalize("NFC").trim() });
}
