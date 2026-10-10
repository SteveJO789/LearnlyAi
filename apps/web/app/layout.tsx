import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fredoka, IBM_Plex_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers"; // Import เพิ่มตรงนี้
import ShootingStars from "./components/ShootingStars";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-thai",
  display: "swap",
});

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
      <body className={`${plusJakarta.variable} ${ibmPlexSansThai.variable} ${fredoka.variable}`}>
        <Providers>
          <ShootingStars />
          {children}
        </Providers>
      </body>
    </html>
  );
}
