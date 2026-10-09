import { createReadinessCheck } from '../dist/shared/readiness.js';
import { getDb } from '../dist/prisma/db.js';
try {
  const result = await createReadinessCheck()();
  console.log(JSON.stringify(result));
  if (result.status !== 'ready') process.exitCode = 1;
} finally {
  try { await (await getDb()).close(); } catch { /* no configured database */ }
}
