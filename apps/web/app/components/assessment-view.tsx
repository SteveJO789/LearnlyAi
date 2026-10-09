import type { AssessmentDto, AssessmentPhase, AssessmentTopic } from "../../lib/assessments";

export const assessmentCopy = {
  en: { title: "Assessment", PRE: "Pre-test", POST: "Post-test", TRANSFER: "Transfer practice", topic: "Topic",
    choose: "Choose a topic", math: "Linear equations", physics: "Ohm's law", start: "Start assessment", submit: "Submit answers",
    loading: "Loading assessment…", submitting: "Saving answers…", retry: "Retry", answer: "Answer", score: "Score",
    result: "Your answers have been saved", correct: "Correct", incorrect: "Try this concept again", back: "Back to learning" },
  th: { title: "แบบทดสอบ", PRE: "ก่อนเรียน", POST: "หลังเรียน", TRANSFER: "ฝึกนำไปใช้", topic: "หัวข้อ",
    choose: "เลือกหัวข้อ", math: "สมการเชิงเส้น", physics: "กฎของโอห์ม", start: "เริ่มแบบทดสอบ", submit: "ส่งคำตอบ",
    loading: "กำลังโหลดแบบทดสอบ…", submitting: "กำลังบันทึกคำตอบ…", retry: "ลองอีกครั้ง", answer: "คำตอบ", score: "คะแนน",
    result: "บันทึกคำตอบแล้ว", correct: "ถูกต้อง", incorrect: "ลองทบทวนหัวข้อนี้อีกครั้ง", back: "กลับไปเรียน" },
};

type Props = {
  language: "th" | "en"; phase: AssessmentPhase; assessment: AssessmentDto | null; loading: boolean;
  saving: boolean; error: string | null; topic: AssessmentTopic | ""; answers: Record<string, string>;
  onTopic: (topic: AssessmentTopic | "") => void; onAnswer: (id: string, answer: string) => void;
  onCreate: () => void; onSubmit: () => void; onRetry: () => void;
};
export function AssessmentView(props: Props) {
  const copy = assessmentCopy[props.language];
  const data = props.assessment;
  const submitted = Boolean(data?.submittedAt);
  const complete = Boolean(data && data.questions.every(question => props.answers[question.id]?.trim() && Number.isFinite(Number(props.answers[question.id]))));
  return <section className="rounded-2xl border border-surface-border bg-surface p-5 sm:p-8" aria-busy={props.loading || props.saving}>
    <h1 className="text-2xl font-semibold">{copy.title}: {copy[props.phase]}</h1>
    {props.loading ? <p role="status" className="mt-5 text-muted">{copy.loading}</p> : null}
    {props.error ? <div role="alert" className="mt-5 rounded-xl border border-danger/40 p-4 text-danger">
      <p>{props.error}</p><button type="button" onClick={props.onRetry} disabled={props.saving} className="mt-3 rounded-lg border px-4 py-2">{copy.retry}</button>
    </div> : null}
    {!props.loading && !data ? <div className="mt-6 space-y-4">
      <label htmlFor="assessment-topic" className="block font-medium">{copy.topic}</label>
      <select id="assessment-topic" value={props.topic} onChange={event => props.onTopic(event.target.value as AssessmentTopic | "")}
        className="w-full rounded-xl border border-surface-border bg-background p-3" disabled={props.saving}>
        <option value="">{copy.choose}</option><option value="linear-equations">{copy.math}</option><option value="ohms-law">{copy.physics}</option>
      </select>
      <button type="button" onClick={props.onCreate} disabled={!props.topic || props.saving || Boolean(props.error)} className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-40">{copy.start}</button>
    </div> : null}
    {data ? <form className="mt-6 space-y-6" onSubmit={event => { event.preventDefault(); props.onSubmit(); }}>
      {data.questions.map((question, index) => <fieldset key={question.id} className="rounded-xl border border-surface-border p-4" disabled={submitted || props.saving}>
        <legend className="px-2 font-medium">{index + 1}. {question.prompt}</legend>
        <label className="mt-3 block text-sm text-muted" htmlFor={`answer-${question.id}`}>{copy.answer}{question.unit ? ` (${question.unit})` : ""}</label>
        <input id={`answer-${question.id}`} name={question.id} type="number" step="any" inputMode="decimal" required
          value={props.answers[question.id] ?? ""} onChange={event => props.onAnswer(question.id, event.target.value)}
          className="mt-2 w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
        {submitted ? <p className="mt-3 text-sm">{data.answers?.find(answer => answer.questionId === question.id)?.isCorrect ? copy.correct : copy.incorrect}</p> : null}
      </fieldset>)}
      {submitted ? <div role="status" className="rounded-xl bg-secondary p-5"><p>{copy.result}</p><p className="mt-2 text-xl font-semibold">{copy.score}: {data.score}/{data.maxScore}</p></div> :
        <button type="submit" disabled={!complete || props.saving} className="rounded-xl bg-primary px-5 py-3 text-primary-foreground disabled:opacity-40">{props.saving ? copy.submitting : copy.submit}</button>}
    </form> : null}
  </section>;
}
