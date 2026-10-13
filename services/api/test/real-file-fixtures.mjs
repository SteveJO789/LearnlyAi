// Synthetic learner test material written by the project. Not reviewed Knowledge or educational provenance.
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
GlobalFonts.registerFromPath(join(dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts','LiberationSans-Regular.ttf'),'LearnlyTest');
export function textPdf(texts=['V = I R']) {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${texts.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${texts.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for(let i=0;i<texts.length;i++){
    const lines=texts[i].split('\n').map(line=>line.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)'));
    const content=`BT /F1 16 Tf 50 700 Td ${lines.map((line,n)=>`${n?'0 -24 Td ':''}(${line}) Tj`).join(' ')} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  let out='%PDF-1.4\n',offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(out);
  out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))out+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  out+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}
export function mathPng(text='2 + 3 = 5'){
  const canvas=createCanvas(600,180),context=canvas.getContext('2d');
  context.fillStyle='white';context.fillRect(0,0,600,180);
  context.font='64px LearnlyTest';context.fillStyle='black';context.fillText(text,40,110);
  return canvas.toBuffer('image/png');
}
