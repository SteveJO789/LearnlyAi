import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelTokenUsage,
} from "./model-provider.js";

// Derived from contracts/examples/explanation.json, but kept runtime-local so the
// provider does not depend on repository paths after the API is compiled.
const DEFAULT_MOCK_TUTOR_OUTPUT = {
  schemaVersion: "1.0",
  responseId: "rsp_mock_001",
  sessionId: "lsn_mock_001",
  stage: "LEARNING",
  blocks: [
    {
      id: "blk_mock_explanation_001",
      type: "explanation",
      title: "Deterministic mock lesson",
      content:
        "A deterministic model response keeps local development and continuous integration repeatable.",
      citationIds: ["src_mock_material"],
    },
  ],
  progress: {
    percent: 40,
    canAdvance: true,
    nextAction: "CONTINUE",
  },
  citations: [
    {
      id: "src_mock_material",
      title: "Mock learner material",
      sourceType: "USER_MATERIAL",
      url: null,
      page: 1,
    },
  ],
} as const;

const DEFAULT_USAGE: ModelTokenUsage = {
  inputTokens: 24,
  outputTokens: 96,
  totalTokens: 120,
};

export type MockModelProviderScenario = (
  request: ModelRequest,
) => unknown | Promise<unknown>;

export interface MockModelProviderOptions {
  readonly model?: string;
  readonly fixture?: unknown;
  readonly scenario?: MockModelProviderScenario;
  readonly usage?: ModelTokenUsage;
}

function serializeFixture(fixture: unknown): string {
  if (typeof fixture === "string") {
    return fixture;
  }

  const serialized = JSON.stringify(fixture);

  if (serialized === undefined) {
    throw new TypeError("A MockModelProvider fixture must be JSON serializable.");
  }

  return serialized;
}

export class MockModelProvider implements ModelProvider {
  readonly name = "mock";

  private readonly model: string;
  private readonly fixture: string;
  private readonly scenario?: MockModelProviderScenario;
  private readonly usage: ModelTokenUsage;

  constructor(options: MockModelProviderOptions = {}) {
    this.model = options.model ?? "mock-tutor-v1";
    this.fixture = serializeFixture(options.fixture ?? DEFAULT_MOCK_TUTOR_OUTPUT);
    this.scenario = options.scenario;
    this.usage = { ...DEFAULT_USAGE, ...options.usage };
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const scenarioOutput = this.scenario ? await this.scenario(request) : undefined;
    const content = this.scenario ? serializeFixture(scenarioOutput) : this.fixture;

    return {
      provider: this.name,
      model: this.model,
      content,
      finishReason: "stop",
      requestId: "mock-request-001",
      usage: { ...this.usage },
    };
  }
}
