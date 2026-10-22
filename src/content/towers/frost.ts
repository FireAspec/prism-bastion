import type {AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const root = '/art/towers/frost/';
const slow = (power:number,duration:number):StatusSpec => ({kind:'slow',power,duration});
const freeze = (duration:number):StatusSpec => ({kind:'freeze',power:1,duration});
const base:AttackDef = {
  mode:'shot',element:'frost',damage:5,interval:.9,range:155,pierce:1,count:1,splash:0,
  chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,
  executeBelow:0,push:0,statuses:[slow(.24,1.7)],projectileSpeed:370,projectileRadius:4,
  homing:true,windup:.08,arc:0,
};
const atk = (extra:Partial<AttackDef>):AttackDef => ({...base,...extra,statuses:(extra.statuses ?? base.statuses).map(s=>({...s}))});
const art = (name:string,color:string,motion:VisualState['motion'],projectile:string,impact:string,glow:number):VisualState => ({
  asset:`${root}${name}.svg`,accent:color,muzzle:'ice-flash',projectile,impact,scale:1,glow,motion,
});
const visuals = {
  a:[1,2,3,4,5].map(t=>art(`a${t}`,'#b6f9ff',t===5?'orbit':t>2?'breathe':'pulse',t===5?'palace-wave':'crystal-spike',t===5?'winter-nova':'snowflake-hit',.2+t*.12)),
  b:[1,2,3,4,5].map(t=>art(`b${t}`,'#8ce3ff',t===5?'breathe':t>2?'rotate':'pulse',t===5?'iceberg-barrage':'steel-shard',t===5?'glacier-break':'shard-split',.2+t*.12)),
  c:[1,2,3,4,5].map(t=>art(`c${t}`,'#c5f7f5',t>2?'orbit':'pulse',t===5?'polar-satellites':'rime-ring',t===5?'polar-front':'snow-wave',.2+t*.12)),
};
function up(path:'a'|'b'|'c',tier:1|2|3|4|5,name:string,description:string,cost:number,delta:StatDelta,
  extras:Partial<Pick<UpgradeDef,'replaceAttack'|'addStatuses'|'effects'|'abilities'>>={}):UpgradeDef {
  return {id:`frost-${path}${tier}`,name,description,cost,tier,delta,...extras,visual:{...visuals[path][tier-1]}};
}
const echo = (power:number,interval:number,cap:number):EffectDef => ({
  id:'frost-shard-echo',kind:'echo',power,radius:0,interval,duration:0,cap,element:'kinetic',
});

/** Returns independent nested content so a resolver cannot mutate the catalog. */
export function getTower():TowerDef {
  return {
    id:'frost',name:'Криокристалл',category:'element',cost:500,footprint:26,placement:'land',
    description:'Ледяные иглы замедляют врагов. Специализации: заморозка, разбивающие броню осколки и широкий холодный фронт.',
    attack:atk({}),effects:[],abilities:[],visual:art('base','#76e1fd','pulse','ice-dart','rime-burst',.18),
    paths:[
      {id:'frost-a',name:'Вечная зима',description:'Точный холод, жёсткий контроль и импульсы ледяного дворца.',upgrades:[
        up('a',1,'Иней на гранях','Замедление 32% на 2,1 с; дальность +8%.',225,{rangeMul:1.08},{addStatuses:[slow(.32,2.1)]}),
        up('a',2,'Снежный затвор','Интервал атак ×0,86; замедление сохраняется 2,5 с.',450,{intervalMul:.86},{addStatuses:[slow(.32,2.5)]}),
        up('a',3,'Печать стужи','Иглы: 8 урона, заморозка 0,32 с. Защита от повторного жёсткого контроля действует как обычно.',1125,{},
          {replaceAttack:atk({damage:8,interval:.82,range:175,projectileSpeed:410,projectileRadius:5,statuses:[slow(.38,2.5),freeze(.32)]})}),
        up('a',4,'Хоровод метелей','Ледяной взрыв радиусом 32: 10 урона каждые 0,78 с, заморозка 0,38 с.',2700,{},
          {replaceAttack:atk({mode:'splash',damage:10,interval:.78,range:185,splash:32,projectileSpeed:420,projectileRadius:6,statuses:[slow(.42,2.7),freeze(.38)]})}),
        up('a',5,'Дворец вечной зимы','Импульсы по зоне 205: 15 урона каждые 0,7 с, заморозка 0,45 с. Ручная «Корона зимы» бьёт по радиусу 240.',6750,{},
          {replaceAttack:atk({mode:'pulse',damage:15,interval:.7,range:205,projectileSpeed:0,projectileRadius:8,windup:0,statuses:[slow(.48,3),freeze(.45)]}),
            abilities:[{id:'frost-winter-crown',name:'Корона зимы',description:'100 урона в радиусе 240; перезарядка 48 с.',cooldown:48,kind:'nova',power:100,duration:0,radius:240,element:'frost'}]}),
      ]},
      {id:'frost-b',name:'Ледокол',description:'Кинетические осколки пробивают оболочки и ломают замедленные цели.',upgrades:[
        up('b',1,'Алмазное острие','Урон ×1,25, скорость снаряда ×1,25 и пробитие брони +1.',275,{damageMul:1.25,projectileSpeedMul:1.25,armorPierceAdd:1}),
        up('b',2,'Раздвоенный скол','Пробитие +1 цель; множитель урона по щиту ×1,15.',550,{pierceAdd:1,shieldMultiplierMul:1.15}),
        up('b',3,'Стальной ледник','Кинетические шипы: 13 урона, осколочный радиус 13, бронепробитие 3. По уже замедленным целям действует бонус +10%.',1375,{},
          {replaceAttack:atk({element:'kinetic',damage:13,interval:.92,range:168,splash:13,armorPierce:3,projectileSpeed:480,projectileRadius:5,statuses:[slow(.24,1.9)]})}),
        up('b',4,'Трещина полюса','20 урона и раскол радиусом 30; бронепробитие 5; эхо-атака 45% через 1,1 с, до 2 целей.',3300,{},
          {replaceAttack:atk({mode:'splash',element:'kinetic',damage:20,interval:.88,range:178,splash:30,armorPierce:5,shieldMultiplier:1.25,projectileSpeed:500,projectileRadius:7,statuses:[slow(.3,2.1)]}),effects:[echo(.45,1.1,2)]}),
        up('b',5,'Сердце айсберга','Тройной залп: 28 урона каждым шипом, радиус раскола 38, бронепробитие 7, эхо 50% через 0,9 с по 3 целям.',8250,{},
          {replaceAttack:atk({mode:'splash',element:'kinetic',damage:28,interval:.9,range:195,count:3,splash:38,armorPierce:7,shieldMultiplier:1.4,bossMultiplier:1.2,projectileSpeed:540,projectileRadius:8,statuses:[slow(.34,2.3)]}),effects:[echo(.5,.9,3)]}),
      ]},
      {id:'frost-c',name:'Полярный фронт',description:'Расширяет зону обморожения и распространяет ледяные волны.',upgrades:[
        up('c',1,'Снежная опушка','Дальность ×1,10; радиус ледяного всплеска +14.',250,{rangeMul:1.1,splashAdd:14}),
        up('c',2,'Туман изморози','Дальность ×1,08, ещё +12 к радиусу всплеска; замедление 36% на 2,4 с.',500,{rangeMul:1.08,splashAdd:12},{addStatuses:[slow(.36,2.4)]}),
        up('c',3,'Кольцо инея','Кольцевой удар: 6 урона по радиусу 185 раз в 1,05 с, замедление 43% на 2,6 с.',1250,{},
          {replaceAttack:atk({mode:'ring',damage:6,interval:1.05,range:185,projectileSpeed:0,projectileRadius:0,windup:0,statuses:[slow(.43,2.6)]})}),
        up('c',4,'Северное сияние','Кольцевая волна радиусом 215: 9 урона каждые 0,9 с, замедление 50% на 3 с.',3000,{},
          {replaceAttack:atk({mode:'ring',damage:9,interval:.9,range:215,projectileSpeed:0,projectileRadius:0,windup:0,statuses:[slow(.5,3)]})}),
        up('c',5,'Три полярных спутника','Импульс радиусом 245: 14 урона каждые 0,68 с, замедление 55% на 3,2 с. «Полярная буря» бьёт по радиусу 290.',7500,{},
          {replaceAttack:atk({mode:'pulse',damage:14,interval:.68,range:245,projectileSpeed:0,projectileRadius:0,windup:0,statuses:[slow(.55,3.2)]}),
            abilities:[{id:'frost-polar-storm',name:'Полярная буря',description:'90 урона в радиусе 290; перезарядка 40 с.',cooldown:40,kind:'nova',power:90,duration:0,radius:290,element:'frost'}]}),
      ]},
    ],
  };
}
