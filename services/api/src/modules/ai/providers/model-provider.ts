export type ModelMessageRole = "system" | "user" | "assistant";

export interface ModelMessage {
  readonly role: ModelMessageRole;
  readonly content: string;
}

export type ModelResponseFormat =
  | { readonly type: "text" }
  | { readonly type: "json_object" }
  | {
      readonly type: "json_schema";
      readonly name: string;
      readonly schema: Readonly<Record<string, unknown>>;
      readonly strict?: boolean;
    };

export interface ModelRequestMetadata {
  readonly correlationId?: string;
  readonly [key: string]: string | undefined;
}

export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly responseFormat?: ModelResponseFormat;
  readonly metadata?: ModelRequestMetadata;
  readonly signal?: AbortSignal;
}

export interface ModelTokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface ModelResponse {
  readonly provider: string;
  readonly model: string;
  readonly content: string;
  readonly finishReason?: string;
  readonly requestId?: string;
  readonly usage: ModelTokenUsage;
}

export interface ModelProvider {
  readonly name: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
}
