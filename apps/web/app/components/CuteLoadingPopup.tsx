"use client";

import { useLanguage } from "../lib/i18n/LanguageContext";

type CuteLoadingPopupProps = {
  message?: string;
  detail?: string;
};

const defaultCopy = {
  message: {
    th: "กำลังเตรียมบทเรียนให้พร้อม ✨",
    en: "Getting your lesson ready ✨",
  },
  detail: {
    th: "ขอเวลาสักครู่นะ เรากำลังจัดทุกอย่างให้เรียบร้อย",
    en: "Just a moment while we get everything ready.",
  },
} as const;

const translatedCopy: Record<string, { th: string; en: string }> = {
  "กำลังสร้างบทเรียน...": { th: "กำลังสร้างบทเรียน...", en: "Creating your lesson..." },
  "กำลังบันทึกข้อมูลและเตรียมห้องเรียนของคุณ 🚀": {
    th: "กำลังบันทึกข้อมูลและเตรียมห้องเรียนของคุณ 🚀",
    en: "Saving your information and preparing your learning space 🚀",
  },
  "กำลังโหลดบทเรียน...": { th: "กำลังโหลดบทเรียน...", en: "Loading lessons..." },
  "กำลังดึงบทเรียนล่าสุดของคุณมาแสดง 🌷": {
    th: "กำลังดึงบทเรียนล่าสุดของคุณมาแสดง 🌷",
    en: "Fetching your latest lessons 🌷",
  },
  "กำลังรวบรวมบทเรียน...": { th: "กำลังรวบรวมบทเรียน...", en: "Gathering your lessons..." },
  "อีกนิดเดียว บทเรียนทั้งหมดกำลังมาแล้ว ✨": {
    th: "อีกนิดเดียว บทเรียนทั้งหมดกำลังมาแล้ว ✨",
    en: "Just a moment—your lessons are on the way ✨",
  },
  "กำลังเปิดบทเรียน...": { th: "กำลังเปิดบทเรียน...", en: "Opening your lesson..." },
  "กำลังเตรียมรายละเอียดบทเรียนของคุณ 💖": {
    th: "กำลังเตรียมรายละเอียดบทเรียนของคุณ 💖",
    en: "Preparing your lesson details 💖",
  },
  "กำลังเปิดห้องเรียน...": { th: "กำลังเปิดห้องเรียน...", en: "Opening your learning space..." },
  "กำลังโหลดประวัติและเตรียมแชทให้พร้อม 💫": {
    th: "กำลังโหลดประวัติและเตรียมแชทให้พร้อม 💫",
    en: "Loading your history and getting the chat ready 💫",
  },
  "กำลังบันทึกแบบทดสอบ...": { th: "กำลังบันทึกแบบทดสอบ...", en: "Saving your assessment..." },
  "กำลังเตรียมแบบทดสอบ...": { th: "กำลังเตรียมแบบทดสอบ...", en: "Preparing your assessment..." },
  "กำลังโหลดข้อมูลบทเรียนและจัดห้องเรียนให้พร้อม 🌷": {
    th: "กำลังโหลดข้อมูลบทเรียนและจัดห้องเรียนให้พร้อม 🌷",
    en: "Loading lesson data and preparing your learning space 🌷",
  },
};

function localize(value: string, language: "th" | "en"): string {
  return translatedCopy[value]?.[language] ?? value;
}

export default function CuteLoadingPopup({
  message,
  detail,
}: CuteLoadingPopupProps) {
  const { language } = useLanguage();
  const resolvedMessage = message
    ? localize(message, language)
    : defaultCopy.message[language];
  const resolvedDetail = detail
    ? localize(detail, language)
    : defaultCopy.detail[language];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={resolvedMessage}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/45 px-5 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-8 text-center shadow-[0_25px_80px_-25px_rgba(168,85,247,0.45)]">
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-pink-300/45 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-sky-300/45 blur-3xl" />
        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-pink-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-pink-400 border-r-violet-400 motion-reduce:animate-none" />
          <span className="animate-pulse text-3xl motion-reduce:animate-none" aria-hidden="true">🌸</span>
          <span className="absolute -right-1 top-0 animate-bounce text-lg text-violet-400 motion-reduce:animate-none" aria-hidden="true">✦</span>
          <span className="absolute -bottom-1 -left-1 animate-pulse text-sm text-sky-400 motion-reduce:animate-none" aria-hidden="true">✧</span>
        </div>
        <p className="relative text-lg font-bold text-violet-700">{resolvedMessage}</p>
        <p className="relative mt-2 text-sm leading-6 text-slate-500">{resolvedDetail}</p>
        <div aria-hidden="true" className="relative mt-5 flex justify-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:0ms] motion-reduce:animate-none" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms] motion-reduce:animate-none" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:300ms] motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
