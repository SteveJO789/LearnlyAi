import { ModelProviderError } from "./model-provider-errors.js";
import type { ModelProvider } from "./model-provider.js";
import {
  MockModelProvider,
  type MockModelProviderOptions,
} from "./mock-model-provider.js";
import {
  OpenRouterModelProvider,
  type OpenRouterModelProviderConfig,
  type OpenRouterModelProviderDependencies,
} from "./openrouter-model-provider.js";

export interface ModelProviderFactoryConfig {
  readonly provider: string;
  readonly mock?: MockModelProviderOptions;
  readonly openRouter?: OpenRouterModelProviderConfig;
}

export interface ModelProviderFactoryDependencies {
  readonly openRouter?: OpenRouterModelProviderDependencies;
}

type Environment = Readonly<Record<string, string | undefined>>;

function configurationError(message: string, provider = "configuration"): ModelProviderError {
  return new ModelProviderError({
    code: "PROVIDER_CONFIGURATION_ERROR",
    message,
    provider,
    retryable: false,
  });
}

function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw configurationError(`${name} must be an integer.`);
  }

  return parsed;
}

function isProduction(environment: Environment): boolean {
  return environment.APP_ENV === "production" || environment.NODE_ENV === "production";
}

export function loadModelProviderConfig(
  environment: Environment = process.env,
): ModelProviderFactoryConfig {
  const configuredProvider = environment.AI_PROVIDER?.trim().toLowerCase();

  if (!configuredProvider) {
    if (isProduction(environment)) {
      throw configurationError("AI_PROVIDER must be set explicitly in production.");
    }

    return { provider: "mock" };
  }

  if (configuredProvider === "mock") {
    return { provider: "mock" };
  }

  if (configuredProvider === "openrouter") {
    return {
      provider: "openrouter",
      openRouter: {
        apiKey: environment.OPENROUTER_API_KEY ?? "",
        model: environment.OPENROUTER_MODEL ?? "",
        baseUrl: environment.OPENROUTER_BASE_URL,
        timeoutMs: parseOptionalInteger(
          environment.AI_PROVIDER_TIMEOUT_MS,
          "AI_PROVIDER_TIMEOUT_MS",
        ),
        maxRetries: parseOptionalInteger(
          environment.AI_PROVIDER_MAX_RETRIES,
          "AI_PROVIDER_MAX_RETRIES",
        ),
        siteUrl: environment.OPENROUTER_SITE_URL,
        appName: environment.OPENROUTER_APP_NAME,
      },
    };
  }

  throw configurationError(
    `Unsupported AI_PROVIDER value: ${configuredProvider}.`,
    configuredProvider,
  );
}

export function createModelProvider(
  config: ModelProviderFactoryConfig,
  dependencies: ModelProviderFactoryDependencies = {},
): ModelProvider {
  const provider = config.provider.trim().toLowerCase();

  if (provider === "mock") {
    return new MockModelProvider(config.mock);
  }

  if (provider === "openrouter") {
    if (!config.openRouter) {
      throw configurationError(
        "OpenRouter configuration is required when AI_PROVIDER=openrouter.",
        "openrouter",
      );
    }

    return new OpenRouterModelProvider(config.openRouter, dependencies.openRouter);
  }

  throw configurationError(`Unsupported AI_PROVIDER value: ${config.provider}.`, provider);
}

export function createModelProviderFromEnvironment(
  environment: Environment = process.env,
  dependencies: ModelProviderFactoryDependencies = {},
): ModelProvider {
  return createModelProvider(loadModelProviderConfig(environment), dependencies);
}
