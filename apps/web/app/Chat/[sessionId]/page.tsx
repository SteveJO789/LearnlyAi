import type { Metadata } from "next";

import LearningSession from "./learning-session";

export const metadata: Metadata = {
  title: "Learning session — Learnly AI",
};

type LearnPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// /Chat/demo-session-001?goal=...&subject=math&input=...
// The Create page passes `input` (the learner's first question) so this
// page can send it automatically instead of making them retype it.
export default async function LearnPage({ params, searchParams }: LearnPageProps) {
  const { sessionId } = await params;
  const query = await searchParams;

  return (
    <LearningSession
      key={sessionId}
      sessionId={sessionId}
      learningGoal={firstValue(query.goal)}
      subject={firstValue(query.subject)}
      initialInput={firstValue(query.input)}
    />
  );
}
