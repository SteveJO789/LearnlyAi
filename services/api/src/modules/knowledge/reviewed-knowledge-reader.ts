import { readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { Ajv2020, type AnySchema, type ValidateFunction } from "ajv/dist/2020.js";
import type { KnowledgeSource, RetrievedKnowledge } from "./knowledge-retriever.js";

const require = createRequire(import.meta.url);
const addFormats: typeof import("ajv-formats").default = require("ajv-formats");

export const OHMS_LAW_CONCEPT_ID = "physics.electricity.electric-circuits.ohms-law";
export const MAX_RETRIEVED_CONTENT_CHARS = 4000;
const MAX_ARTIFACT_BYTES = 128 * 1024;
const PILOT_PATH = "build/concepts/physics/electricity/ohms-law.json";
const TEACHING_SECTIONS = [
  "formal-definition", "formula", "variables-and-units", "conditions-and-limitations",
  "problem", "solution", "checked-answer",
] as const;

interface PilotDocument {
  id: string;
  version: string;
  schema_version: string;
  status: string;
  subject: string;
  language: string;
  title: { th: string; en: string };
  review: {
    content_status: string;
    math_physics_reviewed: boolean;
    language_reviewed: boolean;
    reviewer?: string;
    reviewed_at?: string | null;
  };
  sections: Array<{ slug: string; markdown: string }>;
  source_refs: Array<{ source_id: string; usage: string }>;
}

interface SourceRecord {
  source_id: string;
  name: string;
  official_url: string;
  license: string;
  rag_permission_status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function reviewed(value: unknown): boolean {
  if (!isRecord(value) || value.status !== "reviewed" || !isRecord(value.review)) return false;
  const review = value.review;
  return review.content_status === "reviewed" && review.math_physics_reviewed === true
    && review.language_reviewed === true && typeof review.reviewer === "string"
    && review.reviewer.trim().length > 0 && typeof review.reviewed_at === "string"
    && review.reviewed_at.trim().length > 0;
}

export interface ReviewedKnowledgeReader {
  readPilot(): Promise<RetrievedKnowledge | null>;
}

/** Read only the pipeline's published path, never scan authoring/draft directories. */
export class LocalReviewedKnowledgeReader implements ReviewedKnowledgeReader {
  private readonly root: string;
  private validators?: { document: ValidateFunction<PilotDocument>; source: ValidateFunction<SourceRecord> };

  constructor(knowledgeRoot: string) {
    this.root = resolve(knowledgeRoot);
  }

  private async readJson(path: string): Promise<unknown> {
    const absolute = join(this.root, path);
    if ((await stat(absolute)).size > MAX_ARTIFACT_BYTES) throw new Error("Knowledge artifact exceeds the local reader size limit.");
    const bytes = await readFile(absolute);
    if (bytes.length > MAX_ARTIFACT_BYTES) throw new Error("Knowledge artifact exceeds the local reader size limit.");
    return JSON.parse(bytes.toString("utf8")) as unknown;
  }

  private async loadValidators(): Promise<NonNullable<LocalReviewedKnowledgeReader["validators"]>> {
    if (this.validators) return this.validators;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    // Register checked-in local contracts. No remote schema resolution/fetching.
    const files = (await readdir(join(this.root, "schemas"))).filter((file) => file.endsWith(".schema.json")).sort();
    for (const file of files) ajv.addSchema(await this.readJson(`schemas/${file}`) as AnySchema);
    const document = ajv.getSchema<PilotDocument>("https://learnlyai.local/schemas/knowledge.schema.json");
    const source = ajv.getSchema<SourceRecord>("https://learnlyai.local/schemas/source.schema.json");
    if (!document || !source) throw new Error("Knowledge contracts are unavailable.");
    this.validators = { document, source };
    return this.validators;
  }

  async readPilot(): Promise<RetrievedKnowledge | null> {
    const value = await this.readJson(PILOT_PATH);
    // Review is an eligibility gate even if someone copies a draft into build/.
    if (!reviewed(value)) return null;
    const validators = await this.loadValidators();
    if (!validators.document(value)) throw new Error("Published Knowledge artifact violates its canonical schema.");
    if (value.id !== OHMS_LAW_CONCEPT_ID || value.version !== "0.2.0"
      || value.schema_version !== "1.0" || value.subject !== "physics" || value.language !== "th") return null;

    const registry = await this.readJson("manifest/sources.json");
    if (!isRecord(registry) || registry.schema_version !== "1.0" || !Array.isArray(registry.sources)) {
      throw new Error("Knowledge source registry is invalid.");
    }
    const sources = new Map<string, SourceRecord>();
    for (const entry of registry.sources as unknown[]) {
      if (!validators.source(entry) || sources.has(entry.source_id)) throw new Error("Knowledge source registry is invalid.");
      sources.set(entry.source_id, entry);
    }
    for (const ref of value.source_refs) {
      const source = sources.get(ref.source_id);
      if (!source || source.rag_permission_status === "do_not_ingest"
        || (ref.usage === "content_source" && !["allowed", "internally_authored"].includes(source.rag_permission_status))) {
        throw new Error("Published Knowledge references an unknown or disallowed source.");
      }
    }

    const content = TEACHING_SECTIONS.map((slug) => {
      const sections = value.sections.filter((section) => section.slug === slug);
      if (sections.length !== 1) throw new Error("Published pilot must contain each complete teaching section exactly once.");
      let text = sections[0]!.markdown.trim();
      // Drop the known standalone bookkeeping cross-reference, not teaching prose.
      if (slug === "problem") text = text.split(/\n\s*\n/u).filter((paragraph) =>
        paragraph !== "พิจารณาตัวต้านทานในวงจรที่ระบุต้นฉบับไว้ในส่วน Detailed Provenance").join("\n\n");
      if (!text) throw new Error("Published pilot contains an incomplete teaching section.");
      return `${slug}:\n${text}`;
    }).join("\n\n");
    // Reject oversize passages as a whole; never truncate a formula/unit/example.
    if (content.length > MAX_RETRIEVED_CONTENT_CHARS) throw new Error("Published teaching passage exceeds the retrieval content limit.");

    const sourceIds = [...new Set(value.source_refs.filter((ref) => ref.usage === "content_source").map((ref) => ref.source_id))].sort();
    if (sourceIds.length === 0 || sourceIds.length > 4 || value.title.th.length > 200) {
      throw new Error("Published pilot exceeds retrieval metadata limits or lacks content provenance.");
    }
    const provenance: KnowledgeSource[] = sourceIds.map((id) => {
      const source = sources.get(id)!;
      if (id.length > 200 || source.name.length > 200 || source.official_url.length > 2048 || source.license.length > 512) {
        throw new Error("Published source exceeds retrieval metadata limits.");
      }
      const url = new URL(source.official_url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Published source must have a public HTTP(S) URL without credentials.");
      }
      return Object.freeze({ sourceId: id, title: source.name, url: source.official_url, license: source.license });
    });
    return Object.freeze({
      conceptId: value.id, conceptVersion: value.version, schemaVersion: value.schema_version,
      passageId: `${value.id}@${value.version}:teaching-v1`, title: value.title.th,
      subject: value.subject, language: value.language, content,
      sourceType: "TRUSTED_KNOWLEDGE_BASE", sources: Object.freeze(provenance),
    });
  }
}
