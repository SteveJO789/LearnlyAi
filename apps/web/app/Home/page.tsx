"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import "./style.css";

// NOTE(Cake): image URLs below are temporary Figma-hosted asset links
// (expire ~7 days after being generated). Swap these for real, permanent
// assets — either exported from Figma into /public or final photography —
// before this ships anywhere beyond local dev.
const heroImage =
  "https://www.figma.com/api/mcp/asset/8fd24a11-50b7-4cdf-aa32-f638d45dcf65/d7640.png";
const cardImage1 =
  "https://www.figma.com/api/mcp/asset/8fd24a11-50b7-4cdf-aa32-f638d45dcf65/c0f52.png";
const cardImage2 =
  "https://www.figma.com/api/mcp/asset/8fd24a11-50b7-4cdf-aa32-f638d45dcf65/a5fc4.png";
const cardImage3 =
  "https://www.figma.com/api/mcp/asset/8fd24a11-50b7-4cdf-aa32-f638d45dcf65/6ec63.png";

const HeadButton =
  "rounded-lg bg-black px-6 py-3.5 text-base font-medium text-white shadow-sm hover:bg-neutral-800 transition-colors";

export default function HomePage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="flex w-full items-center justify-between px-5 py-6 sm:px-12 lg:px-20">
        <span className="text-lg font-medium tracking-wide text-black">
          LOGO
        </span>

        <div className="ml-auto flex items-center space-x-4">
          <Link href="/Create" className={HeadButton}>
            Create
          </Link>
          <Link href="/Lessons" className={HeadButton}>
            Lessons
          </Link>

          {/* เมนู Account Dropdown */}
          <div className="relative">
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={HeadButton}
              
              type="button"
            >
              Account
            </button>

            {isOpen && (
            
              <div className="absolute right-0 mt-2 w-40 rounded-2xl bg-white/80 p-2 shadow-xl backdrop-blur-md border border-neutral-100 flex flex-col space-y-1 z-50"
              style={{
              backgroundImage:
                "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
            }}>
                <Link
                  href="/Profile"
                  className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
                  onClick={() => setIsOpen(false)}
                >
                  Profile
                </Link>

                <Link
                  href="/History"
                  className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
                  onClick={() => setIsOpen(false)}
                >
                  History
                </Link>

                <Link
                  href="/Settings"
                  className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
                  onClick={() => setIsOpen(false)}
                >
                  Settings
                </Link>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    // ฟังก์ชัน Log Out
                  }}
                  className="w-full py-2 text-center text-sm font-medium text-purple-400 hover:text-purple-600 hover:bg-purple-50/50 rounded-xl transition-all mt-1"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-5 sm:px-12 lg:px-20">
        <section className="relative max-w-[1100px] pt-6 pb-10">
          <div
            className="hello-gradient pointer-events-none absolute right-0 top-6 hidden bg-clip-text text-4xl font-medium tracking-tight text-transparent sm:block lg:text-5xl"
            style={{
              backgroundImage:
                "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
              backgroundSize: "180% 180%",
              backgroundPosition: "0% 50%",
            }}
          >
            Hello <span>(user...)</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-black sm:text-5xl lg:text-6xl">
            Welcome to LearnlyAI
          </h1>
          <p className="mt-6 text-lg text-black/75 sm:text-xl lg:text-2xl">
            Your AI tutor that breaks every problem down, step by step — so you
            actually understand, not just get the answer.
          </p>
          <Link
            href="/SignIn"
            className="mt-10 inline-flex items-center rounded-lg bg-black px-8 py-5 text-lg font-medium text-white shadow-sm hover:bg-neutral-800 sm:text-xl"
          >
            START
          </Link>
        </section>

        <section className="pb-16">
          <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg">
            <Image
              src={heroImage}
              alt="Learners studying with LearnlyAI"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        </section>

        <section className="pb-24">
          <h2 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">
            What is LearnlyAI ?
          </h2>

          <div className="mt-10 flex flex-col gap-16">
            <article>
              <div className="relative aspect-[1279/405] w-full overflow-hidden rounded-lg">
                <Image
                  src={cardImage1}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="mt-6 max-w-[381px]">
                <h3 className="text-2xl font-medium text-black">Subheading</h3>
                <p className="mt-1 text-2xl text-neutral-500">
                  Body text for whatever you&rsquo;d like to add more to the
                  subheading.
                </p>
              </div>
            </article>

            <article className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
              <div className="relative aspect-[623.5/405] w-full overflow-hidden rounded-lg">
                <Image
                  src={cardImage2}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="max-w-[381px]">
                <h3 className="text-2xl font-medium text-black">Subheading</h3>
                <p className="mt-1 text-2xl text-neutral-500">
                  Body text for whatever you&rsquo;d like to share more.
                </p>
              </div>
            </article>

            <article className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
              <div className="max-w-[381px] md:order-1">
                <h3 className="text-2xl font-medium text-black">Subheading</h3>
                <p className="mt-1 text-2xl text-neutral-500">
                  Body text for whatever you&rsquo;d like to expand on the main
                  point.
                </p>
              </div>
              <div className="relative aspect-[656/405] w-full overflow-hidden rounded-lg md:order-2">
                <Image
                  src={cardImage3}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}