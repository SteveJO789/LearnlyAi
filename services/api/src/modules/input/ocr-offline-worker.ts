import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// The pinned library's documented workerPath option boots this local wrapper.
// Block its fetch adapter before loading it: models/core are packaged local files.
globalThis.fetch = async () => { throw new Error("Runtime OCR network access is disabled."); };
const require = createRequire(import.meta.url);
require("tesseract.js/src/worker-script/node/index.js");
const workerScript = require("tesseract.js/src/worker-script");
const cache = require("tesseract.js/src/worker-script/node/cache");
const coreRoot = fileURLToPath(new URL("../runtime-ocr-core/", import.meta.url));
async function getCore(lstmOnly: boolean, _corePath: string, response: { progress: (value: { status: string; progress: number }) => void }) {
  const { simd, relaxedSimd } = require("wasm-feature-detect");
  const simdSupported = await simd();
  const relaxedSimdSupported = await relaxedSimd();
  const variant = relaxedSimdSupported ? "relaxedsimd" : simdSupported ? "simd" : "";
  const stem = `tesseract-core${variant ? `-${variant}` : ""}${lstmOnly === true ? "-lstm" : ""}`;
  response.progress({ status: "loading tesseract core", progress: 0 });
  const wasmBinary = readFileSync(join(coreRoot, `${stem}.wasm`));
  const Core = require(join(coreRoot, `${stem}.js`)) as (options: Record<string, unknown>) => Promise<unknown>;
  response.progress({ status: "loading tesseract core", progress: 1 });
  return (options: Record<string, unknown>) => Core({ ...options, wasmBinary });
}
workerScript.setAdapter({
  getCore,
  gunzip: require("tesseract.js/src/worker-script/node/gunzip"),
  fetch: globalThis.fetch,
  ...cache,
});
