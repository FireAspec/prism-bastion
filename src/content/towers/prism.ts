import type {AttackDef, EffectDef, StatDelta, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ROOT = '/art/towers/prism/';

function attack(changes:Partial<AttackDef> = {}):AttackDef {
 return {
  mode:'beam', element:'energy', damage:15, interval:0.3, range:185,
  pierce:1, count:1, splash:0, chains:0, chainRadius:0,
  detects:false, armorPierce:0, shieldMultiplier:1, bossMultiplier:1,
  executeBelow:0, push:0, statuses:[], projectileSpeed:0,
  projectileRadius:0, homing:false, windup:0, arc:0, ...changes,
 };
}

function visual(asset:string, accent:string, motion:VisualState['motion'], glow:number,
 projectile:string, impact:string, scale=1):VisualState {
 return {asset:`${ROOT}${asset}.svg`, accent, muzzle:'prism-aperture', projectile,
  impact, scale, glow, motion};
}

function aura(id:string, stat:NonNullable<EffectDef['stat']>, power:number, radius:number):EffectDef {
 return {id,kind:'aura',stat,power,radius,interval:0,duration:0,cap:0};
}

function focus(power:number, cap:number):EffectDef {
 return {id:'prism-focus',kind:'focus',power,cap,radius:0,interval:0,duration:0};
}

function upgrade(id:string, tier:UpgradeDef['tier'], name:string, description:string,
 cost:number, delta:StatDelta, accent:string, motion:VisualState['motion'],
 projectile:string, impact:string, extra:Partial<Pick<UpgradeDef,
 'replaceAttack'|'addStatuses'|'effects'|'abilities'>> = {}):UpgradeDef {
 return {id:`prism-${id}`,tier,name,description,cost,delta,
  visual:visual(id,accent,motion,tier===5?1.7:0.55+tier*0.18,projectile,impact),
  ...extra};
}

const tower:TowerDef = {
 id:'prism', name:'Призменный маяк',
 description:'Энергетический луч преломляется в системе линз. Белое солнце концентрирует урон, Спектр распределяет лучи, Оптический суд раскрывает и отмечает цели, усиливая соседей.',
 category:'element', cost:1100, footprint:26, placement:'land',
 attack:attack(), effects:[], abilities:[],
 visual:visual('base','#a9fff1','breathe',0.7,'prism-ray','prism-spark'),
 paths:[
  {
   id:'a', name:'Белое солнце', description:'Один сфокусированный луч, который усиливается при непрерывном облучении цели.',
   upgrades:[
    upgrade('a1',1,'Юстировка линзы','Урон луча ×1,15, дальность ×1,05.',605,
     {damageMul:1.15,rangeMul:1.05},'#f9ffff','breathe','prism-ray-white','prism-flash'),
    upgrade('a2',2,'Алмазный коллиматор','Интервал ×0,94, бронепробитие +3, урон боссам ×1,16.',1210,
     {intervalMul:0.94,armorPierceAdd:3,bossMultiplierMul:1.16},'#fff2c5','pulse','prism-ray-white','prism-flash'),
    upgrade('a3',3,'Солнечное горло','Сердечник: луч 32 ед. каждые 0,25 с; фокус +18% урона в секунду на прежней цели, максимум +90%.',3025,
     {},'#ffffff','pulse','prism-lance','prism-flare',
     {replaceAttack:attack({damage:32,interval:0.25}),effects:[focus(0.18,0.9)]}),
    upgrade('a4',4,'Корона сжатия','Урон ×1,45, урон щитам ×1,5; фокус +26%/с до +150%.',7260,
     {damageMul:1.45,shieldMultiplierMul:1.5},'#fff6dd','pulse','prism-lance','prism-corona',
     {effects:[focus(0.26,1.5)]}),
    upgrade('a5',5,'Белое солнце','Обелиск с единой гигантской линзой: луч 86 ед./0,18 с, фокус +35%/с до +210%; активная шестисекундная перегрузка темпа атаки (+35%, откат 70 с).',18150,
     {bossMultiplierMul:1.25},'#ffffff','pulse','prism-solar-column','prism-supernova',
     {replaceAttack:attack({damage:86,interval:0.18,shieldMultiplier:1.25}),
      effects:[focus(0.35,2.1)],
      abilities:[{id:'prism-white-overclock',name:'Вспышка белого солнца',
       description:'Перегрузка белой линзы: темп атаки +35% в течение 6 с.',
       kind:'overclock',power:0.35,duration:6,radius:0,cooldown:70,element:'energy'}]}),
   ],
  },
  {
   id:'b',name:'Спектр',description:'Несколько самостоятельных энергетических лучей с расширяющейся системой лепестков.',
   upgrades:[
    upgrade('b1',1,'Двойное преломление','+1 независимый луч (count), урон каждого луча ×0,94.',550,
     {countAdd:1,damageMul:0.94},'#50e9e3','rotate','prism-dual','prism-spark'),
    upgrade('b2',2,'Дисперсионная решётка','Дальность ×1,10, прямое пробитие +1 цель, урон щитам ×1,12.',1100,
     {rangeMul:1.1,pierceAdd:1,shieldMultiplierMul:1.12},'#e3ff83','rotate','prism-multiray','prism-spectrum-hit'),
    upgrade('b3',3,'Трёхцветный венец','Сердечник: два базовых луча по 24 ед./0,32 с (плюс луч от B1); широкая трёхлепестковая оптика.',2750,
     {},'#86d9ff','rotate','prism-triad','prism-spectrum-hit',
     {replaceAttack:attack({damage:24,interval:0.32,count:2})}),
    upgrade('b4',4,'Хроматическая мандала','Ещё +1 луч, урон каждого ×1,2, интервал ×0,9.',6600,
     {countAdd:1,damageMul:1.2,intervalMul:0.9},'#ff8ac5','rotate','prism-spectral-fan','prism-spectrum-burst'),
    upgrade('b5',5,'Семицветный венец','Раскрывает семь оптических лепестков: пять базовых лучей по 52 ед./0,28 с (итого 7 с B1 и B4); активная спектральная нова 155 ед., радиус 195, откат 60 с.',16500,
     {},'#ffe690','rotate','prism-sevenfold','prism-spectrum-nova',
     {replaceAttack:attack({damage:52,interval:0.28,count:5}),
      abilities:[{id:'prism-spectrum-nova',name:'Спектральная нова',
       description:'Энергетическая вспышка: 155 урона в радиусе 195.',
       kind:'nova',power:155,duration:0,radius:195,cooldown:60,element:'energy'}]}),
   ],
  },
  {
   id:'c',name:'Оптический суд',description:'Раскрывает скрытых врагов, отмечает цели и поддерживает союзные башни.',
   upgrades:[
    upgrade('c1',1,'Линза прозрения','Обнаруживает скрытых; луч раскрывает поражённую цель на 3 секунды.',525,
     {detects:true},'#6df5cb','orbit','prism-searchlight','prism-reveal',
     {addStatuses:[{kind:'reveal',power:1,duration:3}]}),
    upgrade('c2',2,'Печать виновности','Дальность ×1,1; луч помечает цель на 3,5 с (+10% входящего урона по общему правилу mark).',1045,
     {rangeMul:1.1},'#ffcf8b','orbit','prism-seal-ray','prism-mark',
     {addStatuses:[{kind:'mark',power:0.1,duration:3.5}]}),
    upgrade('c3',3,'Зал свидетельств','Сердечник: два луча по 20 ед./0,35 с; аура +12% урона союзникам в радиусе 175 и обнаружение скрытых для союзников в радиусе 190.',2615,
     {},'#7af6ea','orbit','prism-verdict','prism-mark',
     {replaceAttack:attack({damage:20,interval:0.35,count:2,detects:true}),
      effects:[aura('prism-judgment-damage','damage',0.12,175),aura('prism-judgment-detect','detect',1,190)]}),
    upgrade('c4',4,'Двойная инстанция','Аура +23% урона в радиусе 200 и +12% скорости атаки в радиусе 175; лучи пробивают +1 цель.',6270,
     {pierceAdd:1},'#ffdcab','orbit','prism-dual-verdict','prism-verdict-ring',
     {effects:[aura('prism-judgment-damage','damage',0.23,200),aura('prism-judgment-tempo','attackSpeed',0.12,175)]}),
    upgrade('c5',5,'Трибунал света','Три яруса вращающихся печатей; три базовых луча по 42 ед./0,3 с, ауры +36% урона (225) и +25% темпа (205), обнаружение (230); активная нова 90 ед. в радиусе 205 каждые 75 с.',15675,
     {},'#ffffff','orbit','prism-tribunal','prism-final-seal',
     {replaceAttack:attack({damage:42,interval:0.3,count:3,pierce:2,detects:true}),
      effects:[aura('prism-judgment-damage','damage',0.36,225),
       aura('prism-judgment-tempo','attackSpeed',0.25,205),
       aura('prism-judgment-detect','detect',1,230)],
      abilities:[{id:'prism-verdict-nova',name:'Приговор света',
       description:'Оптическая волна: 90 урона в радиусе 205.',
       kind:'nova',power:90,duration:0,radius:205,cooldown:75,element:'energy'}]}),
   ],
  },
 ],
};

/** Returns fresh content: resolving, balancing and save restoration cannot mutate the catalog. */
export function getTower():TowerDef {return structuredClone(tower);}
