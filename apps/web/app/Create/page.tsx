"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import SiteHeader from "../components/SiteHeader";
import CuteLoadingPopup from "../components/CuteLoadingPopup";
import CreateMagicCharacters from "./CreateMagicCharacters";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { createLearningSession, createTextMaterial } from "../../lib/learning-sessions";
import { getCurrentUserProfile, type AppUserProfile } from "../../lib/user-profile";
import { uploadFileMaterial, reviewFileMaterial, listUploadReceipts, resumeFileUpload, validateSelectedFile, type FileMaterialDto, type UploadReceiptDto } from "../../lib/file-materials";

export default function CreatePage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);

  const [question, setQuestion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [material, setMaterial] = useState<FileMaterialDto | null>(null);
  const [receipts, setReceipts] = useState<UploadReceiptDto[]>([]);
  const [fileError, setFileError] = useState(false);
  const label = (th: string, en: string) => language === "th" ? th : en;

  const canStart = (question.trim().length > 0 || file !== null) && question.length <= 8000;

  useEffect(() => {
    getCurrentUserProfile()
      .then((user) => { if (!user) router.replace("/SignIn"); else setProfile(user); })
      .catch(() => router.replace("/SignIn"));
  }, [router]);
  useEffect(() => () => uploadController.current?.abort(), []);

  async function handleStart() {
    if (!canStart || isStarting) return;

    const input = question.trim();
    if (!input && !file) return;

    setError(null);
    setIsStarting(true);

    try {
      let id = draftId;
      if (!id) {
        id = (await createLearningSession({ title: (input || file?.name || "Lesson").replace(/\s+/g, " ").slice(0, 120) })).id;
        setDraftId(id);
      }
      if (file && !material) {
        const controller = new AbortController(); uploadController.current = controller;
        const extracted = await uploadFileMaterial(id, file, controller.signal);
        setMaterial(extracted); setReceipts([]); setFileError(false);
        setQuestion(extracted.normalizedText + (input ? "\n\n" + input : ""));
        return;
      }
      if (material) await reviewFileMaterial(id, material.id, input);
      else await createTextMaterial(id, input);
      router.push(`/Assessment/${id}?phase=PRE`);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start a learning session.",
      );
      if (file && !material) setFileError(true);
    } finally { uploadController.current = null; setIsStarting(false); }
  }

  async function checkUploads() {
    if (!draftId || isStarting) return;
    setIsStarting(true); setError(null);
    try {
      const uploads = await listUploadReceipts(draftId); setReceipts(uploads);
      if (!uploads.length) { setFileError(false); setError(label("ยังไม่พบไฟล์ที่ส่ง ลองอ่านไฟล์อีกครั้งได้", "No upload was found. You can try reading the file again.")); }
    } catch (e) { setError(e instanceof Error ? e.message : label("ตรวจไฟล์ไม่สำเร็จ", "Could not check uploads.")); }
    finally { setIsStarting(false); }
  }
  async function restoreUpload(id: string) {
    if (!draftId || isStarting) return;
    setIsStarting(true); setError(null);
    try {
      const restored = await resumeFileUpload(draftId, id);
      if (restored.status === "CANCELLED") { setFileError(false); setReceipts([]); setError(label("รายการนี้ถูกยกเลิกแล้ว เลือกไฟล์แล้วอ่านใหม่ได้", "This upload was cancelled. Select a file to read again.")); }
      else { setMaterial(restored); setQuestion(restored.normalizedText); setFileError(false); setReceipts([]); }
    } catch (e) { setError(e instanceof Error ? e.message : label("กู้คืนไฟล์ไม่สำเร็จ", "Could not restore the upload.")); }
    finally { setIsStarting(false); }
  }

  return (
    <div className="min-h-screen bg-background text-text relative">
      {isStarting && <CuteLoadingPopup message="กำลังสร้างบทเรียน..." detail="กำลังบันทึกข้อมูลและเตรียมห้องเรียนของคุณ 🚀" />}
      <CreateMagicCharacters />
      {/* เลเยอร์ท้องฟ้าการ์ตูน: แสงฟุ้งและดาวลอย */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* กลุ่มแสงฟุ้งเกรเดียนต์เบื้องหลัง */}
        <div className="absolute left-[5%] top-[15%] h-96 w-96 rounded-full bg-pink-400/15 blur-[120px] animate-roam-1" />
        <div className="absolute right-[10%] top-[35%] h-[420px] w-[420px] rounded-full bg-violet-400/15 blur-[120px] animate-roam-2" />
        <div className="absolute left-[25%] bottom-[15%] h-80 w-80 rounded-full bg-sky-400/15 blur-[110px] animate-roam-3" />
        
        {/* {ดาวดวงเล็ก (ชุดเดิม) - เลเยอร์หลัง z-10} */}
        <div className="absolute left-[12%] top-[22%] text-pink-400 text-sm animate-dreamy z-10">✦</div>
        <div className="absolute left-[28%] top-[12%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '3s' }}>✦</div>
        <div className="absolute left-[45%] top-[28%] text-sky-400 text-sm animate-dreamy z-10" style={{ animationDelay: '5s' }}>✦</div>
        <div className="absolute right-[22%] top-[18%] text-pink-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '2s' }}>✦</div>
        <div className="absolute right-[12%] top-[32%] text-violet-400 text-sm animate-dreamy z-10" style={{ animationDelay: '7s' }}>✦</div>
        
        <div className="absolute left-[8%] top-[55%] text-sky-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '4s' }}>✦</div>
        <div className="absolute left-[22%] top-[75%] text-pink-400 text-sm animate-dreamy z-10" style={{ animationDelay: '6s' }}>✦</div>
        <div className="absolute right-[30%] top-[65%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '1s' }}>✦</div>
        <div className="absolute right-[15%] top-[78%] text-sky-400 text-sm animate-dreamy z-10" style={{ animationDelay: '8s' }}>✦</div>
        <div className="absolute left-[38%] bottom-[18%] text-pink-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '3.5s' }}>✦</div>
      </div>

      {/* {ดาวดวงใหญ่ขึ้น (ใหม่) - เลเยอร์หน้า z-20} */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        <div className="absolute left-[20%] top-[15%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '10s' }}>✦</div>
        <div className="absolute right-[25%] top-[45%] text-violet-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '5s' }}>✦</div>
        <div className="absolute left-[15%] bottom-[30%] text-sky-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '15s' }}>✦</div>
        <div className="absolute right-[15%] bottom-[20%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '20s' }}>✦</div>
        <div className="absolute left-[50%] top-[80%] text-violet-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '25s' }}>✦</div>
      </div>

      <SiteHeader
        links={[
          { labelKey: "nav.account", href: "/Account/Profile" },
          { labelKey: "nav.home", href: "/Home" },
          { labelKey: "nav.create", href: "/Create#learning-input" },
        ]}
      />

      <main className="px-5 sm:px-12 lg:px-20 pb-24 relative z-10">
        <div
          className="hello-gradient pointer-events-none max-w-full break-words bg-clip-text text-2xl font-medium leading-tight tracking-tight text-transparent sm:text-3xl lg:text-4xl"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
            backgroundSize: "180% 180%",
            backgroundPosition: "0% 50%",
          }}
        >
          {t("home.greeting")} <span className="inline-block max-w-full break-words">{profile?.displayName ?? "..."}</span>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => router.push("/Lessons")}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface/80 px-4 py-2 text-sm font-medium text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          >
            <span aria-hidden="true">←</span>
            {t("nav.lessons")}
          </button>
        </div>

        <div className="mx-auto mt-8 w-full max-w-3xl px-2 text-center sm:px-4">
          <div className="flex justify-center w-full">
            <h1 
              className="whitespace-nowrap font-bold tracking-tight text-center"
              style={{ fontSize: '46px', lineHeight: '1.2' }}
            >
              {t("create.title")}
            </h1>
          </div>
          <p className="mt-3 text-muted">{t("create.subtitle")}</p>
        </div>

        <div id="learning-input" className="mt-10 max-w-xl mx-auto flex scroll-mt-8 flex-col items-center gap-5">
          <div className="w-full">
            <label htmlFor="learning-question" className="mb-1.5 block text-xs font-semibold text-muted">{material ? label("ตรวจข้อความจากไฟล์และแก้สมการ/หน่วยให้ถูกต้อง", "Review extracted text and correct equations or units") : t("create.textAreaLabel")}</label>
            <textarea
              id="learning-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={6}
              maxLength={8000}
              disabled={isStarting}
              placeholder={t("create.placeholder")}
              className="w-full resize-none rounded-2xl border border-surface-border bg-surface p-5 text-sm outline-none focus:border-primary placeholder:text-muted"
            />
            {material && <p role="status" className="mt-2 text-xs text-muted">{label("อ่านไฟล์แล้ว ตรวจข้อความก่อนกดเริ่มเรียน", "File read. Review the text before starting.")}</p>}
            {question.length > 8000 && <p role="alert" className="text-xs text-danger">{label("ข้อความรวมเกิน 8000 ตัวอักษร กรุณาแก้ให้สั้นลง", "Combined text exceeds 8000 characters. Please shorten it.")}</p>}
          </div>

          <span className="text-sm text-muted">{t("create.or")}</span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStarting || !!material}
            className="w-full break-all rounded-full border border-surface-border bg-surface px-4 py-4 text-sm text-muted hover:border-primary transition-colors cursor-pointer disabled:opacity-60"
          >
            {file ? `📎 ${file.name}` : t("create.uploadPlaceholder")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              try { if (selected) validateSelectedFile(selected); setFile(selected); setError(null); setFileError(false); setReceipts([]); }
              catch (error) { setFile(null); setError(error instanceof Error ? error.message : label("ไฟล์ไม่รองรับ", "Unsupported file.")); }
            }}
          />
          {file && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setMaterial(null); setDraftId(null); setReceipts([]); setFileError(false);
                  setError(null);
                }}
                className="-mt-3 text-xs text-muted hover:text-danger self-end"
                disabled={isStarting}
              >
                {t("create.removeFile")}
              </button>
              <p className="text-xs text-muted">
                {label("PDF, PNG หรือ JPEG ไม่เกิน 3 MiB", "PDF, PNG or JPEG up to 3 MiB")}
              </p>
            </>
          )}
          {fileError && <div className="w-full rounded-xl border border-surface-border p-3 text-sm">
            <p>{label("หากการเชื่อมต่อหลุด ตรวจไฟล์ที่ส่งไว้ก่อนส่งซ้ำ", "If the connection failed, check existing uploads before sending again.")}</p>
            <button type="button" disabled={isStarting} onClick={checkUploads} className="mt-2 text-primary underline">{label("ตรวจไฟล์ที่ส่งแล้ว", "Check existing uploads")}</button>
            {receipts.map(receipt => <button key={receipt.id} type="button" disabled={isStarting} onClick={() => restoreUpload(receipt.id)} className="mt-2 block text-primary underline">
              {label("ตรวจ/กู้คืน", "Check/restore")} {receipt.filename}
            </button>)}
          </div>}

          {error && (
            <p role="alert" className="w-full rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || isStarting || fileError}
            className={`w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer ${canStart && !isStarting ? "motion-safe:animate-bounce shadow-lg shadow-primary/25 ring-2 ring-primary/20" : ""}`}
          >
            {isStarting ? t("create.starting") : file && !material ? label("อ่านไฟล์", "Read file") : t("create.start")}
          </button>
        </div>
      </main>
    </div>
  );
}
