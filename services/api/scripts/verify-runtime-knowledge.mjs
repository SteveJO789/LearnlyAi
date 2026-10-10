import { spawnSync } from "node:child_process";

const env = { ...process.env };

delete env.VERCEL;
env.NODE_ENV = "test";

const result = spawnSync(
  process.execPath,
  ["--test", "test/runtime-knowledge.test.mjs"],
  { env, stdio: "inherit" }
);

process.exit(result.status ?? 1);