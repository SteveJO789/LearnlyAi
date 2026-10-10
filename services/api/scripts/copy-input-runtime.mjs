import { copyFile, mkdir } from 'node:fs/promises';
const target = new URL('../runtime-workers/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['file-text-worker.js', 'ocr-offline-worker.js']) {
  await copyFile(new URL('../dist/modules/input/' + name, import.meta.url), new URL(name, target));
}
console.log('Prepared 2 compiled input workers. OCR model verification is separate.');
