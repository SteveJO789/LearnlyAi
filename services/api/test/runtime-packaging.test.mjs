import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('Vercel include pattern fits platform schema and includes actual dynamic OCR/PDF dependencies and runtime assets', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const { includeFiles, excludeFiles } = config.functions['src/**'];
  assert.deepEqual(config.git.deploymentEnabled, { '**': false, develop: true });
  // Public platform schema https://openapi.vercel.sh/vercel.json, maxLength 256.
  assert.ok(includeFiles.length <= 256);
  assert.equal(excludeFiles, '**/*.map');
  const paths = new Set(globSync(includeFiles, { cwd: root }).map(path => path.replaceAll('\\', '/')));
  for (const path of ['runtime-knowledge/build/concepts/physics/electricity/ohms-law.json',
    'runtime-ocr/eng.traineddata', 'runtime-ocr/tha.traineddata', 'runtime-workers/file-text-worker.js',
    'runtime-workers/ocr-offline-worker.js', 'src/contracts/learning-output.schema.json']) assert.ok(paths.has(path), path);
  for (const name of ['tesseract.js', 'tesseract.js-core', 'pngjs', 'jpeg-js', 'pdfjs-dist', 'bmp-js',
    'wasm-feature-detect', 'is-url', 'zlibjs', 'regenerator-runtime', 'idb-keyval']) {
    assert.ok(paths.has(`node_modules/${name}/package.json`), name);
  }
});
