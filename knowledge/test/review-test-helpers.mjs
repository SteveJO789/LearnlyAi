import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {strToU8,zipSync} from "fflate";
import {acquireArtifact} from "../dist/acquisition.js";
import {normalizeAcquiredArtifacts} from "../dist/normalization.js";
import {REVIEW_ARTIFACT_ID} from "../dist/review-service.js";
export const SOURCE_ID="siyavula-physical-sciences-g10-g12-ccby";
export const PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9l8AAAAASUVORK5CYII=","base64");
const packageRoot=fileURLToPath(new URL("../",import.meta.url));
export function makeReviewFixture(t){
  const root=mkdtempSync(join(tmpdir(),"learnlyai-human-review-"));
  t?.after(()=>rmSync(root,{recursive:true,force:true}));
  cpSync(join(packageRoot,"schemas"),join(root,"schemas"),{recursive:true});
  mkdirSync(join(root,"manifest"));cpSync(join(packageRoot,"manifest/sources.json"),join(root,"manifest/sources.json"));
  for(const directory of ["raw","normalized","acquisition","concepts"])mkdirSync(join(root,directory));
  writeFileSync(join(root,"acquisition/manifest.json"),JSON.stringify({schema_version:"1.0",artifacts:[]}));
  const bytes=zipSync({
    mimetype:strToU8("application/epub+zip"),
    "META-INF/container.xml":strToU8('<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'),
    "OPS/book.opf":strToU8('<package><manifest><item id="chapter" href="chapter.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>'),
    "OPS/chapter.html":strToU8(`<html><head><title>11 electric circuits</title></head><body>
      <h1>Chapter 11: Electric circuits</h1><div><h2>11.2 Ohm's Law</h2>
      <p>Current and potential difference relate at constant temperature.</p><img class="math-inline" src="equation/formula.png"/>
      <img src="circuit.png" alt="Circuit diagram"/><table><tr><th>Quantity</th><th>Unit</th></tr><tr><td>Voltage</td><td>V</td></tr></table>
      <div><h3>Using Ohm's Law</h3><p>Use verified evidence.</p><div><h4>Worked example 1: Ohm's Law</h4>
      <p>Example quantities and calculation.</p><img class="math-inline" src="equation/solution.png"/></div></div></div>
      <div><h2>11.3 Power and energy</h2><h3>Electrical power</h3><p>Power source context.</p></div>
    </body></html>`),
    "OPS/equation/formula.png":PNG,"OPS/equation/solution.png":PNG,"OPS/circuit.png":PNG,
  });
  const artifact=acquireArtifact(root,{sourceId:SOURCE_ID,artifactId:REVIEW_ARTIFACT_ID,filename:"fixture.epub",sourceUrl:"https://example.test/fixture.epub",bytes});
  normalizeAcquiredArtifacts(root);
  const directory=join(root,"normalized",SOURCE_ID,REVIEW_ARTIFACT_ID);
  const units=readdirSync(directory).filter(path=>path.endsWith(".json")).map(path=>({id:path.slice(0,-5),file:`normalized/${SOURCE_ID}/${REVIEW_ARTIFACT_ID}/${path}`,unit:JSON.parse(readFileSync(join(directory,path),"utf8"))}));
  return{root,artifact,units,first:units.find(entry=>entry.unit.title==="11.2 Ohm's Law"),example:units.find(entry=>entry.unit.title.startsWith("Worked example 1:"))};
}
