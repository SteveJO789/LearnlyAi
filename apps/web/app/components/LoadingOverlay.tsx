"use client";

export default function LoadingOverlay({ message = "Logging in..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-white shadow-xl border border-neutral-100">
        {/* SVG Spinner ตามดีไซน์จุดหมุนใน Figma */}
        <svg
          className="h-10 w-10 animate-spin text-neutral-800"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>

        <p className="text-sm font-medium text-neutral-600 tracking-wide">{message}</p>
      </div>
    </div>
  );
}