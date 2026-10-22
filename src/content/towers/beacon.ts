import type {AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const art = '/art/towers/beacon/';

function visual(name:string, accent:string, motion:VisualState['motion'], glow:number):VisualState {
  return {
    asset:`${art}${name}.svg`, accent, muzzle:'beacon-halo',
    projectile:'beacon-signal', impact:'beacon-ripple',
    scale:1, glow, motion,
  };
}

function aura(id:string, stat:NonNullable<EffectDef['stat']>, power:number, radius:number):EffectDef {
  return {id, kind:'aura', stat, power, radius, interval:0, duration:0, cap:0};
}

const attack:AttackDef = {
  mode:'pulse', element:'energy', damage:0, interval:1, range:160,
  pierce:1, count:1, splash:0, chains:0, chainRadius:0,
  detects:false, armorPierce:0, shieldMultiplier:1, bossMultiplier:1,
  executeBelow:0, push:0, statuses:[], projectileSpeed:0,
  projectileRadius:0, homing:false, windup:0, arc:360,
};

function upgrade(
  path:'a'|'b'|'c', tier:1|2|3|4|5, name:string, description:string,
  cost:number, effects:EffectDef[], accent:string,
  motion:VisualState['motion'], glow:number,
  extras:Partial<Pick<UpgradeDef,'replaceAttack'|'abilities'>> = {},
):UpgradeDef {
  return {
    id:`beacon-${path}${tier}`, name, description, tier, cost,
    delta:{}, effects, visual:visual(`${path}${tier}`,accent,motion,glow), ...extras,
  };
}

const command = (power:number,radius:number) => aura('beacon-command','damage',power,radius);
const penetration = (power:number,radius:number) => aura('beacon-penetration','armorPierce',power,radius);
const reveal = (radius:number) => aura('beacon-reveal','detect',1,radius);
const reach = (power:number,radius:number) => aura('beacon-reach','range',power,radius);
const tempo = (power:number,radius:number) => aura('beacon-tempo','attackSpeed',power,radius);
const logistics = (power:number,radius:number) => aura('beacon-logistics','discount',power,radius);

const BEACON:TowerDef = {
  id:'beacon', name:'Сигнальный фонарь', category:'support',
  description:'Командный маяк. Сразу увеличивает урон союзных башен в радиусе 160 на 4%; сам не атакует и не усиливает себя.',
  cost:600, footprint:26, placement:'land', attack,
  effects:[command(0.04,160)], abilities:[],
  visual:visual('base','#f8bf68','breathe',0.38),
  paths:[
    {
      id:'beacon-command', name:'Командный свет',
      description:'Оружейная оптика и золотая корона усиливают урон и пробивание брони соседей.',
      upgrades:[
        upgrade('a',1,'Знак отличия','Аура пробивания брони: +1 к armorPierce союзников в радиусе 165. Базовый бонус урона +4% сохраняется.',300,
          [penetration(1,165)],'#ffcb73','breathe',0.46),
        upgrade('a',2,'Сдвоенный рефлектор','Бонус урона союзников увеличивается с +4% до +8%, радиус этой ауры — 175. Пробивание +1 сохраняется.',600,
          [command(0.08,175)],'#ffd57d','pulse',0.54),
        upgrade('a',3,'Световой штаб','Аура урона +18% на 200; аура пробивания +2 на 200. Две полосы света обозначают боевой сектор.',1500,
          [command(0.18,200),penetration(2,200)],'#ffcf67','pulse',0.68),
        upgrade('a',4,'Солнечные регалии','Аура урона +28% на 225; пробивание брони +4 на 225. Корона раскрывает дополнительные зеркала.',3600,
          [command(0.28,225),penetration(4,225)],'#ffbe4c','rotate',0.84),
        upgrade('a',5,'Корона первого света','Аура урона +40% на 255 и пробивания +7 на 255. Активная «Команда: натиск» раз в 65 с ускоряет союзников на 20% на 8 с в радиусе 250 (общий предел темпа +50%).',9000,
          [command(0.40,255),penetration(7,255)],'#ffe19a','pulse',1.0,
          {abilities:[{id:'beacon-command-surge',name:'Команда: натиск',description:'На 8 с усилить темп союзников на 20% в радиусе 250; лимит поддержки по темпу +50%.',cooldown:65,kind:'overclock',power:0.20,duration:8,radius:250,element:'energy'}]}),
      ],
    },
    {
      id:'beacon-watch', name:'Дозор',
      description:'Линзы обнаруживают скрытые цели и увеличивают дальность союзных башен.',
      upgrades:[
        upgrade('b',1,'Линза дозорного','Обнаружение скрытых целей для союзных башен в радиусе 180, включая башни без собственного обнаружения.',300,
          [reveal(180)],'#78dbe0','orbit',0.46),
        upgrade('b',2,'Телескопический штатив','Бонус к дальности союзников +6% в радиусе 185; обнаружение в радиусе 180 сохраняется.',600,
          [reach(0.06,185)],'#6ddde4','orbit',0.54),
        upgrade('b',3,'Перекрёстный надзор','Обнаружение на 230; дальность союзников +14% в радиусе 225. Вторая сканирующая линза перекрывает слепой сектор.',1500,
          [reveal(230),reach(0.14,225)],'#6de3f2','rotate',0.68),
        upgrade('b',4,'Картограф горизонта','Обнаружение на 285; дальность союзников +24% в радиусе 270. Три линзы считывают разные высоты.',3600,
          [reveal(285),reach(0.24,270)],'#87f1f4','rotate',0.84),
        upgrade('b',5,'Четыре зенита','Четыре линзы дают обнаружение на 350 и +34% дальности в радиусе 325; автоматическая разведволна раз в 2,5 с наносит 8 энергетического урона и помечает врагов на +10% входящего урона на 3 с.',9000,
          [reveal(350),reach(0.34,325)],'#9afff2','rotate',1.0,
          {replaceAttack:{...attack,damage:8,interval:2.5,range:275,detects:true,
            statuses:[{kind:'reveal',power:1,duration:4},{kind:'mark',power:0.10,duration:3}]}}),
      ],
    },
    {
      id:'beacon-rhythm', name:'Боевой ритм',
      description:'Механический метроном синхронизирует огонь и удешевляет снабжение близких позиций.',
      upgrades:[
        upgrade('c',1,'Медный маятник','Союзники получают +6% к скорости атаки в радиусе 160 (в рамках общего лимита +50%).',285,
          [tempo(0.06,160)],'#ed9dd5','pulse',0.46),
        upgrade('c',2,'Счётная шестерня','Скидка на покупки рядом с фонарём +3% в радиусе 165, не влияет на стоимость уже купленного; ускорение +6% сохраняется.',570,
          [logistics(0.03,165)],'#e6a0e9','pulse',0.54),
        upgrade('c',3,'Ритм эскадры','Скорость атаки союзников +16% на 195, скидка +5% на 180. Внутренний маятник включается в общий такт.',1425,
          [tempo(0.16,195),logistics(0.05,180)],'#f0a1dd','pulse',0.68),
        upgrade('c',4,'Синхронный привод','Скорость атаки +32% на 225; скидка +7,5% на 210. Вокруг привода вращается секундное кольцо.',3420,
          [tempo(0.32,225),logistics(0.075,210)],'#f5a6e0','rotate',0.84),
        upgrade('c',5,'Метроном резонанса','Скорость атаки +50% на 260; скидка +10% на 245. Каждые 1,25 с кольцевой импульс наносит 5 энергетического урона и замедляет врагов на 10% на 1,5 с.',8550,
          [tempo(0.50,260),logistics(0.10,245)],'#ffb2e6','pulse',1.0,
          {replaceAttack:{...attack,damage:5,interval:1.25,range:230,detects:false,
            statuses:[{kind:'slow',power:0.10,duration:1.5}]}}),
      ],
    },
  ],
};

/** Fresh independent data: resolvers and knowledge modifiers may mutate their copy. */
export function getTower():TowerDef {
  return structuredClone(BEACON);
}
