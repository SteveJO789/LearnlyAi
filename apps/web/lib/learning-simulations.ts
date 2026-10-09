export function ohmsCurrent(voltage: number, resistance: number) {
  if (!Number.isFinite(voltage) || !Number.isFinite(resistance) || resistance <= 0) return null;
  return voltage / resistance;
}
export function solveLinear(a: number, b: number, c: number): number | "ALL" | "NONE" | null {
  if (![a, b, c].every(Number.isFinite)) return null;
  return a === 0 ? (b === c ? "ALL" : "NONE") : (c - b) / a;
}
export function logicOutput(gate: "AND" | "OR" | "XOR", a: boolean, b: boolean): 0 | 1 {
  return (gate === "AND" ? a && b : gate === "OR" ? a || b : a !== b) ? 1 : 0;
}
