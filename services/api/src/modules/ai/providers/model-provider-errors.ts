export const MODEL_PROVIDER_ERROR_CODES = [
  "PROVIDER_CONFIGURATION_ERROR",
  "PROVIDER_AUTHENTICATION_ERROR",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_INVALID_RESPONSE",
  "PROVIDER_REQUEST_FAILED",
] as const;

export type ModelProviderErrorCode = (typeof MODEL_PROVIDER_ERROR_CODES)[number];

export interface ModelProviderErrorOptions {
  readonly code: ModelProviderErrorCode;
  readonly message: string;
  readonly provider: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly cause?: unknown;
}

export class ModelProviderError extends Error {
  readonly code: ModelProviderErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;

  constructor(options: ModelProviderErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ModelProviderError";
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = options.retryable;
    this.httpStatus = options.httpStatus;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
      ...(this.httpStatus === undefined ? {} : { httpStatus: this.httpStatus }),
    };
  }
}

export function isModelProviderError(error: unknown): error is ModelProviderError {
  return error instanceof ModelProviderError;
}
