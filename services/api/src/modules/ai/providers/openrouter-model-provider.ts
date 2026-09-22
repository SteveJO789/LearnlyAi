import {
  ModelProviderError,
  isModelProviderError,
} from "./model-provider-errors.js";
import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelResponseFormat,
  ModelTokenUsage,
} from "./model-provider.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 10;
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;
type TimeoutHandle = ReturnType<typeof setTimeout>;

export interface OpenRouterModelProviderConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly siteUrl?: string;
  readonly appName?: string;
}

export interface OpenRouterModelProviderDependencies {
  readonly fetch?: typeof fetch;
  readonly sleep?: Sleep;
  readonly scheduleTimeout?: (callback: () => void, milliseconds: number) => TimeoutHandle;
  readonly cancelTimeout?: (handle: TimeoutHandle) => void;
}

interface OpenRouterResponseEnvelope {
  readonly id?: string;
  readonly model?: string;
  readonly choices: readonly [
    {
      readonly message: { readonly content: string };
      readonly finish_reason?: string | null;
    },
    ...unknown[],
  ];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
}

function configurationError(message: string, cause?: unknown): ModelProviderError {
  return new ModelProviderError({
    code: "PROVIDER_CONFIGURATION_ERROR",
    message,
    provider: "openrouter",
    retryable: false,
    cause,
  });
}

function requireNonEmptyConfiguration(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw configurationError(`${label} is required when AI_PROVIDER=openrouter.`);
  }

  return normalized;
}

function requireIntegerInRange(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw configurationError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }

  return value;
}

function resolveEndpoint(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new TypeError("Unsupported URL protocol");
    }

    if (url.username || url.password) {
      throw new TypeError("URL credentials are not allowed");
    }

    const normalizedPath = url.pathname.replace(/\/+$/, "");
    url.pathname = normalizedPath.endsWith("/chat/completions")
      ? normalizedPath
      : `${normalizedPath}/chat/completions`;

    return url.toString();
  } catch (cause) {
    throw configurationError("OPENROUTER_BASE_URL must be a valid HTTP(S) URL.", cause);
  }
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertValidRequest(request: ModelRequest): void {
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new ModelProviderError({
      code: "PROVIDER_REQUEST_FAILED",
      message: "At least one model message is required.",
      provider: "openrouter",
      retryable: false,
    });
  }

  for (const message of request.messages) {
    if (
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new ModelProviderError({
        code: "PROVIDER_REQUEST_FAILED",
        message: "Every model message must have a supported role and non-empty content.",
        provider: "openrouter",
        retryable: false,
      });
    }
  }

  if (
    request.temperature !== undefined &&
    (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2)
  ) {
    throw new ModelProviderError({
      code: "PROVIDER_REQUEST_FAILED",
      message: "Model temperature must be a finite number from 0 through 2.",
      provider: "openrouter",
      retryable: false,
    });
  }

  if (
    request.maxOutputTokens !== undefined &&
    (!Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0)
  ) {
    throw new ModelProviderError({
      code: "PROVIDER_REQUEST_FAILED",
      message: "Maximum output tokens must be a positive integer.",
      provider: "openrouter",
      retryable: false,
    });
  }

  if (
    request.responseFormat?.type === "json_schema" &&
    (!request.responseFormat.name.trim() || !isRecord(request.responseFormat.schema))
  ) {
    throw new ModelProviderError({
      code: "PROVIDER_REQUEST_FAILED",
      message: "JSON Schema response format requires a name and an object schema.",
      provider: "openrouter",
      retryable: false,
    });
  }
}

function mapResponseFormat(responseFormat: ModelResponseFormat | undefined): unknown {
  if (!responseFormat || responseFormat.type === "text") {
    return undefined;
  }

  if (responseFormat.type === "json_object") {
    return { type: "json_object" };
  }

  return {
    type: "json_schema",
    json_schema: {
      name: responseFormat.name,
      strict: responseFormat.strict ?? true,
      schema: responseFormat.schema,
    },
  };
}

function buildRequestBody(model: string, request: ModelRequest): Record<string, unknown> {
  const responseFormat = mapResponseFormat(request.responseFormat);

  return {
    model,
    messages: request.messages.map(({ role, content }) => ({ role, content })),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.maxOutputTokens === undefined
      ? {}
      : { max_tokens: request.maxOutputTokens }),
    ...(responseFormat === undefined ? {} : { response_format: responseFormat }),
  };
}

function invalidResponse(message: string, cause?: unknown): ModelProviderError {
  return new ModelProviderError({
    code: "PROVIDER_INVALID_RESPONSE",
    message,
    provider: "openrouter",
    retryable: false,
    cause,
  });
}

function parseOptionalTokenCount(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || (value as number) < 0) {
    throw invalidResponse(`OpenRouter returned invalid ${fieldName} usage.`);
  }

  return value as number;
}

function parseEnvelope(value: unknown): OpenRouterResponseEnvelope {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    throw invalidResponse("OpenRouter returned a malformed response envelope.");
  }

  const firstChoice = value.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw invalidResponse("OpenRouter returned a malformed response envelope.");
  }

  if (
    typeof firstChoice.message.content !== "string" ||
    !firstChoice.message.content.trim()
  ) {
    throw invalidResponse("OpenRouter returned an empty model response.");
  }

  if (
    firstChoice.finish_reason !== undefined &&
    firstChoice.finish_reason !== null &&
    typeof firstChoice.finish_reason !== "string"
  ) {
    throw invalidResponse("OpenRouter returned an invalid finish reason.");
  }

  if (value.id !== undefined && typeof value.id !== "string") {
    throw invalidResponse("OpenRouter returned an invalid request identifier.");
  }

  if (value.model !== undefined && typeof value.model !== "string") {
    throw invalidResponse("OpenRouter returned an invalid model name.");
  }

  if (value.usage !== undefined && !isRecord(value.usage)) {
    throw invalidResponse("OpenRouter returned malformed token usage.");
  }

  return value as unknown as OpenRouterResponseEnvelope;
}

function normalizeUsage(envelope: OpenRouterResponseEnvelope): ModelTokenUsage {
  const usage = envelope.usage;

  if (!usage) {
    return {};
  }

  return {
    inputTokens: parseOptionalTokenCount(usage.prompt_tokens, "input token"),
    outputTokens: parseOptionalTokenCount(usage.completion_tokens, "output token"),
    totalTokens: parseOptionalTokenCount(usage.total_tokens, "total token"),
  };
}

function errorForHttpStatus(status: number): ModelProviderError {
  if (status === 401 || status === 403) {
    return new ModelProviderError({
      code: "PROVIDER_AUTHENTICATION_ERROR",
      message: "OpenRouter authentication failed.",
      provider: "openrouter",
      retryable: false,
      httpStatus: status,
    });
  }

  if (status === 429) {
    return new ModelProviderError({
      code: "PROVIDER_RATE_LIMITED",
      message: "OpenRouter rate limited the request.",
      provider: "openrouter",
      retryable: true,
      httpStatus: status,
    });
  }

  if (status === 408) {
    return new ModelProviderError({
      code: "PROVIDER_TIMEOUT",
      message: "OpenRouter timed out while processing the request.",
      provider: "openrouter",
      retryable: true,
      httpStatus: status,
    });
  }

  if (RETRYABLE_HTTP_STATUSES.has(status)) {
    return new ModelProviderError({
      code: "PROVIDER_UNAVAILABLE",
      message: "OpenRouter is temporarily unavailable.",
      provider: "openrouter",
      retryable: true,
      httpStatus: status,
    });
  }

  return new ModelProviderError({
    code: "PROVIDER_REQUEST_FAILED",
    message: "OpenRouter rejected the model request.",
    provider: "openrouter",
    retryable: false,
    httpStatus: status,
  });
}

export class OpenRouterModelProvider implements ModelProvider {
  readonly name = "openrouter";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly siteUrl?: string;
  private readonly appName?: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: Sleep;
  private readonly scheduleTimeout: (
    callback: () => void,
    milliseconds: number,
  ) => TimeoutHandle;
  private readonly cancelTimeout: (handle: TimeoutHandle) => void;

  constructor(
    config: OpenRouterModelProviderConfig,
    dependencies: OpenRouterModelProviderDependencies = {},
  ) {
    this.apiKey = requireNonEmptyConfiguration(config.apiKey, "OPENROUTER_API_KEY");
    this.model = requireNonEmptyConfiguration(config.model, "OPENROUTER_MODEL");
    this.endpoint = resolveEndpoint(config.baseUrl ?? DEFAULT_BASE_URL);
    this.timeoutMs = requireIntegerInRange(
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      "AI_PROVIDER_TIMEOUT_MS",
      1,
      MAX_TIMEOUT_MS,
    );
    this.maxRetries = requireIntegerInRange(
      config.maxRetries ?? DEFAULT_MAX_RETRIES,
      "AI_PROVIDER_MAX_RETRIES",
      0,
      MAX_RETRIES,
    );
    this.siteUrl = config.siteUrl?.trim() || undefined;
    this.appName = config.appName?.trim() || undefined;
    this.fetchImplementation = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.scheduleTimeout = dependencies.scheduleTimeout ?? setTimeout;
    this.cancelTimeout = dependencies.cancelTimeout ?? clearTimeout;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    assertValidRequest(request);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.executeAttempt(request);
      } catch (error) {
        const providerError = this.normalizeAttemptError(error, request.signal);
        const hasRetryRemaining = attempt < this.maxRetries;

        if (!providerError.retryable || !hasRetryRemaining) {
          throw providerError;
        }

        try {
          await this.sleep(Math.min(250 * 2 ** attempt, 2_000), request.signal);
        } catch (cause) {
          throw this.cancellationError(cause);
        }
      }
    }

    throw new ModelProviderError({
      code: "PROVIDER_UNAVAILABLE",
      message: "OpenRouter is temporarily unavailable.",
      provider: this.name,
      retryable: true,
    });
  }

  private async executeAttempt(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal?.aborted) {
      throw this.cancellationError(request.signal.reason);
    }

    const attemptController = new AbortController();
    let timedOut = false;
    const onCallerAbort = (): void => attemptController.abort(request.signal?.reason);

    request.signal?.addEventListener("abort", onCallerAbort, { once: true });
    const timeout = this.scheduleTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, this.timeoutMs);

    try {
      let response: Response;

      try {
        response = await this.fetchImplementation(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(this.siteUrl ? { "HTTP-Referer": this.siteUrl } : {}),
            ...(this.appName ? { "X-OpenRouter-Title": this.appName } : {}),
          },
          body: JSON.stringify(buildRequestBody(this.model, request)),
          signal: attemptController.signal,
        });
      } catch (cause) {
        if (request.signal?.aborted) {
          throw this.cancellationError(cause);
        }

        if (timedOut) {
          throw new ModelProviderError({
            code: "PROVIDER_TIMEOUT",
            message: "The OpenRouter request timed out.",
            provider: this.name,
            retryable: true,
            cause,
          });
        }

        throw new ModelProviderError({
          code: "PROVIDER_UNAVAILABLE",
          message: "OpenRouter could not be reached.",
          provider: this.name,
          retryable: true,
          cause,
        });
      }

      if (!response.ok) {
        throw errorForHttpStatus(response.status);
      }

      let responseBody: unknown;

      try {
        responseBody = await response.json();
      } catch (cause) {
        if (request.signal?.aborted) {
          throw this.cancellationError(cause);
        }

        if (timedOut) {
          throw new ModelProviderError({
            code: "PROVIDER_TIMEOUT",
            message: "The OpenRouter response timed out.",
            provider: this.name,
            retryable: true,
            cause,
          });
        }

        throw invalidResponse("OpenRouter returned a non-JSON response.", cause);
      }

      const envelope = parseEnvelope(responseBody);
      const firstChoice = envelope.choices[0];

      return {
        provider: this.name,
        model: envelope.model?.trim() || this.model,
        content: firstChoice.message.content,
        ...(firstChoice.finish_reason ? { finishReason: firstChoice.finish_reason } : {}),
        ...(envelope.id ? { requestId: envelope.id } : {}),
        usage: normalizeUsage(envelope),
      };
    } finally {
      this.cancelTimeout(timeout);
      request.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private normalizeAttemptError(
    error: unknown,
    callerSignal: AbortSignal | undefined,
  ): ModelProviderError {
    if (callerSignal?.aborted) {
      return this.cancellationError(error);
    }

    if (isModelProviderError(error)) {
      return error;
    }

    return new ModelProviderError({
      code: "PROVIDER_UNAVAILABLE",
      message: "OpenRouter could not be reached.",
      provider: this.name,
      retryable: true,
      cause: error,
    });
  }

  private cancellationError(cause: unknown): ModelProviderError {
    return new ModelProviderError({
      code: "PROVIDER_REQUEST_FAILED",
      message: "The model request was cancelled by the caller.",
      provider: this.name,
      retryable: false,
      cause,
    });
  }
}
