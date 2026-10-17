"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { AssessmentView, assessmentCopy } from "../../components/assessment-view";
import CuteLoadingPopup from "../../components/CuteLoadingPopup";
import { getLearningSession, LearningApiError } from "../../../lib/learning-sessions";
import { createAssessment, getAssessment, submitAssessment, type AssessmentDto, type AssessmentPhase, type AssessmentTopic } from "../../../lib/assessments";
import { useFeatures } from "../../../lib/features";

export default function AssessmentSession({ sessionId, phase }: { sessionId: string; phase: AssessmentPhase }) {
  const features = useFeatures();
  const { language } = useLanguage();
  const [data, setData] = useState<AssessmentDto | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null), [topic, setTopic] = useState<AssessmentTopic | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({}), [retry, setRetry] = useState(0);
  const busy = useRef(false);
  function restore(next: AssessmentDto) {
    setData(next); setTopic(next.topic);
    setAnswers(previous => next.submittedAt ? Object.fromEntries((next.answers ?? []).map(answer => [answer.questionId, String(answer.response)])) :
      Object.fromEntries(next.questions.map(question => [question.id, previous[question.id] ?? ""])));
  }
  useEffect(() => {
    if (!features.assessments) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(null);
    void (async () => {
      const [session, assessment] = await Promise.allSettled([getLearningSession(sessionId), getAssessment(sessionId, phase, controller.signal)]);
      if (!active) return;
      if (session.status === "rejected") throw session.reason;
      if (assessment.status === "fulfilled") { restore(assessment.value); return; }
      if (!(assessment.reason instanceof LearningApiError) || assessment.reason.status !== 404) throw assessment.reason;
      setData(null); setAnswers({});
      if (phase !== "PRE") {
        try { const baseline = await getAssessment(sessionId, "PRE", controller.signal); if (active) setTopic(baseline.topic); }
        catch (cause) { if (!(cause instanceof LearningApiError) || cause.status !== 404) throw cause; }
      }
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Assessment could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [sessionId, phase, retry, features.assessments]);

  async function create() {
    if (!topic || busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try { restore(await createAssessment(sessionId, phase, topic, language)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Assessment could not be created."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function submit() {
    if (!data || data.submittedAt || busy.current) return;
    const input = data.questions.map(question => ({ questionId: question.id, answer: Number(answers[question.id]) }));
    if (data.questions.some(question => !answers[question.id]?.trim()) || input.some(answer => !Number.isFinite(answer.answer))) return;
    busy.current = true; setSaving(true); setError(null);
    try { restore(await submitAssessment(sessionId, phase, input)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Answers could not be saved."); }
    finally { busy.current = false; setSaving(false); }
  }
  if (features.status === "loading") return <p role="status" className="rounded-2xl border border-surface-border bg-surface p-5 text-muted">
    {language === "th" ? "กำลังตรวจสอบว่าเปิดใช้แบบทดสอบหรือไม่…" : "Checking whether assessments are available…"}
  </p>;
  if (features.status === "error") return <div role="alert" className="rounded-2xl border border-danger/40 bg-surface p-5 text-danger">
    <p>{language === "th" ? "ตรวจสอบการเปิดใช้แบบทดสอบไม่สำเร็จ กรุณาลองอีกครั้ง" : "Feature availability could not be checked. Please retry."}</p>
    <button type="button" onClick={features.retry} className="mt-4 rounded-xl border border-danger/40 px-4 py-2">
      {language === "th" ? "ลองอีกครั้ง" : "Retry"}
    </button>
  </div>;
  if (!features.assessments) return <p role="status">{language === "th" ? "แบบทดสอบยังไม่เปิดใช้งาน" : "Assessments are not enabled."} <Link href={`/Chat/${encodeURIComponent(sessionId)}`}>{language === "th" ? "กลับไปเรียน" : "Return to lesson"}</Link></p>;
  return <>
    {(loading || saving) && <CuteLoadingPopup message={saving ? "กำลังบันทึกแบบทดสอบ..." : "กำลังเตรียมแบบทดสอบ..."} detail="กำลังโหลดข้อมูลบทเรียนและจัดห้องเรียนให้พร้อม 🌷" />}
    <AssessmentView language={language} phase={phase} assessment={data} loading={loading} saving={saving} error={error}
      topic={topic} answers={answers} onTopic={setTopic} onAnswer={(id, value) => setAnswers(previous => ({ ...previous, [id]: value }))}
      onCreate={() => void create()} onSubmit={() => void submit()} onRetry={() => setRetry(value => value + 1)} />
    <Link href={`/Chat/${encodeURIComponent(sessionId)}`} className="mt-6 inline-block rounded-xl border border-surface-border px-5 py-3">{assessmentCopy[language].back}</Link>
  </>;
}
