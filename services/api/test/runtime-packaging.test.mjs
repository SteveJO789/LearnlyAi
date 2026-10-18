import assert from 'node:assert/strict';
import { cpSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { textPdf } from './real-file-fixtures.mjs';

test('Vercel include pattern fits platform schema and includes actual dynamic OCR/PDF dependencies and runtime assets', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const { includeFiles, excludeFiles } = config.functions['src/**'];
  assert.deepEqual(config.git.deploymentEnabled, { '**': false, develop: true, main: true });
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
  assert.ok(paths.has('node_modules/@napi-rs/canvas/package.json'), '@napi-rs/canvas');
  assert.ok([...paths].some(path => /^node_modules\/@napi-rs\/canvas-[^/]+\/[^/]+\.node$/u.test(path)),
    '@napi-rs native platform binary');
});

test('isolated packaged file worker extracts PDF text with its included native canvas dependency', { timeout: 30000 }, async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const includeFiles = config.functions['src/**'].includeFiles;
  const included = new Set(globSync(includeFiles, { cwd: root }).map(path => path.replaceAll('\\', '/')));
  const nativeBinary = [...included].find(path => /^node_modules\/@napi-rs\/canvas-[^/]+\/[^/]+\.node$/u.test(path));
  assert.ok(nativeBinary, 'Vercel include pattern must select a platform canvas binary');

  const tempRoot = mkdtempSync(join(tmpdir(), 'learnly-worker-package-'));
  const packageRoots = ['node_modules/pngjs', 'node_modules/jpeg-js', 'node_modules/pdfjs-dist',
    'node_modules/@napi-rs/canvas', nativeBinary.slice(0, nativeBinary.lastIndexOf('/'))];
  let worker;
  try {
    writeFileSync(join(tempRoot, 'package.json'), JSON.stringify({ type: 'module' }));
    for (const packageRoot of new Set(packageRoots)) {
      assert.ok(included.has(`${packageRoot}/package.json`), `Vercel include pattern must select ${packageRoot}`);
      cpSync(join(root, packageRoot), join(tempRoot, packageRoot), { recursive: true });
    }
    assert.ok(included.has('runtime-workers/file-text-worker.js'));
    mkdirSync(join(tempRoot, 'runtime-workers'), { recursive: true });
    cpSync(join(root, 'runtime-workers/file-text-worker.js'), join(tempRoot, 'runtime-workers/file-text-worker.js'));

    const bytes = textPdf(['isolated worker extraction succeeds']);
    worker = new Worker(pathToFileURL(join(tempRoot, 'runtime-workers/file-text-worker.js')), {
      workerData: { bytes, file: { type: 'PDF', mimeType: 'application/pdf' } }, env: {}, execArgv: [],
    });
    worker.stdout?.resume();
    worker.stderr?.resume();
    let timer;
    let response;
    try {
      response = await Promise.race([
        once(worker, 'message'),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Packaged file worker timed out')), 15000); }),
      ]);
    } finally {
      clearTimeout(timer);
      await worker.terminate();
      worker = undefined;
    }
    const message = response[0];
    assert.equal(message?.ok, true, `PDF extraction failed with ${message?.code ?? 'no worker response'}`);
    assert.match(message.result.pages.map(page => page.text).join('\n'), /isolated worker extraction succeeds/u);
  } finally {
    if (worker) await worker.terminate();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
