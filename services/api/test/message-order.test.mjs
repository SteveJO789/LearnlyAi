import assert from "node:assert/strict";
import test from "node:test";
import { orderConversationMessages } from "../dist/modules/learning/message-order.js";

const message = (id, role, createdAt = "2026-10-01T12:00:00.000Z") => ({ id, role, createdAt });

test("orders an unambiguous legacy USER/TUTOR tie before deterministic SYSTEM events", () => {
  const result = orderConversationMessages([
    message("a-system", "SYSTEM"),
    message("a-tutor", "TUTOR"),
    message("z-user", "USER"),
  ]);
  assert.deepEqual(result.map(row => row.id), ["z-user", "a-tutor", "a-system"]);
});

test("keeps ambiguous multiple-pair ties in deterministic id order", () => {
  const result = orderConversationMessages([
    message("04-system", "SYSTEM"), message("03-tutor-b", "TUTOR"),
    message("02-user-b", "USER"), message("01-tutor-a", "TUTOR"), message("00-user-a", "USER"),
  ]);
  assert.deepEqual(result.map(row => row.id), ["00-user-a", "01-tutor-a", "02-user-b", "03-tutor-b", "04-system"]);
});

test("keeps distinct database microsecond timestamps distinct even when public createdAt is millisecond precision", () => {
  const result = orderConversationMessages([
    { ...message("a-tutor", "TUTOR"), orderingTimestamp: "2026-10-01T12:00:00.000002Z" },
    { ...message("z-user", "USER"), orderingTimestamp: "2026-10-01T12:00:00.000001Z" },
  ]);
  assert.deepEqual(result.map(row => row.id), ["z-user", "a-tutor"]);
});

test("compares microsecond and millisecond clocks on one normalized timeline", () => {
  const later = orderConversationMessages([
    { ...message("a-user", "USER"), orderingTimestamp: "2026-10-01T12:00:00.000001Z" },
    message("z-tutor", "TUTOR", "2026-10-01T12:00:00.000Z"),
  ]);
  assert.deepEqual(later.map(row => row.id), ["z-tutor", "a-user"]);

  const sameInstant = orderConversationMessages([
    { ...message("a-tutor", "TUTOR"), orderingTimestamp: "2026-10-01T12:00:00.000000Z" },
    message("z-user", "USER", "2026-10-01T12:00:00.000Z"),
  ]);
  assert.deepEqual(sameInstant.map(row => row.id), ["z-user", "a-tutor"]);
});
