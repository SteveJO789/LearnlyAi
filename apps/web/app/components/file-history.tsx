"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FileHistoryItem } from "../../lib/file-materials";
import { downloadFileMaterial, reviewFileMaterial } from "../../lib/file-materials";
import { en, th } from "../lib/i18n/dictionary";

export function FileHistoryCards({ items, language, onSelect }: { items: readonly FileHistoryItem[]; language: "th" | "en"; onSelect(file: FileHistoryItem): void }) {
  const t = (key: string) => (language === "th" ? th : en)[key] ?? key;
  if (!items.length) return <p className="py-12 text-center text-sm text-muted">{t("history.noFiles")}</p>;
  return <div className="grid w-full grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {items.map(file => <button key={file.id} type="button" onClick={() => onSelect(file)}
      className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-surface-border bg-background p-4 text-center transition-all hover:border-primary/60">
      <span aria-hidden="true" className="mb-3 rounded-lg bg-secondary px-3 py-2 text-xs text-muted">{file.type === "PDF" ? "PDF" : t("history.image")}</span>
      <span className="w-full break-words text-xs font-semibold">{file.filename || t("history.unnamedFile")}</span>
      <span className="mt-1 text-[10px] text-muted">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric" }) : t("history.unknownUploadDate")}</span>
      <span className="mt-1 text-[10px] text-muted">{file.reviewedByLearner ? t("history.textConfirmed") : t("history.textUnconfirmed")}</span>
    </button>)}
  </div>;
}

export function FileHistoryDetails({ file, language, onClose, onReviewed }: {
  file: FileHistoryItem; language: "th" | "en"; onClose(): void; onReviewed(file: FileHistoryItem): void;
}) {
  const t = (key: string) => (language === "th" ? th : en)[key] ?? key;
  const dialog = useRef<HTMLDivElement>(null), downloading = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [text, setText] = useState(file.normalizedText ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement;
    mounted.current = true;
    dialog.current?.focus();
    return () => { mounted.current = false; downloading.current?.abort(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  async function download() {
    const controller = new AbortController(); downloading.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setBusy(true); setError(null);
    try {
      const blob = await downloadFileMaterial(file.sessionId, file.id, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      if (blob.size !== file.sizeBytes || blob.type !== file.mimeType) throw new Error(t("history.fileChanged"));
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      try { anchor.href = url; anchor.download = file.filename || `material.${file.type === "PDF" ? "pdf" : file.mimeType === "image/png" ? "png" : "jpg"}`;
        document.body.appendChild(anchor); anchor.click();
      } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (cause) { if (mounted.current) setError(controller.signal.aborted ? t("history.fileError") : cause instanceof Error ? cause.message : t("history.fileError")); }
    finally { clearTimeout(timeout); if (mounted.current) setBusy(false); }
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    const controller = new AbortController(); downloading.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await reviewFileMaterial(file.sessionId, file.id, text, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      setText(result.normalizedText); onReviewed({ ...file, normalizedText: result.normalizedText, reviewedByLearner: true });
    } catch (cause) { if (mounted.current) setError(controller.signal.aborted ? t("history.fileError") : cause instanceof Error ? cause.message : t("history.fileError")); }
    finally { clearTimeout(timeout); if (mounted.current) setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="history-file-title"
      className="relative flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 text-text shadow-2xl sm:p-8"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key !== "Tab") return;
        const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], textarea:not(:disabled)');
        const first = nodes?.[0], last = nodes?.[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <div className="flex items-start justify-between gap-4">
        <h2 id="history-file-title" className="break-words text-lg font-semibold">{file.filename || t("history.unnamedFile")}</h2>
        <button type="button" onClick={onClose} className="shrink-0 rounded-xl bg-secondary px-4 py-2 text-sm">{t("history.back")}</button>
      </div>
      <p className="break-words text-sm text-muted">{file.sessionTitle}</p>
      <p className="text-xs text-muted">{(file.sizeBytes / 1024).toFixed(1)} KB · {file.mimeType}</p>
      {error ? <p role="alert" className="rounded-xl border border-danger/40 p-3 text-sm text-danger">{error}</p> : null}
      {busy ? <p role="status" className="text-sm text-muted">{t("history.fileWorking")}</p> : null}
      <form onSubmit={confirm} className="flex flex-col gap-3">
        <label htmlFor="history-file-text" className="text-sm font-medium">{t("history.fileText")}</label>
        <textarea id="history-file-text" value={text} onChange={event => setText(event.target.value)} maxLength={8000}
          readOnly={!file.canReview} disabled={busy} className="min-h-52 rounded-xl border border-surface-border bg-background p-3 text-sm" />
        <p className="text-xs text-muted">{file.reviewedByLearner ? t("history.textConfirmed") : t("history.textUnconfirmed")}</p>
        {file.canReview ? <button type="submit" disabled={busy || !text.trim()} className="self-start rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{t("history.confirmFileText")}</button> : null}
      </form>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={download} disabled={busy} className="rounded-xl border border-surface-border px-4 py-2 text-sm disabled:opacity-50">{t("history.downloadFile")}</button>
        <Link href={`/Chat/${encodeURIComponent(file.sessionId)}`} className="rounded-xl border border-surface-border px-4 py-2 text-sm text-primary">{t("history.openLearning")}</Link>
      </div>
    </div>
  </div>;
}
