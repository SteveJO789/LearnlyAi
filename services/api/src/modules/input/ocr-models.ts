import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "./ocr-models.json" with { type: "json" };

const defaultRoot = fileURLToPath(new URL("../../../runtime-ocr/", import.meta.url));
const base = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${manifest.revision}/`;
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** HTTP may gzip the LICENSE; validate decompressed bytes, not compressed Content-Length. */
export async function readVerifiedOcrArtifact(response: Response, file: { bytes: number; sha256: string }): Promise<Buffer> {
  const advertised = response.headers.get("content-length"), encoded = response.headers.get("content-encoding");
  const declared = advertised === null ? null : Number(advertised);
  if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 8 * 1024 * 1024 || !/^[a-f0-9]{64}$/u.test(file.sha256) ||
    !response.ok || !response.body || (declared !== null && (!Number.isSafeInteger(declared) || declared < 0 || declared > 8 * 1024 * 1024 ||
      (!encoded && declared !== file.bytes)))) {
    await response.body?.cancel(); throw new Error("Invalid OCR artifact response.");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > file.bytes) { await reader.cancel(); throw new Error("OCR artifact exceeds pinned size."); }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  if (length !== file.bytes || digest(bytes) !== file.sha256) throw new Error("OCR artifact integrity mismatch.");
  return bytes;
}
async function artifact(root: string, file: typeof manifest.files[number]): Promise<boolean> {
  try {
    const path = join(root, file.name), info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== file.bytes) return false;
    return digest(await readFile(path)) === file.sha256;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
async function assertDirectory(root: string): Promise<void> {
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("OCR model directory must be a regular local directory.");
}

/** Runtime is offline: all pinned model bytes + licence must already be packaged. */
export async function verifyOcrModels(root = defaultRoot) {
  await assertDirectory(root);
  for (const file of manifest.files) if (!await artifact(root, file)) throw new Error("Packaged OCR models are missing or fail integrity validation.");
  return Object.freeze({ root, revision: manifest.revision, languages: "tha+eng", gzip: false, license: manifest.license });
}

/** Build-time only. Missing/corrupt bytes never trigger a download without an explicit flag. */
export async function prepareOcrModels(options: { root?: string; download?: boolean; fetchImpl?: typeof fetch } = {}) {
  const root = options.root ?? defaultRoot;
  await mkdir(root, { recursive: true });
  await assertDirectory(root);
  for (const file of manifest.files) {
    if (await artifact(root, file)) continue;
    if (!options.download) throw new Error("OCR models are not prepared. Run the explicit model-download command before building OCR support.");
    let temporary: string | undefined;
    try {
      const response = await (options.fetchImpl ?? fetch)(base + file.name, { redirect: "error", signal: AbortSignal.timeout(20000) });
      const bytes = await readVerifiedOcrArtifact(response, file);
      // Replace only a verified artifact; leave existing files untouched on network/hash failure.
      const target = join(root, file.name);
      try { if ((await lstat(target)).isSymbolicLink()) throw new Error("Unsafe model target"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      temporary = join(root, `${file.name}.tmp-${randomUUID()}`);
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, target); temporary = undefined;
    } catch {
      throw new Error("OCR model preparation failed. No unverified model can be used.");
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
  return verifyOcrModels(root);
}
