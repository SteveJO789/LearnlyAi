import { createServer, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ReviewError, ReviewService, REVIEW_CONCEPTS } from "./review-service.js";

export async function startReviewServer(root:string,port=4317):Promise<{url:string;close:()=>Promise<void>}> {
  if(!Number.isInteger(port)||port<0||port>65535) throw new Error("Port must be an integer between 0 and 65535");
  const service=new ReviewService(root);
  const token=randomBytes(32).toString("hex");
  const uiRoot=fileURLToPath(new URL("../review-ui/",import.meta.url));
  let origin="";
  const json=(response:ServerResponse,status:number,body:unknown):void=>{
    response.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
    response.end(JSON.stringify(body));
  };
  const server=createServer(async(request,response)=>{
    response.setHeader("X-Content-Type-Options","nosniff");
    response.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    try {
      if(request.headers.host!==new URL(origin).host) throw new ReviewError(403,"This tool only accepts its loopback host");
      const url=new URL(request.url??"/",origin);
      if(request.method==="GET" && url.pathname==="/favicon.ico") {response.writeHead(204);response.end();return;}
      if(request.method==="GET" && ["/","/app.js","/style.css"].includes(url.pathname)) {
        const filename=url.pathname==="/"?"index.html":url.pathname.slice(1);
        const contentType=filename.endsWith(".html")?"text/html; charset=utf-8":filename.endsWith(".js")?"text/javascript; charset=utf-8":"text/css; charset=utf-8";
        response.writeHead(200,{"Content-Type":contentType,"Cache-Control":"no-store"});
        response.end(readFileSync(join(uiRoot,filename))); return;
      }
      if(request.method==="GET" && url.pathname==="/api/bootstrap") {
        json(response,200,{token,concepts:REVIEW_CONCEPTS,artifact_id:service.artifact.artifact_id});return;
      }
      if(request.method==="GET" && url.pathname==="/api/units") {
        const selected=url.searchParams.has("selected")?(url.searchParams.get("selected")??"").split(",").filter(Boolean):undefined;
        json(response,200,service.list(url.searchParams.get("concept")??"ohms-law",selected));return;
      }
      const unitMatch=/^\/api\/units\/(\d+)$/.exec(url.pathname);
      if(request.method==="GET" && unitMatch) {json(response,200,service.unit(unitMatch[1]!));return;}
      const assetMatch=/^\/api\/assets\/(\d+)\/(\d+)$/.exec(url.pathname);
      if(request.method==="GET" && assetMatch) {
        const asset=service.resolveAsset(assetMatch[1]!,Number(assetMatch[2]));
        response.writeHead(200,{"Content-Type":asset.contentType,"Cache-Control":"no-store"});response.end(asset.bytes);return;
      }
      const reviewMatch=/^\/api\/reviews\/(\d+)\/(\d+)$/.exec(url.pathname);
      if(request.method==="POST" && reviewMatch) {
        if(request.headers.origin && request.headers.origin!==origin) throw new ReviewError(403,"Cross-origin review writes are blocked");
        if(request.headers["x-review-token"]!==token) throw new ReviewError(403,"Missing local review session token");
        if(!(request.headers["content-type"]??"").startsWith("application/json")) throw new ReviewError(415,"Use application/json");
        let text="";
        for await(const chunk of request) {
          text+=String(chunk);
          if(Buffer.byteLength(text)>50000) throw new ReviewError(413,"Review payload is too large");
        }
        let body:unknown;
        try {body=JSON.parse(text);} catch {throw new ReviewError(400,"Invalid review JSON");}
        json(response,200,service.save(reviewMatch[1]!,Number(reviewMatch[2]),body));return;
      }
      throw new ReviewError(404,"Route not found");
    } catch(error) {
      json(response,error instanceof ReviewError?error.status:500,{error:error instanceof ReviewError?error.message:"Could not process review; check source/review integrity and server logs"});
      if(!(error instanceof ReviewError)) console.error(error);
    }
  });
  await new Promise<void>((done,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",()=>done());});
  const address=server.address();
  if(!address || typeof address==="string") throw new Error("Could not determine review server port");
  origin=`http://127.0.0.1:${address.port}`;
  return {url:origin,close:()=>new Promise<void>((done,reject)=>server.close((error)=>error?reject(error):done()))};
}
