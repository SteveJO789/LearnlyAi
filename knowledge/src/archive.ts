import { strFromU8, unzipSync } from "fflate";

import { SourceProcessingError } from "./source-processing-error.js";

const MAX_EXPANDED_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 20_000;

export function unzipControlled(bytes: Uint8Array): Record<string, Uint8Array> {
  let expandedBytes = 0;
  let fileCount = 0;

  try {
    const files = unzipSync(bytes, {
      filter(file) {
        fileCount += 1;
        expandedBytes += file.originalSize;
        if (fileCount > MAX_ARCHIVE_FILES || expandedBytes > MAX_EXPANDED_ARCHIVE_BYTES) {
          throw new SourceProcessingError("NORMALIZATION_FAILED", "Archive exceeds the extraction safety limit");
        }
        const normalized = file.name.replaceAll("\\", "/");
        if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
          throw new SourceProcessingError("NORMALIZATION_FAILED", `Archive contains an unsafe path: ${file.name}`);
        }
        return !normalized.endsWith("/");
      },
    });
    return files;
  } catch (error) {
    if (error instanceof SourceProcessingError) throw error;
    throw new SourceProcessingError("NORMALIZATION_FAILED", "Could not extract ZIP/EPUB artifact", { cause: error });
  }
}

export function decodeUtf8(bytes: Uint8Array, filename: string): string {
  try {
    return strFromU8(bytes);
  } catch (error) {
    throw new SourceProcessingError("NORMALIZATION_FAILED", `Could not decode UTF-8 file: ${filename}`, { cause: error });
  }
}
