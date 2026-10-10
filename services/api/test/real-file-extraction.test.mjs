import assert from 'node:assert/strict';
import {test} from 'node:test';
import {RealFileTextExtractor} from '../dist/modules/input/real-file-text-extractor.js';
import {inspectFileEnvelope} from '../dist/modules/input/file-envelope.js';
import {textPdf,mathPng} from './real-file-fixtures.mjs';
import {readFileSync} from 'node:fs';
import {encode} from 'jpeg-js';
import {PNG} from 'pngjs';
import {deflateSync,crc32} from 'node:zlib';
const signal=()=>new AbortController().signal;
test('actual PDF.js extracts complete text and retains true empty-page numbering',async()=>{
  const bytes=textPdf(['V = I R','','x + 2 = 5']),file=inspectFileEnvelope(bytes,'application/pdf','synthetic.pdf');
  const out=await new RealFileTextExtractor().extract(bytes,file,signal());
  assert.equal(out.method,'PDF_TEXT');assert.equal(out.confidence,null);
  assert.deepEqual(out.pages,[{page:1,text:'V = I R'},{page:2,text:''},{page:3,text:'x + 2 = 5'}]);
});
test('actual PDF parser rejects malformed documents, empty extraction, page overflow and text overflow without truncation',async()=>{
  for(const [bytes,code] of [[Buffer.from('%PDF-1.7\nnot-a-document\n%%EOF\n'),'INVALID_FILE'],
    [textPdf(['']),'NO_EXTRACTABLE_TEXT'],[textPdf(Array(11).fill('lesson')),'PDF_TOO_MANY_PAGES'],
    [textPdf(Array(10).fill(Array(20).fill('x'.repeat(45)).join('\n'))),'EXTRACTED_TEXT_TOO_LARGE']]){
    await assert.rejects(new RealFileTextExtractor().extract(bytes,inspectFileEnvelope(bytes,'application/pdf','synthetic.pdf'),signal()),e=>e.code===code,code);
  }
});
test('real local Thai/English OCR models recognize synthetic math PNG with finite confidence and no invented page identity',async()=>{
  const bytes=mathPng(),file=inspectFileEnvelope(bytes,'image/png','synthetic.png');
  const out=await new RealFileTextExtractor().extract(bytes,file,signal());
  assert.equal(out.method,'OCR');assert.equal(out.pages[0].page,null);
  assert.ok(out.confidence>=0&&out.confidence<=100);
  assert.equal(out.pages[0].text.replace(/\s/g,''),'2+3=5');
});
test('actual Thai OCR recognizes the project-authored Thai PNG using pinned local models',async()=>{
  const bytes=readFileSync(new URL('./fixtures/own-thai-math.png',import.meta.url));
  const out=await new RealFileTextExtractor().extract(bytes,inspectFileEnvelope(bytes,'image/png','synthetic-thai.png'),signal());
  assert.ok(out.pages[0].text.includes('โจทย์'));assert.equal(out.pages[0].text.replace(/\s/g,''),'โจทย์2+3=5');
});
test('actual encrypted PDF is rejected without asking for, logging or retaining a password',async()=>{
  const bytes=readFileSync(new URL('./fixtures/own-encrypted.pdf',import.meta.url));
  await assert.rejects(new RealFileTextExtractor().extract(bytes,inspectFileEnvelope(bytes,'application/pdf','synthetic-encrypted.pdf'),signal()),e=>
    e.code==='PDF_ENCRYPTED'&&e.status===422&&!e.message.includes('synthetic-test-password'));
});
test('missing OCR assets fail controlled before starting extraction and do not cause a network fallback',async()=>{
  const bytes=mathPng();
  await assert.rejects(new RealFileTextExtractor({ocrRoot:new URL('./fixtures/no-model-directory/',import.meta.url).pathname})
    .extract(bytes,inspectFileEnvelope(bytes,'image/png','synthetic.png'),signal()),e=>e.code==='OCR_MODELS_UNAVAILABLE');
});
test('actual JPEG decoder and OCR read synthetic math, while corrupt PNG/JPEG content is rejected',async()=>{
  const raster=PNG.sync.read(mathPng()),bytes=encode(raster,95).data;
  const out=await new RealFileTextExtractor().extract(bytes,inspectFileEnvelope(bytes,'image/jpeg','synthetic.jpg'),signal());
  assert.equal(out.pages[0].text.replace(/\s/g,''),'2+3=5');
  const brokenPng=Buffer.from(mathPng());brokenPng[45]^=255;
  for(const [data,mime,name] of [[brokenPng,'image/png','corrupt.png'],[Buffer.from([255,216,255,217]),'image/jpeg','corrupt.jpg']]){
    await assert.rejects(new RealFileTextExtractor().extract(data,inspectFileEnvelope(data,mime,name),signal()),e=>e.code==='INVALID_FILE');
  }
});
test('JPEG EXIF rotation is honored for a synthetic mobile-camera image before OCR',async()=>{
  const original=PNG.sync.read(mathPng()),rotated={width:original.height,height:original.width,data:Buffer.alloc(original.data.length)};
  for(let y=0;y<original.height;y++)for(let x=0;x<original.width;x++){
    const source=(y*original.width+x)*4,target=((original.width-1-x)*rotated.width+y)*4;
    rotated.data.set(original.data.subarray(source,source+4),target);
  }
  const jpeg=encode(rotated,95).data,tiff=Buffer.alloc(26);tiff.write('II');tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);
  tiff.writeUInt16LE(1,8);tiff.writeUInt16LE(0x112,10);tiff.writeUInt16LE(3,12);tiff.writeUInt32LE(1,14);tiff.writeUInt16LE(6,18);
  const payload=Buffer.concat([Buffer.from('Exif\0\0'),tiff]),segment=Buffer.alloc(payload.length+4);
  segment[0]=255;segment[1]=225;segment.writeUInt16BE(payload.length+2,2);payload.copy(segment,4);
  const bytes=Buffer.concat([jpeg.subarray(0,2),segment,jpeg.subarray(2)]);
  const out=await new RealFileTextExtractor().extract(bytes,inspectFileEnvelope(bytes,'image/jpeg','synthetic-rotated.jpg'),signal());
  assert.equal(out.pages[0].text.replace(/\s/g,''),'2+3=5');
});
test('CRC-valid tiny PNG with oversized decompressed payload is rejected before full decode/OCR',async()=>{
  const chunk=(name,data)=>{const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);
    out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;};
  const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc(2*1024*1024))),chunk('IEND',Buffer.alloc(0))]);
  await assert.rejects(new RealFileTextExtractor().extract(bytes,inspectFileEnvelope(bytes,'image/png','synthetic-bomb.png'),signal()),e=>e.code==='INVALID_FILE');
});
test('abort, bounded timeout and concurrent overload release workers before the next request',async()=>{
  const bytes=mathPng(),file=inspectFileEnvelope(bytes,'image/png','synthetic.png');
  const controller=new AbortController();controller.abort();
  await assert.rejects(new RealFileTextExtractor().extract(bytes,file,controller.signal),e=>e.code==='FILE_PROCESSING_TIMEOUT');
  await assert.rejects(new RealFileTextExtractor({timeoutMs:100}).extract(bytes,file,signal()),e=>e.code==='FILE_PROCESSING_TIMEOUT');
  const running=new RealFileTextExtractor().extract(bytes,file,signal());
  await assert.rejects(new RealFileTextExtractor().extract(bytes,file,signal()),e=>e.code==='FILE_PROCESSING_BUSY');
  assert.equal((await running).method,'OCR');
});
