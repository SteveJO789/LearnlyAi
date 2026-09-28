"use client";

import { useState } from "react";
import Link from "next/link";

type TabType = "Chat" | "Lessons" | "Uploaded Files" | "Test Results";

interface FileItem {
  id: number;
  name: string;
  date: string;
}

interface ChatItem {
  id: number;
  title: string;
  lastMessage: string;
  date: string;
}

interface LessonItem {
  id: number;
  title: string;
  imageUrl: string;
  progressPercent: number;
  date: string;
}

interface TestResultItem {
  id: number;
  title: string;
  imageUrl: string;
  pretestScore: number;
  posttestScore: number;
  date: string;
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [filesHistory] = useState<FileItem[]>([
    { id: 1, name: "equation-worksheet.pdf", date: "2026-09-10" },
    { id: 2, name: "equation-worksheet(1).pdf", date: "2026-09-10" },
    { id: 3, name: "equation-worksheet(2).pdf", date: "2026-09-10" },
  ]);

  const [chatHistory] = useState<ChatItem[]>([
    {
      id: 1,
      title: "Linear Equations",
      lastMessage: "ลองเริ่มย้าย +4 ไปอีกฝั่ง...",
      date: "2026-09-10",
    },
    {
      id: 2,
      title: "Quadratic Functions",
      lastMessage: "สูตร x = (-b ± √(b² - 4ac)) / 2a",
      date: "2026-09-11",
    },
  ]);

  const [lessonsHistory] = useState<LessonItem[]>([
    {
      id: 1,
      title: "Linear Equations",
      imageUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      progressPercent: 100,
      date: "2026-09-10",
    },
  ]);

  const [testResultsHistory] = useState<TestResultItem[]>([
    {
      id: 1,
      title: "Linear Equations",
      imageUrl: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
      pretestScore: 40,
      posttestScore: 90,
      date: "2026-09-10",
    },
  ]);

  const filterByDate = (dateStr: string) => {
    if (!startDate && !endDate) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  const filteredFiles = filesHistory.filter((item) => filterByDate(item.date));
  const filteredChats = chatHistory.filter((item) => filterByDate(item.date));
  const filteredLessons = lessonsHistory.filter((item) => filterByDate(item.date));
  const filteredTestResults = testResultsHistory.filter((item) => filterByDate(item.date));

  const formatDateDisplay = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 relative">
      {/* Modal เปิดดูไฟล์ */}
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

      {/* Header */}
      <header className="flex items-center justify-between px-10 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          LOGO
        </Link>
        <div className="flex gap-4">
          <Link href="/Create" className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white">
            Create
          </Link>
          <Link href="/Lessons" className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white">
            Lessons
          </Link>
          <Link href="/Home" className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white">
            HOME
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-6 font-bold tracking-tight text-black whitespace-nowrap" style={{ fontSize: '48px' }}>
          Your Account Setting
        </h1>
        <br></br>

        <div className="flex gap-8 items-start">
          {/* Left Sidebar Menu */}
          <aside className="w-64 rounded-2xl border border-neutral-200 p-5 flex flex-col gap-6 text-sm bg-white shrink-0">
            {/* 1. Profile Section */}
            <div>
              <p className="font-semibold text-neutral-500 mb-3 text-center bg-neutral-50 py-1.5 rounded-lg">Profile</p>
              <ul className="space-y-3 text-neutral-600 px-2 text-center">
                <li className="cursor-pointer hover:text-black">Personal Info</li>
                <li className="cursor-pointer hover:text-black">Change Password</li>
              </ul>
            </div>

            {/* 2. History Section */}
            <div>
              <button
                onClick={() => setActiveTab(null)}
                className="w-full font-bold mb-3 text-center bg-black text-white py-1.5 rounded-lg cursor-pointer hover:bg-neutral-800 transition-colors"
              >
                History
              </button>
              <ul className="space-y-2 px-2 text-center">
                {(["Chat", "Lessons", "Uploaded Files", "Test Results"] as TabType[]).map((tab) => (
                  <li key={tab}>
                    <button
                      onClick={() => setActiveTab(tab)}
                      className={`w-full text-center py-1.5 px-3 rounded-lg transition-all ${
                        activeTab === tab
                          ? "font-semibold text-black underline decoration-neutral-400 underline-offset-4"
                          : "text-neutral-500 hover:text-black"
                      }`}
                    >
                      {tab}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Setting Section (ย้าย Learning Preferences เข้ามา + เพิ่ม Subscription) */}
            <div>
              <p className="font-semibold text-neutral-500 mb-3 text-center bg-neutral-50 py-1.5 rounded-lg">Setting</p>
              <ul className="space-y-3 text-neutral-600 px-2 text-center">
                <li className="cursor-pointer hover:text-black">Subscription / Membership</li>
                <li className="cursor-pointer hover:text-black">Learning Preferences</li>
                <li className="cursor-pointer hover:text-black">Notifications</li>
                <li className="cursor-pointer hover:text-black">Language</li>
                <li className="cursor-pointer hover:text-black">Theme</li>
                <li className="cursor-pointer hover:text-black">Privacy</li>
                <li className="cursor-pointer text-neutral-600 hover:text-red-500">Delete Account</li>
              </ul>
            </div>

            {/* 4. Help & Support Section (เพิ่มไว้ด้านล่างสุด) */}
            <div>
              <p className="font-semibold text-neutral-500 mb-3 text-center bg-neutral-50 py-1.5 rounded-lg">Help & Support</p>
              <ul className="space-y-3 text-neutral-600 px-2 text-center">
                <li className="cursor-pointer hover:text-black">Help Center / FAQ</li>
                <li className="cursor-pointer hover:text-black">Report a Problem</li>
                <li className="cursor-pointer hover:text-black">Contact Us</li>
              </ul>
            </div>
          </aside>

          {/* Right Main Display Panel */}
          <section className="flex-1 flex flex-col gap-4">
            {activeTab !== null ? (
              <div className="relative self-start">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="flex items-center gap-4 bg-neutral-50/80 border border-neutral-200 rounded-xl px-5 py-2.5 text-sm transition-all hover:bg-neutral-100"
                >
                  <span className="text-neutral-500 font-medium">date</span>
                  <span className="text-neutral-300 font-normal">
                    {startDate || endDate
                      ? `${startDate || "dd/mm/yy"} - ${endDate || "dd/mm/yy"}`
                      : "dd/mm/yy-dd/mm/yy"}
                  </span>
                </button>

                {isDatePickerOpen && (
                  <div className="absolute left-0 top-12 z-20 w-72 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl flex flex-col gap-3 text-xs">
                    <p className="font-medium text-neutral-700">Select Date Range</p>

                    <div className="flex flex-col gap-1">
                      <label className="text-neutral-500">From:</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-lg border border-neutral-200 p-2 outline-none focus:border-black text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-neutral-500">To:</label>
                      <input
                        type="date"
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
            ) : (
              <div className="h-[42px]" />
            )}

            <div className="rounded-2xl border border-neutral-200 p-6 min-h-[650px] bg-white flex flex-col justify-start">
              {activeTab === null && (
                <div className="flex-1 min-h-[550px] flex items-center justify-center">
                  <h2 className="text-4xl font-bold tracking-widest text-neutral-300 uppercase">
                    HISTORY
                  </h2>
                </div>
              )}

              {activeTab === "Chat" && (
                <div className="flex flex-col gap-3 w-full">
                  {filteredChats.length === 0 ? (
                    <p className="text-neutral-400 text-sm text-center py-12">No chat history found.</p>
                  ) : (
                    filteredChats.map((chat) => (
                      <div
                        key={chat.id}
                        className="rounded-xl border border-neutral-200 p-4 bg-white hover:border-neutral-400 transition-all cursor-pointer flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <h3 className="font-semibold text-sm text-neutral-900">{chat.title}</h3>
                        </div>
                        <p className="text-xs text-neutral-500 pl-6">: {chat.lastMessage}</p>
                        <p className="text-[10px] text-neutral-300 pl-6">{chat.date}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "Lessons" && (
                <div className="grid grid-cols-3 gap-6 w-full items-start">
                  {filteredLessons.length === 0 ? (
                    <p className="text-neutral-400 text-sm col-span-3 text-center py-12">No lessons found.</p>
                  ) : (
                    filteredLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="rounded-2xl border border-neutral-200 p-4 bg-white flex flex-col gap-3 hover:border-neutral-400 transition-all cursor-pointer"
                      >
                        <h3 className="font-semibold text-sm text-neutral-900">{lesson.title}</h3>
                        <div className="w-full h-40 rounded-xl overflow-hidden bg-neutral-100">
                          <img
                            src={lesson.imageUrl}
                            alt={lesson.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="mt-1 flex flex-col gap-1.5">
                          <p className="text-[11px] text-neutral-500 font-medium">
                            {lesson.progressPercent}% Completed
                          </p>
                          <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black rounded-full"
                              style={{ width: `${lesson.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "Uploaded Files" && (
                <div className="grid grid-cols-3 gap-4 w-full items-start">
                  {filteredFiles.length === 0 ? (
                    <p className="text-neutral-400 text-sm col-span-3 text-center py-12">No files found.</p>
                  ) : (
                    filteredFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 p-4 hover:border-neutral-400 transition-all text-center group cursor-pointer bg-white"
                      >
                        <div className="mb-3">
                          <svg
                            className="h-10 w-10 text-neutral-400 group-hover:text-black transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="w-full overflow-hidden">
                          <p className="font-semibold text-xs text-neutral-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-1">
                            {formatDateDisplay(file.date)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {activeTab === "Test Results" && (
                <div className="grid grid-cols-3 gap-6 w-full items-start">
                  {filteredTestResults.length === 0 ? (
                    <p className="text-neutral-400 text-sm col-span-3 text-center py-12">No test results found.</p>
                  ) : (
                    filteredTestResults.map((test) => (
                      <div
                        key={test.id}
                        className="rounded-2xl border border-neutral-200 p-4 bg-white flex flex-col gap-3 hover:border-neutral-400 transition-all cursor-pointer"
                      >
                        <h3 className="font-semibold text-sm text-neutral-900">{test.title}</h3>
                        <div className="w-full h-36 rounded-xl overflow-hidden bg-neutral-100">
                          <img
                            src={test.imageUrl}
                            alt={test.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <p className="text-[11px] text-neutral-500 font-medium">
                            Pretest: {test.pretestScore}%
                          </p>
                          <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black rounded-full"
                              style={{ width: `${test.pretestScore}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <p className="text-[11px] text-neutral-500 font-medium">
                            Posttest: {test.posttestScore}%
                          </p>
                          <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black rounded-full"
                              style={{ width: `${test.posttestScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}