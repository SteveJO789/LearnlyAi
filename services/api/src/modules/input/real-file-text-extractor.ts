import { Worker } from "node:worker_threads";
import { ApiError } from "../../shared/api-error.js";
import { inspectFileEnvelope, type FileEnvelope } from "./file-envelope.js";
import { normalizeFileExtraction, type ExtractedFileText, type FileTextExtractor } from "./file-ingestion.js";
import { verifyOcrModels } from "./ocr-models.js";

const failures = {
  INVALID_FILE: [422, "The file could not be decoded or read."],
  PDF_ENCRYPTED: [422, "Password-protected PDFs are not supported."],
  PDF_TOO_MANY_PAGES: [413, "PDFs must contain at most 10 pages."],
  IMAGE_TOO_LARGE: [413, "Images must be at most 12 million pixels."],
  EXTRACTED_TEXT_TOO_LARGE: [413, "Extracted text must be at most 8000 characters."],
  NO_EXTRACTABLE_TEXT: [422, "No readable text was found in the file."],
  FILE_PROCESSING_TIMEOUT: [504, "File processing took too long."],
  FILE_PROCESSING_LIMIT: [413, "The file exceeds processing limits."],
  OCR_MODELS_UNAVAILABLE: [503, "Packaged OCR models are unavailable."],
} as const;
type Failure = keyof typeof failures;
const controlled = (code: Failure) => new ApiError(code, failures[code][0], failures[code][1]);
let activeWorkers = 0;

/** Per-request isolated CPU work. No worker pool/daemon, credentials or runtime model downloads. */
export class RealFileTextExtractor implements FileTextExtractor {
  private readonly timeoutMs: number;
  constructor(private readonly options: { timeoutMs?: number; ocrRoot?: string } = {}) {
    this.timeoutMs = options.timeoutMs ?? 15000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 15000) throw new Error("Invalid file processing timeout.");
  }
  async extract(bytes: Uint8Array, file: FileEnvelope, incomingSignal: AbortSignal): Promise<ExtractedFileText> {
    const signal = AbortSignal.any([incomingSignal, AbortSignal.timeout(this.timeoutMs)]);
    if (signal.aborted) throw controlled("FILE_PROCESSING_TIMEOUT");
    const checked = inspectFileEnvelope(bytes, file.mimeType, file.filename);
    if (checked.contentHash !== file.contentHash || checked.type !== file.type || checked.sizeBytes !== file.sizeBytes || checked.extension !== file.extension) {
      throw controlled("INVALID_FILE");
    }
    // Restrict expensive WASM/image work to one concurrent request per process; no unbounded queue.
    if (activeWorkers) throw new ApiError("FILE_PROCESSING_BUSY", 503, "File processing is busy. Please try again shortly.");
    activeWorkers++;
    let worker: Worker | undefined;
    try {
      let ocrRoot: string | undefined;
      if (file.type === "IMAGE") {
        try { ocrRoot = (await verifyOcrModels(this.options.ocrRoot, signal)).root; }
        catch { throw controlled(signal.aborted ? "FILE_PROCESSING_TIMEOUT" : "OCR_MODELS_UNAVAILABLE"); }
      }
      if (signal.aborted) throw controlled("FILE_PROCESSING_TIMEOUT");
      const snapshot = Uint8Array.from(bytes);
      worker = new Worker(new URL("../../../runtime-workers/file-text-worker.js", import.meta.url), {
        workerData: { bytes: snapshot, file: { type: file.type, mimeType: file.mimeType }, ocrRoot },
        transferList: [snapshot.buffer], env: {}, execArgv: [],
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
        stdout: true, stderr: true,
      });
      // Library diagnostics must never leak names, extracted text, credentials or raw file bytes.
      worker.stdout.on("data", () => {}); worker.stderr.on("data", () => {});
      const running = worker;
      const output = await new Promise<ExtractedFileText>((resolve, reject) => {
        const deadline = setTimeout(() => finish(controlled("FILE_PROCESSING_TIMEOUT")), this.timeoutMs);
        const abort = () => finish(controlled("FILE_PROCESSING_TIMEOUT"));
        let settled = false;
        function finish(error?: ApiError, result?: ExtractedFileText) {
          if (settled) return; settled = true;
          clearTimeout(deadline); signal.removeEventListener("abort", abort);
          if (error) reject(error); else resolve(result!);
        }
        signal.addEventListener("abort", abort, { once: true });
        running.once("message", (value: unknown) => {
          if (!value || typeof value !== "object") { finish(controlled("INVALID_FILE")); return; }
          const message = value as { ok?: unknown; result?: ExtractedFileText; code?: unknown };
          if (message.ok === true && message.result) {
            try { finish(undefined, normalizeFileExtraction(message.result, file).extraction); }
            catch (error) { finish(error instanceof ApiError ? error : controlled("INVALID_FILE")); }
          } else {
            const code = typeof message.code === "string" && Object.hasOwn(failures, message.code) ? message.code as Failure : "INVALID_FILE";
            finish(controlled(code));
          }
        });
        running.once("error", error => finish(controlled((error as NodeJS.ErrnoException).code === "ERR_WORKER_OUT_OF_MEMORY" ? "FILE_PROCESSING_LIMIT" : "INVALID_FILE")));
        running.once("exit", () => { if (!settled) finish(controlled("INVALID_FILE")); });
        if (signal.aborted) abort();
      });
      if (signal.aborted) throw controlled("FILE_PROCESSING_TIMEOUT");
      return output;
    } finally {
      // Await actual Worker exit even after timeout. Node stops the worker's nested threads too.
      try { if (worker) await worker.terminate(); }
      finally { activeWorkers--; }
    }
  }
}
