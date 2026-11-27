import type {AttackDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ART = '/art/towers/mine/';

function visual(file: string, accent: string, motion: VisualState['motion'], glow: number): VisualState {
  return {asset: `${ART}${file}.svg`, accent, muzzle: `${file}-arming`,
    projectile: `${file}-charge`, impact: `${file}-detonation`, scale: 1, glow, motion};
}

// Mine uses the full attack range when splash is zero.
const baseAttack: AttackDef = {
  mode: 'mine', element: 'kinetic', damage: 40, interval: 2.8, range: 100,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [], projectileSpeed: 0,
  projectileRadius: 7, homing: false, windup: 0, arc: 0,
};

/** Presets are unmodified attacks; the combat resolver applies purchased deltas afterward. */
function preset(changes: Partial<AttackDef>): AttackDef {return {...baseAttack, ...changes};}

function upgrade(path: 'a'|'b'|'c', tier: 1|2|3|4|5, name: string,
  description: string, cost: number, delta: UpgradeDef['delta'],
  extra: Partial<Pick<UpgradeDef,'replaceAttack'|'addStatuses'|'effects'|'abilities'>> = {},
): UpgradeDef {
  const accents = {a:'#ff765a', b:'#ffc277', c:'#87e9ff'};
  const motions: Record<'a'|'b'|'c', VisualState['motion']> = {a:'pulse', b:'rotate', c:'orbit'};
  return {id:`mine-${path}${tier}`,name,description,cost,tier,delta,...extra,
    visual:visual(`${path}${tier}`,accents[path],motions[path],.24+tier*.12)};
}

const mine: TowerDef = {
  id:'mine',name:'Минный узел',category:'tech',placement:'land',footprint:25,cost:450,
  description:'Медный закладчик зарядов: каждые 2,8 с подрывает мины в зоне действия. '
    +'Три специализации: плотность поля, бронепробитие или стазис.',
  attack:baseAttack,effects:[],abilities:[],visual:visual('base','#ffb578','pulse',.22),
  paths:[
    {id:'mine-field',name:'Минное поле',
     description:'Плотные кассеты из зарядов, большая площадь и вторичные подрывы.',
     upgrades:[
      upgrade('a',1,'Двойная кассета','Ещё один подрыв за цикл; радиус поля ×1,06.',
        225,{countAdd:1,rangeMul:1.06}),
      upgrade('a',2,'Удлинённый кабель','Перезарядка ×0,88, радиус поля ×1,12.',
        450,{intervalMul:.88,rangeMul:1.12}),
      upgrade('a',3,'Гексагональная укладка','Перенастройка: 58 урона, радиус 126 до дельт; +2 подрыва.',
        1125,{countAdd:2},{replaceAttack:preset({damage:58,interval:2.55,range:126})}),
      upgrade('a',4,'Сеть детонаторов','Урон ×1,20, ещё один подрыв, радиус поля ×1,08.',
        2700,{damageMul:1.2,countAdd:1,rangeMul:1.08}),
      upgrade('a',5,'Красный архипелаг','Семь подрывов поля, увеличенный радиус и вторичная цепь с 45% силы.',
        6750,{countAdd:2,rangeMul:1.10},{
          replaceAttack:preset({damage:100,interval:2,range:160}),
          effects:[{id:'mine-echo',kind:'echo',power:.45,radius:185,interval:1.2,duration:0,cap:7}],
        }),
     ]},
    {id:'mine-shaped',name:'Кумулятивный заряд',
     description:'Конические заряды, разрушающие броню и щиты особо прочных целей.',
     upgrades:[
      upgrade('b',1,'Вольфрамовая воронка','Бронепробитие +5 и урон ×1,10, в том числе на кросс-путях.',
        215,{armorPierceAdd:5,damageMul:1.1}),
      upgrade('b',2,'Плазменный взрыватель','Бронепробитие +8 и урон по щитам ×1,15.',
        430,{armorPierceAdd:8,shieldMultiplierMul:1.15}),
      upgrade('b',3,'Бронеколпак','Усиленный подрыв на 95 урона до дельт; снижает броню на 12 ед. на 3 с.',
        1070,{armorPierceAdd:12,damageMul:1.15},{
          replaceAttack:preset({damage:95,interval:2.65,range:112,
            armorPierce:15,shieldMultiplier:1.25,bossMultiplier:1.15}),
          addStatuses:[{kind:'shred',power:12,duration:3}],
        }),
      upgrade('b',4,'Пробойная камера','Урон ×1,38, бронепробитие +18, щиты ×1,25, боссы ×1,10, радиус поля ×1,08.',
        2565,{damageMul:1.38,armorPierceAdd:18,shieldMultiplierMul:1.25,
          bossMultiplierMul:1.1,rangeMul:1.08}),
      upgrade('b',5,'Сейсмический коронатор','Два подрыва по 250 базового урона; +30 пробития и метка.',
        6415,{damageMul:1.15,armorPierceAdd:30,rangeMul:1.10,bossMultiplierMul:1.12},{
          replaceAttack:preset({damage:250,interval:2.45,range:140,count:2,
            armorPierce:35,shieldMultiplier:1.7,bossMultiplier:1.45}),
          addStatuses:[{kind:'mark',power:.1,duration:4}],
        }),
     ]},
    {id:'mine-stasis',name:'Стазис-мина',
     description:'Холодные часовые механизмы замедляют и кратковременно замораживают врагов.',
     upgrades:[
      upgrade('c',1,'Инеевые контакты','Замедление 24% на 1,8 с, радиус поля ×1,05.',
        250,{rangeMul:1.05},{addStatuses:[{kind:'slow',power:.24,duration:1.8}]}),
      upgrade('c',2,'Фазовый датчик','Обнаруживает скрытых, интервал ×0,90, дальность ×1,13; slow 32% на 2,2 с.',
        500,{detects:true,intervalMul:.9,rangeMul:1.13},{
          addStatuses:[{kind:'slow',power:.32,duration:2.2}],
        }),
      upgrade('c',3,'Секундная ловушка','Холодные мины: 36 базового урона, два подрыва, slow 40% на 2,6 с, freeze 0,28 с.',
        1240,{rangeMul:1.06},{
          replaceAttack:preset({element:'frost',damage:36,interval:2.45,range:130,count:2,
            statuses:[{kind:'slow',power:.4,duration:2.6},{kind:'freeze',power:1,duration:.28}]}),
        }),
      upgrade('c',4,'Замедленный маятник','Ещё один заряд, цикл ×0,84, радиус поля ×1,08; slow 46% и freeze 0,40 с.',
        2975,{countAdd:1,intervalMul:.84,rangeMul:1.08},{
          addStatuses:[{kind:'slow',power:.46,duration:3.1},{kind:'freeze',power:1,duration:.4}],
        }),
      upgrade('c',5,'Остановленное мгновение','Четыре стазис-капсулы, slow 50%, freeze 0,48 с; активная ледяная нова.',
        7430,{countAdd:1,rangeMul:1.1,intervalMul:.92},{
          replaceAttack:preset({element:'frost',damage:80,interval:1.9,range:165,count:2,
            statuses:[{kind:'slow',power:.5,duration:3.5},
              {kind:'freeze',power:1,duration:.48}]}),
          abilities:[{id:'mine-timebreak',name:'Разрыв секунды',
            description:'Ручной ледяной импульс на 180 px: 160 урона, перезарядка 70 с.',
            cooldown:70,kind:'nova',power:160,duration:.5,radius:180,element:'frost'}],
        }),
     ]},
  ],
};

/** Each game owns an independent catalog instance. */
export function getTower(): TowerDef {return structuredClone(mine);}
