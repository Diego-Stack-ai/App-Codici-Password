import {readFile, writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['scripts/pdf/company-summary-pdf.mjs'], outfile:'Frontend/public/assets/js/vendor/company-summary-pdf.js', bundle:true, format:'esm', platform:'browser', target:['chrome100','edge100','firefox100','safari15'], minify:true, supported:{'template-literal':false}, legalComments:'linked'});

const license='Frontend/public/assets/js/vendor/company-summary-pdf.js.LEGAL.txt';
const original=await readFile(license,'utf8');
const normalized=original.split('\n').map(line=>line.trimEnd()).join('\n');
if(normalized!==original) await writeFile(license,normalized);
