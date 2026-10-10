import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fredoka } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers"; // Import เพิ่มตรงนี้
import ShootingStars from "./components/ShootingStars";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Learnly AI",
  description: "AI learning companion that guides learners to think.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={fredoka.variable}>
        <Providers>
          <ShootingStars />
          {children}
        </Providers>
      </body>
    </html>
  );
}
