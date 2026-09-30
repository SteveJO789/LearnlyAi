"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, useState, ReactNode } from "react";

// ดักจับและซ่อน Warning ของ React 19 ที่มาจาก next-themes ในโหมด Development
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // โหลดและแปะ Brand Color Theme ทันทีที่แอปโหลดในทุกๆ หน้า
    const applySavedTheme = () => {
      const savedColorTheme = localStorage.getItem("app-color-theme") || "default";
      const root = document.documentElement;
      
      // ล้างคลาสธีมเก่าออกให้ครบทุกรูปแบบ
      root.classList.remove("theme-ruby", "theme-peach", "theme-sky", "theme-gold", "theme-slate");
      
      if (savedColorTheme !== "default") {
        root.classList.add(savedColorTheme);
      }
    };

    applySavedTheme();

    // คอยฟัง Event เผื่อมีการเปลี่ยนสีจากหน้า Profile หน้าอื่นจะได้เปลี่ยนตามแบบ Real-time
    window.addEventListener("color-theme-changed", applySavedTheme);
    return () => {
      window.removeEventListener("color-theme-changed", applySavedTheme);
    };
  }, []);

  return (
    // @ts-ignore
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* ใช้ mounted ช่วยเช็กเฉพาะส่วนที่อาจเกิด Hydration Mismatch ได้ แต่ปล่อยให้ Provider ทำงานตลอดเวลา */}
      {children}
    </NextThemesProvider>
  );
}