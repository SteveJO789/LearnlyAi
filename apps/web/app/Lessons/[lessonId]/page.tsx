import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getLesson } from "../../lib/mock-lessons";

type Props = {
  params: Promise<{ lessonId: string }>;
};

export default async function LearningPage({ params }: Props) {
  const { lessonId } = await params;
  const lesson = getLesson(lessonId);

  if (!lesson) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="flex items-center justify-between px-5 py-6 sm:px-12 lg:px-20">
        <Link href="/Home" className="text-lg font-medium tracking-wide">
          LOGO
        </Link>
        <Link href="/Lessons" className="text-sm text-muted hover:underline">
          Back
        </Link>
      </header>

      <main className="px-5 sm:px-12 lg:px-20 pb-24 max-w-3xl mx-auto">
        <div
          className="hello-gradient pointer-events-none bg-clip-text text-3xl font-medium tracking-tight text-transparent sm:text-4xl"
          style={{
            backgroundImage:
              "conic-gradient(from 180deg, #ffe89e, #ff2fb0, #8178ff, #93fbff, #ffe89e)",
            backgroundSize: "180% 180%",
            backgroundPosition: "0% 50%",
          }}
        >
          Welcome Back <span>(user...)</span>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Learning Page</h1>
        <p className="mt-1 text-lg font-medium text-muted">{lesson.title}</p>

        <div className="relative mt-5 aspect-[21/9] w-full overflow-hidden rounded-2xl">
          <Image
            src={lesson.imageUrl}
            alt={lesson.title}
            fill
            unoptimized
            className="object-cover"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted">{lesson.progressPercent}% Completed</p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${lesson.progressPercent}%` }}
              />
            </div>
          </div>
          <Link
            href={`/Chat/${lesson.sessionId}?subject=${encodeURIComponent(lesson.subject)}`}
            className="shrink-0 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
          >
            Learning Lessons
          </Link>
        </div>

        <h2 className="mt-10 text-xl font-bold">Lessons</h2>
        <div className="mt-3 rounded-2xl border border-surface-border bg-surface overflow-hidden">
          {lesson.units.map((unit, index) => (
            <div
              key={unit.id}
              className={`p-4 ${
                index < lesson.units.length - 1 ? "border-b border-surface-border" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary/60 px-4 py-2.5">
                <span className="text-sm font-medium">{unit.name}</span>
                <span className="text-xs text-muted shrink-0">
                  {unit.progressPercent}% Completed
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${unit.progressPercent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
