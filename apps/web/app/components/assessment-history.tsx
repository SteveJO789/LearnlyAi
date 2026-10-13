"use client";
import Link from "next/link";
import type { AssessmentHistoryItem } from "../../lib/history";
import { en, th } from "../lib/i18n/dictionary";

export function AssessmentHistory({ items, language }: { items: readonly AssessmentHistoryItem[]; language: "th" | "en" }) {
  const dictionary = language === "th" ? th : en;
  const t = (key: string) => dictionary[key] ?? key;
  if (!items.length) return <p className="py-12 text-center text-sm text-muted">{t("history.noTestResults")}</p>;
  return <div className="grid w-full grid-cols-1 items-start gap-6 sm:grid-cols-2 xl:grid-cols-3">
    {items.map(item => <article key={`${item.sessionId}:${item.topic}`} className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-background p-4">
      <h3 className="break-words text-sm font-semibold">{item.title ?? t("history.assessment")}</h3>
      {([ ["history.pretest", item.prePercent], ["history.posttest", item.postPercent] ] as const).map(([label, percent]) => <div key={label} className="flex flex-col gap-1">
        <p className="text-xs text-muted">{t(label)} {percent === null ? t("history.noScore") : `${percent}%`}</p>
        {percent !== null ? <div role="progressbar" aria-label={t(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div> : null}
      </div>)}
      {item.deltaPercent !== null ? <p className="text-xs text-muted">{t("history.change")} {item.deltaPercent >= 0 ? "+" : ""}{item.deltaPercent} {t("history.percentagePoints")}</p> : null}
      {item.updatedAt ? <p className="text-xs text-muted">{t("history.sessionUpdated")} {new Date(item.updatedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}</p> : null}
      <Link href={`/Chat/${encodeURIComponent(item.sessionId)}`} className="text-sm text-primary hover:underline">{t("history.openLearning")}</Link>
    </article>)}
  </div>;
}
