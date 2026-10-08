"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import SiteHeader from "../components/SiteHeader";
import {
  listLearningSessions,
  type LearningSessionSummary,
} from "../../lib/learning-sessions";
import { getCurrentUserProfile } from "../../lib/user-profile";

export default function LessonsPage() {
  const [sessions, setSessions] = useState<LearningSessionSummary[]>([]);
  const [displayName, setDisplayName] = useState("...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listLearningSessions(), getCurrentUserProfile()])
      .then(([items, profile]) => {
        setSessions(items);
        setDisplayName(profile?.displayName ?? "User");
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load lessons.");
      });
  }, []);

  const recent = sessions.slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-text">
      <SiteHeader
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
        showAccountMenu
      />

      <main className="px-5 sm:px-12 lg:px-20 pb-24">
        <div
          className="hello-gradient pointer-events-none bg-clip-text text-4xl font-medium tracking-tight text-transparent"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
            backgroundSize: "180% 180%",
            backgroundPosition: "0% 50%",
          }}
        >
          Hello <span>{displayName}</span>
        </div>

        <Link
          href="/Create"
          className="mt-8 inline-flex items-center rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          + Start New Lesson
        </Link>

        <h2 className="mt-10 text-2xl font-bold tracking-tight">Recent Lessons</h2>

        {error && <p className="mt-5 text-sm text-danger">{error}</p>}

        {!error && recent.length === 0 && (
          <div className="mt-5 rounded-2xl border border-surface-border bg-surface p-8 text-center text-muted">
            No learning sessions yet. Start a new lesson to create one.
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {recent.map((session) => (
            <Link
              key={session.id}
              href={`/Lessons/${session.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-5 hover:border-primary/60"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{session.title}</p>
                <span className="rounded-full bg-secondary px-2 py-1 text-[11px] text-muted">
                  {session.stage}
                </span>
              </div>
              {session.subject && <p className="text-xs text-muted">{session.subject}</p>}
              <div>
                <p className="mb-1 text-xs text-muted">{session.progressPercent}% completed</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${session.progressPercent}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {sessions.length > 3 && (
          <div className="mt-10 flex justify-center">
            <Link
              href="/Lessons/all"
              className="rounded-full border border-surface-border px-8 py-2.5 text-sm font-medium text-muted hover:border-primary hover:text-text"
            >
              See more...
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
