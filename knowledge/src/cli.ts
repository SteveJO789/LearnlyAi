#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { KnowledgeValidationResult } from "./domain.js";
import { acquireArtifact, acquireLocalFile } from "./acquisition.js";
import { buildKnowledge, validateKnowledge } from "./knowledge-pipeline.js";
import { normalizeAcquiredArtifacts } from "./normalization.js";
import { SourceProcessingError } from "./source-processing-error.js";
import { startReviewServer } from "./review-server.js";
import { curateKnowledge } from "./curation.js";
import { generateSourcePilot } from "./source-pilot.js";
import {
  assertSourceCanBeAcquired,
  assertSupportedFilename,
  loadSourceRegistry,
} from "./source-processing-policy.js";

function defaultRoot(): string {
  return resolve(fileURLToPath(new URL("..", import.meta.url)));
}

function requestedRoot(args: string[]): string {
  const rootIndex = args.indexOf("--root");
  const rootArgument = rootIndex >= 0 ? args[rootIndex + 1] : undefined;
  return rootArgument ? resolve(rootArgument) : defaultRoot();
}

function reportFailure(result: KnowledgeValidationResult): void {
  console.error(`Knowledge validation failed with ${result.issues.length} error(s):`);
  for (const issue of result.issues) {
    console.error(`- ${issue.file}${issue.path}: [${issue.keyword}] ${issue.message}`);
  }
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function filenameFromUrl(value: string): string | undefined {
  try {
    const filename = basename(new URL(value).pathname);
    return filename ? decodeURIComponent(filename) : undefined;
  } catch {
    return undefined;
  }
}

async function runAcquire(args: string[], root: string): Promise<void> {
  const sourceId = option(args, "--source-id");
  const filePath = option(args, "--file");
  const url = option(args, "--url");
  const explicitSourceUrl = option(args, "--source-url");
  const filename = option(args, "--filename");
  const artifactId = option(args, "--artifact-id");
  if (!sourceId || Boolean(filePath) === Boolean(url) || (filePath && !explicitSourceUrl)) {
    throw new SourceProcessingError(
      "ACQUISITION_INVALID",
      "Usage: knowledge acquire --source-id <id> (--url <url> | --file <path> --source-url <url>) [--filename <name>] [--artifact-id <id>]",
    );
  }
  const resolvedFilename = filename ?? (filePath ? basename(filePath) : filenameFromUrl(url!));
  if (!resolvedFilename) throw new Error("Could not determine original filename; pass --filename");
  const sources = loadSourceRegistry(root);
  assertSourceCanBeAcquired(sources.get(sourceId), sourceId);
  assertSupportedFilename(sourceId, resolvedFilename);

  const artifact = filePath
    ? acquireLocalFile(root, {
        sourceId,
        filePath,
        sourceUrl: explicitSourceUrl!,
        filename: resolvedFilename,
        ...(artifactId ? { artifactId } : {}),
      })
    : await (async () => {
        const response = await fetch(url!);
        if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
        return acquireArtifact(root, {
          sourceId,
          filename: resolvedFilename,
          sourceUrl: url!,
          bytes: new Uint8Array(await response.arrayBuffer()),
          ...(artifactId ? { artifactId } : {}),
        });
      })();

  console.log(`Acquired ${artifact.artifact_id} (${artifact.sha256}) at ${artifact.raw_path}.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const root = requestedRoot(args);
  if (command === "pilot") {
    console.log(`Created draft: ${generateSourcePilot(root, option(args, "--pilot") ?? "").draftPath}`);
    return;
  }

  if (command === "review") {
    const server = await startReviewServer(root,Number(option(args,"--port") ?? "4317"));
    console.log(`Human review UI: ${server.url}\nSource reviews only. Press Ctrl+C to stop.`);
    for (const signal of ["SIGINT","SIGTERM"] as const) process.once(signal,() => {
      void server.close().then(() => process.exit(0));
    });
    return;
  }
  if (command === "curate") {
    const conceptId = option(args,"--concept-id");
    if (!conceptId) throw new Error("Pass --concept-id physics.electricity.electric-circuits.ohms-law");
    console.log(`Created draft: ${curateKnowledge(root,conceptId).draftPath}`);
    return;
  }

  if (command === "acquire") {
    await runAcquire(args, root);
    return;
  }
  if (command === "normalize") {
    const artifactId = option(args, "--artifact-id");
    const documentPrefix = option(args, "--document-prefix");
    const result = normalizeAcquiredArtifacts(root, {
      ...(artifactId ? { artifactId } : {}), ...(documentPrefix ? { documentPrefix } : {}),
    });
    console.log(`Normalized ${result.artifactCount} artifact(s) into ${result.recordCount} provenance-linked record(s).`);
    return;
  }
  if (command !== "validate" && command !== "build") {
    console.error("Usage: knowledge <acquire|normalize|validate|build|review|curate|pilot> [options]");
    process.exitCode = 2;
    return;
  }

  const result = command === "validate" ? validateKnowledge(root) : buildKnowledge(root);
  if (!result.valid) {
    reportFailure(result);
    process.exitCode = 1;
    return;
  }

  if (command === "validate") {
    console.log(`Validated ${result.documents.length} knowledge document(s) and the source manifest.`);
  } else {
    console.log(
      `Built ${result.productionDocuments.length} reviewed document(s); excluded ${result.documents.length - result.productionDocuments.length} non-reviewed document(s).`,
    );
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof SourceProcessingError) console.error(`${error.code}: ${error.message}`);
  else console.error(error instanceof Error ? error.message : "Knowledge command failed");
  process.exitCode = 1;
}
