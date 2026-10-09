"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLearningProfile, getLearningProgress, type LearningProfileDto, type LearningProgressDto } from "../../lib/assessments";
import { listLearningSessions, type LearningSessionSummary } from "../../lib/learning-sessions";
import { useLanguage } from "../lib/i18n/LanguageContext";

export const summaryCopy = {
  en: { title: "Your learning", loading: "Loading your progress…", retry: "Retry", empty: "No assessments yet. Start a lesson to see your results.",
    sessions: "Sessions", complete: "Completed", progress: "Learning progress", latest: "Latest assessment results", sample: "questions",
    math: "Linear equations", physics: "Ohm's law", recent: "Recent sessions", history: "View history", comparisons: "Before / after learning", before: "Pre", after: "Post", strength: "Strong result", weak: "Needs practice" },
  th: { title: "การเรียนของคุณ", loading: "กำลังโหลดความคืบหน้า…", retry: "ลองอีกครั้ง", empty: "ยังไม่มีผลแบบทดสอบ เริ่มเรียนเพื่อดูผลของคุณ",
    sessions: "บทเรียน", complete: "เรียนจบแล้ว", progress: "ความคืบหน้า", latest: "ผลประเมินล่าสุด", sample: "ข้อ",
    math: "สมการเชิงเส้น", physics: "กฎของโอห์ม", recent: "บทเรียนล่าสุด", history: "ดูประวัติ", comparisons: "ก่อนและหลังเรียน", before: "ก่อน", after: "หลัง", strength: "ผลแบบทดสอบดี", weak: "ควรฝึกเพิ่ม" },
};
export function LearningSummaryView({ language, profile, progress, sessions, loading, error, retry }: {
  language: "th" | "en"; profile: LearningProfileDto | null; progress: LearningProgressDto | null;
  sessions: LearningSessionSummary[]; loading: boolean; error: string | null; retry: () => void;
}) {
  const copy = summaryCopy[language];
  const topic = (value: string) => value === "linear-equations" ? copy.math : value === "ohms-law" ? copy.physics : value;
  return <section aria-busy={loading} className="my-8 rounded-2xl border border-surface-border bg-surface p-5 sm:p-7">
    <h2 className="text-2xl font-semibold">{copy.title}</h2>
    {loading ? <p role="status" className="mt-4 text-muted">{copy.loading}</p> : null}
    {error ? <div role="alert" className="mt-4 text-danger"><p>{error}</p><button type="button" onClick={retry} className="mt-3 rounded-lg border px-4 py-2">{copy.retry}</button></div> : null}
    {!loading && !error && progress ? <>
      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[[copy.sessions, progress.sessionCount], [copy.complete, progress.completedSessionCount], [copy.progress, `${progress.averageProgressPercent}%`]].map(([label, value]) =>
          <div key={label} className="rounded-xl bg-background p-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}
      </dl>
      <h3 className="mt-6 font-semibold">{copy.latest}</h3>
      {profile && Object.keys(profile.mastery).length ? <ul className="mt-3 space-y-3">{Object.entries(profile.mastery).map(([key, sample]) => sample ?
        <li key={key} className="flex flex-wrap justify-between gap-2 rounded-xl border border-surface-border p-3"><span>{topic(key)}
          {profile.strengths.includes(key as keyof LearningProfileDto["mastery"]) ? <span className="ml-2 text-sm text-primary">{copy.strength}</span> : null}
          {profile.weakPoints.includes(key as keyof LearningProfileDto["mastery"]) ? <span className="ml-2 text-sm text-muted">{copy.weak}</span> : null}
        </span><span>{sample.percent}% · {sample.sampleQuestions} {copy.sample}</span></li> : null)}</ul> : <p className="mt-3 text-muted">{copy.empty}</p>}
      {progress.comparisons.length ? <div className="mt-6"><h3 className="font-semibold">{copy.comparisons}</h3><ul className="mt-3 space-y-2">
        {progress.comparisons.slice(0, 5).map(pair => <li key={`${pair.sessionId}:${pair.topic}`} className="flex flex-wrap justify-between gap-2 text-sm">
          <span>{topic(pair.topic)}</span><span>{copy.before}: {pair.prePercent === null ? "—" : `${pair.prePercent}%`} → {copy.after}: {pair.postPercent === null ? "—" : `${pair.postPercent}%`}
            {pair.deltaPercent === null ? "" : ` (${pair.deltaPercent > 0 ? "+" : ""}${pair.deltaPercent})`}</span></li>)}
      </ul></div> : null}
      {sessions.length ? <div className="mt-6"><h3 className="font-semibold">{copy.recent}</h3><ul className="mt-3 space-y-2">{sessions.slice(0, 5).map(session =>
        <li key={session.id}><Link href={`/Chat/${encodeURIComponent(session.id)}`} className="flex justify-between gap-3 rounded-lg bg-background px-3 py-2 hover:underline"><span className="truncate">{session.title}</span><span>{session.progressPercent}%</span></Link></li>)}</ul></div> : null}
      <Link href="/History" className="mt-5 inline-block text-primary hover:underline">{copy.history}</Link>
    </> : null}
  </section>;
}
export default function LearningSummary() {
  const { language } = useLanguage();
  const [profile, setProfile] = useState<LearningProfileDto | null>(null), [progress, setProgress] = useState<LearningProgressDto | null>(null);
  const [sessions, setSessions] = useState<LearningSessionSummary[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(null);
    Promise.all([getLearningProfile(controller.signal), getLearningProgress(controller.signal), listLearningSessions()])
      .then(([nextProfile, nextProgress, nextSessions]) => { if (active) { setProfile(nextProfile); setProgress(nextProgress); setSessions(nextSessions); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Learning progress could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [retry]);
  return <LearningSummaryView language={language} profile={profile} progress={progress} sessions={sessions} loading={loading} error={error} retry={() => setRetry(value => value + 1)} />;
}
