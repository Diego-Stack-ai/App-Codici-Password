import {readFile, writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['scripts/pdf/company-summary-pdf.mjs'], outfile:'Frontend/public/assets/js/vendor/company-summary-pdf.js', bundle:true, format:'esm', platform:'browser', target:['chrome100','edge100','firefox100','safari15'], minify:true, supported:{'template-literal':false}, legalComments:'linked'});

const license='Frontend/public/assets/js/vendor/company-summary-pdf.js.LEGAL.txt';
await writeFile(license,(await readFile(license,'utf8')).split('\n').map(line=>line.trimEnd()).join('\n'));
