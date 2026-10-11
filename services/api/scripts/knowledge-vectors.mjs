import { open, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runKnowledgeVectorCommand } from '../dist/operations/knowledge-vector-command.js';
import { LocalReviewedKnowledgeReader } from '../dist/modules/knowledge/reviewed-knowledge-reader.js';
import { PrismaVectorPublication } from '../dist/prisma/prisma-vector-publication.js';

try {
  const result = await runKnowledgeVectorCommand(process.argv.slice(2), {
    reader: new LocalReviewedKnowledgeReader(process.env.KNOWLEDGE_ROOT ?? fileURLToPath(new URL('../runtime-knowledge/', import.meta.url))),
    readJson: async path => {
      const handle = await open(path, 'r');
      try {
        const limit = 1024 * 1024;
        if (!(await handle.stat()).isFile()) throw Error('A regular JSON file is required.');
        const buffer = Buffer.alloc(limit + 1);
        let size = 0;
        while (size <= limit) {
          const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
          if (!bytesRead) break;
          size += bytesRead;
        }
        if (size > limit) throw Error('Prepared input exceeds limits.');
        return JSON.parse(buffer.subarray(0, size).toString('utf8'));
      } finally { await handle.close(); }
    },
    writeNewJson: (path, value) => writeFile(path, JSON.stringify(value), { flag: 'wx', mode: 0o600 }),
    connect: async url => {
      // Lazy: validation/help/prepare never initialize the DB or contact a provider.
      const { default: postgres } = await import('@prisma/orm-postgres/runtime');
      const { default: vector } = await import('@prisma/orm-extension-pgvector/runtime');
      const { default: supabase } = await import('@prisma/orm-extension-supabase/runtime');
      const { default: contractJson } = await import('../dist/prisma/contract.json', { with: { type: 'json' } });
      const client = postgres({ contractJson, url, extensions: [supabase, vector], verifyMarker: 'onFirstUse',
        poolOptions: { connectionTimeoutMillis: 3000, idleTimeoutMillis: 1000 } });
      return { publisher: new PrismaVectorPublication(client), close: () => client.close() };
    },
  });
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // Never print file contents, URLs, credentials, provider/DB exceptions or personal paths.
  process.stderr.write('Knowledge vector command failed. Check reviewed artifacts, prepared input, target and migrations.\n');
  process.exitCode = 1;
}
