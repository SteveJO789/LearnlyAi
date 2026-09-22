import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";

const examplesDirectory = new URL("../../../contracts/examples/", import.meta.url);

function readExample(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, examplesDirectory), "utf8"));
}

function expectInvalid(value, keyword) {
  const result = validateTutorOutput(value);

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.some((error) => error.keyword === keyword),
    `Expected ${keyword}, received ${JSON.stringify(result.errors)}`,
  );

  return result;
}

test("every valid contract example passes validation", () => {
  const exampleNames = readdirSync(examplesDirectory)
    .filter((name) => name.endsWith(".json"))
    .sort();

  assert.ok(exampleNames.length >= 3);

  for (const exampleName of exampleNames) {
    assert.deepEqual(
      validateTutorOutput(readExample(exampleName)),
      { valid: true, errors: [] },
      exampleName,
    );
  }
});

test("all supported block discriminators pass validation", () => {
  const value = readExample("explanation.json");
  value.blocks = [
    value.blocks[0],
    {
      id: "blk_guided",
      type: "guided_question",
      content: "What value should be isolated next?",
      expectedInput: "TEXT",
      citationIds: ["src_algebra_notes"],
    },
    {
      id: "blk_hint",
      type: "hint",
      content: "Apply the same operation to both sides.",
      level: 1,
      citationIds: ["src_algebra_notes"],
    },
    {
      id: "blk_quiz",
      type: "quiz",
      questionId: "q_linear_001",
      prompt: "What is x when x + 2 = 5?",
      format: "NUMBER",
      citationIds: ["src_algebra_notes"],
    },
    {
      id: "blk_feedback",
      type: "feedback",
      content: "Correct: subtracting two gives x = 3.",
      result: "CORRECT",
      citationIds: ["src_algebra_notes"],
    },
    {
      id: "blk_interactive",
      type: "interactive",
      component: "LINEAR_EQUATION",
      props: { leftSide: "x + 2", rightSide: 5 },
      citationIds: ["src_algebra_notes"],
    },
  ];

  assert.deepEqual(validateTutorOutput(value), { valid: true, errors: [] });
});

test("a missing required top-level property fails", () => {
  const result = expectInvalid(readExample("invalid/missing-required-field.json"), "required");

  assert.ok(result.errors.some((error) => error.path === "/sessionId"));
});

test("an unknown top-level property fails", () => {
  const result = expectInvalid(
    readExample("invalid/additional-unknown-property.json"),
    "additionalProperties",
  );

  assert.ok(result.errors.some((error) => error.path === "/debug"));
});

test("an unknown block property fails", () => {
  const value = readExample("explanation.json");
  value.blocks[0].internalNotes = "must not reach the frontend";

  const result = expectInvalid(value, "additionalProperties");
  assert.ok(result.errors.some((error) => error.path.endsWith("/internalNotes")));
});

test("an unsupported block type fails", () => {
  expectInvalid(readExample("invalid/unsupported-block-type.json"), "oneOf");
});

test("progress must be an integer from 0 through 100", () => {
  const tooHigh = readExample("explanation.json");
  tooHigh.progress.percent = 101;
  expectInvalid(tooHigh, "maximum");

  const fractional = readExample("explanation.json");
  fractional.progress.percent = 12.5;
  expectInvalid(fractional, "type");
});

test("nextAction only accepts supported values", () => {
  const value = readExample("explanation.json");
  value.progress.nextAction = "SKIP";

  expectInvalid(value, "enum");
});

test("blank required content and duplicate references fail", () => {
  const blankContent = readExample("explanation.json");
  blankContent.blocks[0].content = "   ";
  expectInvalid(blankContent, "pattern");

  const duplicateReferences = readExample("explanation.json");
  duplicateReferences.blocks[0].citationIds = ["src_algebra_notes", "src_algebra_notes"];
  expectInvalid(duplicateReferences, "uniqueItems");
});

test("block, citation, and quiz choice IDs are unique in their scopes", () => {
  const duplicateCitations = readExample("explanation.json");
  duplicateCitations.citations.push({
    ...duplicateCitations.citations[0],
    title: "Another source with the same ID",
  });
  expectInvalid(duplicateCitations, "uniqueId");

  const duplicateChoices = readExample("quiz.json");
  duplicateChoices.blocks[0].choices[1].id = duplicateChoices.blocks[0].choices[0].id;
  expectInvalid(duplicateChoices, "uniqueId");
});

test("an existing citation reference passes", () => {
  assert.deepEqual(validateTutorOutput(readExample("explanation.json")), {
    valid: true,
    errors: [],
  });
});

test("an unresolved citationId returns a controlled error", () => {
  const result = expectInvalid(
    readExample("invalid/unresolved-citation.json"),
    "citationReference",
  );

  assert.deepEqual(result.errors, [
    {
      path: "/blocks/0/citationIds/0",
      keyword: "citationReference",
      message: "must reference an existing citation: src_missing",
    },
  ]);
});

test("unknown inputs return validation results without throwing", () => {
  const cyclic = {};
  cyclic.self = cyclic;

  for (const value of [undefined, null, true, 42, "output", [], {}, cyclic]) {
    assert.doesNotThrow(() => validateTutorOutput(value));

    const result = validateTutorOutput(value);
    assert.equal(result.valid, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0);
  }
});
