import { validateEmbedding, type EmbeddingProvider } from "../../knowledge/embedding-port.js";

/** Real OpenRouter embeddings transport. No Mock fallback, retry or credential logging. */
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: { apiKey: string; model: string; dimensions?: number; timeoutMs?: number; fetchImpl?: typeof fetch }) {
    if (!options.apiKey.trim() || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(options.model)) throw new Error("Embedding configuration is invalid.");
    this.model = options.model;
    this.dimensions = options.dimensions ?? 1536;
    this.timeoutMs = options.timeoutMs ?? 15000;
    if (!Number.isInteger(this.dimensions) || this.dimensions < 1 || this.dimensions > 2000 ||
      !Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 30000) throw new Error("Embedding limits are invalid.");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async embed(inputs: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 8 ||
      inputs.some(input => typeof input !== "string" || !input.trim() || input.length > 8000)) throw new RangeError("Embedding input exceeds limits.");
    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const response = await this.fetchImpl("https://openrouter.ai/api/v1/embeddings", {
        method: "POST", redirect: "error", signal, headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: inputs, dimensions: this.dimensions, encoding_format: "float" }),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error("Embedding service unavailable."); }
      // Bound streamed bytes as well as declared size; untrusted responses may omit the header.
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Embedding response is invalid.");
      const limit = 1024 * 1024;
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > limit) { await reader.cancel(); throw new Error("Embedding response exceeds limits."); }
          chunks.push(next.value);
        }
      } finally { reader.releaseLock(); }
      const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data) ||
        payload.data.length !== inputs.length || !("model" in payload) || payload.model !== this.model) throw new Error("Embedding response is invalid.");
      const rows = payload.data as unknown[];
      const output: (readonly number[])[] = [];
      for (const row of rows) {
        if (!row || typeof row !== "object" || !("index" in row) || !Number.isInteger(row.index) ||
          (row.index as number) < 0 || (row.index as number) >= inputs.length || output[row.index as number] || !("embedding" in row)) {
          throw new Error("Embedding response is invalid.");
        }
        output[row.index as number] = validateEmbedding(row.embedding, this.dimensions);
      }
      return Object.freeze(output);
    } catch {
      // No upstream body, request text, token or exception message crosses this boundary.
      throw new Error("Knowledge embedding request failed.");
    }
  }
}
