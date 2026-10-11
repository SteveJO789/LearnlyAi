import type { ReviewedKnowledgeReader } from "../modules/knowledge/reviewed-knowledge-reader.js";
import { prepareReviewedVectorsFromReport, validatePreparedReviewedVectors, preparedReviewedEmbeddingProvider, type PreparedReviewedVectors } from "../modules/knowledge/prepared-reviewed-vectors.js";
import { publishReviewedKnowledge, type ReviewedVectorPublisher } from "../modules/knowledge/reviewed-vector-publication.js";

export interface VectorCommandDependencies {
  readonly reader: ReviewedKnowledgeReader;
  readJson(path: string): Promise<unknown>;
  writeNewJson(path: string, value: PreparedReviewedVectors): Promise<void>;
  connect(url: string): Promise<{ publisher: ReviewedVectorPublisher; close(): Promise<void> }>;
}
export async function runKnowledgeVectorCommand(args: readonly string[], dependencies: VectorCommandDependencies, env: NodeJS.ProcessEnv = process.env) {
  const [command, ...flags] = args;
  if (!['prepare', 'publish'].includes(command ?? '')) throw new Error("Choose prepare or publish.");
  const values = new Map<string, string>();
  for (const flag of flags) {
    const match = /^(--report|--output|--index|--target)=(.+)$/u.exec(flag);
    const key = match?.[1] ?? flag;
    if (!match && flag !== '--apply' && flag !== '--help' || values.has(key)) throw new Error("Invalid or duplicate vector command option.");
    values.set(key, match?.[2] ?? 'true');
  }
  if (values.has('--help')) return { status: 'HELP', usage: command === 'prepare'
    ? 'knowledge:vector:prepare --report=<budgeted-report.json> --output=<new-index.json>'
    : 'knowledge:vector:publish --index=<prepared-index.json> [--apply --target=<host:port/database>]' };
  const allowed = command === 'prepare' ? ['--report', '--output'] : ['--index', '--apply', '--target'];
  if ([...values.keys()].some(key => !allowed.includes(key))) throw new Error("Unsupported vector command option.");
  const passage = await dependencies.reader.readPilot();
  if (!passage) throw new Error("Reviewed Knowledge is unavailable.");
  if (command === 'prepare') {
    const report = values.get('--report'), output = values.get('--output');
    if (!report || !output) throw new Error("Explicit report and unused output paths are required.");
    const prepared = prepareReviewedVectorsFromReport(await dependencies.readJson(report), passage);
    await dependencies.writeNewJson(output, prepared);
    return { status: 'PREPARED', documentId: prepared.documentId, chunks: prepared.chunks.length, model: prepared.model };
  }
  const path = values.get('--index');
  if (!path) throw new Error("An explicit prepared index is required.");
  const prepared = validatePreparedReviewedVectors(await dependencies.readJson(path), passage);
  const provider = preparedReviewedEmbeddingProvider(prepared);
  if (!values.has('--apply')) {
    if (values.has('--target')) throw new Error("A target is valid only with explicit apply.");
    const result = await publishReviewedKnowledge(dependencies.reader, provider, { replace: async () => {} });
    return { status: 'VALIDATED', ...result };
  }
  const url = env.KNOWLEDGE_PUBLISH_DATABASE_URL, target = values.get('--target');
  if (!url || !target) throw new Error("Apply requires a dedicated publishing connection and explicit target.");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Publishing target is invalid."); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !/^\/[^/]+$/u.test(parsed.pathname) || parsed.hash ||
    [...parsed.searchParams.keys()].some(key => key !== 'sslmode') || parsed.searchParams.getAll('sslmode').length > 1 ||
    target !== `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`) {
    throw new Error("Publishing target does not match the dedicated connection.");
  }
  // No fallback to DATABASE_URL, no migration/signing, and no marker-check bypass.
  const connection = await dependencies.connect(url);
  try {
    const result = await publishReviewedKnowledge(dependencies.reader, provider, connection.publisher);
    return { status: 'PUBLISHED', ...result };
  } finally { await connection.close(); }
}
