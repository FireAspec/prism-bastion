import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
const palette={a:'#ffc95c',c:'#83d8e2',v:'#c6a9f5',g:'#9bd6aa',r:'#ff9b85',b:'#c48354',i:'#fff1ca'};
// Deliberately distinct silhouettes. Coordinates use a 64-unit icon grid.
const groups={
'resource':{
credits:['a','M32 7 51 17 55 39 40 55 19 52 9 34 15 15Z','M32 17 43 23 46 36 36 45 23 43 19 30 23 20Z M32 23V39 M26 31H38'],
xp:['c','M32 5 39 24 59 32 39 40 32 59 25 40 5 32 25 24Z','M32 17V47 M17 32H47'],
'knowledge-points':['v','M8 15Q20 10 32 20Q44 10 56 15V49Q44 44 32 54Q20 44 8 49Z','M32 20V54 M15 25 25 27 M15 34 25 36 M39 27 49 25 M39 36 49 34'],
seals:['b','M32 6 40 12 50 12 52 22 58 32 52 42 50 52 40 52 32 58 24 52 14 52 12 42 6 32 12 22 14 12 24 12Z','M19 32 28 41 45 23 M32 15V18 M32 46V49'],
lives:['r','M32 54 10 34Q0 13 18 10Q27 9 32 20Q37 9 46 10Q64 13 54 34Z','M14 32H24L29 22 35 42 40 32H50']},
'difficulty':{
easy:['g','M32 6 51 15V33Q48 47 32 58Q16 47 13 33V15Z','M23 35 29 41 43 24'],
normal:['c','M32 6 53 17V36L32 57 11 36V17Z','M20 42 32 15 44 42 M24 33H40'],
hard:['a','M8 12 17 7 32 22 47 7 56 12 41 32 56 49 49 56 32 41 15 56 8 49 23 32Z','M17 17 47 47 M47 17 17 47'],
extreme:['r','M32 5 58 32 32 59 6 32Z','M32 15V36 M32 45V48 M16 32H20 M44 32H48']},
'map-group':{
'group-1':['g','M5 50 24 22 38 42 47 32 59 50Z','M9 50H55 M24 22V9H36L31 14 36 19H24'],
'group-2':['c','M5 50 17 27 25 39 39 15 59 50Z','M39 15V6H52L47 11 52 16H39 M9 50H55'],
'group-3':['a','M4 50 17 28 27 37 37 9 49 31 60 50Z','M37 9 44 22 37 19 32 23 M9 50H55 M17 28 24 41'],
'group-4':['v','M4 50 14 34 23 40 32 6 41 40 50 34 60 50Z','M32 6 39 22 32 18 25 22 M13 50H51 M24 42 32 28 40 42']},
'mode':{
standard:['a','M11 56H53L48 48 43 46 40 20H24L21 46 16 48Z','M23 20 32 7 41 20 M32 24V35 M8 16 17 20 M56 16 47 20'],
'half-cash':['b','M31 7A25 25 0 0 0 31 57Z','M42 9 52 17 57 32 52 47 42 55 M13 32H26 M38 32H57'],
'no-leaks':['r','M32 55 10 32Q4 12 20 11Q29 11 32 21Q35 11 44 11Q60 12 54 32Z','M32 25V42 M26 30 32 25'],
'iron-oath':['i','M12 9H52V32Q49 48 32 58Q15 48 12 32Z','M23 19H41V36H23Z M27 19V14H37V19 M32 27V31'],
'short-supply':['a','M7 24 17 13 27 24V48H7Z M37 24 47 13 57 24V48H37Z','M8 54H56 M27 34H37 M29 24H35'],
blackout:['v','M44 7Q12 4 8 31Q6 56 35 57Q49 57 58 42Q34 47 25 29Q21 15 44 7Z','M48 13V25 M42 19H54'],
stormfront:['c','M9 32Q3 19 17 16Q22 3 37 12Q53 8 58 24Q61 34 49 35H9Z M28 34 20 48 31 48 26 58 45 41H34L38 34Z','M9 42 5 50 M53 43 49 51'],
overdrive:['a','M34 5 8 35H27L23 59 56 25H37Z','M6 18H19 M3 46H16 M45 51H58'],
'low-tech':['g','M7 45 28 23 25 10 35 6 40 20 54 20 58 30 45 38 32 34 16 56Z','M11 48 17 53 M32 26 44 26'],
'no-actives':['v','M9 22H22L39 9V55L22 42H9Z','M46 23 58 41 M58 23 46 41']},
'status':{
burn:['r','M32 5Q50 22 40 30Q48 29 51 22Q62 48 42 56Q13 65 9 40Q8 27 24 18Q19 32 28 33Q36 22 32 5Z','M30 50Q20 44 32 32Q42 44 34 50'],
poison:['g','M23 7H41V14L37 18V27L53 47Q59 57 47 57H17Q5 57 11 47L27 27V18L23 14Z','M19 43H45 M25 49H26 M38 36H39'],
slow:['a','M8 28H20L20 12H50L56 21 50 30H43V40L53 52H13L22 40V28Z','M24 21H43 M23 47H43 M32 30V39'],
freeze:['c','M32 5 56 19 56 45 32 59 8 45 8 19Z','M32 13V51 M15 22 49 42 M49 22 15 42 M25 17 32 24 39 17 M25 47 32 40 39 47'],
stun:['a','M32 4 37 23 56 14 46 32 60 44 40 43 32 60 24 43 4 44 18 32 8 14 27 23Z','M32 24V35 M32 42V44'],
mark:['r','M32 8A24 24 0 1 0 32 56A24 24 0 1 0 32 8Z','M32 19V27 M32 37V45 M19 32H27 M37 32H45 M32 31V33'],
shred:['b','M10 10H54V32Q50 48 32 58Q14 48 10 32Z','M35 10 23 29 39 34 27 54'],
wet:['c','M32 5Q53 31 53 41A21 21 0 0 1 11 41Q11 31 32 5Z','M21 39Q21 49 32 50'],
reveal:['v','M4 32Q32 1 60 32Q32 63 4 32Z','M32 18A14 14 0 1 0 32 46A14 14 0 1 0 32 18Z M32 28V36']},
'control':{
play:['g','M17 8 55 32 17 56Z','M26 22 42 32 26 42'],
pause:['i','M14 8H27V56H14Z M37 8H50V56H37Z',''],
speed:['a','M6 14 30 32 6 50Z M33 14 57 32 33 50Z',''],
lock:['b','M12 27H52V57H12Z','M21 27V18A11 11 0 0 1 43 18V27 M32 38V46'],
check:['g','M32 6 58 32 32 58 6 32Z','M19 32 28 41 46 23'],
warning:['r','M32 6 59 55H5Z','M32 23V37 M32 45V47'],
close:['i','M10 18 18 10 32 24 46 10 54 18 40 32 54 46 46 54 32 40 18 54 10 46 24 32Z',''],
settings:['b','M25 5H39L41 13 49 16 57 13 61 25 55 32 61 39 57 51 49 48 41 51 39 59H25L23 51 15 48 7 51 3 39 9 32 3 25 7 13 15 16 23 13Z','M32 21A11 11 0 1 0 32 43A11 11 0 1 0 32 21Z'],
sell:['b','M8 15H39L56 32 39 49H8Z','M19 32H43 M36 25 43 32 36 39'],
ability:['v','M32 5 43 20 59 32 43 44 32 59 21 44 5 32 21 20Z','M34 15 22 34H33L30 49 44 29H33Z'],
coop:['c','M6 52V42Q7 32 19 32Q31 32 32 42V52Z M32 52V42Q33 32 45 32Q57 32 58 42V52Z M19 10A9 9 0 1 0 19 28A9 9 0 1 0 19 10Z M45 10A9 9 0 1 0 45 28A9 9 0 1 0 45 10Z',''],
medal:['a','M14 5H26L32 25 38 5H50L43 30A18 18 0 1 1 21 30Z','M32 34 35 41 43 42 37 47 39 54 32 50 25 54 27 47 21 42 29 41Z']}}
const decor={lantern:['a','M22 56H42L40 46 45 42 42 19 34 12 30 12 22 19 19 42 24 46Z','M22 19H42 M20 41H44 M32 23V37 M25 9Q32 2 39 9'], 'crystal-cluster':['c','M8 49 13 27 24 19 29 45 34 6 48 17 46 43 56 30 60 51 32 58Z','M34 6 38 35 48 17 M13 27 23 35 24 19 M32 58 38 35 46 43'], 'reed-bed':['g','M8 53 14 29 21 45 20 13 28 39 32 8 36 42 44 16 45 45 55 29 58 53 32 58Z','M12 54Q32 44 55 54 M32 14V49 M20 20 27 47 M44 22 39 48'], 'copper-gear':['b','M24 8H40L43 16 51 17 57 30 51 38 51 46 39 55 32 51 24 55 12 46 12 38 6 30 12 17 21 16Z','M32 21A11 11 0 1 0 32 43A11 11 0 1 0 32 21Z M16 26 21 29 M43 39 48 42'], 'stone-rubble':['i','M5 46 12 32 25 29 30 15 44 14 54 29 60 48 48 55 12 55Z','M25 29 36 37 30 55 M44 14 42 31 54 29 M12 32 18 45 5 46'],waystone:['v','M20 54 16 44 20 13 32 5 44 13 48 44 44 54Z','M32 15 40 27 32 39 24 27Z M24 47H40']};
const frames={panel:'#c48354',selected:'#83d8e2',locked:'#8a9ba1',warning:'#ff9b85'};
const files={};
const externalDetails={lock:'M21 27V18A11 11 0 0 1 43 18V27',blackout:'M48 13V25 M42 19H54','half-cash':'M42 9 52 17 57 32 52 47 42 55 M38 32H57','no-actives':'M46 23 58 41 M58 23 46 41',standard:'M23 20 32 7 41 20 M8 16 17 20 M56 16 47 20',overdrive:'M6 18H19 M3 46H16 M45 51H58','group-1':'M24 22V9H36L31 14 36 19H24','group-2':'M39 15V6H52L47 11 52 16H39','group-3':'M37 9 44 22 37 19 32 23','group-4':'M32 6 39 22 32 18 25 22',lantern:'M25 9Q32 2 39 9'};
const frameMotifs={panel:'M12 27V12H27 M293 12H308V27 M12 93V108H27 M293 108H308V93',selected:'M12 30V12H30 M18 24V18H24 M290 12H308V30 M296 18H302V24 M12 90V108H30 M18 96V102H24 M290 108H308V90 M296 102H302V96',locked:'M12 27V12H27 M293 12H308V27 M12 93V108H27 M293 108H308V93 M151 8V3H169V8',warning:'M12 27 27 12 M12 35 35 12 M293 12 308 27 M285 12 308 35 M12 93 27 108 M12 85 35 108 M293 108 308 93 M285 108 308 85'};
function svg(id,[color,shape,detail],size=64){return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><title>${id}</title><g stroke-linecap="round" stroke-linejoin="round"><path d="${shape}" fill="${palette[color]}" stroke="#11272e" stroke-width="3"/>${detail?`<path d="${detail}" fill="none" stroke="#11272e" stroke-width="3"/>`:''}${externalDetails[id]?`<path d="${externalDetails[id]}" fill="none" stroke="${palette[color]}" stroke-width="2.5"/>`:''}</g></svg>\n`}
for(const [group,items] of Object.entries(groups))for(const [id,spec] of Object.entries(items))files[`public/art/ui/${group}/${id}.svg`]=svg(id,spec);
for(const [id,spec] of Object.entries(decor))files[`public/art/world/decoration/${id}.svg`]=svg(id,spec,96);
for(const [id,c] of Object.entries(frames))files[`public/art/ui/frame/${id}.svg`]=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120"><title>${id} frame</title><path d="M16 3H304L317 16V104L304 117H16L3 104V16Z" fill="#21434a" stroke="#11272e" stroke-width="4"/><path d="M18 8H302L312 18V102L302 112H18L8 102V18Z" fill="none" stroke="${c}" stroke-width="3"${id==='locked'?' stroke-dasharray="8 5"':''}/><path d="${frameMotifs[id]}" fill="none" stroke="${c}" stroke-width="3"/></svg>\n`;
const sections=Object.entries({...groups,decoration:decor,frame:frames}).map(([group,items])=>`<section><h2>${group}</h2><div class="grid">${Object.keys(items).map(id=>`<figure><img width="${({resource:24,status:20,control:28,difficulty:32,'map-group':32,mode:40,decoration:96,frame:320})[group]}" height="${group==='frame'?120:({resource:24,status:20,control:28,difficulty:32,'map-group':32,mode:40,decoration:96})[group]}" src="${group==='decoration'?'../decoration/':'../../ui/'+group+'/'}${id}.svg" alt="${id}"><figcaption>${id}</figcaption></figure>`).join('')}</div></section>`).join('');
files['public/art/world/reference/index.html']=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Bastion | Art reference</title><style>body{margin:0;background:#102b35;color:#fff1ca;font:16px system-ui;padding:24px;max-width:1200px}h1{color:#ffc95c}h2{text-transform:capitalize;color:#83d8e2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:8px}figure{margin:0;padding:12px;text-align:center;background:#21434a;border:1px solid #c48354;border-radius:8px}img{object-fit:contain;max-width:100%}figcaption{font-size:12px;overflow-wrap:anywhere}section:last-child .grid{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}section:last-child img{height:auto}section:nth-last-child(2) img{width:96px;height:96px}@media(max-width:500px){body{padding:12px}}</style><h1>Prism Bastion — common art</h1><p>Warm copper, amber light, mineral cyan. Shape carries meaning independently of hue.</p>${sections}</html>\n`;
for(const [path,content] of Object.entries(files)){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content)}
