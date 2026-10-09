import { parseDocument as parseYamlDocument } from "yaml";

import type { MarkdownSection, ParsedKnowledgeMarkdown } from "./domain.js";

export class KnowledgeParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KnowledgeParseError";
  }
}

function makeSlug(heading: string): string {
  return heading
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSections(body: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  let current: Omit<MarkdownSection, "markdown"> | undefined;
  let content: string[] = [];
  const preamble: string[] = [];

  const finishCurrent = (): void => {
    if (!current) return;
    sections.push({ ...current, markdown: content.join("\n").trim() });
    content = [];
  };

  for (const line of lines) {
    const match = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (!match) {
      if (current) content.push(line);
      else preamble.push(line);
      continue;
    }

    finishCurrent();
    const heading = match[2]?.trim() ?? "";
    current = {
      heading,
      slug: makeSlug(heading),
      level: match[1]?.length ?? 1,
    };
  }

  finishCurrent();

  if (preamble.some((line) => line.trim().length > 0)) {
    throw new KnowledgeParseError("Markdown body content must be placed under a heading");
  }
  if (sections.length === 0) {
    throw new KnowledgeParseError("Markdown body must contain at least one heading");
  }

  return sections;
}

export function parseKnowledgeMarkdown(markdown: string): ParsedKnowledgeMarkdown {
  const normalized = markdown.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new KnowledgeParseError("Knowledge Markdown must start with YAML frontmatter");
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex < 0) {
    throw new KnowledgeParseError("Knowledge Markdown frontmatter is missing its closing delimiter");
  }

  const yamlSource = lines.slice(1, closingIndex).join("\n");
  const yamlDocument = parseYamlDocument(yamlSource, {
    prettyErrors: true,
    uniqueKeys: true,
  });

  if (yamlDocument.errors.length > 0) {
    throw new KnowledgeParseError(`Invalid YAML frontmatter: ${yamlDocument.errors[0]?.message}`);
  }

  const frontmatter: unknown = yamlDocument.toJS();
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    throw new KnowledgeParseError("YAML frontmatter must be an object");
  }

  return {
    frontmatter: frontmatter as Record<string, unknown>,
    sections: parseSections(lines.slice(closingIndex + 1).join("\n")),
  };
}
