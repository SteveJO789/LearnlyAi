import { posix } from "node:path";

import type { NormalizedLocator } from "./domain.js";
import type { ExtractedUnit } from "./epub-normalizer.js";
import { decodeUtf8, unzipControlled } from "./archive.js";
import { SourceProcessingError } from "./source-processing-error.js";

interface HeadingMark {
  start: number;
  end: number;
  level: number;
  title: string;
}

const HEADING_COMMANDS = [
  { command: "olsubsubsection", level: 4 },
  { command: "olsubsection", level: 3 },
  { command: "olsection", level: 2 },
  { command: "olchapter", level: 1 },
  { command: "subsubsection", level: 4 },
  { command: "subsection", level: 3 },
  { command: "section", level: 2 },
  { command: "chapter", level: 1 },
] as const;

function stripCommentsPreservingOffsets(source: string): string {
  const characters = source.split(""); // UTF-16 offsets must match String.slice, including non-BMP text.
  for (let index = 0; index < characters.length; index += 1) {
    if (characters[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && characters[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 1) continue;
    for (let cursor = index; cursor < characters.length && characters[cursor] !== "\n"; cursor += 1) {
      characters[cursor] = " ";
    }
  }
  return characters.join("");
}

function balancedGroup(source: string, openingIndex: number): { content: string; end: number } | undefined {
  if (source[openingIndex] !== "{") return undefined;
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{" && source[index - 1] !== "\\") depth += 1;
    if (character === "}" && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) return { content: source.slice(openingIndex + 1, index), end: index + 1 };
    }
  }
  return undefined;
}

function headingMarks(source: string): HeadingMark[] {
  const searchable = stripCommentsPreservingOffsets(source);
  const marks: HeadingMark[] = [];
  for (let index = 0; index < searchable.length; index += 1) {
    if (searchable[index] !== "\\") continue;
    const definition = HEADING_COMMANDS.find(({ command }) => searchable.startsWith(`\\${command}`, index));
    if (!definition) continue;
    let cursor = index + definition.command.length + 1;
    if (/[a-zA-Z]/.test(searchable[cursor] ?? "")) continue;
    if (searchable[cursor] === "*") cursor += 1;
    while (/\s/.test(searchable[cursor] ?? "")) cursor += 1;
    if (searchable[cursor] === "[") {
      const end = searchable.indexOf("]", cursor);
      if (end < 0) continue;
      cursor = end + 1;
      while (/\s/.test(searchable[cursor] ?? "")) cursor += 1;
    }
    if (definition.command === "olchapter") {
      // Open Logic: \olchapter{part-id}{chapter-id}{title}.
      for (let groupIndex = 0; groupIndex < 2; groupIndex += 1) {
        const id = balancedGroup(searchable, cursor);
        if (!id) break;
        cursor = id.end;
        while (/\s/.test(searchable[cursor] ?? "")) cursor += 1;
      }
    }
    const group = balancedGroup(searchable, cursor);
    if (!group) continue;
    marks.push({ start: index, end: group.end, level: definition.level, title: group.content.trim() });
    index = group.end - 1;
  }
  return marks;
}

function plainTitle(latex: string): string {
  return latex
    .replace(/\\usetoken\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:textbf|textit|emph|texorpdfstring)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Untitled";
}

function extractMath(source: string): string[] {
  source = stripCommentsPreservingOffsets(source);
  const expressions: string[] = [];
  const patterns = [
    /\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?|displaymath)\}([\s\S]*?)\\end\{(?:equation\*?|align\*?|gather\*?|multline\*?|displaymath)\}/g,
    /\\\[([\s\S]*?)\\\]/g,
    /\\\(([\s\S]*?)\\\)/g,
    /\$\$([\s\S]*?)\$\$/g,
    /(?<!\\|\$)\$((?:\\\$|[^$])+?)(?<!\\|\$)\$(?!\$)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value) expressions.push(value);
    }
  }
  return [...new Set(expressions)];
}

function makeUnit(
  documentPath: string,
  locator: NormalizedLocator,
  title: string,
  content: string,
): ExtractedUnit {
  return {
    locator: { ...locator, document: documentPath },
    title,
    content: content.trim(),
    math: extractMath(content),
    content_format: "latex",
    ...(/\\(?:iftag|tagitem|olimport|usetoken)\b|!!|![A-Z]/.test(content)
      ? { normalization_warnings: ["latex_macros_requires_review" as const] } : {}),
  };
}

function normalizeLatexDocument(source: string, documentPath: string, parentChapter?: string): ExtractedUnit[] {
  const marks = headingMarks(source);
  const fallbackTitle = posix.basename(documentPath, posix.extname(documentPath));
  if (marks.length === 0) {
    if (!source.trim()) return [];
    return [makeUnit(
      documentPath,
      { chapter: parentChapter ?? fallbackTitle, section: fallbackTitle, offset_start: 0, offset_end: source.length },
      fallbackTitle,
      source,
    )];
  }

  const units: ExtractedUnit[] = [];
  const headings = new Map<number, string>();
  marks.forEach((mark, index) => {
    for (const key of [...headings.keys()]) {
      if (key >= mark.level) headings.delete(key);
    }
    const title = plainTitle(mark.title);
    headings.set(mark.level, title);
    const chapter = headings.get(1) ?? parentChapter ?? fallbackTitle;
    const section = [...headings.entries()]
      .sort(([left], [right]) => left - right)
      .filter(([level]) => level > 1)
      .map(([, value]) => value)
      .join(" > ") || title;
    const start = index === 0 ? 0 : mark.start; // Retain comments, olfileid, and the subfile preamble.
    const end = marks[index + 1]?.start ?? source.length;
    const content = source.slice(start, end).trim();
    if (content) units.push(makeUnit(documentPath, { chapter, section, offset_start: start, offset_end: end }, title, content));
  });
  return units;
}

export function normalizeOpenLogic(bytes: Uint8Array, filename: string): ExtractedUnit[] {
  const lower = filename.toLowerCase();
  let documents: Array<{ path: string; source: string }>;
  if (lower.endsWith(".tex")) {
    documents = [{ path: filename, source: decodeUtf8(bytes, filename) }];
  } else if (lower.endsWith(".zip")) {
    const files = unzipControlled(bytes);
    documents = Object.entries(files)
      .filter(([path]) => path.toLowerCase().endsWith(".tex"))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, value]) => ({ path, source: decodeUtf8(value, path) }));
  } else {
    throw new SourceProcessingError("UNSUPPORTED_FORMAT", `Unsupported Open Logic artifact: ${filename}`);
  }

  const chapters = new Map<string, string>();
  for (const { path, source } of documents) {
    const chapter = headingMarks(source).find((mark) => mark.level === 1);
    if (chapter) chapters.set(posix.dirname(path), plainTitle(chapter.title));
  }
  const units = documents.flatMap(({ path, source }) => normalizeLatexDocument(source, path, chapters.get(posix.dirname(path))));
  if (units.length === 0) {
    throw new SourceProcessingError("NORMALIZATION_FAILED", "Open Logic artifact contains no LaTeX content units");
  }
  return units;
}
