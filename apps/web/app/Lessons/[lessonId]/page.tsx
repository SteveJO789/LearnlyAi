"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import SiteHeader from "../../components/SiteHeader";
import CuteLoadingPopup from "../../components/CuteLoadingPopup";
import {
  getLearningSession,
  type LearningSessionDetail,
} from "../../../lib/learning-sessions";

export default function LearningPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [session, setSession] = useState<LearningSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    getLearningSession(lessonId)
      .then(setSession)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load lesson.");
      });
  }, [lessonId]);

  return (
    <div className="min-h-screen bg-transparent text-text">
      {!error && !session && <CuteLoadingPopup message="กำลังเปิดบทเรียน..." detail="กำลังเตรียมรายละเอียดบทเรียนของคุณ 💖" />}
      <SiteHeader
        links={[
          { labelKey: "nav.lessons", href: "/Lessons" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
        showAccountMenu
      />

      <main className="px-5 sm:px-12 lg:px-20 pb-24 max-w-3xl mx-auto">
        {error && <p className="mt-8 text-danger">{error}</p>}

        {session && (
          <>
            <h1 className="mt-6 text-3xl font-bold tracking-tight">{session.title}</h1>
            {session.learningGoal && (
              <p className="mt-2 text-muted">{session.learningGoal}</p>
            )}

            <div className="mt-8 rounded-2xl border border-surface-border bg-surface p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Current stage</p>
                  <p className="mt-1 text-lg font-medium">{session.stage}</p>
                </div>
                <p className="text-sm text-muted">{session.progressPercent}% completed</p>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${session.progressPercent}%` }}
                />
              </div>

              <div className="mt-6 flex gap-3">
                <Link
                  href={`/Chat/${session.id}`}
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Continue Learning
                </Link>
                <Link
                  href="/Lessons"
                  className="rounded-lg border border-surface-border px-6 py-3 text-sm font-medium text-muted hover:text-text"
                >
                  Back
                </Link>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-surface-border bg-surface p-6">
              <h2 className="text-lg font-bold">Session activity</h2>
              <p className="mt-2 text-sm text-muted">
                {session.messages.length} persisted messages · Last updated{" "}
                {new Date(session.updatedAt).toLocaleString()}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
