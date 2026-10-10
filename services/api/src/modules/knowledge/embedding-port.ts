export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(inputs: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export function validateEmbedding(value: unknown, dimensions: number): readonly number[] {
  if (!Array.isArray(value) || value.length !== dimensions || value.some(item => typeof item !== "number" || !Number.isFinite(item)) ||
    !value.some(item => item !== 0)) throw new Error("Embedding response is invalid.");
  return Object.freeze([...value] as number[]);
}
