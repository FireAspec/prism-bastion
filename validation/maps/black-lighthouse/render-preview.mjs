/**
 * Build a static SVG composite of the exact preview overlay and map background.
 * Designed for CLI raster export when a browser is not installed. This does
 * not evaluate the HTML toggles or replace a real browser interaction test.
 * Usage: node validation/maps/black-lighthouse/render-preview.mjs /tmp/map.svg
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const directory=fileURLToPath(new URL('../../../public/art/maps/black-lighthouse/',import.meta.url));
const html=readFileSync(new URL('../../../public/art/maps/black-lighthouse/preview.html',import.meta.url),'utf8');
const backgroundSource=readFileSync(new URL('../../../public/art/maps/black-lighthouse/background.svg',import.meta.url),'utf8');
const background=backgroundSource.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1];
const overlay=html.match(/<svg class="overlay"[^>]*>([\s\S]*?)<\/svg>/)?.[1];
if(!overlay||!background)throw new Error('Preview overlay or SVG terrain not found');

const css=`
.route-base{stroke:#172932;stroke-width:46;fill:none;stroke-linecap:round;stroke-linejoin:round}
.route{stroke-width:33;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.82}
.route-midline{fill:none;stroke:#fbf1ce;stroke-width:2.5;stroke-dasharray:5 15;opacity:.72;stroke-linecap:round}
.route-label{font-size:15px;font-weight:900;paint-order:stroke;stroke:#122734;stroke-width:6;letter-spacing:.09em;fill:#fff8dc}
.site{fill:#142b35;stroke:#f6cf93;stroke-width:2.6;stroke-dasharray:5 6}
.site-water{fill:#10374a;stroke:#9be6de;stroke-width:2.4;stroke-dasharray:5 6}
.site-n{fill:#f8d69d;font-size:13px;font-weight:900;text-anchor:middle;dominant-baseline:middle}
.site-w{fill:#adfff2;font-size:13px;font-weight:900;text-anchor:middle;dominant-baseline:middle}`;

const composite=`<svg xmlns="http://www.w3.org/2000/svg" width="1366" height="768" viewBox="0 0 1280 720">
<style>${css}</style>
<g id="terrain">${background}</g>
${overlay}
</svg>`;
const output=resolve(process.argv[2]??'/tmp/black-lighthouse-preview-composite.svg');
writeFileSync(output,composite);
console.log(`Saved CLI composite from ${directory}: ${output}`);
