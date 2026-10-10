export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(inputs: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export function validateEmbedding(value: unknown, dimensions: number): readonly number[] {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 2000 || !Array.isArray(value) || value.length !== dimensions ||
    Array.from(value).some(item => typeof item !== "number" || !Number.isFinite(item)) ||
    !value.some(item => item !== 0)) throw new Error("Embedding response is invalid.");
  return Object.freeze([...value] as number[]);
}
