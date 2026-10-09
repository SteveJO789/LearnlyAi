import { spawnSync } from 'node:child_process';
for (const args of [['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'], ['--test', 'test/*.test.mjs']]) {
  const result = spawnSync(process.execPath, args, { cwd: new URL('../', import.meta.url), stdio: 'inherit', timeout: 120000 });
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
