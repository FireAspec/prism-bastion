import type { AbilityDef, AttackDef, CommandResult, EffectDef, GameCommand, GameConfig, GameState, HUD, LocaleCatalog, PathIndex, ResolvedTower, StatDelta, Targeting, Tiers, TowerDef, TowerState, UIHooks } from '../contracts';
import { canUpgrade, legalTiers, sellRefund } from '../contracts/rules';
import './hud.css';

const PATHS: PathIndex[] = [0, 1, 2];
const LETTERS = ['A', 'B', 'C'];
const CATEGORIES: TowerDef['category'][] = ['weapon', 'element', 'tech', 'support', 'economy', 'water'];
const TARGETS: Targeting[] = ['first', 'last', 'strong', 'near'];
const storyNames: Record<string, string> = {
 scatter:'Сад фонарей', ember:'Сад фонарей', saw:'Медный ручей', venom:'Медный ручей',
 rail:'Поля ветряков', tesla:'Поля ветряков', mortar:'Старый акведук', observatory:'Старый акведук',
 mint:'Садовая стена', orchard:'Садовая стена', drone:'Грузовой двор', rocket:'Грузовой двор',
 resonator:'Колокольная литейная', forge:'Колокольная литейная', harbor:'Приливные доки',
 tide:'Солёные болота', coral:'Коралловые ворота', chrono:'Часовая площадь',
 gravity:'Павшая обсерватория', prism:'Призменный карьер', mirror:'Зеркальные террасы',
 mine:'Стеклянный серпантин', portal:'Мост раскола', bank:'Квартал хранилищ',
 storm:'Штормовой берег', bastion:'Чёрный маяк'
};
const categoryNames: Record<TowerDef['category'], string> = {weapon:'Оружие',element:'Стихии',tech:'Технологии',support:'Поддержка',economy:'Снабжение',water:'Водные'};
const targetNames: Record<Targeting,string> = {first:'Первый',last:'Последний',strong:'Сильный',near:'Ближний'};
const fmt = (n:number) => Number.isFinite(n) ? String(Math.round(n*100)/100) : '—';
const money = (n:number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const nextTiers = (tiers:Tiers,path:PathIndex):Tiers => {const next:Tiers=[...tiers]; next[path]++; return next;};

export function towerAsset(id:string, asset:string):string {
 const prefix = 'art/towers/'+id+'/';
 const normalized = asset.replace(/^\.?\//,'').replace(/^public\//,'');
 const name = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
 // Only local SVGs from this tower's own art directory.
 return '/'+prefix+(/^[a-zA-Z0-9_-]+\.svg$/.test(name) ? name : 'base.svg');
}
function deltaAttack(a:AttackDef,d:StatDelta):void {
 a.damage*=d.damageMul??1; a.interval=Math.max(.05,a.interval*(d.intervalMul??1)); a.range*=d.rangeMul??1;
 a.pierce+=d.pierceAdd??0; a.count+=d.countAdd??0; a.splash+=d.splashAdd??0;
 a.chains+=d.chainsAdd??0; a.chainRadius+=d.chainRadiusAdd??0; a.armorPierce+=d.armorPierceAdd??0;
 a.shieldMultiplier*=d.shieldMultiplierMul??1; a.bossMultiplier*=d.bossMultiplierMul??1;
 a.executeBelow+=d.executeBelowAdd??0; a.push+=d.pushAdd??0;
 a.detects=a.detects||Boolean(d.detects); a.projectileSpeed*=d.projectileSpeedMul??1;
 a.windup*=d.windupMul??1; a.arc+=d.arcAdd??0;
}
function mergeById<T extends {id:string}>(items:Map<string,T>,more:readonly T[]):void {
 for(const item of more) items.set(item.id,item);
}
/** Read-only projection for HUD; never used to execute an attack. */
export function resolveHUDTower(def:TowerDef,tiers:Tiers):ResolvedTower {
 if(!legalTiers(tiers)) throw new Error('Illegal tower tiers');
 const main=PATHS.reduce((best,p)=>tiers[p]>tiers[best]?p:best,0 as PathIndex);
 const active=PATHS.flatMap(p=>def.paths[p].upgrades.filter(u=>u.tier<=tiers[p]).sort((a,b)=>a.tier-b.tier));
 const primary=def.paths[main].upgrades.filter(u=>u.tier<=tiers[main]).sort((a,b)=>a.tier-b.tier);
 const replacement=primary.filter(u=>u.tier>=3&&u.replaceAttack).at(-1)?.replaceAttack;
 const base=replacement??def.attack;
 const attack:AttackDef={...base,statuses:base.statuses.map(s=>({...s}))};
 const effects=new Map<string,EffectDef>(); const abilities=new Map<string,AbilityDef>();
 mergeById(effects,def.effects); mergeById(abilities,def.abilities);
 for(const u of active) {
  deltaAttack(attack,u.delta);
  for(const status of u.addStatuses??[]) {
   const previous=attack.statuses.findIndex(s=>s.kind===status.kind);
   if(previous<0) attack.statuses.push({...status});
   else attack.statuses[previous]={...status};
  }
  mergeById(effects,u.effects??[]); mergeById(abilities,u.abilities??[]);
 }
 const secondary=PATHS.find(p=>p!==main&&tiers[p]>0);
 return {attack,effects:[...effects.values()],abilities:[...abilities.values()],
  visual:primary.at(-1)?.visual??def.visual,
  ...(tiers[main]>0?{mainPath:main}:{}),
  ...(secondary!==undefined?{secondaryOverlay:towerAsset(def.id,LETTERS[secondary].toLowerCase()+tiers[secondary]+'-overlay.svg')}:{})};
}
function discountSources(config:GameConfig,state:GameState,exclude?:string) {
 const sources:{pos:TowerState['pos'];radius:number;power:number}[]=[];
 for(const tower of state.towers) {
  if(tower.id===exclude||!legalTiers(tower.tiers)) continue;
  const def=config.towers.find(d=>d.id===tower.defId); if(!def) continue;
  for(const e of resolveHUDTower(def,tower.tiers).effects)
   if(e.kind==='aura'&&e.stat==='discount'&&e.power>0&&e.radius>0)
    sources.push({pos:tower.pos,radius:e.radius,power:e.power});
 }
 return sources;
}
// Avoid an extra credit caused solely by IEEE-754 noise at an integer boundary.
function creditCeil(value:number):number {return Math.max(1,Math.ceil(value-Number.EPSILON*Math.max(1,Math.abs(value))*4));}
export function hudPrice(config:GameConfig,state:GameState,base:number,tower?:TowerState):number {
 const knowledge=state.rules.allowKnowledge?Math.max(0,config.knowledgeDiscount):0;
 const support=tower?Math.max(0,...discountSources(config,state,tower.id)
  .filter(e=>Math.hypot(e.pos.x-tower.pos.x,e.pos.y-tower.pos.y)<=e.radius).map(e=>e.power)):0;
 return creditCeil(base*state.rules.towerCostMul*(1-Math.min(.2,knowledge+Math.min(.15,support))));
}
function placementPrice(config:GameConfig,state:GameState,base:number):[number,number] {
 const max=hudPrice(config,state,base);
 const support=Math.min(.15,Math.max(0,...discountSources(config,state).map(s=>s.power)));
 const knowledge=state.rules.allowKnowledge?Math.max(0,config.knowledgeDiscount):0;
 return [creditCeil(base*state.rules.towerCostMul*(1-Math.min(.2,knowledge+support))),max];
}
export function upgradeBlock(state:GameState,tower:TowerState,path:PathIndex,actor?:string):string {
 if(state.phase==='victory'||state.phase==='defeat')return 'ended';
 if(actor!==undefined&&tower.owner!==actor)return 'owner';
 const tier=tower.tiers[path]+1;
 if(tier>5)return 'complete';
 if(tier>state.rules.maxTier)return 'modeTier';
 if(!canUpgrade(tower.tiers,path))return 'crosspath';
 if(tier===5&&state.towers.some(t=>t.id!==tower.id&&t.defId===tower.defId&&t.tiers[path]===5))return 'teamTier';
 return '';
}

type Pending={command:GameCommand;before:string;requestId?:string};
export interface HUDWithResults extends HUD {
 /** Optional app adapter: route a correlated authoritative result here. */
 settle(requestId:string,result:CommandResult):void;
}
function observable(state:GameState,c:GameCommand):string {
 switch(c.type){
  case 'upgrade':return String(state.towers.find(t=>t.id===c.tower)?.tiers[c.path]);
  case 'sell':return String(state.towers.some(t=>t.id===c.tower));
  case 'target':return String(state.towers.find(t=>t.id===c.tower)?.targeting);
  case 'ability':return String((state.towers.find(t=>t.id===c.tower)?.abilityCooldowns[c.ability]??0)>0);
  case 'startWave':return state.phase+':'+state.wave;
  case 'speed':return String(state.speed);
  case 'pause':return String(state.paused);
  case 'autoStart':return String(state.autoStart);
  case 'place':return String(state.towers.length);
 }
}
function node<K extends keyof HTMLElementTagNameMap>(doc:Document,tag:K,cls='',text=''):HTMLElementTagNameMap[K] {
 const n=doc.createElement(tag); if(cls)n.className=cls; if(text)n.textContent=text; return n;
}
/** Preserve live nodes, keyboard focus and scroll when snapshots change. */
function reconcile(target:HTMLElement,source:HTMLElement):void {
 for(const attr of Array.from(target.attributes)) if(!source.hasAttribute(attr.name))target.removeAttribute(attr.name);
 for(const attr of Array.from(source.attributes)) if(target.getAttribute(attr.name)!==attr.value)target.setAttribute(attr.name,attr.value);
 const desired=Array.from(source.childNodes);
 for(let i=0;i<desired.length;i++){
  const fresh=desired[i]; let old=target.childNodes[i];
  const key=fresh instanceof HTMLElement?fresh.dataset.key:undefined;
  if(key&&(!(old instanceof HTMLElement)||old.dataset.key!==key)){
   const found=Array.from(target.children).find(n=>n instanceof HTMLElement&&n.dataset.key===key&&n.tagName===(fresh as HTMLElement).tagName);
   if(found){target.insertBefore(found,old??null);old=found;}
   else {target.insertBefore(fresh.cloneNode(true),old??null);continue;}
  }
  if(!old){target.appendChild(fresh.cloneNode(true));continue;}
  if(old instanceof HTMLElement&&fresh instanceof HTMLElement&&old.tagName===fresh.tagName&&old.dataset.key===fresh.dataset.key)reconcile(old,fresh);
  else if(old.nodeType===3&&fresh.nodeType===3){if(old.nodeValue!==fresh.nodeValue)old.nodeValue=fresh.nodeValue;}
  else target.replaceChild(fresh.cloneNode(true),old);
 }
 while(target.childNodes.length>desired.length)target.lastChild?.remove();
}

export function createHUD(root:HTMLElement,config:GameConfig,hooks:UIHooks,locale?:LocaleCatalog):HUDWithResults {
 const doc=root.ownerDocument;
 const tr=(key:string,fallback:string,vars?:Record<string,string|number>)=>{
  const value=locale?.text('hud.'+key,vars); return !value||value===key||value==='hud.'+key?fallback:value;
 };
 const view=node(doc,'div','pb-hud'); root.append(view);
 const notice=node(doc,'div','pb-hud-notice'); notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite');root.append(notice);
 let state:GameState|undefined, selected:string|null=null, placing:string|null=null;
 let query='',category='all',tab:'shop'|'tower'='shop',disposed=false,signature='',runId='';
 const pending=new Map<string,Pending>();
 let actions=new Map<string,{run:()=>void;reason:string}>();
 const reasons:Record<string,string>={ended:'Забег завершён',owner:'Только владелец постройки',complete:'Максимальная ступень',modeTier:'Ограничение ступени в этом режиме',crosspath:'Не более двух веток и только одна выше T2',teamTier:'Этот T5 уже построен командой',locked:'Технология закрыта сюжетом',limit:'Достигнут лимит построек',host:'Только хост управляет боем',noSell:'Продажа запрещена режимом',noAbilities:'Способности запрещены режимом',noIncome:'Денежные способности запрещены режимом',oneLife:'В режиме одной жизни восстановление недоступно',cooldown:'Способность восстанавливается',waiting:'Ожидаем подтверждение',previous:'Сначала купите предыдущую ступень',running:'Волна уже идёт',same:'Уже выбрано'};
 const reasonText=(key:string)=>tr('reason.'+key,reasons[key]??key);
 const tell=(s:string)=>{if(!disposed)notice.textContent=s;};
 const coop=()=>Boolean(state&&state.options.players.length>1);
 const actor=()=>hooks.playerId??(coop()?'':undefined);
 const hostBlock=()=>coop()&&hooks.isHost!==true?'host':'';
 const ended=()=>state?.phase==='victory'||state?.phase==='defeat'?'ended':'';
 const foreign=(t:TowerState)=>actor()!==undefined&&t.owner!==actor()?'owner':'';
 const send=(key:string,command:GameCommand)=>{
  if(!state||disposed||pending.has(key))return;
  const before=observable(state,command);
  // Reserve before invoking the hook, including a reentrant update.
  pending.set(key,{command,before});
  try {
   const result=hooks.command({...command,...(hooks.playerId?{actor:hooks.playerId}:{})});
   if(!result.ok&&!result.pending){pending.delete(key);tell(result.reason??tr('rejected','Команда отклонена'));}
   else {
    const entry=pending.get(key); if(entry)entry.requestId=result.requestId;
    if(result.pending)tell(tr('pending','Команда отправлена. Ожидание хоста.'));
    if(state&&observable(state,command)!==before)pending.delete(key);
   }
  } catch(error){pending.delete(key);tell(error instanceof Error?error.message:String(error));}
  draw(true);
 };
 const keyed=<T extends HTMLElement>(n:T,key:string):T=>{n.dataset.key=key;return n;};
 const add=(parent:HTMLElement,tag:'div'|'span'|'p'|'h2'|'h3'|'strong',cls:string,text:string,key?:string)=>{
  const el=node(doc,tag,cls,text); if(key)keyed(el,key);parent.append(el);return el;
 };
 const button=(parent:HTMLElement,key:string,label:string,run:()=>void,block='',cls='')=>{
  const b=keyed(node(doc,'button','pb-hud-button '+cls,label),key);b.type='button';b.dataset.action=key;
  const reasonKey=block|| (pending.has(key)?'waiting':'');
  const reason=reasonKey?reasonText(reasonKey):'';
  b.setAttribute('aria-disabled',String(Boolean(reason)));if(reason)b.title=reason;
  actions.set(key,{run,reason}); parent.append(b);return b;
 };
 const command=(parent:HTMLElement,key:string,label:string,c:GameCommand,block='',cls='')=>button(parent,key,label,()=>send(key,c),block,cls);
 const image=(parent:HTMLElement,id:string,asset:string,overlay?:string)=>{
  const wrap=node(doc,'span','pb-hud-art');
  const url=(a:string)=> (doc.location?.protocol==='file:'?'.':'')+towerAsset(id,a);
  const img=node(doc,'img');img.src=url(asset);img.alt='';img.draggable=false;wrap.append(img);
  if(overlay){const extra=node(doc,'img','pb-hud-overlay');extra.src=url(overlay);extra.alt='';extra.draggable=false;wrap.append(extra);}
  parent.append(wrap);return wrap;
 };
 const lockedStory=(d:TowerDef)=>{
  const campaign=config.campaign.find(n=>n.unlocks.includes(d.id));
  const map=campaign&&config.maps.find(m=>m.id===campaign.mapId);
  return tr('unlock','Восстановите: '+(map?.name??campaign?.title??storyNames[d.id]??d.name),{map:map?.name??campaign?.title??storyNames[d.id]??d.name});
 };
 const short=(a:AttackDef)=>tr('attackStats','Урон '+fmt(a.damage)+' · '+fmt(a.interval)+' с · Радиус '+fmt(a.range),{damage:fmt(a.damage),interval:fmt(a.interval),range:fmt(a.range)});
 function draw(force=false):void {
  if(!state||disposed)return;
  const s=state;
  const tower=s.towers.find(t=>t.id===selected);
  const def=tower&&config.towers.find(d=>d.id===tower.defId);
  const map=config.maps.find(m=>m.id===s.options.mapId);
  const number=s.phase==='build'?s.wave+1:s.wave;
  const nextNumber=s.phase==='wave'?s.wave+1:number;
  const getWave=(n:number)=>{
   const base=config.waves.find(w=>w.number===n);
   const override=map?.waveOverrides[n];
   return base?{...base,...override}:undefined;
  };
  const current=getWave(number),next=getWave(nextNumber);
  const bosses=s.enemies.filter(e=>config.enemies.find(d=>d.id===e.defId)?.boss);
  const bossSummary=bosses.map(e=>[e.id,Math.round(e.hp/Math.max(1,e.maxHp)*100),Math.round(e.shield),e.defId]);
  const stamp=JSON.stringify([s.options.runId,s.options.unlockedTowers,s.options.players,s.phase,s.wave,s.paused,s.speed,s.autoStart,s.credits,s.lives,s.rules,selected,placing,query,category,tab,[...pending.keys()],
   s.towers.map(t=>[t.id,t.defId,t.owner,t.pos,t.tiers,t.targeting,t.invested]),
   tower&&Object.entries(tower.abilityCooldowns).map(([k,v])=>[k,Math.ceil(v*10)]),bossSummary,tr('shop','Постройки')]);
  if(!force&&stamp===signature)return;signature=stamp;
  actions=new Map();
  const fresh=node(doc,'div','pb-hud');
  const top=keyed(node(doc,'header','pb-hud-top'),'top');fresh.append(top);
  const resources=node(doc,'div','pb-hud-resources');top.append(resources);
  add(resources,'strong','pb-hud-credit','◆ '+money(s.credits));
  add(resources,'span','pb-hud-muted',coop()?tr('shared','Общий кошелёк'):tr('credits','Кредиты'));
  add(resources,'strong','pb-hud-lives','♥ '+money(s.lives)+' / '+money(s.rules.maxLives));
  const threat=node(doc,'div','pb-hud-threat');top.append(threat);
  add(threat,'strong','',tr('wave','Волна '+(s.options.endless?number:Math.min(number,s.rules.rounds))+' / '+s.rules.rounds,{wave:number,total:s.rules.rounds}));
  const nextBoss=next?.boss?config.enemies.find(e=>e.id===next.boss):undefined;
  const threatText=nextNumber>s.rules.rounds&&!s.options.endless?tr('lastWave','Последняя волна'):
   (s.phase==='wave'?tr('next','Далее: '):tr('threat','Угроза: '))+(nextBoss?.name??next?.preview??tr('unknownThreat','Нет данных о следующей волне'));
  add(threat,'span',nextBoss?'pb-hud-boss-alert':'pb-hud-muted',threatText).title=threatText;
  const controls=node(doc,'div','pb-hud-controls');top.append(controls);
  command(controls,'speed1','1×',{type:'speed',value:1},ended()||hostBlock(),s.speed===1?'is-active':'');
  command(controls,'speed2','2×',{type:'speed',value:2},ended()||hostBlock(),s.speed===2?'is-active':'');
  command(controls,'speed3','3×',{type:'speed',value:3},ended()||hostBlock(),s.speed===3?'is-active':'');
  command(controls,'pause',s.paused?tr('resume','Продолжить'):tr('pause','Пауза'),{type:'pause',value:!s.paused},ended()||hostBlock());
  command(controls,'start',tr('start','Старт'),{type:'startWave'},ended()||(s.phase!=='build'?'running':''));
  command(controls,'auto',tr('auto','Авто')+(s.autoStart?' ✓':''),{type:'autoStart',value:!s.autoStart},ended()||hostBlock(),s.autoStart?'is-active':'');
  button(controls,'exit',tr('exit','Выход'),hooks.exit);
  const side=keyed(node(doc,'aside','pb-hud-side'),'side');fresh.append(side);
  const tabs=keyed(node(doc,'div','pb-hud-tabs'),'tabs');side.append(tabs);
  button(tabs,'shopTab',tr('shop','Постройки'),()=>{tab='shop';draw(true);},'',tab==='shop'?'is-active':'');
  button(tabs,'towerTab',tr('selected','Выбранная'),()=>{tab='tower';draw(true);},tower?'':'—',tab==='tower'?'is-active':'');
  if(placing){
   const strip=keyed(node(doc,'div','pb-hud-placement'),'placement');side.append(strip);
   add(strip,'span','',tr('placing','Размещение: ')+(config.towers.find(d=>d.id===placing)?.name??placing));
   button(strip,'cancelPlace',tr('cancel','Отмена'),()=>hooks.chooseTower(null));
  }
  if(bosses.length){
   const block=keyed(node(doc,'div','pb-hud-boss'),'bosses');side.append(block);
   for(const enemy of bosses){
    const d=config.enemies.find(e=>e.id===enemy.defId)!;
    const line=keyed(node(doc,'div','pb-hud-boss-line'),enemy.id);block.append(line);
    const percent=Math.max(0,Math.min(100,Math.round(enemy.hp/Math.max(1,enemy.maxHp)*100)));
    add(line,'strong','',d.name+' · '+percent+'%'+(enemy.shield>0?' · '+tr('shield','Щит')+' '+money(enemy.shield):''));
    const bar=node(doc,'progress');bar.max=100;bar.value=percent;bar.setAttribute('aria-label',d.name);line.append(bar);
    add(line,'span','pb-hud-muted',tr('phase','Фаза')+' '+(1+(d.boss?.phases.filter(p=>enemy.hp/enemy.maxHp<=p.atHealth).length??0)));
   }
  } else if(current?.boss&&s.phase==='wave')add(side,'p','pb-hud-boss-alert',tr('bossWave','Волна босса'),'bossWaiting');
  const body=keyed(node(doc,'div','pb-hud-body'),tab);side.append(body);
  if(tab==='shop'||!tower||!def){
   const filters=node(doc,'div','pb-hud-filters');body.append(filters);
   const search=keyed(node(doc,'input','pb-hud-search'),'search');search.type='search';search.value=query;search.setAttribute('value',query);search.placeholder=tr('search','Поиск построек');search.setAttribute('aria-label',search.placeholder);filters.append(search);
   const categories=node(doc,'div','pb-hud-categories');filters.append(categories);
   for(const c of ['all',...CATEGORIES] as const)button(categories,'cat-'+c,c==='all'?tr('all','Все'):tr('category.'+c,categoryNames[c]),()=>{category=c;draw(true);},'',category===c?'is-active':'');
   let visible=0;
   for(const c of CATEGORIES){
    if(category!=='all'&&c!==category)continue;
    const defs=config.towers.filter(d=>d.category===c&&[d.id,d.name,d.description].some(v=>v.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
    if(!defs.length)continue;visible+=defs.length;
    const section=keyed(node(doc,'section','pb-hud-category'),c);body.append(section);
    add(section,'h3','',tr('category.'+c,categoryNames[c]));
    const cards=node(doc,'div','pb-hud-cards');section.append(cards);
    for(const d of defs){
     const [lo,hi]=placementPrice(config,s,d.cost);
     const unlocked=s.options.unlockedTowers.includes(d.id);
     const block=ended()||(!unlocked?'locked':s.towers.length>=s.rules.maxTowers?'limit':s.credits<lo?tr('missing','Не хватает '+money(lo-s.credits),{amount:lo-s.credits}):'');
     const card=button(cards,'buy-'+d.id,'',()=>hooks.chooseTower(placing===d.id?null:d.id),block,'pb-hud-card'+(placing===d.id?' is-active':'')+(!unlocked?' is-locked':''));
     image(card,d.id,d.visual.asset);
     add(card,'strong','pb-hud-card-name',(!unlocked?'🔒 ':'')+d.name);
     add(card,'span','pb-hud-card-price',money(lo)+(hi!==lo?'–'+money(hi):'')+' ◆');
     add(card,'span','pb-hud-muted',!unlocked?lockedStory(d):block?reasonText(block):d.placement==='water'?tr('water','Вода'):d.placement==='either'?tr('either','Суша / вода'):tr('land','Суша'));
     card.title=[d.description,card.title,!unlocked?lockedStory(d):hi!==lo?tr('placementDiscount','Цена зависит от места установки'):''].filter(Boolean).join(' · ');
    }
   }
   if(!visible)add(body,'p','pb-hud-muted',tr('empty','Ничего не найдено'));
   add(body,'p','pb-hud-muted',tr('placementHint','Выберите постройку, затем точку на поле. Esc — отмена.'));
  } else {
   const model=legalTiers(tower.tiers)?resolveHUDTower(def,tower.tiers):undefined;
   const head=node(doc,'div','pb-hud-tower-head');body.append(head);
   image(head,def.id,model?.visual.asset??def.visual.asset,model?.secondaryOverlay);
   const identity=node(doc,'div');head.append(identity);
   add(identity,'h2','',def.name);
   add(identity,'strong','pb-hud-tier-code',tower.tiers.join('–'));
   const owner=s.options.players.find(p=>p.id===tower.owner);
   if(coop()){
    const line=add(identity,'span','pb-hud-owner',tr('owner','Владелец')+': '+(owner?.name??tower.owner));
    if(owner&&/^#[\da-f]{3,8}$/i.test(owner.color))line.style.borderInlineStartColor=owner.color;
   }
   button(head,'deselect','×',()=>hooks.select(null),'','pb-hud-close').setAttribute('aria-label',tr('deselect','Снять выбор'));
   add(body,'p','pb-hud-muted',def.description);
   if(model)add(body,'p','pb-hud-stat',short(model.attack));
   if(!model)add(body,'p','pb-hud-boss-alert',tr('invalidTiers','Недопустимая комбинация улучшений'));
   const finances=node(doc,'div','pb-hud-finances');body.append(finances);
   add(finances,'span','',tr('invested','Вложено')+' '+money(tower.invested)+' ◆');
   const refund=tower.invested>0&&Number.isSafeInteger(tower.invested)?sellRefund(tower.invested):0;
   command(finances,'sell-'+tower.id,tr('sell','Продать')+' '+money(refund)+' ◆',{type:'sell',tower:tower.id},ended()||foreign(tower)||(!s.rules.sellAllowed?'noSell':''),'pb-hud-sell');
   if(!s.rules.sellAllowed||foreign(tower))add(finances,'span','pb-hud-muted',reasonText(!s.rules.sellAllowed?'noSell':foreign(tower)));
   const targeting=node(doc,'div','pb-hud-targets');body.append(targeting);
   add(targeting,'span','pb-hud-muted',tr('target','Приоритет'));
   for(const target of TARGETS)command(targeting,'target-'+tower.id+'-'+target,tr('target.'+target,targetNames[target]),{type:'target',tower:tower.id,targeting:target},ended()||foreign(tower)||(tower.targeting===target?'same':''),tower.targeting===target?'is-active':'');
   const tree=keyed(node(doc,'div','pb-hud-tree'),'tree');body.append(tree);
   for(const p of PATHS){
    const row=keyed(node(doc,'section','pb-hud-path'),'path-'+p);tree.append(row);
    const path=def.paths[p];
    add(row,'h3','',LETTERS[p]+' · '+path.name);
    const tiles=node(doc,'div','pb-hud-tiles');row.append(tiles);
    const nextTier=tower.tiers[p]+1;
    const structural=upgradeBlock(s,tower,p,actor());
    for(let tier=1;tier<=5;tier++){
     const u=path.upgrades.find(u=>u.tier===tier);
     const purchased=tier<=tower.tiers[p];const price=u?hudPrice(config,s,u.cost,tower):0;
     const block=purchased?'same':!u?'Нет данных улучшения':tier!==nextTier?'previous':structural|| (s.credits<price?tr('missing','Не хватает '+money(price-s.credits),{amount:price-s.credits}):'');
     const key='upgrade-'+tower.id+'-'+p+'-'+tier;
     const tile=command(tiles,key,'',{type:'upgrade',tower:tower.id,path:p},block,'pb-hud-tile'+(purchased?' is-owned':'')+(tier===nextTier?' is-next':''));
     if(u)image(tile,def.id,u.visual.asset);
     add(tile,'span','', 'T'+tier+(purchased?' ✓':''));
     add(tile,'span','pb-hud-tile-price',purchased?'—':money(price));
     tile.setAttribute('aria-label',LETTERS[p]+' T'+tier+' '+(u?.name??'')+' '+(purchased?tr('purchased','Куплено'):money(price)));
     tile.title=[u?.name,u?.description,block?reasonText(block):''].filter(Boolean).join(' · ');
    }
    const u=path.upgrades.find(u=>u.tier===nextTier);
    if(u){
     const price=hudPrice(config,s,u.cost,tower);
     add(row,'strong','pb-hud-next',u.name+' · '+money(price)+' ◆');
     add(row,'p','pb-hud-muted',u.description);
     if(model&&!structural&&legalTiers(nextTiers(tower.tiers,p))){
      const future=resolveHUDTower(def,nextTiers(tower.tiers,p));
      const stats:[string,number,number][]=[['Урон',model.attack.damage,future.attack.damage],['Интервал',model.attack.interval,future.attack.interval],['Дальность',model.attack.range,future.attack.range],['Пробитие',model.attack.pierce,future.attack.pierce],['Выстрелы',model.attack.count,future.attack.count],['Взрыв',model.attack.splash,future.attack.splash],['Цепь',model.attack.chains,future.attack.chains],['Бронепробитие',model.attack.armorPierce,future.attack.armorPierce],['Щиты ×',model.attack.shieldMultiplier,future.attack.shieldMultiplier],['Босс ×',model.attack.bossMultiplier,future.attack.bossMultiplier]];
      const changes=stats.filter(([,a,b])=>a!==b).map(([label,a,b])=>label+' '+fmt(a)+' → '+fmt(b));
      if(future.attack.mode!==model.attack.mode)changes.push(tr('attackChange','Тип атаки изменится'));
      if(future.attack.detects&&!model.attack.detects)changes.push(tr('detect','Обнаружение скрытых'));
      for(const e of future.effects){
       const old=model.effects.find(x=>x.id===e.id);
       if(JSON.stringify(old)===JSON.stringify(e))continue;
       if(e.kind==='barrier'&&s.rules.maxLives===1){changes.push(reasonText('oneLife'));continue;}
       if(['income','interest','harvest'].includes(e.kind)&&!s.rules.allowPassiveIncome){changes.push(reasonText('noIncome'));continue;}
       changes.push((e.stat??e.kind)+': '+fmt(old?.power??0)+' → '+fmt(e.power));
      }
      if(changes.length)add(row,'p','pb-hud-preview',changes.join(' · '));
      add(row,'p','pb-hud-muted',s.rules.sellAllowed?tr('futureRefund','После покупки возврат')+' '+money(sellRefund(tower.invested+price))+' ◆':reasonText('noSell'));
     }
     if(structural)add(row,'p','pb-hud-block',reasonText(structural));
     else if(s.credits<price)add(row,'p','pb-hud-block',tr('missing','Не хватает '+money(price-s.credits),{amount:price-s.credits}));
    }else add(row,'p','pb-hud-muted',reasonText('complete'));
   }
   const abilities=node(doc,'section','pb-hud-abilities');body.append(abilities);
   add(abilities,'h3','',tr('abilities','Способности'));
   if(!model?.abilities.length)add(abilities,'p','pb-hud-muted',tr('noUnlockedAbilities','Нет открытых способностей'));
   for(const ability of model?.abilities??[]){
    const remaining=Math.max(0,tower.abilityCooldowns[ability.id]??0);
    const block=ended()||foreign(tower)||(!s.rules.allowAbilities?'noAbilities':ability.kind==='mint'&&!s.rules.allowPassiveIncome?'noIncome':ability.kind==='barrier'&&s.rules.maxLives===1?'oneLife':remaining>0?'cooldown':'');
    const b=command(abilities,'ability-'+tower.id+'-'+ability.id,ability.name+' · '+(remaining>0?Math.ceil(remaining*10)/10+' с':tr('ready','Готово')),{type:'ability',tower:tower.id,ability:ability.id},block);
    b.title=[ability.description,b.title].filter(Boolean).join(' · ');
    if(block)add(abilities,'span','pb-hud-muted',reasonText(block));
   }
   if(s.rules.maxLives===1&&model?.effects.some(e=>e.kind==='barrier'))add(body,'p','pb-hud-block',reasonText('oneLife'));
  }
  reconcile(view,fresh);
 }
 function click(event:MouseEvent){
  const el=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button[data-action]'):null;
  if(!el||!view.contains(el))return;
  event.preventDefault();event.stopPropagation();
  const action=actions.get(el.dataset.action??'');if(!action)return;
  if(action.reason){tell(action.reason);return;}action.run();
 }
 function input(event:Event){
  if(event.target instanceof HTMLInputElement&&event.target.dataset.key==='search'){query=event.target.value;draw(true);}
 }
 function pointer(event:PointerEvent){if(event.target instanceof Element&&event.target.closest('.pb-hud-side,.pb-hud-top'))event.stopPropagation();}
 function keydown(event:KeyboardEvent){
  if(disposed||!state||event.defaultPrevented||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
  const target=event.target;
  if(target instanceof HTMLElement&&(target.isContentEditable||target.closest('[role=dialog]')))return;
  if(target instanceof HTMLElement&&target.closest('input,textarea,select')&&event.key!=='Escape')return;
  if(target instanceof HTMLElement&&!view.contains(target)&&target!==doc.body&&target.tagName!=='CANVAS'&&target!==root)return;
  if(event.key==='Escape'){
   event.preventDefault();if(placing)hooks.chooseTower(null);else if(selected)hooks.select(null);return;
  }
  if(target instanceof HTMLElement&&target.closest('button')&&(event.key===' '||event.key==='Enter'))return;
  const key=event.key===' '?state.phase==='build'?'start':'pause':/^[123]$/.test(event.key)?'speed'+event.key:'';
  const action=actions.get(key);if(!action)return;event.preventDefault();if(action.reason)tell(action.reason);else action.run();
 }
 view.addEventListener('click',click);view.addEventListener('input',input);view.addEventListener('pointerdown',pointer);doc.addEventListener('keydown',keydown);
 return {
  update(snapshot,selection,placement){
   if(disposed)return;
   if(runId!==snapshot.options.runId){runId=snapshot.options.runId;pending.clear();notice.textContent='';}
   for(const [key,p] of pending)if(observable(snapshot,p.command)!==p.before)pending.delete(key);
   if(selection!==selected)tab=selection?'tower':'shop';
   if(placement&&placement!==placing)tab='shop';
   state=snapshot;selected=selection;placing=placement;draw();
  },
  notify:tell,
  settle(requestId,result){
   if(disposed)return;
   const match=[...pending].find(([,p])=>p.requestId===requestId);
   if(!match)return;
   if(!result.ok&&!result.pending){pending.delete(match[0]);tell(result.reason??tr('rejected','Команда отклонена'));}
   // Successful result alone does not unlock until its observable snapshot arrives.
   draw(true);
  },
  dispose(){if(disposed)return;disposed=true;pending.clear();actions.clear();view.removeEventListener('click',click);view.removeEventListener('input',input);view.removeEventListener('pointerdown',pointer);doc.removeEventListener('keydown',keydown);view.remove();notice.remove();}
 };
}
