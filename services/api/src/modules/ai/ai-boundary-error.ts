import { isModelProviderError } from "./providers/model-provider-errors.js";

const DEFINITIONS = {
  AI_INVALID_OUTPUT: { status: 502, message: "The tutor returned an invalid response." },
  AI_UNAVAILABLE: { status: 503, message: "The tutor is temporarily unavailable." },
  AI_TIMEOUT: { status: 504, message: "The tutor request timed out." },
  AI_RATE_LIMITED: { status: 429, message: "The tutor is busy. Please try again later." },
  AI_REQUEST_FAILED: { status: 502, message: "The tutor request could not be completed." },
} as const;

export type AIBoundaryErrorCode = keyof typeof DEFINITIONS;

// Internal, bounded diagnostics only. Never include prompts, model content or credentials.
export interface ModelOutputDiagnostics {
  readonly subtype: "MODEL_OUTPUT_TRUNCATED" | "MODEL_OUTPUT_INVALID_JSON" | "MODEL_OUTPUT_SCHEMA_INVALID" | "MODEL_OUTPUT_CITATION_INVALID";
  readonly finishReason?: "stop" | "length" | "content_filter" | "other";
  readonly outputCharacters: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export class AIBoundaryError extends Error {
  readonly code: AIBoundaryErrorCode;
  readonly status: number;
  readonly diagnostics?: ModelOutputDiagnostics;

  constructor(code: AIBoundaryErrorCode, cause?: unknown, diagnostics?: ModelOutputDiagnostics) {
    super(DEFINITIONS[code].message, { cause });
    this.name = "AIBoundaryError";
    this.code = code;
    this.status = DEFINITIONS[code].status;
    this.diagnostics = diagnostics;
  }

  toJSON(): { code: AIBoundaryErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}

export function normalizeProviderFailure(error: unknown): AIBoundaryError {
  if (!isModelProviderError(error)) return new AIBoundaryError("AI_UNAVAILABLE", error);
  switch (error.code) {
    case "PROVIDER_TIMEOUT": return new AIBoundaryError("AI_TIMEOUT", error);
    case "PROVIDER_RATE_LIMITED": return new AIBoundaryError("AI_RATE_LIMITED", error);
    case "PROVIDER_INVALID_RESPONSE": {
      const cause = error.cause;
      const safeCount = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
      if (cause && typeof cause === "object" && "subtype" in cause && cause.subtype === "MODEL_OUTPUT_TRUNCATED") {
        const data = cause as Record<string, unknown>;
        return new AIBoundaryError("AI_INVALID_OUTPUT", error, { subtype: "MODEL_OUTPUT_TRUNCATED", finishReason: "length",
          outputCharacters: safeCount(data.outputCharacters) ?? 0,
          inputTokens: safeCount(data.inputTokens), outputTokens: safeCount(data.outputTokens) });
      }
      return new AIBoundaryError("AI_INVALID_OUTPUT", error);
    }
    case "PROVIDER_REQUEST_FAILED": return new AIBoundaryError("AI_REQUEST_FAILED", error);
    default: return new AIBoundaryError("AI_UNAVAILABLE", error);
  }
}
