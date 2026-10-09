// Read-only audit. Run after npm run knowledge:normalize.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { parse } from "parse5";
import { decodeUtf8, unzipControlled } from "../dist/archive.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "acquisition/manifest.json"), "utf8"));
const artifactId = process.argv[2];
const artifact = artifactId
  ? manifest.artifacts.find((item) => item.artifact_id === artifactId)
  : manifest.artifacts.length === 1 ? manifest.artifacts[0] : undefined;
if (!artifact || !artifact.filename.endsWith(".epub")) throw new Error("Pass the artifact ID of an acquired EPUB");
const bytes = readFileSync(join(root, artifact.raw_path));
const checksum = createHash("sha256").update(bytes).digest("hex");
const files = unzipControlled(bytes);
const xml = new XMLParser({ignoreAttributes:false, removeNSPrefix:true});
const array = (value) => Array.isArray(value) ? value : value === undefined ? [] : [value];
const container = xml.parse(decodeUtf8(files["META-INF/container.xml"], "container.xml"));
const packagePath = array(container.container.rootfiles.rootfile)[0]["@_full-path"];
const book = xml.parse(decodeUtf8(files[packagePath], packagePath)).package;
const items = new Map(array(book.manifest.item).map((item) => [item["@_id"], item]));
const spine = array(book.spine.itemref).map((item) => items.get(item["@_idref"]))
  .filter((item) => item?.["@_media-type"] === "application/xhtml+xml")
  .map((item) => posix.join(posix.dirname(packagePath), item["@_href"]));
const directory = join(root, "normalized", artifact.source_id, artifact.artifact_id);
const paths = readdirSync(directory).filter((path) => path.endsWith(".json")).sort();
const digest = createHash("sha256");
const records = paths.map((path) => {
  const text = readFileSync(join(directory, path), "utf8");
  digest.update(path).update("\0").update(text).update("\0");
  return {path, ...JSON.parse(text)};
});
const retained = new Set(records.flatMap((record) => (record.assets ?? []).map((asset) => `${record.locator.document}\0${asset.archive_path}`)));
let images = 0;
let imageMath = 0;
let textualMath = 0;
const expected = new Set();
const lost = [];
function visit(node, documentPath) {
  if (["head", "nav"].includes(node.tagName)) return;
  const attribute = (name) => node.attrs?.find((item) => item.name === name)?.value ?? "";
  if (node.tagName === "img") {
    images += 1;
    if (/(?:^|\s)math-(?:inline|block)(?:\s|$)/.test(attribute("class")) || attribute("src").includes("equation/")) imageMath += 1;
    const path = posix.normalize(posix.join(posix.dirname(documentPath), decodeURIComponent(attribute("src").split(/[?#]/)[0])));
    expected.add(`${documentPath}\0${path}`);
    if (!retained.has(`${documentPath}\0${path}`)) lost.push({document:documentPath,archive_path:path});
  }
  if (node.tagName === "math" || (node.tagName === "script" && attribute("type").includes("math/tex"))) textualMath += 1;
  for (const child of node.childNodes ?? []) visit(child, documentPath);
}
for (const path of spine) visit(parse(decodeUtf8(files[path], path)), path);
const sampleTitles = [
  /^11\.1 Introduction$/, /^11\.2 Ohm's Law$/, /^Method$/, /^Worked example 1:/,
  /^Solve the problem$/, /^Equivalent series resistance$/, /^Equivalent parallel resistance$/,
  /^Electrical power$/, /^Worked example 8:/, /^11\.4 Chapter summary$/,
];
const circuits = records.filter((record) => record.locator.document.includes("11-electric-circuits"));
const report = {
  artifact_id:artifact.artifact_id, bytes:bytes.length, sha256:checksum,
  checksum_matches:checksum === artifact.sha256,
  parser_versions:[...new Set(records.map((record) => record.provenance.parser_version))],
  normalized_digest:digest.digest("hex"),
  archive_files:Object.keys(files).length, spine_documents:spine.length,
  normalized_documents:new Set(records.map((record) => record.locator.document)).size,
  spine_without_records:spine.filter((path) => !records.some((record) => record.locator.document === path)),
  records:records.length, image_occurrences:images, image_math_occurrences:imageMath,
  textual_math_occurrences:textualMath, distinct_document_asset_references:expected.size,
  lost_asset_references:[...new Map(lost.map((item) => [JSON.stringify(item),item])).values()],
  unexpected_asset_references:[...retained].filter((path) => !expected.has(path)),
  units_requiring_image_math_review:records.filter((record) => record.normalization_warnings?.includes("image_math_requires_review")).length,
  circuit_records:circuits.length,
  incorrect_circuit_chapters:circuits.filter((record) => record.locator.chapter !== "Chapter 11: Electric circuits").map((record) => record.path),
  samples:sampleTitles.map((pattern) => {
    const record = circuits.find((item) => pattern.test(item.title));
    return record ? {file:record.path,title:record.title,locator:record.locator,assets:record.assets?.length ?? 0,warnings:record.normalization_warnings ?? []} : {missing_sample:String(pattern)};
  }),
  image_math_transcription_required:imageMath > 0,
  mathematical_curation_ready:false, // An automated audit cannot grant human review.
};
console.log(JSON.stringify(report, null, 2));
if (!report.checksum_matches || report.lost_asset_references.length || report.unexpected_asset_references.length
  || report.incorrect_circuit_chapters.length || report.samples.some((sample) => sample.missing_sample)) process.exitCode = 1;
