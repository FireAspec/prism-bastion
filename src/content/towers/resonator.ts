import type {AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const art='/art/towers/resonator/';
function visual(asset:string,accent:string,motion:VisualState['motion'],glow=.65):VisualState {
 return {asset:`${art}${asset}.svg`,accent,muzzle:`resonator-${asset}-emitter`,projectile:`resonator-${asset}-sonic-wave`,
  impact:`resonator-${asset}-ripple`,scale:1,glow,motion};
}
const original:AttackDef={mode:'shot',element:'energy',damage:18,interval:1.1,range:155,
 pierce:1,count:1,splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,
 shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,statuses:[],
 projectileSpeed:390,projectileRadius:6,homing:false,windup:.13,arc:0};
const attack=(patch:Partial<AttackDef>):AttackDef=>({...original,...patch,statuses:patch.statuses?.map(s=>({...s}))??[]});
const status=(kind:StatusSpec['kind'],power:number,duration:number):StatusSpec=>({kind,power,duration,maxStacks:1});
const aura=(id:string,stat:NonNullable<EffectDef['stat']>,power:number,radius:number):EffectDef=>
 ({id,kind:'aura',stat,power,radius,interval:0,duration:0,cap:0});
const echo=(power:number,interval:number,cap:number):EffectDef=>
 ({id:'resonator-aftershock',kind:'echo',power,radius:100,interval,duration:0,cap});
function upgrade(path:'a'|'b'|'c',tier:1|2|3|4|5,name:string,description:string,cost:number,
 delta:StatDelta,extras:Omit<Partial<UpgradeDef>,'id'|'name'|'description'|'cost'|'tier'|'delta'|'visual'>={}):UpgradeDef {
 const accent=path==='a'?'#57efff':path==='b'?'#e7a1ff':'#ffd978';
 return {id:`resonator-${path}${tier}`,name,description,cost,tier,delta,...extras,
  visual:visual(`${path}${tier}`,accent,tier>=3?'pulse':tier===2?'orbit':'breathe',tier===5?1.35:.5+tier*.12)};
}

const definition:TowerDef={
 id:'resonator',name:'Резонатор',description:'Звуковое орудие: басовые кольца, разрушающий броню диссонанс или синхронизация союзных башен.',
 category:'tech',placement:'land',cost:700,footprint:26,attack:original,effects:[],abilities:[],
 visual:visual('base','#70e6f1','breathe'),paths:[
 {id:'resonator-bass',name:'Басовая волна',description:'Широкие кольца урона и ударные отзвуки.',upgrades:[
  upgrade('a',1,'Расширитель диффузора','Дальность каждой атаки +10%; расширяет и кольца.',350,{rangeMul:1.10}),
  upgrade('a',2,'Двойной резонанс','Импульс пробивает ещё две цели; урон +12%.',700,{pierceAdd:2,damageMul:1.12}),
  upgrade('a',3,'Низкая орбита','Кольцо (pierce 10): 33 урона каждые 1,35 с в радиусе 178; отталкивание 7.',1750,{},
   {replaceAttack:attack({mode:'ring',damage:33,interval:1.35,range:178,pierce:10,push:7,projectileRadius:12,windup:.17})}),
  upgrade('a',4,'Обратная волна','Урон кольца +35%, дальность +12%; эхо силой 35% с задержкой 0,7 с, до 6 целей в цепи с шагом 100.',4200,
   {damageMul:1.35,rangeMul:1.12},{effects:[echo(.35,.7,6)]}),
  upgrade('a',5,'Сердце сабвуфера','Три мембраны: кольцо 92 урона (pierce 32) каждые 1,5 с, радиус 245, отталкивание 22; активная нова 210 урона/38 с.',10500,{},
   {replaceAttack:attack({mode:'ring',damage:92,interval:1.5,range:245,pierce:32,push:22,projectileRadius:20,windup:.21,bossMultiplier:1.15}),
    abilities:[{id:'resonator-seismic-nova',name:'Сейсмическая нова',description:'Удар на 210 энергетического урона в радиусе 245.',cooldown:38,kind:'nova',power:210,duration:0,radius:245,element:'energy'}]})
 ]},
 {id:'resonator-dissonance',name:'Диссонанс',description:'Метка и ослабление брони.',upgrades:[
  upgrade('b',1,'Сбитая нота','Снижает броню на 2 на 2,5 с; собственный бронепробой +2.',335,{armorPierceAdd:2},
   {addStatuses:[status('shred',2,2.5)]}),
  upgrade('b',2,'Фальшивая гармоника','Метка +10% входящего урона на 3 с, дальность +8%, обнаружение скрытых.',665,
   {rangeMul:1.08,detects:true},{addStatuses:[status('mark',.1,3)]}),
  upgrade('b',3,'Зазубренный аккорд','Разряд до 2 целей: 42 урона, бронепробой 5, ослабление брони −4 и метка на 3,5 с.',1665,{},
   {replaceAttack:attack({mode:'shot',damage:42,interval:1.1,range:190,pierce:2,armorPierce:5,detects:true,shieldMultiplier:1.25,
    projectileRadius:9,statuses:[status('shred',4,3.5),status('mark',.1,3.5)]})}),
  upgrade('b',4,'Расколотый унисон','Широкий луч до 8 целей: 60 урона, бронепробой 7, −6 брони на 4 с, щиты ×1,5.',3990,{},
   {replaceAttack:attack({mode:'beam',damage:60,interval:1.2,range:205,pierce:8,armorPierce:7,detects:true,
    shieldMultiplier:1.5,projectileRadius:13,windup:.18,statuses:[status('shred',6,4),status('mark',.1,4)]})}),
  upgrade('b',5,'Корона разлада','Ломаная волна (pierce 24): 116 урона, бронепробой 12, щиты ×1,8, боссы ×1,4, −9 брони/5 с; активный разлом 240 урона/42 с.',9975,{},
   {replaceAttack:attack({mode:'pulse',damage:116,interval:1.6,range:225,pierce:24,armorPierce:12,detects:true,
    shieldMultiplier:1.8,bossMultiplier:1.4,projectileRadius:17,windup:.22,statuses:[status('shred',9,5),status('mark',.1,5)]}),
    abilities:[{id:'resonator-rupture',name:'Разлом аккорда',description:'Удар 240 урона в радиусе 225.',cooldown:42,kind:'nova',power:240,duration:0,radius:225,element:'energy'}]})
 ]},
 {id:'resonator-tuning',name:'Камертон',description:'Согласует темп и дальность соседних башен.',upgrades:[
  upgrade('c',1,'Чистый строй','Интервал собственных ударов −14%.',390,{intervalMul:.86}),
  upgrade('c',2,'Общий метроном','Дальность +8%; другие башни в радиусе 135 получают +10% темпа.',775,{rangeMul:1.08},
   {effects:[aura('resonator-tempo','attackSpeed',.10,135)]}),
  upgrade('c',3,'Два камертона','Импульс (pierce 9): 29 урона/1,1 с; аура темпа +18% в радиусе 165.',1930,{},
   {replaceAttack:attack({mode:'pulse',damage:29,interval:1.1,range:180,pierce:9,projectileRadius:11,windup:.16}),
    effects:[aura('resonator-tempo','attackSpeed',.18,165)]}),
  upgrade('c',4,'Синхронная решётка','Аура темпа +30% в радиусе 190, аура дальности +10%, собственный интервал −10%.',4625,
   {intervalMul:.90},{effects:[aura('resonator-tempo','attackSpeed',.30,190),aura('resonator-reach','range',.10,190)]}),
  upgrade('c',5,'Золотой камертонный хор','Две золотые вилки: +45% темпа, +14% дальности, +12% урона другим башням в радиусе 220; импульс (pierce 20) по 67 урона; активная нова 175/34 с.',11555,{},
   {replaceAttack:attack({mode:'pulse',damage:67,interval:1.25,range:215,pierce:20,projectileRadius:16,windup:.16}),
    effects:[aura('resonator-tempo','attackSpeed',.45,220),aura('resonator-reach','range',.14,220),aura('resonator-harmony','damage',.12,220)],
    abilities:[{id:'resonator-harmonic-nova',name:'Гармонический удар',description:'Синхронный импульс на 175 энергетического урона в радиусе 220.',cooldown:34,kind:'nova',power:175,duration:0,radius:220,element:'energy'}]})
 ]}
 ]
};

/** A new independent catalog entry for every caller. */
export function getTower():TowerDef{return structuredClone(definition);}
