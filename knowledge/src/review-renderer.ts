import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];

export function escapeHtml(text: string): string {
  return text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

// Only the source table's semantic elements survive. No scripts, links, SVG, event
// attributes, styles, remote URLs or arbitrary raw HTML are served to the browser.
function safeTable(html: string, imageUrl: (reference:string) => string | undefined): string {
  const allowed = new Set(["table","thead","tbody","tfoot","tr","td","th","caption","p","br","strong","em","sup","sub"]);
  function render(node: Node): string {
    if ("value" in node) return escapeHtml(node.value);
    if (!("tagName" in node)) return "childNodes" in node ? node.childNodes.map(render).join("") : "";
    if (["script","style","iframe","object"].includes(node.tagName)) return "";
    if (node.tagName === "img") {
      const source = node.attrs.find((attr) => attr.name === "src")?.value ?? "";
      const url = imageUrl(source);
      return url ? `<img src="${escapeHtml(url)}" alt="Source mathematical image">` : "[Source image unavailable]";
    }
    const content = node.childNodes.map(render).join("");
    if (!allowed.has(node.tagName)) return content;
    const spans = node.attrs.filter((attr) => ["rowspan","colspan"].includes(attr.name) && /^[1-9][0-9]?$/.test(attr.value))
      .map((attr) => ` ${attr.name}="${attr.value}"`).join("");
    return `<${node.tagName}${spans}>${content}${node.tagName === "br" ? "" : `</${node.tagName}>`}`;
  }
  return render(parseFragment(html));
}

export function renderEvidence(markdown: string, imageUrl: (reference:string) => string | undefined): string {
  function inline(text: string): string {
    // Escape all source text before introducing trusted local image tags.
    return escapeHtml(text).replace(/!\[([^\]]*)\]\((epub:[^)]*)\)/g,(_match,label:string,reference:string) => {
      const url = imageUrl(reference.slice(5));
      return url ? `<img class="source-image" src="${escapeHtml(url)}" alt="${label}" loading="lazy">` : "[Source image unavailable]";
    }).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  }
  const blocks = markdown.split(/(<table[\s\S]*?<\/table>)/gi);
  return blocks.map((block) => {
    if (/^<table/i.test(block)) return safeTable(block,imageUrl);
    const lines = block.split("\n");
    let html = "";
    for (let index=0;index<lines.length;index++) {
      const line = lines[index]!;
      if (line.trim().startsWith("|") && lines[index+1]?.trim().match(/^\|[\s:|\-]+\|$/)) {
        const cells = (row:string):string[] => row.trim().slice(1,-1).split(/(?<!\\)\|/).map((cell)=>cell.trim().replaceAll("\\|","|"));
        html += `<table><thead><tr>${cells(line).map((cell)=>`<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>`;
        index += 2;
        while(index<lines.length && lines[index]!.trim().startsWith("|")) {
          html += `<tr>${cells(lines[index]!).map((cell)=>`<td>${inline(cell)}</td>`).join("")}</tr>`;
          index++;
        }
        html += "</tbody></table>"; index--; continue;
      }
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) html += `<h${Math.min(heading[1]!.length,4)}>${inline(heading[2]!)}</h${Math.min(heading[1]!.length,4)}>`;
      else if (line.trim()) html += `<p class="source-line">${inline(line)}</p>`;
    }
    return html;
  }).join("\n");
}
