"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { changeCurrentUserPassword, PasswordChangeError, type PasswordChangeCode } from "../../lib/password-change";
import { en, th } from "../lib/i18n/dictionary";

export function PasswordChangeForm({ language }: { language: "th" | "en" }) {
  const t = (key: string) => (language === "th" ? th : en)[key] ?? key;
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<PasswordChangeCode | null>(null), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false);
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setSaved(false); setError(null);
    try { await changeCurrentUserPassword(values.current, values.next, values.confirm); if (mounted.current) { setValues({ current: "", next: "", confirm: "" }); setSaved(true); } }
    catch (cause) { if (mounted.current) setError(cause instanceof PasswordChangeError ? cause.code : "UNAVAILABLE"); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <form onSubmit={submit} className="flex max-w-md flex-col gap-5">
    <h3 className="text-xl font-bold">{t("settings.changePassword.title")}</h3>
    {([ ["current", "settings.changePassword.current", "current-password"], ["next", "settings.changePassword.new", "new-password"], ["confirm", "settings.changePassword.confirm", "new-password"] ] as const).map(([field, label, autoComplete]) => <div key={field} className="flex flex-col gap-1.5">
      <label htmlFor={`password-${field}`} className="text-xs font-semibold text-muted">{t(label)}</label>
      <input id={`password-${field}`} name={field} type="password" autoComplete={autoComplete} required maxLength={1024}
        minLength={field === "current" ? undefined : 8} value={values[field]} disabled={busy}
        onChange={event => { setValues(previous => ({ ...previous, [field]: event.target.value })); setError(null); setSaved(false); }}
        className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none transition-all focus:border-primary disabled:opacity-50" />
    </div>)}
    {error ? <p role="alert" className="text-sm text-danger">{t(`settings.passwordError.${error}`)}</p> : null}
    {saved ? <p role="status" className="text-sm text-primary">{t("settings.toast.passwordChanged")}</p> : null}
    {busy ? <p role="status" className="text-xs text-muted">{t("settings.changePassword.saving")}</p> : null}
    <button type="submit" disabled={busy} className="self-start rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50">
      {t("settings.changePassword.save")}
    </button>
  </form>;
}
