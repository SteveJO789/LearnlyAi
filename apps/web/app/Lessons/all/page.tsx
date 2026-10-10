"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import SiteHeader from "../../components/SiteHeader";
import CuteLoadingPopup from "../../components/CuteLoadingPopup";
import {
  listLearningSessions,
  type LearningSessionSummary,
} from "../../../lib/learning-sessions";

export default function AllLessonsPage() {
  const [sessions, setSessions] = useState<LearningSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLearningSessions()
      .then(setSessions)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load lessons.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-text">
      {isLoading && <CuteLoadingPopup message="กำลังรวบรวมบทเรียน..." detail="อีกนิดเดียว บทเรียนทั้งหมดกำลังมาแล้ว ✨" />}
      <SiteHeader
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
        showAccountMenu
      />

      <main className="px-5 sm:px-12 lg:px-20 pb-24">
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-center">Your Lessons</h1>

        {error && <p className="mt-8 text-center text-sm text-danger">{error}</p>}

        {!error && sessions.length === 0 && (
          <p className="mt-8 text-center text-muted">No learning sessions yet.</p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/Lessons/${session.id}`}
              className="rounded-2xl border border-surface-border bg-surface p-5 hover:border-primary/60"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{session.title}</p>
                <span className="text-xs text-muted">{session.stage}</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {new Date(session.updatedAt).toLocaleDateString()}
              </p>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${session.progressPercent}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
