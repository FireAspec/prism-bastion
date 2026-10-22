import type {AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ART = '/art/towers/rail/';
function visual(id:string, accent:string, projectile:string, motion:VisualState['motion']='rotate', glow=0.4):VisualState {
 return {asset:`${ART}${id}.svg`,accent,muzzle:'rail-capacitor-flash',projectile,impact:'rail-crystal-fracture',scale:1,glow,motion};
}
const baseAttack:AttackDef = {
 mode:'shot',element:'kinetic',damage:100,interval:2.8,range:290,pierce:1,count:1,splash:0,chains:0,chainRadius:0,
 detects:false,armorPierce:8,shieldMultiplier:1,bossMultiplier:1.15,executeBelow:0,push:0,statuses:[],
 projectileSpeed:1050,projectileRadius:4.5,homing:false,windup:0.24,arc:0,
};
function attack(patch:Partial<AttackDef>):AttackDef {
 return {...baseAttack,...patch,statuses:patch.statuses?.map(s=>({...s}))??[]};
}
function charge(power:number,cap:number,duration:number):EffectDef {
 return {id:'rail-stored-charge',kind:'charge',power,cap,duration,radius:0,interval:0};
}
function focus(power:number,cap:number):EffectDef {
 return {id:'rail-target-lock',kind:'focus',power,cap,duration:0,radius:0,interval:0};
}
type Step=Omit<UpgradeDef,'tier'|'visual'> & {projectile?:string;glow?:number};
function upgrades(path:'a'|'b'|'c',entries:[Step,Step,Step,Step,Step]):UpgradeDef[] {
 const colors={a:'#ffd28b',b:'#72f8eb',c:'#dcacff'};
 return entries.map((entry,index)=>{
  const {projectile,glow,...data}=entry;
  return {...data,tier:(index+1) as UpgradeDef['tier'],visual:visual(`${path}${index+1}`,colors[path],projectile??`${path}-rail-slug`,index===4?'pulse':'rotate',glow??0.25+index*0.16)};
 });
}
const a=upgrades('a',[
 {id:'rail-a1-stabilizers',name:'Гиростабилизаторы',cost:550,
  description:'Урон ×1,16, дальность ×1,06, скорость снаряда ×1,30.',
  delta:{damageMul:1.16,rangeMul:1.06,projectileSpeedMul:1.3}},
 {id:'rail-a2-magnetic-injector',name:'Магнитный инжектор',cost:1095,
  description:'+14 пробития брони, урон щитам ×1,18, подготовка выстрела короче на 20%.',
  delta:{armorPierceAdd:14,shieldMultiplierMul:1.18,windupMul:0.8}},
 {id:'rail-a3-capacitor',name:'Банк накопителей',cost:2735,
  description:'Снаряд с уроном 220 раз в 3,8 с; ×1,55 по боссам. Заряд за 4,8 с до ×1,75.',delta:{},
  replaceAttack:attack({damage:220,interval:3.8,range:305,armorPierce:28,bossMultiplier:1.55,projectileSpeed:1400,projectileRadius:5.8,windup:0.62}),
  effects:[charge(0.75,1.75,4.8)]},
 {id:'rail-a4-siege-bus',name:'Осадная шина',cost:6555,
  description:'Урон ×1,28, урон по боссам ×1,45; заряд до ×2,10 за 5,5 с.',
  delta:{damageMul:1.28,bossMultiplierMul:1.45},effects:[charge(1.1,2.1,5.5)]},
 {id:'rail-a5-last-argument',name:'Последний довод',cost:16390,
  description:'Три катушки. Одиночный 580-единичный залп раз в 5,2 с, ×4,2 по боссам, ×2,25 по щитам; заряд до ×2,65 за 8 с.',delta:{},
  replaceAttack:attack({damage:580,interval:5.2,range:365,armorPierce:72,shieldMultiplier:2.25,bossMultiplier:4.2,projectileSpeed:1900,projectileRadius:9,windup:1.05}),
  effects:[charge(1.65,2.65,8)],projectile:'a-singularity-bolt',glow:1.3},
]);
const b=upgrades('b',[
 {id:'rail-b1-long-coils',name:'Удлинённые катушки',cost:475,
  description:'Дальность ×1,14, скорость снаряда ×1,35.',delta:{rangeMul:1.14,projectileSpeedMul:1.35}},
 {id:'rail-b2-tungsten-core',name:'Вольфрамовое ядро',cost:950,
  description:'+2 пробиваемые цели и +10 пробития брони на линию выстрела.',delta:{pierceAdd:2,armorPierceAdd:10}},
 {id:'rail-b3-horizon',name:'Линия горизонта',cost:2375,
  description:'Энергетический луч: 105 урона раз в 2,35 с, шесть целей по одной прямой.',delta:{},
  replaceAttack:attack({mode:'beam',element:'energy',damage:105,interval:2.35,range:360,pierce:6,armorPierce:18,shieldMultiplier:1.22,projectileSpeed:0,projectileRadius:5,windup:0.32}),projectile:'b-horizon-beam'},
 {id:'rail-b4-phase-guide',name:'Фазовый волновод',cost:5700,
  description:'+5 пронзаемых целей, урон ×1,30, дальность ×1,18, интервал ×0,84.',
  delta:{pierceAdd:5,damageMul:1.3,rangeMul:1.18,intervalMul:0.84},projectile:'b-phase-lance'},
 {id:'rail-b5-three-horizons',name:'Три горизонта',cost:14250,
  description:'Три луча по 245 урона каждые 1,7 с, до 18 целей на луч, разрушение 16 брони на 3,2 с.',delta:{},
  replaceAttack:attack({mode:'beam',element:'energy',damage:245,interval:1.7,range:465,pierce:18,count:3,armorPierce:38,shieldMultiplier:1.4,projectileSpeed:0,projectileRadius:7,windup:0.44,
   statuses:[{kind:'shred',power:16,duration:3.2,maxStacks:1}]}),projectile:'b-triple-horizon',glow:1.25},
]);
const c=upgrades('c',[
 {id:'rail-c1-gyro-array',name:'Следящий кардан',cost:455,
  description:'Дальность ×1,10, скорость снаряда ×1,40.',delta:{rangeMul:1.1,projectileSpeedMul:1.4}},
 {id:'rail-c2-spectrum-eye',name:'Спектральное око',cost:905,
  description:'Обнаружение скрытых, ×1,12 урона по боссам и ×1,05 дальности.',
  delta:{detects:true,bossMultiplierMul:1.12,rangeMul:1.05}},
 {id:'rail-c3-seeker',name:'Искатель',cost:2260,
  description:'Самонаведение: 125 урона каждые 2,25 с; обнаружение и метка +10% входящего урона на 3,5 с.',delta:{},
  replaceAttack:attack({damage:125,interval:2.25,range:350,detects:true,homing:true,projectileSpeed:1450,bossMultiplier:1.4,armorPierce:20,windup:0.18,
   statuses:[{kind:'mark',power:0.1,duration:3.5,maxStacks:1},{kind:'reveal',power:1,duration:3.5,maxStacks:1}]}),
  effects:[focus(0.06,0.2)],projectile:'c-guided-dart'},
 {id:'rail-c4-threat-matrix',name:'Матрица угроз',cost:5415,
  description:'Интервал ×0,80, урон по боссам ×1,32, добивание обычных врагов ниже 10% HP; фокус до +40%.',
  delta:{intervalMul:0.8,bossMultiplierMul:1.32,executeBelowAdd:0.1},effects:[focus(0.1,0.4)],projectile:'c-guided-dart'},
 {id:'rail-c5-crown',name:'Корона искателя',cost:13540,
  description:'Два самонаводящихся болта по 250 урона каждые 1,25 с; обнаружение, метка, фокус до +60%.',delta:{},
  replaceAttack:attack({damage:250,interval:1.25,range:445,count:2,detects:true,homing:true,projectileSpeed:1900,projectileRadius:5.5,armorPierce:36,bossMultiplier:1.6,executeBelow:0.16,windup:0.16,
   statuses:[{kind:'mark',power:0.1,duration:5,maxStacks:1},{kind:'reveal',power:1,duration:5,maxStacks:1},{kind:'shred',power:9,duration:2.5,maxStacks:1}]}),
  effects:[focus(0.14,0.6)],projectile:'c-dual-tracker',glow:1.25},
]);

/** Returns an independent copy; repeated consumers cannot share mutable upgrades. */
export function getTower():TowerDef {
 return structuredClone({
  id:'rail',name:'Рельсотрон',description:'Дальнобойная магнитная пушка для точного залпа, продольного пробития или охоты на опасные цели.',
  category:'weapon',placement:'land',footprint:26,cost:950,attack:baseAttack,effects:[],abilities:[],
  visual:visual('base','#7cf9ed','rail-copper-slug','rotate',0.2),
  paths:[
   {id:'rail-a',name:'Последний довод',description:'Накопление сверхтяжёлого выстрела против боссов.',upgrades:a},
   {id:'rail-b',name:'Горизонт',description:'Длинные энергетические лучи через группы врагов.',upgrades:b},
   {id:'rail-c',name:'Искатель',description:'Обнаружение, метки, самонаведение и захват опасных целей.',upgrades:c},
  ],
 } satisfies TowerDef);
}
