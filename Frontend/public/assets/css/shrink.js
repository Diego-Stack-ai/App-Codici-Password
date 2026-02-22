const fs = require('fs');
const filepath = 'C:/Users/Diego/OneDrive - BM SERVICE S.R.L/BM SERVICE SRL/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/css/form_azienda.css';
let css = fs.readFileSync(filepath, 'utf8');

css = css.replace(/(\.detail-content-wrap\s*\{[^}]*gap:\s*)2rem/g, '$11rem');
css = css.replace(/(\.detail-section-header\s*\{[^}]*margin-bottom:\s*)1rem/g, '$10.5rem');
css = css.replace(/(\.detail-section-header\s*\{[^}]*gap:\s*)0\.75rem/g, '$10.5rem');
css = css.replace(/(\.glass-card\s*\{[^}]*padding:\s*)1\.5rem/g, '$11rem');
css = css.replace(/(\.glass-card\s*\{[^}]*gap:\s*)1\.25rem/g, '$10.75rem');
css = css.replace(/(\.view-label\s*\{[^}]*margin-bottom:\s*)0\.5rem/g, '$10.25rem');
css = css.replace(/(\.detail-field-box\s*\{[^}]*height:\s*)3\.5rem/g, '$12.8rem');
css = css.replace(/(\.detail-field-box\s*\{[^}]*padding:\s*)0 1rem/g, '$10 0.75rem');
css = css.replace(/(\.form-grid-2\s*\{[^}]*gap:\s*)1rem/g, '$10.75rem');
css = css.replace(/(\.form-grid-3\s*\{[^}]*gap:\s*)1rem/g, '$10.75rem');
css = css.replace(/(\.form-grid-responsive\s*\{[^}]*gap:\s*)1rem/g, '$10.75rem');
css = css.replace(/(\.collapsible-section\s*\{[^}]*gap:\s*)1rem/g, '$10.75rem');
css = css.replace(/(\.inside-card,\s*\n?\.email-extra-item,\s*\n?\.extra-sede-item\s*\{[^}]*padding:\s*)1rem\s*!important/g, '$10.75rem !important');
css = css.replace(/(\.inside-card,\s*\n?\.email-extra-item,\s*\n?\.extra-sede-item\s*\{[^}]*gap:\s*)0\.75rem/g, '$10.5rem');
css = css.replace(/(\.inside-card,\s*\n?\.email-extra-item,\s*\n?\.extra-sede-item\s*\{[^}]*margin-bottom:\s*)0\.5rem/g, '$10.25rem');
css = css.replace(/(\.accordion-trigger-premium\s*\{[^}]*padding:\s*)1rem/g, '$10.75rem 1rem');
css = css.replace(/(\.flex-col-gap\s*\{[^}]*gap:\s*)1rem/g, '$10.75rem');

fs.writeFileSync(filepath, css);
console.log("Done");
