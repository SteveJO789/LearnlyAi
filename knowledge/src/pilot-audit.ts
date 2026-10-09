import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { calculateSha256 } from "./acquisition.js";
import { decodeUtf8, unzipControlled } from "./archive.js";
import { loadSourceRegistry } from "./source-processing-policy.js";
import { validateSourceProcessing } from "./source-processing-validation.js";
import type { NormalizedUnit } from "./domain.js";

export function auditSourcePilot(root: string, artifactId: string): Record<string, unknown> {
  const state = validateSourceProcessing(root, loadSourceRegistry(root));
  if (!state.valid) throw new Error(state.issues.map((issue) => issue.message).join("; "));
  const artifact = state.manifest!.artifacts.find((a) => a.artifact_id === artifactId);
  if (!artifact) throw new Error(`Unknown acquired artifact: ${artifactId}`);
  const bytes = readFileSync(join(root, artifact.raw_path));
  const archive = unzipControlled(bytes);
  const directory = `normalized/${artifact.source_id}/${artifactId}`;
  const records = readdirSync(join(root, directory)).filter((name) => name.endsWith(".json")).sort().map((name) => {
    const bytes = readFileSync(join(root, directory, name));
    return { path: `${directory}/${name}`, sha256: calculateSha256(bytes), unit: JSON.parse(bytes.toString("utf8")) as NormalizedUnit };
  });
  const documents = [...new Set(records.map((r) => r.unit.locator.document!))];
  const expectedAssets = new Set<string>();
  let imageOccurrences = 0, equationImages = 0, tables = 0, textMath = 0;
  const missingAssets: string[] = [];
  type Node = DefaultTreeAdapterMap["node"];
  const visit = (node: Node, document: string): void => {
    if ("tagName" in node) {
      if (["head", "nav"].includes(node.tagName)) return;
      const attr = (name: string): string => node.attrs.find((a) => a.name === name)?.value ?? "";
      if (node.tagName === "img") {
        imageOccurrences += 1;
        if (/math-(inline|block)/.test(attr("class")) || attr("src").includes("equation/")) equationImages += 1;
        const asset = posix.normalize(posix.join(posix.dirname(document), decodeURIComponent(attr("src").split(/[?#]/)[0]!)));
        expectedAssets.add(`${document}\0${asset}`);
        if (!archive[asset]) missingAssets.push(asset);
      }
      if (node.tagName === "table") tables += 1;
      if (node.tagName === "math" || (node.tagName === "script" && attr("type").includes("math/tex"))) textMath += 1;
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child, document);
  };
  const latex = artifact.source_id === "open-logic-project";
  if (!latex) for (const path of documents) visit(parse(decodeUtf8(archive[path]!, path)), path);
  const retainedAssets = new Set(records.flatMap((r) => (r.unit.assets ?? []).map((a) => `${r.unit.locator.document}\0${a.archive_path}`)));
  const lost = [...expectedAssets].filter((path) => !retainedAssets.has(path));
  const unexpected = [...retainedAssets].filter((path) => !expectedAssets.has(path));
  const mismatches = latex ? records.filter(({ unit }) => {
    const source = decodeUtf8(archive[unit.locator.document!]!, unit.locator.document!);
    return source.slice(unit.locator.offset_start, unit.locator.offset_end).trim() !== unit.content;
  }).map((r) => r.path) : [];
  if (missingAssets.length || lost.length || unexpected.length || mismatches.length) throw new Error("Source audit found lost assets or changed LaTeX slices");
  const content = records.map((r) => r.unit.content).join("\n");
  const count = (regex: RegExp): number => [...content.matchAll(regex)].length;
  const concepts = latex ? [
    ["mathematics.foundations.logic.statement-proposition", "propositional variables versus everyday statements", "introduction.tex"],
    ["mathematics.foundations.logic.negation", "negation truth table", "valuations-sat.tex"],
    ["mathematics.foundations.logic.conjunction", "conjunction truth table", "valuations-sat.tex"],
    ["mathematics.foundations.logic.disjunction", "inclusive disjunction truth table", "valuations-sat.tex"],
    ["mathematics.foundations.logic.implication", "material conditional truth table", "valuations-sat.tex"],
  ] : [
    ["mathematics.algebra.linear-equations.linear-equation-one-variable", "definition: independently state nonzero leading coefficient", "4.2 Solving linear equations"],
    ["mathematics.algebra.linear-equations.balance-preserving-operations", "equal operations on both sides", "Method for solving linear equations"],
    ["mathematics.algebra.linear-equations.inverse-operations", "isolate the unknown by reversible operations", "Method for solving linear equations"],
    ["mathematics.algebra.linear-equations.bracket-expansion", "expand brackets before collecting like terms", "Method for solving linear equations"],
    ["mathematics.algebra.linear-equations.substitution-check", "check the solution in the original equation", "Method for solving linear equations"],
  ];
  return {
    schema_version: "1.0", artifact_id: artifactId, source_id: artifact.source_id,
    source_url: artifact.source_url, artifact_sha256: calculateSha256(bytes), acquired_at: artifact.acquired_at,
    artifact_bytes: bytes.length, archive_entries: Object.keys(archive).length,
    scope: latex ? "propositional-logic/syntax-and-semantics only" : "Chapter 4 / 4.2 Solving linear equations only",
    normalized_records: records.length, normalized_documents: documents.length,
    normalized_parser_versions: [...new Set(records.map((r) => r.unit.provenance.parser_version))],
    normalized_manifest_sha256: calculateSha256(Buffer.from(JSON.stringify(records.map(({ path, sha256 }) => ({ path, sha256 }))))),
    selected_document_image_occurrences: imageOccurrences, selected_document_equation_image_occurrences: equationImages,
    selected_document_other_image_occurrences: imageOccurrences - equationImages,
    selected_document_table_count: latex ? count(/\\begin\{tabular\}/g) : tables,
    textual_math_nodes: textMath, normalized_math_expressions: records.reduce((sum, r) => sum + r.unit.math.length, 0),
    distinct_document_asset_references: expectedAssets.size,
    missing_asset_files: missingAssets, lost_asset_references: lost, unexpected_asset_references: unexpected,
    latex_slice_mismatches: mismatches,
    latex_definitions: count(/\\begin\{(?:defn|definition)\}/g), latex_propositions: count(/\\begin\{(?:prop|proposition)\}/g),
    latex_theorems: count(/\\begin\{(?:thm|theorem)\}/g), latex_problems: count(/\\begin\{prob\}/g),
    unresolved_macros_retained: latex ? ["\\iftag", "\\tagitem", "!!{token}", "!A", "\\pValue", "\\olimport"] : [],
    candidate_concepts: concepts.map(([concept_id, rationale, match]) => ({ concept_id, rationale,
      mapping_status: latex ? "candidate_M4_introductory_logic_not_indicator_certified" : "prerequisite_candidate_Thai_grade_not_inferred",
      alignment_url: latex ? "https://proj14.ipst.ac.th/m4-6-math-basic/m4-math-basic/" : null,
      evidence: records.filter((r) => latex ? r.unit.locator.document!.endsWith(`/${match}`) : r.unit.title === match)
        .map((r) => ({ normalized_unit: r.path, normalized_sha256: r.sha256, source_locator: r.unit.locator })) })),
    normalized_units: records.map((r) => ({ path: r.path, sha256: r.sha256, title: r.unit.title, locator: r.unit.locator,
      math_count: r.unit.math.length, assets: r.unit.assets ?? [], warnings: r.unit.normalization_warnings ?? [] })),
    approval: "none", image_transcription: "none", suitable_for_scaling: latex ? "conditional: preserve macro context, simplify university scope, human correctness/alignment review" : "conditional: text extraction viable; equation images require human verification before reuse",
  };
}
