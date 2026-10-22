import type {AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ART = '/art/towers/needle/';

function visual(asset: string, accent: string, projectile: string, motion: VisualState['motion']): VisualState {
  return {
    asset: `${ART}${asset}.svg`, accent,
    muzzle: `needle-${projectile}-muzzle`, projectile: `needle-${projectile}`,
    impact: `needle-${projectile}-impact`,
    scale: 1, glow: asset.endsWith('5') ? 0.95 : 0.32, motion,
  };
}

const baseAttack: AttackDef = {
  mode: 'shot', element: 'kinetic', damage: 8, interval: 0.55, range: 160,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [],
  projectileSpeed: 760, projectileRadius: 2, homing: false, windup: 0, arc: 0,
};

/** Sustained focus increases impact per shot, not the simulation's firing rate. */
function focus(power: number, cap: number): EffectDef {
  return {
    id: 'needle-spindle-focus', kind: 'focus', power, cap,
    radius: 0, interval: 0, duration: 0,
  };
}

function upgrade(
  path: 'a' | 'b' | 'c', tier: 1 | 2 | 3 | 4 | 5,
  name: string, description: string, delta: UpgradeDef['delta'],
  extras: Pick<UpgradeDef, 'replaceAttack' | 'effects' | 'addStatuses'> = {},
): UpgradeDef {
  const accent = path === 'a' ? '#51e5df' : path === 'b' ? '#bbebff' : '#ffcb6a';
  const projectile = path === 'a' ? 'staccato' : path === 'b' ? 'silver' : 'ricochet';
  return {
    id: `needle-${path}${tier}`, name, description,
    tier, cost: [125, 250, 625, 1500, 3750][tier - 1], delta,
    visual: visual(`${path}${tier}`, accent, projectile,
      path === 'a' ? 'rotate' : path === 'b' ? 'breathe' : 'orbit'),
    ...extras,
  };
}

// The resolver chooses the highest replacement on the main path, then applies
// all deltas in A→B→C order. T1/T2 deliberately never replace the attack.
const needle: TowerDef = {
  id: 'needle', name: 'Игломёт',
  description: 'Медно-кристаллический скорострел: иглы настигнут даже быстрые цели. Три специализации — темп, бронебойный прострел и рикошеты.',
  category: 'weapon', cost: 250, footprint: 26, placement: 'land',
  attack: baseAttack, effects: [], abilities: [],
  visual: visual('base', '#56dcd5', 'copper', 'none'),
  paths: [
    {
      id: 'needle-sewing-storm', name: 'Швейная буря',
      description: 'Пружины, барабаны и серия всё более плотных игольных залпов.',
      upgrades: [
        upgrade('a', 1, 'Подшипники ветра',
          'Интервал выстрелов ×0,90: свободный ход вращающегося затвора.',
          {intervalMul: 0.9, projectileSpeedMul: 1.15}),
        upgrade('a', 2, 'Двойная шпулька',
          '+1 независимая игла в каждом залпе — эффективно и на вторичной ветке.',
          {countAdd: 1}),
        upgrade('a', 3, 'Вихревая катушка',
          'Интервал ×0,80; при непрерывном огне по одной цели фокус +8% урона/с, максимум +35%.',
          {intervalMul: 0.8}, {effects: [focus(0.08, 0.35)]}),
        upgrade('a', 4, 'Тройной барабан',
          '+1 игла, интервал ×0,70; фокус растёт на 12%/с до +60%.',
          {countAdd: 1, intervalMul: 0.7}, {effects: [focus(0.12, 0.6)]}),
        upgrade('a', 5, 'Пять колец урагана',
          'Пять игл в залпе, интервал ×0,60; фокус +20%/с до +100%. Пять кольцевых роторов.',
          {countAdd: 2, intervalMul: 0.6}, {effects: [focus(0.2, 1)]}),
      ],
    },
    {
      id: 'needle-diamond', name: 'Алмазные иглы',
      description: 'Растущие грани кристалла режут броню и прошивают строй насквозь.',
      upgrades: [
        upgrade('b', 1, 'Карбидный сердечник',
          '+2 игнорируемой брони на каждое попадание.',
          {armorPierceAdd: 2}),
        upgrade('b', 2, 'Сквозная закалка',
          '+20% урона и +1 уникальная пробиваемая цель.',
          {damageMul: 1.2, pierceAdd: 1}),
        upgrade('b', 3, 'Гранёный пробойник',
          '+3 пробития брони, +2 сквозные цели и скорость иглы ×1,20.',
          {armorPierceAdd: 3, pierceAdd: 2, projectileSpeedMul: 1.2}),
        upgrade('b', 4, 'Осадная огранка',
          'Урон ×1,50, +2 сквозные цели, урон по щитам ×1,20.',
          {damageMul: 1.5, pierceAdd: 2, shieldMultiplierMul: 1.2}),
        upgrade('b', 5, 'Сердце алмазного копья',
          'Иглы превращаются в мгновенные серебряные лучи: базовый урон луча 24, интервал 0,50 с, дальность 180. Ещё +4 цели, урон ×1,50, по щитам ×1,25, по боссам ×1,20.',
          {pierceAdd: 4, damageMul: 1.5, shieldMultiplierMul: 1.25, bossMultiplierMul: 1.2},
          {replaceAttack: {
            ...baseAttack, mode: 'beam', damage: 24, interval: 0.5, range: 180,
            projectileSpeed: 0, projectileRadius: 5,
          }}),
      ],
    },
    {
      id: 'needle-ricochet', name: 'Рикошетный рой',
      description: 'Золотые челноки передают разряд от одного врага к следующему.',
      upgrades: [
        upgrade('c', 1, 'Дальний челнок',
          'Дальность ×1,18: поиск целей начинается дальше.',
          {rangeMul: 1.18}),
        upgrade('c', 2, 'Точно в уязвимость',
          '+25% урона и +15% урона по боссам — действует на любой вид атаки.',
          {damageMul: 1.25, bossMultiplierMul: 1.15}),
        upgrade('c', 3, 'Первый зигзаг',
          'Атака становится мгновенной цепью: +2 перехода, расстояние перехода 80.',
          {chainsAdd: 2, chainRadiusAdd: 20, damageMul: 1.1},
          {replaceAttack: {
            ...baseAttack, mode: 'chain', chainRadius: 60,
            projectileSpeed: 0, projectileRadius: 3,
          }}),
        upgrade('c', 4, 'Перекрёстные стежки',
          '+1 независимая цепь, ещё +2 перехода, радиус перехода +25, интервал ×0,90. Метка повышает входящий урон на 10% на 2,5 с.',
          {countAdd: 1, chainsAdd: 2, chainRadiusAdd: 25, intervalMul: 0.9},
          {addStatuses: [{kind: 'mark', power: 0.1, duration: 2.5, maxStacks: 1}]}),
        upgrade('c', 5, 'Золотая корона роя',
          'Три орбитальных челнока: базовый урон цепи 14, дальность 180, +1 цепь, ещё +4 перехода, радиус +30, урон ×1,80, интервал ×0,75.',
          {countAdd: 1, chainsAdd: 4, chainRadiusAdd: 30, damageMul: 1.8, intervalMul: 0.75},
          {replaceAttack: {
            ...baseAttack, mode: 'chain', damage: 14, range: 180,
            chainRadius: 60, projectileSpeed: 0, projectileRadius: 4,
          }}),
      ],
    },
  ],
};

/** Consumers may freely mutate their copy without touching the catalog. */
export function getTower(): TowerDef {
  return structuredClone(needle);
}
