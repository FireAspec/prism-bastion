import type {AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const root = '/art/towers/ember/';
type Branch = 'a'|'b'|'c';
type Tier = 1|2|3|4|5;
const burn = (power:number, duration:number, maxStacks:number):StatusSpec => ({kind:'burn',power,duration,maxStacks});
const baseAttack = (patch:Partial<AttackDef> = {}):AttackDef => ({
  mode:'shot',element:'fire',damage:9,interval:0.8,range:145,pierce:1,count:1,
  splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,
  shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,
  statuses:[burn(2,2.8,2)],projectileSpeed:340,projectileRadius:4,
  homing:false,windup:0,arc:0,...patch,
});
const burst = (id:string,power:number,radius:number):EffectDef =>
  ({id,kind:'deathBurst',power,radius,interval:0,duration:0,cap:0,element:'fire'});
const focus = (power:number,cap:number):EffectDef =>
  ({id:'ember-forge-focus',kind:'focus',power,radius:0,interval:0,duration:0,cap});
const echo = (power:number,interval:number,cap:number):EffectDef =>
  ({id:'ember-solar-echo',kind:'echo',power,radius:0,interval,duration:0,cap,element:'fire'});
const ability = (
  id:string,name:string,description:string,kind:'nova'|'overclock'|'meteor',
  cooldown:number,power:number,duration:number,radius:number,
) => ({id,name,description,kind,cooldown,power,duration,radius,element:'fire' as const});

const tones:Record<Branch,string[]> = {
  a:['#ff9e47','#ffad50','#ff7d2f','#ff7628','#ff6328'],
  b:['#ffe292','#ffdc7d','#ffeaa0','#ffefb4','#fff2c2'],
  c:['#e9a36f','#f7a25c','#f68f50','#f78248','#ff8b4c'],
};
const appearances:Record<Branch,[string,string,string,VisualState['motion']][]> = {
  a:[
    ['forge-bellows','forge-coal','hot-spark','breathe'],
    ['forge-vents','hot-iron','molten-drop','pulse'],
    ['furnace-lance','magma-lance','lava-hit','pulse'],
    ['slag-burst','molten-spear','slag-explosion','breathe'],
    ['infernal-arms','heart-spear','inferno-bloom','pulse'],
  ],
  b:[
    ['solar-lens','sun-seed','sun-spark','rotate'],
    ['solar-prism','sun-dart','halo-flare','rotate'],
    ['corona-wave','sun-ring','ring-glint','orbit'],
    ['pulsar-halo','pulsar-ring','white-flare','orbit'],
    ['prominence-crown','triple-halo','solar-nova','orbit'],
  ],
  c:[
    ['ash-spray','cinder-pellet','ash-pop','breathe'],
    ['cinder-nozzle','magma-shot','ember-cloud','pulse'],
    ['volcanic-lob','lava-shell','crater-blast','breathe'],
    ['twin-vents','double-meteor','lava-crater','pulse'],
    ['volcanic-salvo','triple-comet','caldera','pulse'],
  ],
};
function view(file:string,accent:string,muzzle:string,projectile:string,impact:string,motion:VisualState['motion'],glow:number):VisualState {
  return {asset:root+file+'.svg',accent,muzzle,projectile,impact,scale:1,glow,motion};
}
function up(path:Branch,tier:Tier,cost:number,name:string,description:string,delta:StatDelta,extra:Partial<UpgradeDef> = {}):UpgradeDef {
  const [muzzle,projectile,impact,motion] = appearances[path][tier-1];
  return {
    id:`ember-${path}${tier}`,name,description,cost,tier,delta,...extra,
    visual:view(path+tier,tones[path][tier-1],muzzle,projectile,impact,motion,
      [0.35,0.42,0.6,0.75,0.95][tier-1]),
  };
}

/** Always returns an independent content tree; callers may resolve or clone it freely. */
export function getTower():TowerDef {
  const a:UpgradeDef[] = [
    up('a',1,300,'Меха раздува','Урон ×1,08; горение 3 ед./с на 3,2 с, до 3 слоёв. Работает и на кольцах, и на мортире.',
      {damageMul:1.08},{addStatuses:[burn(3,3.2,3)]}),
    up('a',2,600,'Керамические каналы','Урон ×1,12, бронепробитие +1; горение 4 ед./с на 3,8 с, до 4 слоёв.',
      {damageMul:1.12,armorPierceAdd:1},{addStatuses:[burn(4,3.8,4)]}),
    up('a',3,1500,'Сердце горна','Огненный снаряд 18 урона / 0,58 с; 6 ед./с горения на 4,6 с, до 5 слоёв. Фокус даёт до +35% урона по одной цели.',
      {},{replaceAttack:baseAttack({damage:18,interval:0.58,range:168,projectileSpeed:390,projectileRadius:5,statuses:[burn(6,4.6,5)]}),
        effects:[focus(0.06,0.35)]}),
    up('a',4,3600,'Шлаковый реактор','28 урона / 0,48 с, горение 10 ед./с (6 слоёв). Убийство пламенем даёт взрыв 35 урона в радиусе 50.',
      {},{replaceAttack:baseAttack({damage:28,interval:0.48,range:181,armorPierce:2,projectileSpeed:420,projectileRadius:6,statuses:[burn(10,5.2,6)]}),
        effects:[focus(0.08,0.5),burst('ember-forge-burst',35,50)]}),
    up('a',5,9000,'Инфернальный колосс','Три огненных рукава по 42 урона каждые 0,38 с (по 2 пробития). Горение до 8 слоёв, посмертная вспышка 80 урона; активная перегрузка.',
      {},{replaceAttack:baseAttack({damage:42,interval:0.38,range:205,count:3,pierce:2,armorPierce:3,bossMultiplier:1.2,projectileSpeed:470,projectileRadius:7,statuses:[burn(15,6.5,8)]}),
        effects:[focus(0.12,0.7),burst('ember-forge-burst',80,68)],
        abilities:[ability('ember-infernal-overclock','Сброс давления','Перегрузка рукавов на 8 секунд.','overclock',42,0.5,8,0)]}),
  ];
  const b:UpgradeDef[] = [
    up('b',1,330,'Гелиоконцентратор','Интервал ×0,92; дальность ×1,10. Работает на всех формах атаки.',
      {intervalMul:0.92,rangeMul:1.1}),
    up('b',2,660,'Рассветная оптика','Интервал ×0,90, урон щитам ×1,15; обнаружение скрытых врагов для любого пути.',
      {intervalMul:0.9,shieldMultiplierMul:1.15,detects:true}),
    up('b',3,1650,'Корона фотонов','Кольцо 27 урона каждые 1,35 с в радиусе 150, до 12 целей. Обжигает и раскрывает скрытых.',
      {},{replaceAttack:baseAttack({mode:'ring',damage:27,interval:1.35,range:150,pierce:12,projectileSpeed:0,projectileRadius:0,detects:true,shieldMultiplier:1.25,
        statuses:[burn(4,3.5,3),{kind:'reveal',power:1,duration:4}]})}),
    up('b',4,3960,'Пульсарная розетка','Кольцо 46 урона / 1,15 с, радиус 188, до 16 целей, метка +10%. Активная нова 120 урона в радиусе 190.',
      {},{replaceAttack:baseAttack({mode:'ring',damage:46,interval:1.15,range:188,pierce:16,projectileSpeed:0,projectileRadius:0,detects:true,shieldMultiplier:1.4,
        statuses:[burn(6,4.2,4),{kind:'mark',power:0.1,duration:4}]}),
        abilities:[ability('ember-solar-nova','Солнечная нова','Широкий ручной импульс вокруг сферы.','nova',38,120,0,190)]}),
    up('b',5,9900,'Сердце протуберанца','Парящее солнце: кольцо 78 урона / 0,85 с, радиус 230, до 24 целей; эхо 35% каждые 2 с. Сверхновая 260 урона в радиусе 255.',
      {},{replaceAttack:baseAttack({mode:'ring',damage:78,interval:0.85,range:230,pierce:24,projectileSpeed:0,projectileRadius:0,detects:true,shieldMultiplier:1.75,bossMultiplier:1.3,
        statuses:[burn(9,4.8,5),{kind:'mark',power:0.1,duration:5}]}),
        effects:[echo(0.35,2,8)],
        abilities:[ability('ember-solar-nova','Сверхновая','Корональный выброс вокруг солнечного сердца.','nova',29,260,0,255)]}),
  ];
  const c:UpgradeDef[] = [
    up('c',1,285,'Искровой распылитель','Урон ×1,09, площадь взрыва +10, скорость снаряда ×1,15; полезен и другим веткам.',
      {damageMul:1.09,splashAdd:10,projectileSpeedMul:1.15}),
    up('c',2,570,'Магматическая смесь','Дальность ×1,12, площадь взрыва +12, бронепробитие +1; горение 3 ед./с на 4 с.',
      {rangeMul:1.12,splashAdd:12,armorPierceAdd:1},{addStatuses:[burn(3,4,3)]}),
    up('c',3,1425,'Кратерный ствол','Навесной заряд 48 урона / 1,85 с, радиус взрыва 58, дальность 275. Горение 7 ед./с.',
      {},{replaceAttack:baseAttack({mode:'mortar',damage:48,interval:1.85,range:275,splash:58,projectileSpeed:245,projectileRadius:6,statuses:[burn(7,4.5,4)]})}),
    up('c',4,3420,'Двойной вулкан','Два навесных заряда по 76 урона / 1,55 с, взрыв радиусом 72. Убийства от огня дают вспышку 34 урона.',
      {},{replaceAttack:baseAttack({mode:'mortar',damage:76,interval:1.55,range:315,count:2,splash:72,armorPierce:2,projectileSpeed:275,projectileRadius:7,statuses:[burn(10,5,5)]}),
        effects:[burst('ember-ash-burst',34,48)]}),
    up('c',5,8550,'Вулканический триумвират','Три трубы: по 108 урона / 1,2 с, взрыв радиусом 94, дальность 355, сильное горение. Активная кальдера — метеор на 360 урона.',
      {},{replaceAttack:baseAttack({mode:'mortar',damage:108,interval:1.2,range:355,count:3,splash:94,armorPierce:3,bossMultiplier:1.25,projectileSpeed:320,projectileRadius:9,statuses:[burn(15,6,6)]}),
        effects:[burst('ember-ash-burst',72,68)],
        abilities:[ability('ember-ash-meteor','Кальдера','Автоматический метеор по скоплению врагов в досягаемости.','meteor',36,360,0,125)]}),
  ];
  return {
    id:'ember',name:'Жаровая печь',
    description:'Медная печь стреляет огненными ядрами, постепенно выжигая кристаллы. Три пути: кузня, солнечные волны и пепельная артиллерия.',
    category:'element',cost:600,footprint:25,placement:'land',attack:baseAttack(),effects:[],abilities:[],
    visual:view('base','#ff9e47','ember-mouth','coal-spark','ember-pop','breathe',0.35),
    paths:[
      {id:'ember-forge',name:'Адская кузня',description:'Слои горения, жаркие рукава и раскалённое сердце.',upgrades:a},
      {id:'ember-solar',name:'Солнечная вспышка',description:'Кольцевые импульсы, световая метка и активная нова.',upgrades:b},
      {id:'ember-ash',name:'Пепельный дождь',description:'Навесные взрывы, вулканические трубы и падающие метеоры.',upgrades:c},
    ],
  };
}
