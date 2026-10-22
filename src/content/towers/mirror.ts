import type {AttackDef, EffectDef, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ART = '/art/towers/mirror/';

const baseAttack: AttackDef = {
  mode: 'shot', element: 'energy', damage: 8, interval: 1, range: 170,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [],
  projectileSpeed: 480, projectileRadius: 4, homing: false, windup: 0, arc: 0,
};

// Effect parameters unused by a particular effect kind are explicitly zero.
function effect(id: string, kind: EffectDef['kind'], power: number, radius: number,
                interval = 0, duration = 0, cap = 0, stat?: EffectDef['stat']): EffectDef {
  return {id, kind, power, radius, interval, duration, cap, ...(stat ? {stat} : {})};
}

function visual(asset: string, accent: string, motion: VisualState['motion'],
                projectile = 'mirror-shard', glow = 0.4, scale = 1): VisualState {
  return {asset: `${ART}${asset}.svg`, accent, muzzle: 'mirror-flare',
    projectile, impact: 'mirror-burst', scale, glow, motion};
}

const aVisual = (tier: number) => visual(`a${tier}`, '#99f5ec', tier >= 3 ? 'orbit' : 'pulse',
  tier >= 5 ? 'spectral-bolt' : 'mirror-shard', 0.35 + tier * 0.1, 1);
const bVisual = (tier: number) => visual(`b${tier}`, '#b4ebff', tier >= 3 ? 'rotate' : 'pulse',
  tier >= 3 ? 'shard-fan' : 'mirror-shard', 0.35 + tier * 0.1, 1);
const cVisual = (tier: number) => visual(`c${tier}`, '#ffe2a1', tier >= 3 ? 'breathe' : 'pulse',
  tier >= 5 ? 'corridor-ray' : 'mirror-shard', 0.35 + tier * 0.1, 1);

const a: UpgradeDef[] = [
  {
    id: 'mirror-a1', name: 'Серебряная юстировка', tier: 1, cost: 525,
    description: 'Полировка оптики: урон собственных попаданий ×1,18; скорость снаряда ×1,3.',
    delta: {damageMul: 1.18, projectileSpeedMul: 1.3}, visual: aVisual(1),
  },
  {
    id: 'mirror-a2', name: 'Сдвоенный фокус', tier: 2, cost: 1045,
    description: 'Частота собственных атак: интервал ×0,83. Пробивание брони +2.',
    delta: {intervalMul: 0.83, armorPierceAdd: 2}, visual: aVisual(2),
  },
  {
    id: 'mirror-a3', name: 'Первый отражённый ствол', tier: 3, cost: 2615,
    description: 'Копирует 42% базовой разрешённой атаки ближайшей боевой башни в радиусе 195; дальность своей атаки ×1,08.',
    delta: {rangeMul: 1.08},
    effects: [effect('mirror-copy', 'copy', 0.42, 195)], visual: aVisual(3),
  },
  {
    id: 'mirror-a4', name: 'Резонанс отражений', tier: 4, cost: 6270,
    description: 'Доля копии 65% в радиусе 220; собственный интервал ×0,90; урон боссам ×1,15.',
    delta: {intervalMul: 0.90, bossMultiplierMul: 1.15},
    effects: [effect('mirror-copy', 'copy', 0.65, 220)], visual: aVisual(4),
  },
  {
    id: 'mirror-a5', name: 'Триумвират двойников', tier: 5, cost: 15675,
    description: 'Три собственных снаряда за залп (+2 выстрела), копия 90% в радиусе 240 и одно эхо с силой 42% через 1,2 с (до 2 целей).',
    delta: {countAdd: 2, shieldMultiplierMul: 1.25},
    effects: [effect('mirror-copy', 'copy', 0.90, 240),
      effect('mirror-a-echo', 'echo', 0.42, 205, 1.2, 0, 2)],
    visual: aVisual(5),
  },
];

const b: UpgradeDef[] = [
  {
    id: 'mirror-b1', name: 'Раздвоенная кромка', tier: 1, cost: 475,
    description: 'Дополнительный отдельный снаряд на каждую атаку (+1 к count).',
    delta: {countAdd: 1}, visual: bVisual(1),
  },
  {
    id: 'mirror-b2', name: 'Капиллярные грани', tier: 2, cost: 950,
    description: 'Каждый прямой удар пробивает ещё одну цель (+1 pierce), радиус осколочного всплеска +14.',
    delta: {pierceAdd: 1, splashAdd: 14}, visual: bVisual(2),
  },
  {
    id: 'mirror-b3', name: 'Веер хрустальных стрел', tier: 3, cost: 2375,
    description: 'Переход к конусу 60°: пять разнесённых стрел по 7 урона за 0,9 с, с осколочным контактом.',
    delta: {},
    replaceAttack: {...baseAttack, mode: 'cone', damage: 7, interval: 0.9,
      range: 180, count: 4, arc: 60, splash: 9, projectileSpeed: 550,
      projectileRadius: 3}, visual: bVisual(3),
  },
  {
    id: 'mirror-b4', name: 'Каскад микропризм', tier: 4, cost: 5700,
    description: 'Ещё две стрелы за залп (+2 count), всплеск +10, метка 10% входящего урона на 1,8 с.',
    delta: {countAdd: 2, splashAdd: 10},
    addStatuses: [{kind: 'mark', power: 0.1, duration: 1.8}], visual: bVisual(4),
  },
  {
    id: 'mirror-b5', name: 'Корона тысячи граней', tier: 5, cost: 14250,
    description: 'Широкий конус 110° с 12 осколками по 10 урона каждые 0,75 с; сквозной удар и эхо 50% через 1,5 с.',
    delta: {pierceAdd: 1, shieldMultiplierMul: 1.2},
    replaceAttack: {...baseAttack, mode: 'cone', damage: 10, interval: 0.75,
      range: 205, pierce: 2, count: 9, splash: 12, arc: 110,
      projectileSpeed: 620, projectileRadius: 3},
    effects: [effect('mirror-b-echo', 'echo', 0.5, 205, 1.5, 0, 3)],
    visual: bVisual(5),
  },
];

const c: UpgradeDef[] = [
  {
    id: 'mirror-c1', name: 'Дальнозоркие фасеты', tier: 1, cost: 455,
    description: 'Собственная дальность ×1,15; обнаружение скрытых целей собственными атаками.',
    delta: {rangeMul: 1.15, detects: true}, visual: cVisual(1),
  },
  {
    id: 'mirror-c2', name: 'Раскрывающий отблеск', tier: 2, cost: 905,
    description: 'Даёт союзным башням обнаружение в радиусе 145; урон своей атаки ×1,10.',
    delta: {damageMul: 1.10},
    effects: [effect('mirror-detection', 'aura', 1, 145, 0, 0, 0, 'detect')],
    visual: cVisual(2),
  },
  {
    id: 'mirror-c3', name: 'Коридор прицельного света', tier: 3, cost: 2260,
    description: 'Союзные боевые башни в радиусе 195 получают +12% дальности; личная дальность ×1,08.',
    delta: {rangeMul: 1.08},
    effects: [effect('mirror-range', 'aura', 0.12, 195, 0, 0, 0, 'range')],
    visual: cVisual(3),
  },
  {
    id: 'mirror-c4', name: 'Терраса проходящего луча', tier: 4, cost: 5415,
    description: 'Аура дальности +20% в радиусе 230 и обнаружение в радиусе 225; свой интервал ×0,90.',
    delta: {intervalMul: 0.90},
    effects: [effect('mirror-range', 'aura', 0.20, 230, 0, 0, 0, 'range'),
      effect('mirror-detection', 'aura', 1, 225, 0, 0, 0, 'detect')],
    visual: cVisual(4),
  },
  {
    id: 'mirror-c5', name: 'Собор бесконечного горизонта', tier: 5, cost: 13540,
    description: 'Двойной сквозной луч, раскрывающий скрытность на 4 с; аура дальности +30% (270), обнаружения (280), темпа +15% (230).',
    delta: {armorPierceAdd: 3},
    replaceAttack: {...baseAttack, mode: 'beam', damage: 18, interval: 0.65,
      range: 255, count: 2, pierce: 3, projectileSpeed: 0,
      projectileRadius: 5, statuses: [{kind: 'reveal', power: 1, duration: 4}]},
    effects: [effect('mirror-range', 'aura', 0.30, 270, 0, 0, 0, 'range'),
      effect('mirror-detection', 'aura', 1, 280, 0, 0, 0, 'detect'),
      effect('mirror-tempo', 'aura', 0.15, 230, 0, 0, 0, 'attackSpeed')],
    visual: cVisual(5),
  },
];

const tower: TowerDef = {
  id: 'mirror', name: 'Зеркальная галерея',
  description: 'Медная оптическая башня. Сама поражает цель кристаллическим импульсом; отражает атаки соседей, распускает осколки или освещает союзные позиции.',
  category: 'tech', placement: 'land', cost: 950, footprint: 25,
  attack: baseAttack, effects: [], abilities: [],
  visual: visual('base', '#9ee8dc', 'pulse', 'mirror-shard', 0.38),
  paths: [
    {id: 'mirror-a', name: 'Двойник', description: 'Усиление отражённой атаки союзного орудия и призрачных выстрелов.', upgrades: a},
    {id: 'mirror-b', name: 'Осколочные зеркала', description: 'Расходящиеся залпы, пробивание и осколочные попадания.', upgrades: b},
    {id: 'mirror-c', name: 'Световой коридор', description: 'Увеличение дальности, открытие маскировки и точные лучи поддержки.', upgrades: c},
  ],
};

/** Independent definition on every catalog read, including nested status/effect arrays. */
export function getTower(): TowerDef {
  return structuredClone(tower);
}
