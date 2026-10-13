"use client";

import { usePathname } from "next/navigation";
import "./ShootingStars.css";

const EXCLUDED_ROUTES = [
  "/",          // public pre-login landing page
  "/Home",      // already has its own shooting-star layer
];

export default function ShootingStars() {
  const pathname = usePathname() || "/";
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const isExcluded = EXCLUDED_ROUTES.some((route) => normalized.toLowerCase() === route.toLowerCase())
    || /(^|\/)(chat|conversation)(\/|$)/i.test(normalized);

  if (isExcluded) return null;

  return (
    <div className="global-shooting-stars" aria-hidden="true">
      <span className="global-shooting-star global-shooting-star-a" />
      <span className="global-shooting-star global-shooting-star-b" />
      <span className="global-shooting-star global-shooting-star-c" />
      <span className="global-shooting-star global-shooting-star-d" />
    </div>
  );
}
