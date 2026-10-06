import { posix } from "node:path";

import { XMLParser } from "fast-xml-parser";
import { parse, serializeOuter, type DefaultTreeAdapterMap } from "parse5";

import type { NormalizedAsset, NormalizedLocator, NormalizationWarning } from "./domain.js";
import { decodeUtf8, unzipControlled } from "./archive.js";
import { SourceProcessingError } from "./source-processing-error.js";

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlElement = DefaultTreeAdapterMap["element"];

export interface ExtractedUnit {
  locator: NormalizedLocator;
  title: string;
  content: string;
  math: string[];
  content_format: "markdown" | "latex";
  assets?: NormalizedAsset[];
  normalization_warnings?: NormalizationWarning[];
}

interface RenderContext {
  documentPath: string;
  math: string[];
  assets: NormalizedAsset[];
  warnings: NormalizationWarning[];
}

interface ContentEvent {
  type: "heading" | "block";
  level?: number;
  text?: string;
  markdown?: string;
  math: string[];
  assets?: NormalizedAsset[];
  warnings?: NormalizationWarning[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function attribute(object: unknown, name: string): string | undefined {
  if (!isObject(object)) return undefined;
  const value = object[`@_${name}`];
  return typeof value === "string" ? value : undefined;
}

function element(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

function children(node: HtmlNode): HtmlNode[] {
  return "childNodes" in node ? node.childNodes : [];
}

function getAttribute(node: HtmlElement, name: string): string | undefined {
  return node.attrs.find((item) => item.name === name)?.value;
}

function textContent(node: HtmlNode): string {
  if ("value" in node) return node.value;
  return children(node).map(textContent).join("");
}

function cleanInline(value: string): string {
  return value.replace(/[\t\n\r ]+/g, " ").trim();
}

function findFirst(node: HtmlNode, predicate: (candidate: HtmlElement) => boolean): HtmlElement | undefined {
  if (element(node) && predicate(node)) return node;
  for (const child of children(node)) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function descendants(node: HtmlNode, tagNames: ReadonlySet<string>): HtmlElement[] {
  const result: HtmlElement[] = [];
  for (const child of children(node)) {
    if (element(child) && tagNames.has(child.tagName)) result.push(child);
    result.push(...descendants(child, tagNames));
  }
  return result;
}

function mathValue(node: HtmlElement): string {
  if (node.tagName === "script") return textContent(node).trim();
  const annotation = findFirst(
    node,
    (candidate) => candidate.tagName === "annotation"
      && (getAttribute(candidate, "encoding") ?? "").toLowerCase().includes("tex"),
  );
  if (annotation) return textContent(annotation).trim();
  return serializeOuter(node).trim();
}

function renderInline(node: HtmlNode, context: RenderContext): string {
  if ("value" in node) return node.value;
  if (!element(node)) return children(node).map((child) => renderInline(child, context)).join("");
  if (node.tagName === "math" || (node.tagName === "script" && (getAttribute(node, "type") ?? "").includes("math/tex"))) {
    const value = mathValue(node);
    if (value) context.math.push(value);
    return value.startsWith("<math") ? value : `\\(${value}\\)`;
  }
  if (node.tagName === "br") return "\n";
  if (node.tagName === "img") {
    const src = getAttribute(node, "src");
    if (!src) throw new SourceProcessingError("NORMALIZATION_FAILED", "EPUB image is missing src");
    if (/^(?:[a-z]+:|\/\/)/i.test(src)) {
      throw new SourceProcessingError("NORMALIZATION_FAILED", `EPUB image must be archive-local: ${src}`);
    }
    const archivePath = posix.normalize(posix.join(posix.dirname(context.documentPath), decodeURIComponent(src.split(/[?#]/)[0]!)));
    if (archivePath.startsWith("../") || archivePath.startsWith("/")) {
      throw new SourceProcessingError("NORMALIZATION_FAILED", `Unsafe EPUB image: ${src}`);
    }
    const alt = getAttribute(node, "alt") ?? "";
    const mathImage = /(?:^|\s)math-(?:inline|block)(?:\s|$)/.test(getAttribute(node, "class") ?? "")
      || /(?:^|\/)equation\//.test(archivePath);
    context.assets.push({ kind: mathImage ? "math_image" : "image", archive_path: archivePath, alt });
    context.warnings.push(mathImage ? "image_math_requires_review" : "image_requires_review");
    const label = (mathImage ? "Equation image: manual review required" : alt || "Source image")
      .replace(/[\[\]\\]/g, "\\$&");
    return `![${label}](epub:${encodeURI(archivePath).replace(/[()]/g, (value) => value === "(" ? "%28" : "%29")})`;
  }
  if (node.tagName === "ul" || node.tagName === "ol") return `\n\n${renderList(node, context)}\n\n`;
  if (node.tagName === "table") return `\n\n${renderTable(node, context)}\n\n`;

  const content = children(node).map((child) => renderInline(child, context)).join("");
  if (node.tagName === "p") return `${content}\n\n`;
  if (node.tagName === "em" || node.tagName === "i") return `*${content}*`;
  if (node.tagName === "strong" || node.tagName === "b") return `**${content}**`;
  if (node.tagName === "code") return `\`${content}\``;
  if (node.tagName === "sup") return `^{${content}}`;
  if (node.tagName === "sub") return `_{${content}}`;
  return content;
}

function renderList(node: HtmlElement, context: RenderContext): string {
  const ordered = node.tagName === "ol";
  return children(node)
    .filter((child): child is HtmlElement => element(child) && child.tagName === "li")
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const content = renderInline(item, context).trim();
      const lines = content.split("\n");
      return `${marker} ${lines[0] ?? ""}\n${lines.slice(1).map((line) => `${" ".repeat(marker.length + 1)}${line}`).join("\n")}`.trimEnd();
    })
    .join("\n");
}

function renderTable(node: HtmlElement, context: RenderContext): string {
  if (descendants(node, new Set(["th", "td"])).some((cell) =>
    Number(getAttribute(cell, "colspan") ?? "1") > 1 || Number(getAttribute(cell, "rowspan") ?? "1") > 1)) {
    context.warnings.push("complex_table_requires_review");
    descendants(node, new Set(["img", "math", "script"]))
      .filter((child) => child.tagName !== "script" || (getAttribute(child, "type") ?? "").includes("math/tex"))
      .forEach((child) => renderInline(child, context));
    return serializeOuter(node);
  }
  const rows = descendants(node, new Set(["tr"])).map((row) =>
    descendants(row, new Set(["th", "td"])).map((cell) =>
      cleanInline(renderInline(cell, context)).replaceAll("|", "\\|"),
    ),
  ).filter((row) => row.length > 0);
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
  const header = normalized[0] ?? [];
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function collectEvents(node: HtmlNode, events: ContentEvent[], documentPath: string, inheritedLevel = 0): void {
  if ("value" in node) {
    const value = cleanInline(node.value);
    if (value) events.push({ type: "block", markdown: value, math: [] });
    return;
  }
  if (!element(node)) {
    children(node).forEach((child) => collectEvents(child, events, documentPath, inheritedLevel));
    return;
  }
  if (["style", "nav"].includes(node.tagName)
    || (node.tagName === "script" && !(getAttribute(node, "type") ?? "").includes("math/tex"))) return;
  const context: RenderContext = { documentPath, math: [], assets: [], warnings: [] };

  const heading = /^h([1-6])$/.exec(node.tagName);
  if (heading) {
    const value = cleanInline(renderInline(node, context));
    if (value) events.push({ type: "heading", level: Math.max(Number(heading[1]), inheritedLevel + 1), text: value, math: context.math, assets: context.assets, warnings: context.warnings });
    return;
  }

  let markdown: string | undefined;
  if (["p", "blockquote", "dt", "figcaption"].includes(node.tagName)) {
    markdown = cleanInline(renderInline(node, context));
    if (node.tagName === "dt" && markdown) markdown = `**${markdown}**`;
    if (node.tagName === "blockquote" && markdown) markdown = `> ${markdown}`;
  } else if (node.tagName === "ul" || node.tagName === "ol") {
    markdown = renderList(node, context);
  } else if (node.tagName === "table") {
    markdown = renderTable(node, context);
  } else if (node.tagName === "pre") {
    markdown = `\`\`\`\n${textContent(node).trim()}\n\`\`\``;
  } else if (node.tagName === "img") {
    markdown = renderInline(node, context);
  } else if (node.tagName === "math" || node.tagName === "script") {
    const value = mathValue(node);
    if (value) {
      context.math.push(value);
      markdown = value.startsWith("<math") ? value : `\\[\n${value}\n\\]`;
    }
  }

  if (markdown?.trim()) {
    events.push({ type: "block", markdown: markdown.trim(), math: context.math, assets: context.assets, warnings: context.warnings });
    return;
  }
  let childLevel = inheritedLevel;
  for (const child of children(node)) {
    collectEvents(child, events, documentPath, element(child) && /^h[1-6]$/.test(child.tagName) ? inheritedLevel : childLevel);
    if (element(child) && /^h[1-6]$/.test(child.tagName)) {
      childLevel = Math.max(Number(child.tagName.slice(1)), inheritedLevel + 1);
    }
  }
}

function unitsFromXhtml(xhtml: string, documentPath: string, chapterContext?: string): ExtractedUnit[] {
  const document = parse(xhtml);
  const titleNode = findFirst(document, (candidate) => candidate.tagName === "title");
  const body = findFirst(document, (candidate) => candidate.tagName === "body") ?? document;
  const documentTitle = cleanInline(titleNode ? textContent(titleNode) : "") || posix.basename(documentPath);
  const events: ContentEvent[] = [];
  collectEvents(body, events, documentPath);

  const units: ExtractedUnit[] = [];
  const chapterTitle = chapterContext ?? events.find((event) => event.type === "heading" && event.level === 1)?.text ?? documentTitle;
  const headings = new Map<number, string>([[1, chapterTitle]]);
  let blocks: string[] = [];
  let math: string[] = [];
  let assets: NormalizedAsset[] = [];
  let warnings: NormalizationWarning[] = [];
  let currentTitle = documentTitle;

  const flush = (): void => {
    if (blocks.length === 0) return;
    const orderedHeadings = [...headings.entries()].sort(([left], [right]) => left - right);
    const chapter = headings.get(1) ?? documentTitle;
    const sectionParts = orderedHeadings.filter(([level]) => level > 1).map(([, value]) => value);
    const section = sectionParts.join(" > ") || currentTitle;
    const hierarchy = orderedHeadings.map(([level, value]) => `${"#".repeat(level)} ${value}`);
    units.push({
      locator: { chapter, section, document: documentPath },
      title: currentTitle,
      content: [...hierarchy, ...blocks].join("\n\n").trim(),
      math: [...new Set(math.filter(Boolean))],
      content_format: "markdown",
      assets: [...new Map(assets.map((asset) => [asset.archive_path, asset])).values()],
      normalization_warnings: [...new Set(warnings)],
    });
    blocks = [];
    math = [];
    assets = [];
    warnings = [];
  };

  for (const event of events) {
    if (event.type === "heading") {
      flush();
      const level = event.level === 1 && event.text !== chapterTitle ? 3 : event.level ?? 1;
      for (const key of [...headings.keys()]) {
        if (key >= level) headings.delete(key);
      }
      currentTitle = event.text ?? documentTitle;
      headings.set(level, currentTitle);
      math.push(...event.math);
    } else {
      if (event.markdown) blocks.push(event.markdown);
      math.push(...event.math);
    }
    assets.push(...event.assets ?? []);
    warnings.push(...event.warnings ?? []);
  }
  flush();
  return units;
}

function xmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    processEntities: false,
  });
}

function findRootfile(container: unknown): string {
  if (!isObject(container) || !isObject(container.container) || !isObject(container.container.rootfiles)) {
    throw new SourceProcessingError("NORMALIZATION_FAILED", "EPUB container.xml has no rootfiles element");
  }
  const rootfile = array(container.container.rootfiles.rootfile)[0];
  const path = attribute(rootfile, "full-path");
  if (!path) throw new SourceProcessingError("NORMALIZATION_FAILED", "EPUB container.xml has no package path");
  return path;
}

function readingOrder(packageDocument: unknown, packagePath: string): string[] {
  if (!isObject(packageDocument) || !isObject(packageDocument.package)) {
    throw new SourceProcessingError("NORMALIZATION_FAILED", "EPUB package document is invalid");
  }
  const packageValue = packageDocument.package;
  const manifestValue = isObject(packageValue.manifest) ? packageValue.manifest : {};
  const spineValue = isObject(packageValue.spine) ? packageValue.spine : {};
  const items = array(manifestValue.item);
  const hrefById = new Map<string, string>();
  const xhtmlHrefs: string[] = [];
  for (const item of items) {
    const id = attribute(item, "id");
    const href = attribute(item, "href");
    const mediaType = attribute(item, "media-type");
    if (!id || !href) continue;
    hrefById.set(id, href);
    if (mediaType === "application/xhtml+xml" || /\.x?html?$/i.test(href)) xhtmlHrefs.push(href);
  }
  const spineHrefs = array(spineValue.itemref)
    .map((item) => attribute(item, "idref"))
    .filter((id): id is string => Boolean(id))
    .map((id) => hrefById.get(id))
    .filter((href): href is string => Boolean(href));
  const base = posix.dirname(packagePath);
  return [...new Set((spineHrefs.length > 0 ? spineHrefs : xhtmlHrefs).map((href) => posix.normalize(posix.join(base, href))))];
}

export function normalizeEpub(bytes: Uint8Array): ExtractedUnit[] {
  const files = unzipControlled(bytes);
  const containerBytes = files["META-INF/container.xml"];
  if (!containerBytes) throw new SourceProcessingError("NORMALIZATION_FAILED", "EPUB is missing META-INF/container.xml");
  const parser = xmlParser();
  const packagePath = findRootfile(parser.parse(decodeUtf8(containerBytes, "META-INF/container.xml")));
  const packageBytes = files[packagePath];
  if (!packageBytes) throw new SourceProcessingError("NORMALIZATION_FAILED", `EPUB package is missing: ${packagePath}`);
  const documentPaths = readingOrder(parser.parse(decodeUtf8(packageBytes, packagePath)), packagePath);
  // Siyavula chapters span several XHTML files with the same document title.
  // Collect real chapter titles before processing activity/example headings.
  const chapterTitles = new Map<string, string>();
  const documents = documentPaths.map((path) => {
    const documentBytes = files[path];
    if (!documentBytes) throw new SourceProcessingError("NORMALIZATION_FAILED", `EPUB spine document is missing: ${path}`);
    const xhtml = decodeUtf8(documentBytes, path);
    const document = parse(xhtml);
    const title = findFirst(document, (candidate) => candidate.tagName === "title");
    const key = `${posix.dirname(path)}/${cleanInline(title ? textContent(title) : path)}`;
    const chapter = findFirst(document, (candidate) => candidate.tagName === "h1" && /^Chapter\s+\d+\s*:/i.test(cleanInline(textContent(candidate))));
    if (chapter) chapterTitles.set(key, cleanInline(textContent(chapter)));
    return { path, xhtml, key };
  });
  const units = documents.flatMap(({ path, xhtml, key }) => unitsFromXhtml(xhtml, path, chapterTitles.get(key)));
  for (const unit of units) {
    for (const asset of unit.assets ?? []) {
      if (!files[asset.archive_path]) {
        throw new SourceProcessingError("NORMALIZATION_FAILED", `EPUB image is missing: ${asset.archive_path}`);
      }
    }
  }
  if (units.length === 0) throw new SourceProcessingError("NORMALIZATION_FAILED", "EPUB contains no normalizable content units");
  return units;
}
