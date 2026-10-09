import type { MarkdownSection, ParsedKnowledgeMarkdown } from "./domain.js";

interface FormulaVariable {
  symbol: string;
  meaning: string;
  unit: string;
}

interface CanonicalFormula {
  id: string;
  expression: string;
  variables: FormulaVariable[];
  conditions: string;
}

interface CanonicalWorkedExample {
  title: string;
  problem: string;
  solution: string;
  checked_answer: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function findSection(sections: MarkdownSection[], slug: string): MarkdownSection | undefined {
  return sections.find((section) => section.slug === slug);
}

function extractMath(markdown: string): string {
  const patterns = [
    /\\\[\s*([\s\S]*?)\s*\\\]/,
    /\$\$\s*([\s\S]*?)\s*\$\$/,
    /```(?:math|latex)\s*\n([\s\S]*?)\n```/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(markdown);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseVariables(markdown: string): FormulaVariable[] {
  const rows = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map(splitTableRow);

  if (rows.length < 2) return [];
  const dataRows = rows.slice(1).filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));

  return dataRows.map((row) => ({
    symbol: row[0] ?? "",
    meaning: row[1] ?? "",
    unit: row[2] ?? "",
  }));
}

function extractFormulas(frontmatter: Record<string, unknown>, sections: MarkdownSection[]): CanonicalFormula[] {
  const formulaIds = stringArray(frontmatter.formula_ids);
  const formulaSections = sections.filter((section) => section.slug === "formula" || section.slug.startsWith("formula-"));

  if (formulaIds.length === 0 && formulaSections.length === 0) return [];

  const count = Math.max(formulaIds.length, formulaSections.length, 1);
  const variables = parseVariables(findSection(sections, "variables-and-units")?.markdown ?? "");
  const conditions = findSection(sections, "conditions-and-limitations")?.markdown ?? "";

  return Array.from({ length: count }, (_, index) => ({
    id: formulaIds[index] ?? "",
    expression: extractMath(formulaSections[index]?.markdown ?? ""),
    variables,
    conditions,
  }));
}

function descendantsOf(sections: MarkdownSection[], parentIndex: number): MarkdownSection[] {
  const parent = sections[parentIndex];
  if (!parent) return [];
  const descendants: MarkdownSection[] = [];

  for (let index = parentIndex + 1; index < sections.length; index += 1) {
    const candidate = sections[index];
    if (!candidate || candidate.level <= parent.level) break;
    descendants.push(candidate);
  }

  return descendants;
}

function extractWorkedExamples(sections: MarkdownSection[]): CanonicalWorkedExample[] {
  return sections.flatMap((section, index) => {
    if (section.slug !== "worked-example" && !section.slug.startsWith("worked-example-")) return [];

    const descendants = descendantsOf(sections, index);
    const nested = (slug: string): string => descendants.find((item) => item.slug === slug)?.markdown ?? "";

    return [{
      title: section.heading,
      problem: nested("problem"),
      solution: nested("solution"),
      checked_answer: nested("checked-answer"),
    }];
  });
}

export function toCanonicalKnowledgeDocument(parsed: ParsedKnowledgeMarkdown): Record<string, unknown> {
  const metadata = { ...parsed.frontmatter };
  const titleObject = metadata.title;
  const title = titleObject && typeof titleObject === "object" && !Array.isArray(titleObject)
    ? titleObject
    : {
        th: text(metadata.title_th) ?? "",
        en: text(metadata.title_en) ?? "",
      };
  const retrievalSection = findSection(parsed.sections, "retrieval-summary");
  const formulas = extractFormulas(metadata, parsed.sections);
  const workedExamples = extractWorkedExamples(parsed.sections);

  delete metadata.title_th;
  delete metadata.title_en;
  delete metadata.title;
  delete metadata.retrieval_summary;

  if (typeof metadata.schema_version === "number") {
    metadata.schema_version = metadata.schema_version.toFixed(1);
  }

  return {
    ...metadata,
    title,
    retrieval_summary: retrievalSection?.markdown ?? text(parsed.frontmatter.retrieval_summary) ?? "",
    sections: parsed.sections,
    ...(formulas.length > 0 ? { formulas } : {}),
    ...(workedExamples.length > 0 ? { worked_examples: workedExamples } : {}),
  };
}
