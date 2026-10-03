import Link from "next/link";
import Image from "next/image";

import { LESSONS } from "../lib/mock-lessons";

const NavButton =
  "rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-colors";

export default function LessonsPage() {
  const recent = [...LESSONS]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="flex items-center justify-between px-5 py-6 sm:px-12 lg:px-20">
        <Link href="/Home" className="text-lg font-medium tracking-wide">
          LOGO
        </Link>
        <Link href="/Home" className="text-sm text-muted hover:underline">
          Back
        </Link>
      </header>

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
          Hello <span>(user...)</span>
        </div>

        <Link href="/Create" className={`${NavButton} mt-8 inline-flex items-center`}>
          + Start New Lesson
        </Link>

        <h2 className="mt-10 text-2xl font-bold tracking-tight">Recent Lessons</h2>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {recent.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/Lessons/${lesson.id}`}
              className="flex flex-col gap-2 group"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                <Image
                  src={lesson.imageUrl}
                  alt={lesson.title}
                  fill
                  unoptimized
                  className="object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <p className="text-sm font-medium">{lesson.title}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${lesson.progressPercent}%` }}
                />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/Lessons/all"
            className="rounded-full border border-surface-border px-8 py-2.5 text-sm font-medium text-muted hover:border-primary hover:text-text transition-colors"
          >
            See more...
          </Link>
        </div>
      </main>
    </div>
  );
}
