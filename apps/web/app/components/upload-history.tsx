"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cancelFileUpload, listUploadHistory, resumeFileUpload, type UploadHistoryItem } from "../../lib/file-materials";
import { en, th } from "../lib/i18n/dictionary";

export function UploadReceiptCards({ items, language, busyId, confirmId, onResume, onConfirm, onCancel }: {
  items: readonly UploadHistoryItem[]; language: "th" | "en"; busyId: string | null; confirmId: string | null;
  onResume(item: UploadHistoryItem): void; onConfirm(id: string | null): void; onCancel(item: UploadHistoryItem): void;
}) {
  const t = (key: string) => (language === "th" ? th : en)[key] ?? key;
  return <div className="flex flex-col gap-3">
    {items.map(item => <article key={item.id} className="flex flex-col gap-2 rounded-xl border border-surface-border bg-background p-4">
      <h3 className="break-words text-sm font-semibold">{item.filename || t("history.unnamedFile")}</h3>
      <p className="break-words text-xs text-muted">{item.sessionTitle}</p>
      <p className="text-xs text-muted">{item.state === "PENDING" ? t("history.uploadPending") : t("history.uploadCancelled")}</p>
      <p className="text-xs text-muted">{new Date(item.createdAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric" })}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {item.canResume ? <button type="button" disabled={busyId !== null} onClick={() => onResume(item)}
          className="rounded-lg border border-primary/40 px-3 py-2 text-primary disabled:opacity-50">{t("history.resumeUpload")}</button> : null}
        {confirmId === item.id ? <>
          <p className="w-full text-xs text-muted">{t("history.cancelUploadPrompt")}</p>
          <button type="button" disabled={busyId !== null} onClick={() => onCancel(item)} className="rounded-lg border border-danger/40 px-3 py-2 text-danger disabled:opacity-50">{t("history.confirmCancelUpload")}</button>
          <button type="button" disabled={busyId !== null} onClick={() => onConfirm(null)} className="rounded-lg border border-surface-border px-3 py-2 disabled:opacity-50">{t("history.keepUpload")}</button>
        </> : <button type="button" disabled={busyId !== null} onClick={() => onConfirm(item.id)} className="rounded-lg border border-surface-border px-3 py-2 disabled:opacity-50">
          {item.state === "CANCELLED" ? t("history.cleanupUpload") : t("history.cancelUpload")}</button>}
        <Link href={`/Chat/${encodeURIComponent(item.sessionId)}`} className="text-primary hover:underline">{t("history.openLearning")}</Link>
      </div>
    </article>)}
  </div>;
}

export function UploadHistory({ language, from, to, onChanged }: { language: "th" | "en"; from: string; to: string; onChanged(): void }) {
  const t = (key: string) => (language === "th" ? th : en)[key] ?? key;
  const [items, setItems] = useState<UploadHistoryItem[]>([]), [after, setAfter] = useState("");
  const [next, setNext] = useState<string | null>(null), [retry, setRetry] = useState(0), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null), [confirmId, setConfirmId] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);
  useEffect(() => { setAfter(""); setItems([]); setNext(null); setConfirmId(null); }, [from, to]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    listUploadHistory({ after, from, to }, controller.signal).then(page => {
      if (!controller.signal.aborted) { setItems(previous => after ? [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))] : page.items); setNext(page.nextCursor); }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t("history.fileError")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [after, from, to, retry, language]);
  async function act(item: UploadHistoryItem, cancel: boolean) {
    const controller = new AbortController(); operation.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000); setBusyId(item.id); setError(null); setNotice(null);
    try {
      const result = cancel ? await cancelFileUpload(item.sessionId, item.id, controller.signal) : await resumeFileUpload(item.sessionId, item.id, controller.signal);
      if (!controller.signal.aborted && mounted.current) {
        setNotice(t(result.status === "READY" ? "history.uploadSaved" : "history.uploadCleaned"));
        setConfirmId(null); setAfter(""); setRetry(value => value + 1); onChanged();
      }
    } catch (cause) {
      if (mounted.current) setError(controller.signal.aborted ? t("history.uploadUnknown") : cause instanceof Error ? cause.message : t("history.fileError"));
    } finally { clearTimeout(timeout); if (mounted.current) setBusyId(null); }
  }
  return <section aria-labelledby="upload-history-title" className="flex flex-col gap-3 border-b border-surface-border pb-5">
    <h2 id="upload-history-title" className="text-sm font-semibold">{t("history.uploadRecoveryTitle")}</h2>
    <p className="text-xs text-muted">{t("history.uploadRecoveryHelp")}</p>
    {error ? <div role="alert" className="rounded-lg border border-danger/40 p-3 text-sm text-danger"><p>{error}</p>
      <button type="button" disabled={loading || busyId !== null} onClick={() => { setAfter(""); setRetry(value => value + 1); }} className="mt-2 underline disabled:opacity-50">{t("history.reloadUploads")}</button>
    </div> : null}
    {notice ? <p role="status" className="text-sm text-muted">{notice}</p> : null}
    {loading || busyId !== null ? <p role="status" className="text-sm text-muted">{t("history.fileWorking")}</p> : null}
    {!loading && !error && !items.length ? <p className="text-sm text-muted">{t("history.noPendingUploads")}</p> : null}
    <UploadReceiptCards items={items} language={language} busyId={loading || error ? "refresh-required" : busyId} confirmId={confirmId} onResume={item => act(item, false)} onConfirm={setConfirmId} onCancel={item => act(item, true)} />
    {next ? <button type="button" disabled={loading || busyId !== null} onClick={() => setAfter(next)} className="self-start rounded-lg border border-surface-border px-3 py-2 text-sm disabled:opacity-50">{t("history.moreFiles")}</button> : null}
  </section>;
}
