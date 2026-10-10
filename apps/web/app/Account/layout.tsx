import type { ReactNode } from "react";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen bg-transparent">
      {/* Persistent dreamy background: shared by every /Account route */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {/* Soft gradient light */}
        <div className="absolute -left-32 top-[4%] h-[28rem] w-[28rem] rounded-full bg-pink-400/20 blur-[120px] animate-roam-1" />
        <div className="absolute -right-32 top-[18%] h-[30rem] w-[30rem] rounded-full bg-violet-400/20 blur-[125px] animate-roam-2" />
        <div className="absolute left-[24%] top-[48%] h-[24rem] w-[24rem] rounded-full bg-sky-400/15 blur-[115px] animate-roam-3" />
        <div className="absolute bottom-[-10rem] right-[16%] h-[28rem] w-[28rem] rounded-full bg-yellow-300/15 blur-[125px] animate-roam-1 [animation-delay:4s]" />

        {/* Tiny drifting stars */}
        <span className="absolute left-[12%] top-[22%] text-lg text-pink-300/80 animate-dreamy">✦</span>
        <span className="absolute left-[31%] top-[13%] text-sm text-violet-300/80 animate-dreamy-slow [animation-delay:3s]">✧</span>
        <span className="absolute right-[24%] top-[28%] text-base text-sky-300/80 animate-dreamy [animation-delay:5s]">✦</span>
        <span className="absolute right-[12%] top-[58%] text-sm text-pink-300/80 animate-dreamy-slow [animation-delay:2s]">✧</span>
        <span className="absolute left-[39%] bottom-[14%] text-base text-violet-300/80 animate-dreamy-slowest">✦</span>
        <span className="absolute right-[35%] bottom-[22%] text-sm text-yellow-300/90 animate-dreamy [animation-delay:6s]">✧</span>
      </div>

      {/* Route content stays above the background; translucent panels can reveal it */}
      <div className="relative z-10 min-h-screen bg-transparent">
        {children}
      </div>
    </div>
  );
}
