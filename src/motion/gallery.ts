import { GAME_CUES, UI_CUES, EXTRA_CUES, cueForEvent, sampleCue, createDirector, createUIDirector } from './director';
import type { Cue, CueSample } from './director';
import type { GameEvent } from '../contracts/index';
import type { UITransition } from '../contracts/motion';

interface Demo { id:string; label:string; cue:Cue; kind?:GameEvent['kind']; transition?:UITransition; tier?:number }
const gameLabels:Record<GameEvent['kind'],string>={place:'Строительство',upgrade:'Улучшение T1–T2',sell:'Демонтаж',shot:'Выстрел',projectileSpawn:'Вылет снаряда',projectileImpact:'Контакт снаряда',strikeStart:'Замах',strikeContact:'Ближний контакт',miss:'Промах',hit:'Попадание',layerBreak:'Снятие слоя',shieldBreak:'Разрушение щита',kill:'Гибель',leak:'Утечка',spawn:'Появление',ability:'Способность',bossPhase:'Фаза босса',waveStart:'Начало волны',waveEnd:'Конец волны',victory:'Победа',defeat:'Поражение',income:'Доход'};
const uiLabels:Record<UITransition,string>={purchase:'Покупка',reject:'Отказ',unlock:'Открытие',levelUp:'Новый уровень',reward:'Награда',open:'Открыть экран',close:'Закрыть экран',select:'Выбор',respec:'Сброс знаний'};
const extraLabels:Record<keyof typeof EXTRA_CUES,string>={ghost:'Призрак установки',idle:'Покой',aim:'Наведение',reload:'Перезарядка',move:'Движение',turn:'Поворот',split:'Разделение',debit:'Списание',xp:'Опыт',seals:'Печати',medal:'Медаль',upgradeMid:'Улучшение T3–T4',upgradeFinal:'Кульминация T5'};
const demos:Demo[]=[...Object.entries(GAME_CUES).map(([key,c])=>({id:'game-'+key,label:gameLabels[key as GameEvent['kind']],cue:c,kind:key as GameEvent['kind']})),...Object.entries(UI_CUES).map(([key,c])=>({id:'ui-'+key,label:uiLabels[key as UITransition],cue:c,transition:key as UITransition})),...Object.entries(EXTRA_CUES).map(([key,c])=>({id:'extra-'+key,label:extraLabels[key as keyof typeof EXTRA_CUES],cue:c,...(key==='upgradeMid'?{kind:'upgrade' as const,tier:3}:key==='upgradeFinal'?{kind:'upgrade' as const,tier:5}:{})}))];
function must<T extends HTMLElement>(id:string):T { const node=document.getElementById(id);if(!node)throw new Error('Missing '+id);return node as T; }
const grid=must('grid'),status=must('status'),fps=must<HTMLSelectElement>('fps'),speed=must<HTMLSelectElement>('speed'),reduced=must<HTMLInputElement>('reduced'),pause=must<HTMLButtonElement>('pause');
reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused=false,gameTime=0,uiTime=0,last=performance.now(),carry=0,serial=0;
const game=createDirector(),ui=createUIDirector();
const samples=new Map<string,{sample:CueSample;node:HTMLElement;ring:HTMLElement;meter:HTMLElement;start:number}>();
const scratch=()=>({progress:0,scale:1,rotation:0,opacity:1,glow:0,offsetX:0,offsetY:0,ring:0});
for(const d of demos){
  const card=document.createElement('article');card.id=d.id;
  card.innerHTML='<header><strong></strong><small></small></header><div class="stage"><div class="ring"></div><div class="piece"></div></div><div class="meter"><i></i></div><button type="button">Повторить</button>';
  card.querySelector('strong')!.textContent=d.label;card.querySelector('small')!.textContent=d.id+' · '+Math.round(d.cue.duration*1000)+' ms';
  const node=card.querySelector<HTMLElement>('.piece')!;node.dataset.style=d.cue.style;node.textContent=d.transition?'✦':d.kind==='income'||d.id==='extra-debit'?'◆':d.kind==='projectileSpawn'?'➤':'';
  samples.set(d.id,{sample:scratch(),node,ring:card.querySelector<HTMLElement>('.ring')!,meter:card.querySelector<HTMLElement>('i')!,start:0});
  card.querySelector('button')!.addEventListener('click',()=>play(d));grid.append(card);
}
function play(d:Demo){const rec=samples.get(d.id)!;rec.start=d.transition?uiTime:gameTime;if(d.kind){game.consume([{id:serial++,time:gameTime,kind:d.kind,source:d.id,target:d.id,toVisual:d.tier?'a'+d.tier+'.svg':undefined}],{time:gameTime,towers:[]});}else if(d.transition)ui.play(d.id,d.transition);}
function restart(){gameTime=0;uiTime=0;game.reset({time:0,nextEvent:serial});ui.clear();for(const d of demos)play(d);}
function draw(d:Demo,s:CueSample){const rec=samples.get(d.id)!;rec.node.style.transform=`translate(${s.offsetX}px,${s.offsetY}px) rotate(${s.rotation}rad) scale(${s.scale})`;rec.node.style.opacity=String(s.opacity);rec.node.style.filter=`drop-shadow(0 0 ${s.glow*14}px #ffd37a)`;rec.ring.style.transform=`translate(-50%,-50%) scale(${.45+1.9*s.ring})`;rec.ring.style.opacity=String(s.ring>0?1-s.ring:0);rec.meter.style.width=`${s.progress*100}%`;}
function render(){
  const isReduced=reduced.checked;
  // Finished cues keep the final frame for inspection. Active samples come from the shared director.
  for(const d of demos){const rec=samples.get(d.id)!;const elapsed=(d.transition?uiTime:gameTime)-rec.start;const actual=d.kind?cueForEvent({kind:d.kind,toVisual:d.tier?'a'+d.tier+'.svg':undefined},d.tier):d.cue;draw(d,sampleCue(actual,elapsed,isReduced,rec.sample));}
  game.visit((a,elapsed)=>{const d=demos.find(x=>x.id===a.entity);if(d)draw(d,sampleCue(a.cue,elapsed,isReduced,samples.get(d.id)!.sample));});
  ui.visit((a,elapsed,r)=>{const d=demos.find(x=>x.id===a.element);if(d)draw(d,sampleCue(a.cue,elapsed,r,samples.get(d.id)!.sample));});
  status.textContent=`Игра ${gameTime.toFixed(2)} s · UI ${uiTime.toFixed(2)} s · ${game.size} игровых и ${ui.size} UI cues`;
}
function frame(now:number){const dt=Math.min(.25,Math.max(0,(now-last)/1000));last=now;carry+=dt;const step=1/Number(fps.value);if(carry>=step-1e-9){const delta=carry;carry=0;uiTime+=delta;ui.advance(delta);if(!paused)gameTime+=delta*Number(speed.value);game.update({time:gameTime});render();}requestAnimationFrame(frame);}
must('restart').addEventListener('click',restart);pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Продолжить игру':'Пауза игры';});
reduced.addEventListener('change',()=>{ui.setReducedMotion(reduced.checked);restart();});ui.setReducedMotion(reduced.checked);restart();requestAnimationFrame(frame);
