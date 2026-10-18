import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
const target = new URL('../runtime-workers/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['file-text-worker.js', 'ocr-offline-worker.js']) {
  await copyFile(new URL('../dist/modules/input/' + name, import.meta.url), new URL(name, target));
}

const coreManifest = JSON.parse(await readFile(new URL('../src/modules/input/ocr-core-assets.json', import.meta.url), 'utf8'));
const packageRoot = new URL('../node_modules/tesseract.js-core/', import.meta.url);
const packageInfo = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'));
if (coreManifest.packageVersion !== '7.0.0' || packageInfo.version !== coreManifest.packageVersion) {
  throw new Error('Unsupported tesseract.js-core package version.');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const verified = [];
for (const file of coreManifest.files) {
  if (!/^[A-Za-z0-9.-]+$/u.test(file.name)) throw new Error('Invalid pinned OCR core asset name.');
  const source = new URL(file.name, packageRoot);
  const info = await lstat(source);
  const bytes = await readFile(source);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== file.bytes || hash(bytes) !== file.sha256) {
    throw new Error('Installed tesseract.js-core files differ from the pinned asset manifest.');
  }
  verified.push({ file, bytes });
}
const coreTarget = new URL('../runtime-ocr-core/', import.meta.url);
await mkdir(coreTarget, { recursive: true });
for (const { file } of verified) await copyFile(new URL(file.name, packageRoot), new URL(file.name, coreTarget));
await writeFile(new URL('package.json', coreTarget), JSON.stringify({ type: 'commonjs' }));
for (const { file } of verified) {
  const bytes = await readFile(new URL(file.name, coreTarget));
  if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error('Copied OCR core asset failed integrity validation.');
}
console.log('Prepared input workers and pinned tesseract.js-core assets.');
