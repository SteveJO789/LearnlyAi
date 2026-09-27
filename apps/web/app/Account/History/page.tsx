"use client";

import { useState } from "react";
import Link from "next/link";

type TabType = "Chat" | "Lessons" | "Uploaded Files" | "Test Results";

interface FileItem {
  id: number;
  name: string;
  date: string; // ISO หรือรูปแบบ YYYY-MM-DD
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType | null>("Uploaded Files");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // State สำหรับควบคุม Popover ปฏิทิน และการเก็บค่าวันที่
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // สมมุติตัวอย่างข้อมูลไฟล์
  const [filesHistory] = useState<FileItem[]>([
    { id: 1, name: "equation-worksheet.pdf", date: "2026-09-10" },
    { id: 2, name: "equation-worksheet(1).pdf", date: "2026-09-10" },
    { id: 3, name: "equation-worksheet(2).pdf", date: "2026-09-10" },
  ]);

  // ฟังก์ชัน Filter ข้อมูลตามวันที่ผู้ใช้เลือก
  const filteredFiles = filesHistory.filter((file) => {
    if (!startDate && !endDate) return true;
    if (startDate && file.date < startDate) return false;
    if (endDate && file.date > endDate) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-white text-neutral-900 relative">
      {/* ----------------- Modal เปิดดูไฟล์ (หน้า B) ----------------- */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="relative flex h-[85vh] w-[90vw] max-w-4xl flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute right-6 top-6 rounded-xl bg-neutral-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-600 transition-all"
            >
              Back
            </button>
            <div className="flex flex-col items-center justify-center gap-6">
              <svg
                className="h-48 w-48 text-neutral-800"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002-2v-2"
                />
              </svg>
              <p className="text-xl font-medium text-neutral-700">{selectedFile.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- Header ----------------- */}
      <header className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="text-xl font-bold">
          LOGO
        </Link>
        <div className="flex gap-4">
          <Link href="/Create" className="rounded-xl bg-black px-6 py-2.5 text-white">
            Create
          </Link>
          <Link href="/Lessons" className="rounded-xl bg-black px-6 py-2.5 text-white">
            Lessons
          </Link>
          <Link href="/Account" className="rounded-xl bg-black px-6 py-2.5 text-white">
            HOME
          </Link>
          <Link href="/" className="rounded-xl bg-neutral-200 px-6 py-2.5 text-black">
            Back
          </Link>
        </div>
      </header>

      {/* ----------------- Main Content ----------------- */}
      <main className="px-8 py-4">
        <h1 className="mb-6 text-sm font-semibold tracking-tight text-neutral-800 whitespace-nowrap">
          Your Account Setting
        </h1>
        <div className="flex gap-8">
          {/* Left Sidebar Menu */}
          <aside className="w-64 rounded-3xl border border-neutral-200 p-6 flex flex-col gap-6 text-sm">
            <div>
              <p className="font-semibold text-neutral-400 mb-2">Profile</p>
              <ul className="space-y-2 text-neutral-600 pl-2">
                <li>Personal Info</li>
                <li>Change Password</li>
                <li>Learning Preferences</li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-black mb-2">History</p>
              <ul className="space-y-1.5 pl-2">
                {(["Chat", "Lessons", "Uploaded Files", "Test Results"] as TabType[]).map((tab) => (
                  <li key={tab}>
                    <button
                      onClick={() => setActiveTab(tab)}
                      className={`w-full text-left py-1.5 px-3 rounded-lg transition-all ${
                        activeTab === tab
                          ? "font-semibold bg-neutral-100 text-black"
                          : "text-neutral-500 hover:text-black"
                      }`}
                    >
                      {tab}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold text-neutral-400 mb-2">Setting</p>
              <ul className="space-y-2 text-neutral-600 pl-2">
                <li>Notifications</li>
                <li>Language</li>
                <li>Theme</li>
                <li>Privacy</li>
                <li className="text-red-500">Delete Account</li>
              </ul>
            </div>
          </aside>

          {/* Right Main Display Panel */}
          <section className="flex-1 rounded-3xl border border-neutral-200 p-6 min-h-[500px] flex flex-col">
            {activeTab && (
              <div className="flex justify-end relative mb-6">
                {/* ปุ่มแสดงช่วงวันที่ */}
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="flex items-center gap-1.5 text-xs font-normal transition-colors shrink-0"
                >
                  <span className="text-neutral-600 font-normal shrink-0">date</span>
                  <span
                    className={`border-b border-neutral-300 px-1 py-0.5 text-center transition-colors font-normal whitespace-nowrap ${
                      startDate || endDate ? "text-neutral-800" : "text-neutral-300"
                    }`}
                  >
                    {startDate || endDate
                      ? `${startDate ? startDate.slice(2) : "yy-mm-dd"} ~ ${endDate ? endDate.slice(2) : "yy-mm-dd"}`
                      : "dd/mm/yy-dd/mm/yy"}
                  </span>
                </button>

                {/* ----------------- Popover ปฏิทินเลือกช่วงวันที่ ----------------- */}
                {isDatePickerOpen && (
                  <div className="absolute right-0 top-8 z-20 w-72 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl flex flex-col gap-3 text-xs">
                    <p className="font-medium text-neutral-700">Select Date Range</p>

                    <div className="flex flex-col gap-1">
                      <label className="text-neutral-500">From:</label>
                      <input
                        type="date"
                        min="2000-01-01"
                        max="2099-12-31"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-lg border border-neutral-200 p-2 outline-none focus:border-black text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-neutral-500">To:</label>
                      <input
                        type="date"
                        min="2000-01-01"
                        max="2099-12-31"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-lg border border-neutral-200 p-2 outline-none focus:border-black text-xs"
                      />
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="rounded-lg bg-black px-3 py-1.5 font-medium text-white hover:bg-neutral-800"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ----------------- แสดงผลข้อมูลตาม Tab ที่เลือก ----------------- */}
            <div className="flex-1 flex flex-col justify-start">
              {/* Tab: Uploaded Files */}
              {activeTab === "Uploaded Files" &&
                (filteredFiles.length > 0 ? (
                  <div className="grid grid-cols-3 gap-6 w-full">
                    {filteredFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className="flex flex-col items-center justify-between rounded-2xl border border-neutral-200 p-6 hover:shadow-md transition-all text-center group cursor-pointer bg-white"
                      >
                        <div className="my-2">
                          <svg
                            className="h-12 w-12 text-neutral-400 group-hover:text-black transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-neutral-800 underline decoration-neutral-300 underline-offset-4">
                            {file.name}
                          </p>
                          <p className="text-xs text-neutral-400 mt-2">{file.date}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-neutral-400 text-sm">No files found in this date range.</p>
                  </div>
                ))}

              {/* Tab: Chat */}
              {activeTab === "Chat" && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-neutral-400 text-sm">No chat history found in this date range.</p>
                </div>
              )}

              {/* Tab: Lessons */}
              {activeTab === "Lessons" && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-neutral-400 text-sm">No lesson history found in this date range.</p>
                </div>
              )}

              {/* Tab: Test Results */}
              {activeTab === "Test Results" && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-neutral-400 text-sm">No test results found in this date range.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}