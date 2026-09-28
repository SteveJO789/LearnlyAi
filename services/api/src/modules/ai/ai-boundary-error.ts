import { isModelProviderError } from "./providers/model-provider-errors.js";

const DEFINITIONS = {
  AI_INVALID_OUTPUT: { status: 502, message: "The tutor returned an invalid response." },
  AI_UNAVAILABLE: { status: 503, message: "The tutor is temporarily unavailable." },
  AI_TIMEOUT: { status: 504, message: "The tutor request timed out." },
  AI_RATE_LIMITED: { status: 429, message: "The tutor is busy. Please try again later." },
  AI_REQUEST_FAILED: { status: 502, message: "The tutor request could not be completed." },
} as const;

export type AIBoundaryErrorCode = keyof typeof DEFINITIONS;

export class AIBoundaryError extends Error {
  readonly code: AIBoundaryErrorCode;
  readonly status: number;

  constructor(code: AIBoundaryErrorCode, cause?: unknown) {
    super(DEFINITIONS[code].message, { cause });
    this.name = "AIBoundaryError";
    this.code = code;
    this.status = DEFINITIONS[code].status;
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
    case "PROVIDER_INVALID_RESPONSE": return new AIBoundaryError("AI_INVALID_OUTPUT", error);
    case "PROVIDER_REQUEST_FAILED": return new AIBoundaryError("AI_REQUEST_FAILED", error);
    default: return new AIBoundaryError("AI_UNAVAILABLE", error);
  }
}
