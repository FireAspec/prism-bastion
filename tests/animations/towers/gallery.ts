import {createTowerMotion,towerIds,towerAsset,towerOverlay} from '../../../src/render-animations/towers/index';
import type {GameEvent,GameState,Tiers,TowerState} from '../../../src/contracts';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const select=$<HTMLSelectElement>('tower'), speed=$<HTMLSelectElement>('speed'), fps=$<HTMLSelectElement>('fps'), reduced=$<HTMLInputElement>('reduced');
const current=$<HTMLImageElement>('current'), old=$<HTMLImageElement>('old'), overlay=$<HTMLImageElement>('overlay');
const missing=$<HTMLDivElement>('missing'), status=$<HTMLDivElement>('status');
interface Case {name:string;from:Tiers;to:Tiers;kind:'place'|'upgrade';}
const cases:Case[]=[{name:'База · установка',from:[0,0,0],to:[0,0,0],kind:'place'}];
for(let p=0;p<3;p++)for(let n=1;n<=5;n++){const from:Tiers=[0,0,0],to:Tiers=[0,0,0];from[p]=n-1;to[p]=n;cases.push({name:`${'ABC'[p]}${n-1} → ${'ABC'[p]}${n}${n===5?' · T5':''}`,from,to,kind:'upgrade'});}
for(let p=0;p<3;p++)for(let q=0;q<3;q++)if(p!==q){const from:Tiers=[0,0,0],to:Tiers=[0,0,0];from[p]=4;from[q]=2;to[p]=5;to[q]=2;cases.push({name:`${to.join('–')} · кросс-путь`,from,to,kind:'upgrade'});}
for(const id of towerIds){const o=document.createElement('option');o.value=o.textContent=id;select.append(o);}
$<HTMLElement>('counts').textContent='30 баз · 450 основных переходов · 90 T5 · 180 финальных кросс-путей';
let motion=createTowerMotion(), selected=0, eventId=0, time=0, alive=true, strikeUntil=0;
const makeTower=(tiers:Tiers):TowerState=>({id:'t1',defId:select.value,owner:'p',pos:{x:0,y:0},tiers:[...tiers],targeting:'first',invested:1,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0});
let tower=makeTower([0,0,0]);
function snapshot():GameState{return {options:{runId:'gallery'},time,tick:Math.floor(time*60),towers:alive?[tower]:[],projectiles:[],strikes:strikeUntil>time?[{source:'t1',direction:{x:1,y:0},remainingWindup:strikeUntil-time,attack:{windup:.5}}]:[]} as unknown as GameState;}
function event(kind:GameEvent['kind'],extra:Partial<GameEvent>={}){motion.consume([{id:++eventId,kind,time,source:'t1',...extra}],snapshot());}
const badAssets=new Set<string>();
function asset(img:HTMLImageElement,path?:string){if(!path||badAssets.has(path)){img.style.visibility='hidden';delete img.dataset.asset;if(img===current&&path)missing.textContent=`Нет SVG: ${path.split('/').pop()}`;return;}if(img.dataset.asset===path)return;img.dataset.asset=path;img.style.visibility='hidden';img.onload=()=>{if(img.dataset.asset===path){img.style.visibility='visible';if(img===current)missing.textContent='';}};img.onerror=()=>{if(img.dataset.asset===path){badAssets.add(path);img.style.visibility='hidden';if(img===current)missing.textContent=`Нет SVG: ${path.split('/').pop()}`;}};img.src=path;}
function replay(){motion.dispose();motion=createTowerMotion();motion.setReducedMotion(reduced.checked);time=0;eventId=0;alive=true;strikeUntil=0;const c=cases[selected];tower=makeTower(c.from);if(c.kind==='upgrade')motion.update(0,snapshot());tower=makeTower(c.to);event(c.kind);$<HTMLElement>('title').textContent=`${tower.defId} · ${c.name}`;document.querySelectorAll('#cases button').forEach((b,i)=>b.classList.toggle('active',i===selected));}
for(const [i,c] of cases.entries()){const b=document.createElement('button');b.textContent=c.name;b.onclick=()=>{selected=i;replay();};$<HTMLElement>('cases').append(b);}
select.onchange=replay;reduced.onchange=()=>motion.setReducedMotion(reduced.checked);$<HTMLButtonElement>('replay').onclick=replay;
$<HTMLButtonElement>('shot').onclick=()=>{if(alive)event('shot',{pos:{x:0,y:0},to:{x:1,y:0}});};
$<HTMLButtonElement>('strike').onclick=()=>{if(alive){strikeUntil=time+.5;event('strikeStart');}};
$<HTMLButtonElement>('ability').onclick=()=>{if(alive)event('ability');};
$<HTMLButtonElement>('sell').onclick=()=>{if(alive){alive=false;strikeUntil=0;event('sell');}};
function paint(){const sample=motion.sample('t1'), show=alive||motion.retired().length>0;const path=towerAsset(tower.defId,tower.tiers);asset(current,show?path:undefined);asset(old,show?sample.ghostAsset:undefined);asset(overlay,show?towerOverlay(tower.defId,tower.tiers):undefined);const transform=`translate(${sample.offset.x}px,${sample.offset.y}px) rotate(${sample.rotation}rad) scale(${sample.scale})`;for(const img of [current,old,overlay])img.style.transform=transform;const opacity=sample.ghostAsset&&badAssets.has(sample.ghostAsset)?1:sample.opacity;current.style.opacity=String(opacity);overlay.style.opacity=String(opacity);if(!show)missing.textContent='';old.style.opacity=String(sample.ghostOpacity??0);current.style.filter=`drop-shadow(0 0 ${sample.glow*8}px rgba(255,192,90,${sample.glow}))`;status.textContent=`Время симуляции: ${time.toFixed(2)} c\n${JSON.stringify(sample,null,1)}`;}
let last=performance.now(),acc=0;function frame(now:number){acc+=Math.min(.1,(now-last)/1000);last=now;const step=1/Number(fps.value);while(acc>=step){acc-=step;const before=time;time+=step*Number(speed.value);if(strikeUntil>0&&before<strikeUntil&&time>=strikeUntil){strikeUntil=0;event('strikeContact');}motion.update(step,snapshot());}paint();requestAnimationFrame(frame);}replay();requestAnimationFrame(frame);
