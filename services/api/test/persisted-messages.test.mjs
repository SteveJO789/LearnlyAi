import assert from "node:assert/strict";
import test from "node:test";

import { decodePersistedMessageRow } from "../dist/modules/learning/persisted-messages.js";

const base = {
  id: "message-1",
  learningSessionId: "session-1",
  createdAt: "2026-10-08T15:42:00.000Z",
};

test("decodes a persisted user JSON string", () => {
  const result = decodePersistedMessageRow({
    ...base,
    role: "USER",
    contentJson: JSON.stringify("Explain Ohm's law"),
  });
  assert.equal(result.content, "Explain Ohm's law");
  assert.equal(result.role, "USER");
});

test("decodes a persisted tutor JSON object without losing its blocks", () => {
  const content = { schemaVersion: "1.0", blocks: [{ type: "explanation", id: "b1", content: "V = IR" }] };
  const result = decodePersistedMessageRow({
    ...base,
    role: "TUTOR",
    contentJson: JSON.stringify(content),
  });
  assert.deepEqual(result.content, content);
});

test("rejects invalid JSON and unsupported roles", () => {
  assert.throws(() => decodePersistedMessageRow({ ...base, role: "USER", contentJson: "{invalid" }), /not valid JSON/);
  assert.throws(() => decodePersistedMessageRow({ ...base, role: "OTHER", contentJson: "{}" }), /Unsupported persisted message role/);
});
