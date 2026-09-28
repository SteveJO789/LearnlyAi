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

// Optional: /learn/demo-session-001?goal=...&subject=math
// (the Create page can pass these along later)
export default async function LearnPage({ params, searchParams }: LearnPageProps) {
  const { sessionId } = await params;
  const query = await searchParams;

  return (
    <LearningSession
      key={sessionId}
      sessionId={sessionId}
      learningGoal={firstValue(query.goal)}
      subject={firstValue(query.subject)}
    />
  );
}
