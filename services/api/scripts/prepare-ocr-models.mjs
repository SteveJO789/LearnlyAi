// Node 24 strips this standalone TS module; package-manager execution is not involved.
import { prepareOcrModels } from '../src/modules/input/ocr-models.ts';
const args=process.argv.slice(2);
if(args.some(value=>value!=='--download'))throw Error('Use no arguments to verify cached bytes, or --download to fetch pinned official models.');
const result=await prepareOcrModels({download:args.includes('--download')});
console.log(JSON.stringify({status:'PASS',scope:'model packaging/integrity only; not OCR recognition',revision:result.revision,languages:result.languages,license:result.license}));
