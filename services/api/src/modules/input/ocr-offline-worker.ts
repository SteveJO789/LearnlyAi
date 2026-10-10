import { createRequire } from "node:module";
// The pinned library's documented workerPath option boots this local wrapper.
// Block its fetch adapter before loading it: models/core are packaged local files.
globalThis.fetch = async () => { throw new Error("Runtime OCR network access is disabled."); };
const require = createRequire(import.meta.url);
require("tesseract.js/src/worker-script/node/index.js");
