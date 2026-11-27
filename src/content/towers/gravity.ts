import type {AbilityDef, AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const BASE: AttackDef = {
  mode:'shot', element:'energy', damage:20, interval:1.5, range:175,
  pierce:1, count:1, splash:0, chains:0, chainRadius:0,
  detects:false, armorPierce:0, shieldMultiplier:1, bossMultiplier:1,
  executeBelow:0, push:0, statuses:[],
  projectileSpeed:390, projectileRadius:5, homing:true, windup:0, arc:0,
};
const slow = (power:number,duration:number):StatusSpec => ({kind:'slow',power,duration});
const stun = (duration:number):StatusSpec => ({kind:'stun',power:1,duration});
const art = (name:string,accent:string,motion:VisualState['motion'],glow:number):VisualState => ({
  asset:'/art/towers/gravity/'+name+'.svg',accent,
  muzzle:`gravity-${name}-flare`,
  projectile:`gravity-${name}-${/^[ab][345]$/.test(name)?(name[0]==='a'?'ring':'pulse'):name==='c5'?'beam':'orb'}`,
  impact:`gravity-${name}-${/^b[1-5]$/.test(name)?'repulse':name[0]==='c'?'fracture':'ripple'}`,
  scale:1,glow,motion,
});
const well = (power:number,radius:number,interval:number,duration:number):EffectDef => ({
  id:'gravity-well',kind:'portal',power,radius,interval,duration,cap:0,
});
const focus = (power:number,cap:number):EffectDef => ({
  id:'gravity-tidal-focus',kind:'focus',power,radius:0,interval:1,duration:0,cap,
});
const active = (
  id:string,name:string,description:string,kind:AbilityDef['kind'],
  power:number,radius:number,cooldown:number,
):AbilityDef => ({id,name,description,kind,power,radius,cooldown,duration:0,element:'energy'});
const a3:AttackDef = {...BASE,mode:'ring',damage:34,interval:1.65,range:154,pierce:7,
  projectileSpeed:0,projectileRadius:0,homing:false,windup:.1,statuses:[slow(.32,1.8)]};
const a5:AttackDef = {...BASE,mode:'ring',damage:98,interval:1.2,range:189,pierce:15,
  projectileSpeed:0,projectileRadius:0,homing:false,windup:.1,statuses:[slow(.58,2.8)]};
const b3:AttackDef = {...BASE,mode:'pulse',damage:48,interval:1.7,range:158,pierce:8,
  projectileSpeed:0,projectileRadius:0,homing:false,windup:.1,push:24};
const b5:AttackDef = {...BASE,mode:'pulse',damage:112,interval:1.25,range:195,pierce:16,
  projectileSpeed:0,projectileRadius:0,homing:false,windup:.1,push:72,statuses:[stun(.28)]};
const c3:AttackDef = {...BASE,damage:79,interval:1.9,range:205,bossMultiplier:1.65,
  executeBelow:.16,armorPierce:6,projectileSpeed:515,projectileRadius:8};
const c5:AttackDef = {...BASE,mode:'beam',damage:152,interval:1.12,range:232,pierce:2,
  bossMultiplier:2.15,executeBelow:.29,armorPierce:14,
  projectileSpeed:0,projectileRadius:0,homing:false,
  statuses:[{kind:'mark',power:.1,duration:3.2}]};

type Path = 'a'|'b'|'c';
function u(path:Path,tier:1|2|3|4|5,name:string,description:string,cost:number,
  delta:StatDelta,extra:Pick<UpgradeDef,'replaceAttack'|'addStatuses'|'effects'|'abilities'>={}):UpgradeDef {
  const accent = {a:'#ad87ff',b:'#79f2ed',c:'#f9bd72'}[path];
  const motion:Record<Path,VisualState['motion']> = {a:'orbit',b:'pulse',c:'breathe'};
  return {id:'gravity-'+path+tier,name,description,cost,tier,delta,...extra,
    visual:art(path+tier,accent,motion[path],.2+tier*.13)};
}

const TOWER:TowerDef = {
  id:'gravity',name:'Гравитационная линза',
  description:'Медно-кристаллическая установка преломляет пространство: удерживает врагов, отражает волны или обрушивает массу на сильнейших.',
  category:'tech',cost:1200,footprint:26,placement:'land',attack:BASE,
  effects:[],abilities:[],visual:art('base','#91dce8','breathe',.24),
  paths:[
    {id:'gravity-black-star',name:'Чёрная звезда',
      description:'Воронка замедления, кольцевой урон и контролируемый возврат вдоль маршрута.',
      upgrades:[
        u('a',1,'Вязкая орбита','Дальность ×1,08; попадания замедляют на 16% на 1,2 с.',660,
          {rangeMul:1.08},{addStatuses:[slow(.16,1.2)]}),
        u('a',2,'Искривление траектории','Урон ×1,16; замедление 25% на 1,7 с.',1320,
          {damageMul:1.16},{addStatuses:[slow(.25,1.7)]}),
        u('a',3,'Сердце провала','Кольцо 34 урона каждые 1,65 с (до 7 целей), замедление 32%; откат одной цели на 22 пикселя раз в 4,4 с.',3300,
          {rangeMul:1.05},{replaceAttack:a3,addStatuses:[slow(.32,1.8)],effects:[well(22,154,4.4,2.5)]}),
        u('a',4,'Горизонт событий','Урон ×1,32, интервал ×0,88; замедление 45% на 2,3 с; откат одной цели на 41 пиксель раз в 3,5 с.',7920,
          {damageMul:1.32,intervalMul:.88},{addStatuses:[slow(.45,2.3)],effects:[well(41,173,3.5,2.6)]}),
        u('a',5,'Нулевая звезда','Кольцо 98 урона каждые 1,2 с до 15 целей; замедление 58%; откат одной цели на 68 пикселей раз в 2,7 с. Активная сингулярность: 310 урона, радиус 210, 55 с.',19800,
          {damageMul:1.2,rangeMul:1.12},{replaceAttack:a5,addStatuses:[slow(.58,2.8)],effects:[well(68,207,2.7,2.7)],
            abilities:[active('gravity-singularity','Схлопывание','Нова 310 энергетического урона в радиусе 210.','nova',310,210,55)]}),
      ]},
    {id:'gravity-reflector',name:'Отражатель',
      description:'Отдача снарядов сменяется массовыми отталкивающими импульсами.',
      upgrades:[
        u('b',1,'Отдача поля','Снаряд отталкивает на 10 пикселей, скорость снаряда ×1,2.',600,
          {pushAdd:10,projectileSpeedMul:1.2}),
        u('b',2,'Зеркальный резонанс','Интервал ×0,9, урон щитам ×1,25.',1200,
          {intervalMul:.9,shieldMultiplierMul:1.25}),
        u('b',3,'Толчковая диафрагма','Импульс 48 урона каждые 1,7 с по 8 целям; базовое отталкивание 24 пикселя.',3000,
          {pushAdd:12},{replaceAttack:b3}),
        u('b',4,'Зеркало давления','Урон ×1,36, дальность ×1,16, оглушение на 0,18 с.',7200,
          {damageMul:1.36,rangeMul:1.16},{addStatuses:[stun(.18)]}),
        u('b',5,'Великий отражатель','Импульс 112 урона каждые 1,25 с до 16 целей, отталкивание 72 пикселя, оглушение 0,28 с. Активная волна откатывает на 100 пикселей, 48 с.',18000,
          {intervalMul:.92,pushAdd:18},{replaceAttack:b5,addStatuses:[stun(.28)],
            abilities:[active('gravity-repulse','Отражённая волна','Откатить врагов в радиусе 210 на 100 пикселей вдоль дороги.','rewind',100,210,48)]}),
      ]},
    {id:'gravity-mass-tide',name:'Прилив массы',
      description:'Тяжёлые удары, добивание обычных врагов и нарастающее давление на босса.',
      upgrades:[
        u('c',1,'Тяжёлый изотоп','Урон боссам ×1,25, пробитие брони +1.',570,
          {bossMultiplierMul:1.25,armorPierceAdd:1}),
        u('c',2,'Приливное разрушение','Урон ×1,1; добивание обычных врагов ниже 6% maxHP.',1140,
          {damageMul:1.1,executeBelowAdd:.06}),
        u('c',3,'Лунный молот','Самонаводящийся удар 79 урона раз в 1,9 с; дальность 205, добивание с 16%, боссы ×1,65 до улучшений.',2850,
          {armorPierceAdd:3},{replaceAttack:c3}),
        u('c',4,'Сжатие ядра','Интервал ×0,82; боссы ×1,25; порог добивания +6 п.п.; фокус +8% за секунду до +48%.',6840,
          {intervalMul:.82,bossMultiplierMul:1.25,executeBelowAdd:.06},{effects:[focus(.08,.48)]}),
        u('c',5,'Луна предела Роша','Линейный луч с пробитием двух целей, 152 урона раз в 1,12 с; добивание с 29%, боссы ×2,15 до улучшений. Фокус до +90%. Метеор 650 урона, 70 с.',17100,
          {rangeMul:1.18,bossMultiplierMul:1.1,executeBelowAdd:.04},{replaceAttack:c5,effects:[focus(.13,.9)],
            abilities:[active('gravity-roche','Падение осколка','Метеор 650 энергетического урона в радиусе 105.','meteor',650,105,70)]}),
      ]},
  ],
};

/** Every caller owns an independent copy, including nested upgrade and effect definitions. */
export function getTower():TowerDef {
  return structuredClone(TOWER);
}
