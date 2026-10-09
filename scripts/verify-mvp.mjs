// Deterministic verification only. Never loads local secrets or calls live AI.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, process.argv[2] ?? '.verification-results');
mkdirSync(out, { recursive: true });
const steps = [
  ['knowledge-typecheck', 'knowledge', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']],
  ['knowledge-build', 'knowledge', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']],
  ['knowledge-tests', 'knowledge', ['--test', '--test-isolation=none', 'test/*.test.mjs']],
  ['runtime-prepare', 'knowledge', ['scripts/prepare-runtime.mjs']],
  ['api-typecheck', 'services/api', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']],
  ['api-build', 'services/api', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']],
  ['api-contract-copy', 'services/api', ['scripts/copy-contract.mjs']],
  ['api-tests', 'services/api', ['--test', 'test/*.test.mjs']],
  ['persistent-rag-integration', 'services/api', ['--experimental-test-module-mocks', '--test', 'test/persisted-rag.integration.mjs']],
  ['rag-offline-evaluation', 'services/api', ['evaluation/rag/run-offline.mjs', '--output', resolve(out, 'rag-offline-summary.json')]],
  ['web-typecheck', 'apps/web', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['web-tests', 'apps/web', ['scripts/run-tests.mjs']],
  ['web-production-build', 'apps/web', ['node_modules/next/dist/bin/next', 'build']],
  ['fresh-runtime', 'services/api', ['scripts/verify-fresh-runtime.mjs']],
];
const summary = {
  startedAt: new Date().toISOString(),
  commit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
  node: process.version, results: [],
};
for (const [name, cwd, args] of steps) {
  const start = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: resolve(root, cwd), encoding: 'utf8', timeout: 600000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, AI_PROVIDER: 'mock', KNOWLEDGE_ROOT: '', NEXT_TELEMETRY_DISABLED: '1' },
  });
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  writeFileSync(resolve(out, `${name}.log`), log);
  const record = { name, cwd, args, exitCode: result.status, seconds: (Date.now() - start) / 1000,
    evidence: log.split(/\r?\n/).filter(line => /(?:tests |pass |fail |Prepared|Fresh source|Deterministic|Error|error TS|Route)/.test(line)).slice(-15),
  };
  summary.results.push(record);
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(record));
  if (result.status !== 0) {
    console.error(log.slice(-5000)); process.exitCode = 1; break;
  }
}
summary.finishedAt = new Date().toISOString();
writeFileSync(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2));
