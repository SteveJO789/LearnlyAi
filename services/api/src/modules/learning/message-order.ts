/**
 * Canonical conversation ordering for persisted and in-memory messages.
 * New turns have distinct server timestamps. For legacy timestamp ties, infer
 * USER before TUTOR only when the bucket contains exactly one of each; the
 * chronology of buckets with multiple possible pairs cannot be recovered, so
 * those buckets retain deterministic timestamp/id order. SYSTEM events are
 * placed after an unambiguous pair, in id order.
 */
export type OrderedMessage = { id: string; createdAt: string; role: string; orderingTimestamp?: string };

function eventTime(message: OrderedMessage): number {
  const value = message.orderingTimestamp ?? message.createdAt;
  const match = /^(.*T\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!match) throw new Error("Invalid persisted message timestamp.");
  const wholeSecond = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(wholeSecond)) throw new Error("Invalid persisted message timestamp.");
  const fraction = (match[2] ?? "").slice(0, 6).padEnd(6, "0");
  return wholeSecond * 1000 + Number(fraction || "0");
}

export function orderConversationMessages<T extends OrderedMessage>(messages: readonly T[]): T[] {
  const timestampOrder = [...messages].sort((left, right) =>
    eventTime(left) - eventTime(right) || left.id.localeCompare(right.id));
  const ordered: T[] = [];
  for (let start = 0; start < timestampOrder.length;) {
    let end = start + 1;
    while (end < timestampOrder.length && eventTime(timestampOrder[end]!) === eventTime(timestampOrder[start]!)) end++;
    const bucket = timestampOrder.slice(start, end);
    const users = bucket.filter(message => message.role === "USER");
    const tutors = bucket.filter(message => message.role === "TUTOR");
    if (users.length === 1 && tutors.length === 1) {
      ordered.push(users[0]!, tutors[0]!, ...bucket.filter(message => message.role !== "USER" && message.role !== "TUTOR"));
    } else {
      ordered.push(...bucket);
    }
    start = end;
  }
  return ordered;
}
