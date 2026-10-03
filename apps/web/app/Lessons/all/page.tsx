import Link from "next/link";
import Image from "next/image";

import { LESSONS } from "../../lib/mock-lessons";

export default function AllLessonsPage() {
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

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-center">Your Lessons</h1>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {LESSONS.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/Lessons/${lesson.id}`}
              className="flex flex-col gap-2 group"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl ring-1 ring-surface-border">
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
      </main>
    </div>
  );
}
