import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { LocalReviewedKnowledgeReader } from "../modules/knowledge/reviewed-knowledge-reader.js";

export type ReadinessProbe = (signal: AbortSignal) => Promise<void>;
export interface ReadinessOptions {
  database?: ReadinessProbe;
  knowledge?: ReadinessProbe;
  authConfiguration?: ReadinessProbe;
  timeoutMs?: number;
  knowledgeRoot?: string;
}

/** Connectivity/configuration checks only; not an OAuth, RLS or provider smoke test. */
export function createReadinessCheck(options: ReadinessOptions = {}) {
  const probes: Record<string, ReadinessProbe> = {
    database: options.database ?? (async (signal) => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error("Database configuration missing");
      // A connectivity check must not require switching to the anonymous role.
      // Prisma remains the application persistence adapter; no table is read here.
      const client = new Client({ connectionString, connectionTimeoutMillis: 2000,
        query_timeout: 2000, statement_timeout: 1500 });
      client.on("error", () => {}); // Dependency errors never become unsanitized process logs.
      try {
        signal.throwIfAborted();
        await client.connect();
        signal.throwIfAborted();
        await client.query("SELECT 1");
      } finally { await client.end(); }
    }),
    knowledge: options.knowledge ?? (async () => {
      const root = options.knowledgeRoot ?? process.env.KNOWLEDGE_ROOT ??
        fileURLToPath(new URL("../../runtime-knowledge/", import.meta.url));
      if (!await new LocalReviewedKnowledgeReader(root).readPilot()) throw new Error("No reviewed Knowledge");
    }),
    authConfiguration: options.authConfiguration ?? (async () => {
      const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key || !["https:", "http:"].includes(new URL(url).protocol)) {
        throw new Error("Auth configuration missing");
      }
    }),
  };
  return async () => {
    const checks: Record<string, "ok" | "failed"> = { api: "ok" };
    await Promise.all(Object.entries(probes).map(async ([name, probe]) => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(() => probe(controller.signal)),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Readiness deadline exceeded"));
            }, options.timeoutMs ?? 3000);
          }),
        ]);
        checks[name] = "ok";
      } catch { checks[name] = "failed"; }
      finally { clearTimeout(timer); }
    }));
    return { status: Object.values(checks).every(value => value === "ok") ? "ready" : "not_ready", checks };
  };
}
