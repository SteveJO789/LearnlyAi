import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../../../contracts/learning-output.schema.json", import.meta.url);
const targetDirectory = new URL("../dist/contracts/", import.meta.url);
const target = new URL("learning-output.schema.json", targetDirectory);

await mkdir(targetDirectory, { recursive: true });
await copyFile(source, target);

// Vercel runs the source Express entrypoint; keep the same local schema path there.
const sourceRuntimeDirectory = new URL("../src/contracts/", import.meta.url);
await mkdir(sourceRuntimeDirectory, { recursive: true });
await copyFile(source, new URL("learning-output.schema.json", sourceRuntimeDirectory));
