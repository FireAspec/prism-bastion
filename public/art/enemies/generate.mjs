/** Offline generator for original SVG shell states and their standalone guide.
 * node --import tsx public/art/enemies/generate.mjs [--check]
 */
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getEnemies} from '../../../src/content/enemies.ts';

const directory=dirname(fileURLToPath(import.meta.url));
const enemies=getEnemies();
const byId=new Map(enemies.map(e=>[e.id,e]));
const check=process.argv.includes('--check');
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const outlines={
  orb:'M64 18a46 46 0 1 0 0 92 46 46 0 1 0 0-92Z',
  diamond:'M64 11 111 64 64 117 17 64Z',
  hex:'M64 13 106 37 106 91 64 115 22 91 22 37Z',
  shard:'M63 10 91 36 111 58 84 112 54 101 19 79 36 32Z',
  crown:'M17 49 29 24 49 47 64 12 80 47 101 24 112 49 104 105 24 105Z',
};

// Each enemy owns its own vector sigil rather than sharing a recoloured sprite.
const glyphs={
  scarlet:'<path d="M63 35 51 59 66 59 57 86 82 53 66 53 73 35Z"/>',
  amber:'<path d="m43 43 17 17-17 17m23-34 17 17-17 17"/>',
  lemon:'<path d="M72 29 46 66h18l-9 34 33-45H70Z"/>',
  jade:'<path d="m43 45 21-12 21 12v35L64 92 43 80Z M44 60h40 M64 34v56"/>',
  azure:'<path d="M37 58q13-17 27 0t27 0M37 75q13-17 27 0t27 0"/>',
  violet:'<path d="m64 31 27 12v20q0 22-27 33Q37 85 37 63V43Z M48 63h32"/>',
  iron:'<path d="M43 40h42v46H43zM47 45l9 9m20 20 6 6M47 80l9-9m19-17 7-9"/><circle cx="64" cy="63" r="8"/>',
  glass:'<path d="m42 34 28 25-11 10 27 22M79 35 58 69 42 96M70 59l23 1"/>',
  cloak:'<path d="M29 63q35-39 70 0-35 39-70 0ZM64 52a11 11 0 1 0 0 22 11 11 0 0 0 0-22ZM30 96l69-66"/>',
  regrow:'<path d="M80 48a24 24 0 1 0 5 27M80 48V33m0 15H65M49 71l15-6-1 16"/>',
  shield:'<path d="m64 26 30 14v27q-5 24-30 34-25-10-30-34V40Z M64 39v47M43 62h42"/>',
  split:'<path d="M64 31v28l-25 22m25-22 25 22M29 79l10 2 2 10m38 0 10-10 10 1M55 36l9-8 9 8"/>',
  ruby:'<path d="M64 27q14 23 2 34 16-6 18-21 19 37-2 51-15 11-31 2-26-18-4-50 0 20 17-16ZM63 62q16 18 0 27-17-9 0-27Z"/>',
  glacier:'<path d="M64 28v72M33 46l62 36M33 82l62-36M54 38l10 10 10-10M54 90l10-10 10 10"/>',
  copper:'<path d="M72 29 47 64h20L55 98l31-43H65Z M41 45h-7m53 39h7"/>',
  obsidian:'<path d="m64 26 29 23-12 42H47L35 49Z M48 55l16-16 16 16-7 26H55Z M35 49l13 6m45-6-13 6"/>',
  dart:'<path d="m64 21 15 37-15 47-15-47Z M50 60 22 43l9 29 20 3M78 60l28-17-9 29-20 3"/>',
  swarm:'<circle cx="64" cy="64" r="13"/><path d="M50 48 39 38m39 10 11-10M49 79 39 89m39-10 11 10"/>',
  aegis:'<path d="M64 26 94 43v38L64 101 34 81V43Z M64 39l18 11v24L64 87 46 74V50Z"/>',
  royal:'<path d="M35 73 31 46l19 12 14-29 14 29 19-12-4 27ZM37 84h54M45 69h5m12 0h5m12 0h5"/>',
  hollow:'<path d="M30 63q34-35 68 0-34 35-68 0ZM64 49a14 14 0 1 0 0 28 14 14 0 0 0 0-28ZM43 87l42-48"/>',
  prismatic:'<path d="m64 28 28 32-28 36-28-36Z M64 28v68M36 60h56M46 43l36 36M82 43 46 79"/>',
  juggernaut:'<path d="M42 34h44l14 30-14 30H42L28 64Z M45 48h38v32H45Z M57 48v32m14-32v32"/>',
  herald:'<path d="M34 69V47l19 12 11-30 11 30 19-12v22M37 83h54M64 45v23m-10-10 10-13 10 13M48 94h32"/>',
};

const marks={
  armor:'<path d="M4-7 12-3V7L4 12-4 7V-3Z M4-4v11"/>',
  shield:'<path d="M4-10 14-6V4Q14 13 4 17-6 13-6 4V-6Z"/>',
  cloaked:'<path d="M-8 3Q4-12 16 3 4 18-8 3ZM-8 15l24-24"/>',
  flying:'<path d="M3 3-9-7l3 15 9 3 9-3 3-15Z"/>',
  regen:'<path d="M13-1a10 10 0 1 0-4 12M13-1v-8M13-1H5"/>',
  children:'<path d="M4-9V1m0 0-10 9M4 1l10 9M-9 10h5m15 0h5"/>',
};

function badges(e) {
  const active=['armor','shield','cloaked','flying','regen','children'].filter(k=>k==='children'?e.children.length:e[k]);
  const locations=[[99,23],[25,24],[24,100],[102,100],[64,9],[64,116]];
  return active.map((key,i)=>{
    const [x,y]=locations[i];
    return `<g transform="translate(${x} ${y}) scale(.67)" stroke="#fff7e8" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round" fill="none"><circle cx="4" cy="3" r="19" fill="#162c40" stroke="#416079" stroke-width="3"/>${marks[key]}</g>`;
  }).join('');
}

function svg(e,stage) {
  const color=e.layers[stage].color;
  const n=e.layers.length;
  const remaining=n-stage;
  const path=outlines[e.shape];
  const scale=(1-.055*stage).toFixed(3);
  const diamonds=Array.from({length:n},(_,i)=>{
    const x=64+(i-(n-1)/2)*11;
    return `<path d="M${x} 109l4 4-4 4-4-4Z" stroke="#152b40" stroke-width="1.5" fill="${i<remaining?'#fff2d8':'#273e53'}"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" data-enemy="${e.id}" data-shell="${stage}" data-shell-count="${n}" role="img"><title>${esc(e.name)} — оболочка ${stage+1} из ${n}</title><desc>${esc(e.description)} Осталось оболочек: ${remaining}.</desc>`+
    `<defs><linearGradient id="crystal" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="#fffbea"/><stop offset=".18" stop-color="${color}"/><stop offset=".7" stop-color="${color}"/><stop offset="1" stop-color="#172b4b"/></linearGradient></defs>`+
    `<g transform="translate(64 64) scale(${scale}) translate(-64 -64)"><path d="${path}" fill="url(#crystal)" stroke="#15253c" stroke-width="6" stroke-linejoin="round"/><path d="${path}" stroke="#f4ffff" stroke-opacity=".48" stroke-width="1.6" fill="none"/><path d="${path}" transform="translate(64 64) scale(.82) translate(-64 -64)" fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width="2.4"/>`+
    `<g stroke="#14243d" stroke-width="7.5" fill="none" stroke-linejoin="round" stroke-linecap="round">${glyphs[e.id]}</g><g stroke="#fff7e7" stroke-width="3.4" fill="none" stroke-linejoin="round" stroke-linecap="round">${glyphs[e.id]}</g></g>`+
    badges(e)+diamonds+`</svg>\n`;
}

function budget(id,parents=[]) {
  if(parents.includes(id)||parents.length>3) throw new Error(`Invalid child graph at ${id}`);
  const e=byId.get(id);
  if(!e) throw new Error(`Unknown child ${id}`);
  return e.bounty+e.children.reduce((sum,c)=>sum+c.count*budget(c.id,[...parents,id]),0);
}

const traitLabels={armor:'Броня',shield:'Щит',regen:'Регенерация',cloaked:'Скрыт',flying:'Летает'};
function tags(e) {
  const values=Object.entries(traitLabels).filter(([key])=>e[key]).map(([key,label])=>
    key==='cloaked'||key==='flying'?label:key==='regen'?`${label} ${e[key]}/с`:`${label} ${e[key]}`);
  for(const [key,val] of Object.entries(e.resist)) values.push(`${{fire:'Огонь',frost:'Холод',electric:'Ток'}[key]??key} −${Math.round(val*100)}%`);
  if(e.children.length) values.push('Дети: '+e.children.map(c=>`${c.id} ×${c.count}`).join(', '));
  if(!values.length) values.push('Без защиты');
  return values.map(t=>`<span class="trait">${esc(t)}</span>`).join('');
}

function preview() {
  const cards=enemies.map((e,i)=>`<article class="card" data-id="${e.id}" data-count="${e.layers.length}"><div class="art"><img src="${e.id}.svg" alt="${esc(e.name)}" width="160" height="160"/><button ${e.layers.length===1?'disabled':''}>${e.layers.length===1?'Один слой':'Снять слой ↻'}</button></div><div class="body"><small>№ ${String(i+1).padStart(2,'0')} · ${e.id}</small><h2>${esc(e.name)}</h2><div class="stats"><b>${e.hp} <small>HP</small></b><b>${e.speed} <small>px/с</small></b><b>${e.bounty} <small>₡</small></b><b>${e.leak} <small>♥</small></b></div><div class="traits">${tags(e)}</div><p>${esc(e.description)}</p><div class="layers"><strong>Слои снаружи → внутрь</strong>${e.layers.map((l,j)=>`<div class="layer"><i style="background:${l.color}"></i><span>${j+1}. ${l.hp} HP</span><b>+${l.cash} ₡</b></div>`).join('')}</div><footer>Полный распад с потомками: <strong>${budget(e.id)} ₡</strong></footer></div></article>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Bastion — 24 врага</title><style>
:root{color-scheme:dark;font:15px/1.5 system-ui,sans-serif;background:#081725;color:#eaf6f2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#1e4253,transparent 52%),#081725}header{max-width:1200px;margin:auto;padding:48px 24px 16px}header small,.body>small{color:#91c3c5;letter-spacing:.12em}h1{font:700 clamp(32px,5vw,58px)/1.1 Georgia,serif;color:#fff1ce;margin:12px 0}header p{max-width:810px;color:#c2d9da}main{max-width:1200px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px;padding:18px 24px 60px}.card{display:flex;flex-direction:column;background:linear-gradient(150deg,#193448,#0b2032);border:1px solid #355a6c;border-radius:19px;overflow:hidden;box-shadow:0 12px 30px #03101d90}.art{height:205px;display:flex;justify-content:center;align-items:center;background:radial-gradient(circle,#34556b,#0f2a3e 66%);position:relative}.art img{filter:drop-shadow(0 8px 9px #071725)}button{position:absolute;right:12px;bottom:12px;border:1px solid #779a9a;border-radius:20px;padding:9px 13px;background:#244756;color:#fff0ce;cursor:pointer}button:hover,button:focus-visible{outline:2px solid #b8f0dd}button:disabled{opacity:.5;cursor:default}.body{display:flex;flex-direction:column;flex:1;padding:22px 24px}h2{font:700 27px Georgia,serif;margin:8px 0 15px}.stats{display:grid;grid-template-columns:repeat(4,1fr)}.stats b{font-size:20px;color:#ffe3a8}.stats small{display:block;font-size:11px;font-weight:400;color:#a7bfca}.traits{display:flex;gap:6px;flex-wrap:wrap;margin:17px 0 2px}.trait{border:1px solid #4b7282;border-radius:6px;padding:3px 8px;font-size:12px;color:#e1f2e8}.body p{color:#c8dadc;min-height:70px}.layers{border-top:1px solid #3d596b;margin-top:auto;padding-top:12px}.layers strong{font-size:13px;color:#f7deaf}.layer{display:flex;align-items:center;gap:10px;margin-top:7px}.layer i{width:14px;height:14px;transform:rotate(45deg);border:1px solid #fff8}.layer span{flex:1}footer{margin-top:16px;color:#b5cdd0}footer strong{color:#ffe2a2}@media(max-width:390px){main{grid-template-columns:1fr;padding:12px}}
</style></head><body><header><small>FIELD GUIDE · V1</small><h1>Кристаллы надвигаются</h1><p>24 противника, HP, слои дохода и контрприёмы. Нажмите «Снять слой», чтобы увидеть смену цвета и ромбов оставшихся оболочек. Формы и значки различимы без цветового зрения.</p></header><main>${cards}</main><script>document.querySelectorAll('.card').forEach(card=>{let i=0;const n=+card.dataset.count;const btn=card.querySelector('button');btn.addEventListener('click',()=>{if(n===1)return;i=(i+1)%n;card.querySelector('img').src=card.dataset.id+(i?'-layer-'+i:'')+'.svg';btn.textContent=i?'Оболочка '+(i+1)+'/'+n+' ↻':'Снять слой ↻';});});</script></body></html>\n`;
}

async function emit(name,body) {
  const path=join(directory,name);
  if(check) {
    if(await readFile(path,'utf8')!==body) throw new Error(`Outdated ${name}`);
  } else await writeFile(path,body,'utf8');
}
for(const e of enemies) {
  if(!glyphs[e.id]) throw new Error(`Missing glyph ${e.id}`);
  for(let i=0;i<e.layers.length;i++) await emit(`${e.id}${i?'-layer-'+i:''}.svg`,svg(e,i));
}
await emit('preview.html',preview());
console.log(`${check?'Verified':'Generated'} ${enemies.length} enemies, ${enemies.reduce((a,e)=>a+e.layers.length,0)} SVG variants.`);
