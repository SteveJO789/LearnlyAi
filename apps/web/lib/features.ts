"use client";
import { useEffect, useState } from "react";
export type Features = { assessments: boolean; fileUploads: boolean };
export const disabledFeatures: Features = { assessments: false, fileUploads: false };
export async function getFeatures(signal?: AbortSignal): Promise<Features> {
  const response = await fetch("/api/capabilities", { signal, cache: "no-store", redirect: "error" });
  const value = await response.json();
  if (!response.ok || typeof value?.data?.assessments !== "boolean" || typeof value?.data?.fileUploads !== "boolean") {
    throw new Error("Feature availability could not be checked. Please retry.");
  }
  return { assessments: value.data.assessments, fileUploads: value.data.assessments && value.data.fileUploads };
}
/** Fail closed while loading or unavailable; the API remains the authority. */
export function useFeatures() {
  const [features, setFeatures] = useState(disabledFeatures);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    getFeatures(controller.signal).then(value => { if (active) setFeatures(value); }).catch(() => {}).finally(() => {
      clearTimeout(timer); if (active) setLoaded(true);
    });
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, []);
  return { ...features, loaded };
}
