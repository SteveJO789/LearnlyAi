"use client";
import { useState } from "react";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { logicOutput, ohmsCurrent, solveLinear } from "../../lib/learning-simulations";

const initialNumber = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 10000 ? value : fallback;
const display = (value: number) => Number(value.toFixed(3)).toString();
export default function InteractiveLesson({ component, props = {}, enabled }: {
  component: string; props?: Record<string, unknown>; enabled: boolean;
}) {
  const { language } = useLanguage();
  const thai = language === "th";
  const [voltage, setVoltage] = useState(() => Math.max(0, initialNumber(props.voltage, 12)));
  const [resistance, setResistance] = useState(() => Math.max(1, initialNumber(props.resistance, 6)));
  const [a, setA] = useState(() => initialNumber(props.a, 2)), [b, setB] = useState(() => initialNumber(props.b, 4)), [c, setC] = useState(() => initialNumber(props.c, 10));
  const [inputA, setInputA] = useState(Boolean(props.inputA)), [inputB, setInputB] = useState(Boolean(props.inputB));
  const [gate, setGate] = useState<"AND" | "OR" | "XOR">(props.gate === "OR" || props.gate === "XOR" ? props.gate : "AND");
  const numberChange = (value: string, setter: (value: number) => void) => {
    const next = Number(value);
    if (value.trim() && Number.isFinite(next) && Math.abs(next) <= 10000) setter(next);
  };
  if (component === "OHMS_LAW") {
    const current = ohmsCurrent(voltage, resistance);
    return <section className="rounded-2xl border border-surface-border bg-surface p-5">
      <h3 className="font-semibold">{thai ? "ทดลองกฎของโอห์ม" : "Explore Ohm’s law"}</h3>
      <p className="mt-2 text-sm text-muted">{thai ? "ใช้กับตัวต้านทานโอห์มมิกที่อุณหภูมิคงที่" : "For an ohmic resistor at constant temperature."}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>{thai ? "แรงดัน" : "Voltage"} (V)<input aria-label="Voltage (V)" type="number" min="0" max="10000" step="any" value={voltage} disabled={!enabled}
          onChange={event => numberChange(event.target.value, value => setVoltage(Math.max(0, value)))} className="mt-2 w-full rounded-lg border bg-background p-2" /></label>
        <label>{thai ? "ความต้านทาน" : "Resistance"} (Ω)<input aria-label="Resistance (Ω)" type="number" min="0.001" max="10000" step="any" value={resistance} disabled={!enabled}
          onChange={event => numberChange(event.target.value, value => { if (value > 0) setResistance(value); })} className="mt-2 w-full rounded-lg border bg-background p-2" /></label>
      </div>
      <output className="mt-4 block rounded-xl bg-secondary p-4" aria-live="polite">I = V/R = {current === null ? "—" : display(current)} A</output>
    </section>;
  }
  if (component === "LINEAR_EQUATION") {
    const x = solveLinear(a, b, c);
    return <section className="rounded-2xl border border-surface-border bg-surface p-5">
      <h3 className="font-semibold">{thai ? "ทดลองสมการเชิงเส้น" : "Explore a linear equation"}</h3><p className="mt-2">ax + b = c</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[['a', a, setA], ['b', b, setB], ['c', c, setC]].map(([name, value, setter]) =>
        <label key={String(name)}>{String(name)}<input aria-label={`Coefficient ${name}`} type="number" step="any" value={value as number} disabled={!enabled}
          onChange={event => numberChange(event.target.value, setter as (value: number) => void)} className="mt-2 w-full rounded-lg border bg-background p-2" /></label>)}</div>
      <output className="mt-4 block rounded-xl bg-secondary p-4" aria-live="polite">
        {typeof x === "number" ? `x = (c − b)/a = ${display(x)}` : x === "ALL" ? (thai ? "ทุกค่าของ x เป็นคำตอบ" : "Every x is a solution") : (thai ? "ไม่มีคำตอบ" : "No solution")}
      </output>
    </section>;
  }
  if (component === "LOGIC_GATE") return <section className="rounded-2xl border border-surface-border bg-surface p-5">
    <h3 className="font-semibold">{thai ? "ทดลองลอจิกเกต" : "Explore a logic gate"}</h3>
    <label className="mt-4 block">Gate<select aria-label="Logic gate" value={gate} disabled={!enabled} onChange={event => setGate(event.target.value as typeof gate)} className="ml-3 rounded-lg border bg-background p-2">
      <option>AND</option><option>OR</option><option>XOR</option></select></label>
    <div className="mt-4 flex gap-6"><label><input type="checkbox" checked={inputA} disabled={!enabled} onChange={event => setInputA(event.target.checked)} /> A</label>
      <label><input type="checkbox" checked={inputB} disabled={!enabled} onChange={event => setInputB(event.target.checked)} /> B</label></div>
    <output className="mt-4 block rounded-xl bg-secondary p-4" aria-live="polite">{Number(inputA)} {gate} {Number(inputB)} = {logicOutput(gate, inputA, inputB)}</output>
  </section>;
  return <p role="status">{thai ? "ไม่รองรับกิจกรรมนี้" : "This activity is unsupported."}</p>;
}
