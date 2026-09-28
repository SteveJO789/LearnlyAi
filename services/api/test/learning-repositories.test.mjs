import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryLearningPersistence } from "../dist/modules/learning/in-memory-repositories.js";

function session(id = "session-1") {
  return { id, state: "ACTIVE", stage: "EXPLAIN", progress: { percent: 25, canAdvance: true, nextAction: "CONTINUE" }, version: 1, createdAt: "2026-09-27T00:00:00Z", updatedAt: "2026-09-27T00:00:00Z" };
}

test("repositories copy data on writes and reads and scope messages by session", async () => {
  const persistence = new InMemoryLearningPersistence();
  const original = session();
  await persistence.sessions.save(original);
  original.progress.percent = 99;
  const read = await persistence.sessions.findById(original.id);
  assert.equal(read.progress.percent, 25);
  read.state = "FAILED";
  assert.equal((await persistence.sessions.findById(original.id)).state, "ACTIVE");
  assert.equal(await persistence.sessions.findById("missing"), null);

  const message = { id: "message-1", sessionId: original.id, role: "USER", content: "question", createdAt: original.createdAt };
  await persistence.messages.add(message);
  message.content = "changed";
  const messages = await persistence.messages.findBySessionId(original.id);
  assert.equal(messages[0].content, "question");
  messages[0].content = "also changed";
  assert.equal((await persistence.messages.findBySessionId(original.id))[0].content, "question");
  assert.deepEqual(await persistence.messages.findBySessionId("another-session"), []);
});

test("a failed commit leaves both session and message repositories unchanged", async () => {
  const persistence = new InMemoryLearningPersistence();
  const value = session();
  const message = { id: "message-1", sessionId: value.id, role: "USER", content: "question", createdAt: value.createdAt };
  await assert.rejects(persistence.commit({ session: value, expectedVersion: null, messages: [message, message] }));
  assert.equal(await persistence.sessions.findById(value.id), null);
  assert.deepEqual(await persistence.messages.findBySessionId(value.id), []);
  assert.equal(await persistence.commit({ session: value, expectedVersion: null, messages: [message] }), true);
  assert.equal(await persistence.commit({ session: value, expectedVersion: null, messages: [] }), false);
  await assert.rejects(persistence.commit({ session: { ...value, version: 2 }, expectedVersion: 1, messages: [message] }));
  assert.equal((await persistence.sessions.findById(value.id)).version, 1);
  assert.equal((await persistence.messages.findBySessionId(value.id)).length, 1);
});
