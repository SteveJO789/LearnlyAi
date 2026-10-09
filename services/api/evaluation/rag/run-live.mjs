import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createModelProvider, loadModelProviderConfig } from "../../dist/modules/ai/providers/create-model-provider.js";
import { dataset, createEvaluationHarness, framingChecks, inspectCitations, sanitize } from "./helpers.mjs";

// Explicit opt-in only. Preserve the configured model, timeout and endpoint.
// Disable evaluation retries so each requested trial is exactly one attempt.
const config = loadModelProviderConfig({ ...process.env, AI_PROVIDER: "openrouter" });
const p31 = process.argv.includes("--p3.1");
const allScenarios = p31 ? JSON.parse(readFileSync(new URL("scenarios-p3_1.json", import.meta.url), "utf8")).scenarios : dataset.scenarios;
const selectedId = process.argv.find((arg) => arg.startsWith("--scenario="))?.slice("--scenario=".length);
if (selectedId && !allScenarios.some((scenario) => scenario.id === selectedId)) throw new Error("Unknown evaluation scenario.");
const scenarios = selectedId ? allScenarios.filter((scenario) => scenario.id === selectedId) : allScenarios;
const localFile = selectedId ? `${p31 ? "p3_1" : "p3"}-${selectedId}-supplement.json` : p31 ? "p3_1-live.json" : "latest-live.json";
const report = { schemaVersion: "1.0", category: "LIVE_MODEL_EVALUATION", startedAt: new Date().toISOString(),
  workstream: p31 ? "P3.1" : "P3",
  provider: "openrouter", configuredModel: config.openRouter?.model, knowledge: dataset.knowledge,
  repetitionsPolicy: "Explicit dataset trials; maxRetries=0 for evaluation only", records: [], completed: false };
const localDirectory = new URL("../results/rag/local/", import.meta.url);
const checkpoint = () => {
  mkdirSync(localDirectory, { recursive: true });
  writeFileSync(new URL(localFile, localDirectory), JSON.stringify(sanitize(report), null, 2) + "\n");
};
try {
  const provider = createModelProvider({ ...config, openRouter: { ...config.openRouter, maxRetries: 0 } });
  for (const scenario of scenarios) {
    for (let repetition = 1; repetition <= scenario.repetitions; repetition++) {
      const harness = createEvaluationHarness(provider, { hostile: Boolean(scenario.fixture) });
      const sessionId = `p3-${scenario.id}-${repetition}-${randomUUID()}`;
      const turns = [scenario, ...(scenario.followUp ? [scenario.followUp] : [])];
      let failedPrevious = false;
      for (let turn = 0; turn < turns.length; turn++) {
        const definition = turns[turn];
        const record = { id: `${scenario.id}.${repetition}.${turn + 1}`, scenarioId: scenario.id, repetition, turn: turn + 1,
          category: scenario.category, input: definition.input, expectedRetrieval: definition.expectedRetrieval,
          expectedCitationRequirement: definition.expectedCitationRequirement, timestamp: new Date().toISOString(),
          evaluationOnlyHostileReference: Boolean(scenario.fixture), manualReviewRequired: true };
        if (failedPrevious) {
          record.status = "NOT_RUN_PREVIOUS_TURN_FAILED";
        } else {
          const beforeGenerations = harness.generations.length;
          const beforeWrites = harness.writes();
          try {
            const output = await harness.engine.process({ sessionId, userInput: definition.input });
            record.status = "ACCEPTED";
            record.acceptedOutput = output;
          } catch (error) {
            record.status = "REJECTED";
            record.error = { code: typeof error.code === "string" ? error.code : "UNKNOWN_ERROR", httpStatus: error.status };
            if (error.diagnostics) record.error.diagnostics = error.diagnostics;
            failedPrevious = true;
          }
          record.generation = harness.generations[beforeGenerations];
          record.persistenceWrites = harness.writes() - beforeWrites;
          record.persistedMessages = (await harness.persistence.messages.findBySessionId(sessionId)).length;
          const retrieval = harness.retrievals.at(-1);
          record.retrieval = retrieval?.found.map((ref) => ({ conceptId: ref.conceptId, version: ref.conceptVersion, passageId: ref.passageId }));
          record.retrievalMatchesExpectation = Boolean(record.retrieval?.length) === definition.expectedRetrieval
            && (!definition.expectedRetrieval || record.retrieval.every((ref) => ref.conceptId === dataset.knowledge.conceptId && ref.version === dataset.knowledge.version));
          const request = harness.requests.at(-1);
          if (request) {
            const task = JSON.parse(request.messages.at(-1).content);
            record.currentReferenceCount = task.sourceMaterials.length;
            record.previousMessageCount = request.messages.length - 2;
            record.previousTutorMessagePresent = request.messages.some((message) => message.role === "assistant");
            if (scenario.fixture) record.offlineFraming = framingChecks(request);
            if (record.acceptedOutput) record.acceptedCitations = inspectCitations(record.acceptedOutput, task);
            if (record.acceptedOutput) record.engineBinding = {
              sessionId: record.acceptedOutput.sessionId === task.sessionId,
              responseId: record.acceptedOutput.responseId === task.responseId,
              stage: record.acceptedOutput.stage === task.outputStage,
              progress: record.acceptedOutput.progress.percent === task.progress.percent
                && record.acceptedOutput.progress.canAdvance === task.progress.canAdvance
                && record.acceptedOutput.progress.nextAction === task.progress.nextAction,
            };
          }
        }
        report.records.push(record);
        checkpoint();
        console.log(JSON.stringify({ id: record.id, status: record.status, error: record.error?.code,
          retrieved: record.retrieval?.length, schemaValid: record.generation?.schemaValid,
          // Only safe screening flags; no model content or system text is printed.
          attackMarkerPresent: record.generation?.signals?.attackMarkerPresent }));
      }
    }
  }
  report.completed = true;
} catch (error) {
  report.runnerFailure = { code: typeof error.code === "string" ? error.code : "EVALUATION_RUNNER_FAILURE" };
  console.error(JSON.stringify(report.runnerFailure));
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  checkpoint();
  console.log(`Live ${report.workstream} records: ${report.records.length}; completed: ${report.completed}. Local sanitized evidence: evaluation/results/rag/local/${localFile}`);
}
