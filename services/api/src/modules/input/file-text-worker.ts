import { parentPort, workerData, Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { PNG } from "pngjs";
import { decode } from "jpeg-js";
import type { ExtractedFileText } from "./file-ingestion.js";

const require = createRequire(import.meta.url);
const fail = (code: string): never => { throw Object.assign(new Error("File processing failed."), { code }); };
globalThis.fetch = async () => { throw new Error("File extraction network access is disabled."); };

function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000 || width * height > 12000000) fail("IMAGE_TOO_LARGE");
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function decodedPng(bytes: Buffer) {
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  dimensions(width, height);
  const depth = bytes[24]!, channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[bytes[25]!];
  if (!channels || ![1, 2, 4, 8, 16].includes(depth) || ![0, 1].includes(bytes[28]!)) fail("INVALID_FILE");
  const passes = bytes[28] === 1 ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  let expected = 0;
  for (const [x, y, dx, dy] of passes) {
    const w = Math.max(0, Math.ceil((width - x!) / dx!)), h = Math.max(0, Math.ceil((height - y!) / dy!));
    if (w && h) expected += (1 + Math.ceil(w * channels! * depth / 8)) * h;
  }
  const chunks: Buffer[] = [];
  let offset = 8, ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString("ascii", offset + 4, offset + 8);
    if (length > bytes.length - offset - 12) fail("INVALID_FILE");
    // Validate ancillary chunks too; the decoder may otherwise ignore their corrupted metadata.
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) fail("INVALID_FILE");
    if (type === "IDAT") chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === "IEND") { if (length || offset !== bytes.length) fail("INVALID_FILE"); ended = true; break; }
  }
  if (!ended || !chunks.length || expected > 100 * 1024 * 1024) fail("INVALID_FILE");
  // pngjs's interlaced path has an unbounded inflate: validate the exact decompressed size first.
  if (inflateSync(Buffer.concat(chunks), { maxOutputLength: expected }).length !== expected) fail("INVALID_FILE");
  return PNG.sync.read(bytes, { checkCRC: true });
}

function jpegOrientation(bytes: Buffer) {
  let position = 2;
  while (position + 4 <= bytes.length) {
    if (bytes[position++] !== 0xff) fail("INVALID_FILE");
    while (bytes[position] === 0xff) position++;
    const marker = bytes[position++]!;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    const length = bytes.readUInt16BE(position);
    if (length < 2 || position + length > bytes.length) fail("INVALID_FILE");
    if (marker === 0xe1 && bytes.toString("latin1", position + 2, position + 8) === "Exif\0\0") {
      const data = bytes.subarray(position + 8, position + length), endian = data.toString("ascii", 0, 2);
      if (data.length < 8 || !["II", "MM"].includes(endian)) fail("INVALID_FILE");
      const u16 = (at: number) => { if (at < 0 || at + 2 > data.length) fail("INVALID_FILE"); return endian === "II" ? data.readUInt16LE(at) : data.readUInt16BE(at); };
      const u32 = (at: number) => { if (at < 0 || at + 4 > data.length) fail("INVALID_FILE"); return endian === "II" ? data.readUInt32LE(at) : data.readUInt32BE(at); };
      if (u16(2) !== 42) fail("INVALID_FILE");
      const start = u32(4), count = u16(start);
      if (count > 256 || start + 2 + count * 12 > data.length) fail("INVALID_FILE");
      for (let entry = 0; entry < count; entry++) {
        const at = start + 2 + entry * 12;
        if (u16(at) === 0x112) {
          if (u16(at + 2) !== 3 || u32(at + 4) !== 1) fail("INVALID_FILE");
          const orientation = u16(at + 8);
          if (orientation < 1 || orientation > 8) fail("INVALID_FILE");
          return orientation;
        }
      }
    }
    position += length;
  }
  return 1;
}
function orient(image: { width: number; height: number; data: Uint8Array }, orientation: number) {
  if (orientation === 1) return image;
  const { width: w, height: h } = image, width = orientation >= 5 ? h : w, height = orientation >= 5 ? w : h;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [xx, yy] = orientation === 2 ? [w - 1 - x, y] : orientation === 3 ? [w - 1 - x, h - 1 - y] :
      orientation === 4 ? [x, h - 1 - y] : orientation === 5 ? [y, x] : orientation === 6 ? [h - 1 - y, x] :
        orientation === 7 ? [h - 1 - y, w - 1 - x] : [y, w - 1 - x];
    const source = (y * w + x) * 4, target = (yy! * width + xx!) * 4;
    data.set(image.data.subarray(source, source + 4), target);
  }
  return { width, height, data };
}

async function pdfText(bytes: Uint8Array): Promise<ExtractedFileText> {
  const modulePath = "pdfjs-dist/legacy/build/pdf.mjs";
  const pdf = await import(modulePath) as typeof import("pdfjs-dist");
  const root = dirname(require.resolve("pdfjs-dist/package.json"));
  const task = pdf.getDocument({ data: bytes, verbosity: 0, stopAtErrors: true, useWorkerFetch: false,
    disableFontFace: true, useSystemFonts: false, enableXfa: false, useWasm: false,
    isOffscreenCanvasSupported: false, isImageDecoderSupported: false, maxImageSize: 12000000,
    cMapUrl: join(root, "cmaps").replaceAll("\\", "/") + "/", cMapPacked: true,
    standardFontDataUrl: join(root, "standard_fonts").replaceAll("\\", "/") + "/" });
  try {
    const document = await task.promise;
    if (!Number.isInteger(document.numPages) || document.numPages < 1) fail("INVALID_FILE");
    if (document.numPages > 10) fail("PDF_TOO_MANY_PAGES");
    const pages: { page: number; text: string }[] = [];
    let total = 0;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number), reader = page.streamTextContent().getReader();
      let text = "", separator = "";
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          for (const item of value.items) {
            if (!("str" in item)) continue;
            if (!item.str) { if (item.hasEOL) separator = "\n"; continue; }
            const piece = (text && !/\s$/u.test(text) && !/^\s/u.test(item.str) ? separator : "") + item.str;
            if (total + text.length + piece.length > 8000) fail("EXTRACTED_TEXT_TOO_LARGE");
            text += piece;
            separator = item.hasEOL ? "\n" : " ";
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); page.cleanup(); }
      text = text.trim(); total += text.length + (pages.length ? 2 : 0);
      if (total > 8000) fail("EXTRACTED_TEXT_TOO_LARGE");
      pages.push({ page: number, text });
    }
    if (!pages.some(page => page.text.trim())) fail("NO_EXTRACTABLE_TEXT");
    return { method: "PDF_TEXT", pages, confidence: null };
  } catch (error) {
    if ((error as Error).name === "PasswordException") fail("PDF_ENCRYPTED");
    throw error;
  } finally { await task.destroy(); }
}

async function imageText(bytes: Buffer, mimeType: string, root: string): Promise<ExtractedFileText> {
  const decoded = mimeType === "image/png" ? decodedPng(bytes) : decode(bytes, {
    useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 12, maxMemoryUsageInMB: 80,
  });
  dimensions(decoded.width, decoded.height);
  const image = mimeType === "image/jpeg" ? orient(decoded, jpegOrientation(bytes)) : decoded;
  // Feed a fully decoded, normalized PNG to OCR; original bytes/hash remain unchanged in Storage.
  const normalized = new PNG({ width: image.width, height: image.height });
  normalized.data = Buffer.from(image.data);
  const png = PNG.sync.write(normalized);
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const engine = await createWorker("tha+eng", OEM.LSTM_ONLY, { langPath: root, gzip: false, cacheMethod: "none",
    workerPath: fileURLToPath(new URL("./ocr-offline-worker.js", import.meta.url)),
    logger: () => {}, errorHandler: () => {} });
  const thread = (engine as unknown as { worker: Worker }).worker;
  if (!(thread instanceof Worker)) fail("INVALID_FILE");
  try {
    await engine.setParameters({ tessedit_pageseg_mode: PSM.AUTO, user_defined_dpi: "300" });
    const { data } = await engine.recognize(png, {}, { text: true });
    if (!data.text.trim()) fail("NO_EXTRACTABLE_TEXT");
    if (data.text.length > 8000) fail("EXTRACTED_TEXT_TOO_LARGE");
    return { method: "OCR", pages: [{ page: null, text: data.text }], confidence: data.confidence };
  } finally { await thread.terminate(); }
}

try {
  const { bytes, file, ocrRoot } = workerData as { bytes: Uint8Array; file: { type: string; mimeType: string }; ocrRoot?: string };
  const result = file.type === "PDF" ? await pdfText(bytes) : await imageText(Buffer.from(bytes), file.mimeType, ocrRoot!);
  parentPort!.postMessage({ ok: true, result });
} catch (error) {
  parentPort!.postMessage({ ok: false, code: (error as { code?: string }).code ?? "INVALID_FILE" });
} finally { parentPort?.close(); }
