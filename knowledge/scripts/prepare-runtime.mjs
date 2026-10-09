import { fileURLToPath } from "node:url";
import { prepareRuntimeKnowledge } from "../dist/runtime-knowledge.js";

const files = prepareRuntimeKnowledge(
  fileURLToPath(new URL("../", import.meta.url)),
  fileURLToPath(new URL("../../services/api/runtime-knowledge/", import.meta.url)),
);
const bytes = [...files.values()].reduce((sum, content) => sum + Buffer.byteLength(content), 0);
console.log(`Prepared validated reviewed Ohm's Law 0.2.0: ${files.size} files, ${bytes} bytes.`);
