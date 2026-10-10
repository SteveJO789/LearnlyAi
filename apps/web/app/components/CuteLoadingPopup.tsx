"use client";

type CuteLoadingPopupProps = {
  message?: string;
  detail?: string;
};

export default function CuteLoadingPopup({
  message = "กำลังเตรียมบทเรียนให้พร้อม ✨",
  detail = "ขอเวลาสักครู่นะ เรากำลังจัดทุกอย่างให้เรียบร้อย",
}: CuteLoadingPopupProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
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
        <p className="relative text-lg font-bold text-violet-700">{message}</p>
        <p className="relative mt-2 text-sm leading-6 text-slate-500">{detail}</p>
        <div aria-hidden="true" className="relative mt-5 flex justify-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:0ms] motion-reduce:animate-none" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms] motion-reduce:animate-none" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:300ms] motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
