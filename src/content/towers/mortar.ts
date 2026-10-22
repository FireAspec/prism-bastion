import type {AttackDef, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const art = '/art/towers/mortar/';

function visual(asset: string, accent: string, projectile: string, impact: string, scale = 1, glow = 0.3): VisualState {
  return {
    asset: `${art}${asset}.svg`, accent, muzzle: 'mortar-flash', projectile, impact,
    scale, glow, motion: 'breathe',
  };
}

const reveal: StatusSpec = {kind: 'reveal', power: 1, duration: 4};
const mark: StatusSpec = {kind: 'mark', power: 0.1, duration: 4};

const attack: AttackDef = {
  mode: 'mortar', element: 'kinetic', damage: 50, interval: 2.4, range: 340,
  pierce: 1, count: 1, splash: 44, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [],
  projectileSpeed: 320, projectileRadius: 5, homing: false, windup: 0.24, arc: 65,
};

// Costs are independent upgrade purchases at normal difficulty, without discounts.
// All cross-path upgrades compose through deltas/statuses; none replaces an attack.
const meteor: UpgradeDef[] = [
  {
    id: 'mortar-a1', tier: 1, name: 'Широкий кратер', cost: 445,
    description: 'Усиленные опоры: урон ×1,12, радиус взрыва +16 пкс.',
    delta: {damageMul: 1.12, splashAdd: 16},
    visual: visual('a1', '#ffc36e', 'mortar-shell', 'mortar-crater', 1.02, 0.38),
  },
  {
    id: 'mortar-a2', tier: 2, name: 'Пороховой ускоритель', cost: 885,
    description: 'Перезарядка ×0,90, скорость снаряда ×1,18, пробитие брони +3.',
    delta: {intervalMul: 0.9, projectileSpeedMul: 1.18, armorPierceAdd: 3},
    visual: visual('a2', '#ffc36e', 'mortar-shell-fast', 'mortar-crater', 1.04, 0.44),
  },
  {
    id: 'mortar-a3', tier: 3, name: 'Тунгусский заряд', cost: 2205,
    description: 'Тяжёлая болванка: урон ×1,80, радиус +34 пкс, интервал ×1,12, пробитие +7.',
    delta: {damageMul: 1.8, splashAdd: 34, intervalMul: 1.12, armorPierceAdd: 7},
    visual: visual('a3', '#ffae45', 'mortar-meteor', 'mortar-crater', 1.06, 0.53),
  },
  {
    id: 'mortar-a4', tier: 4, name: 'Раскалённый обод', cost: 5285,
    description: 'Урон ×1,38, радиус +30 пкс; ожог 6 ед. силы на 3 с, не более 2 стеков.',
    delta: {damageMul: 1.38, splashAdd: 30},
    addStatuses: [{kind: 'burn', power: 6, duration: 3, maxStacks: 2}],
    visual: visual('a4', '#ff9c39', 'mortar-meteor', 'mortar-inferno', 1.08, 0.65),
  },
  {
    id: 'mortar-a5', tier: 5, name: 'Падение небес', cost: 13205,
    description: 'Два гигантских метеора за залп; урон ×1,60, радиус +40 пкс, по боссам ×1,35. Активный метеор: 520 урона в радиусе 175 пкс раз в 65 с.',
    delta: {countAdd: 1, damageMul: 1.6, splashAdd: 40, bossMultiplierMul: 1.35},
    abilities: [{id: 'mortar-skyfall', name: 'Удар с небес', description: 'Метеорный удар по области.', kind: 'meteor', cooldown: 65, power: 520, duration: 0, radius: 175, element: 'fire'}],
    visual: visual('a5', '#ff782e', 'mortar-supermeteor', 'mortar-inferno', 1.12, 0.95),
  },
];

const cluster: UpgradeDef[] = [
  {
    id: 'mortar-b1', tier: 1, name: 'Раздвоенный стакан', cost: 380,
    description: 'Два снаряда вместо одного; радиус каждого взрыва −7 пкс.',
    delta: {countAdd: 1, splashAdd: -7},
    visual: visual('b1', '#72dedc', 'mortar-pellet', 'mortar-cluster', 1.02, 0.4),
  },
  {
    id: 'mortar-b2', tier: 2, name: 'Быстрая подача', cost: 760,
    description: 'Интервал ×0,86, дальность ×1,08: ускоренная кассетная обойма.',
    delta: {intervalMul: 0.86, rangeMul: 1.08},
    visual: visual('b2', '#72dedc', 'mortar-pellet', 'mortar-cluster', 1.04, 0.48),
  },
  {
    id: 'mortar-b3', tier: 3, name: 'Трёхлучевая кассета', cost: 1900,
    description: 'Ещё 2 снаряда за залп (всего 4); урон каждого ×0,72, радиус −6 пкс.',
    delta: {countAdd: 2, damageMul: 0.72, splashAdd: -6},
    visual: visual('b3', '#67eaf0', 'mortar-cluster-shell', 'mortar-cluster', 1.07, 0.56),
  },
  {
    id: 'mortar-b4', tier: 4, name: 'Автомат перекрёстного огня', cost: 4560,
    description: 'Ещё 2 снаряда (всего 6), интервал ×0,82; замедление на 16% в течение 1,4 с.',
    delta: {countAdd: 2, intervalMul: 0.82},
    addStatuses: [{kind: 'slow', power: 0.16, duration: 1.4}],
    visual: visual('b4', '#65f1ea', 'mortar-cluster-shell', 'mortar-cluster', 1.09, 0.7),
  },
  {
    id: 'mortar-b5', tier: 5, name: 'Соты бомбардирования', cost: 11400,
    description: 'Десять малых зон поражения за залп; урон каждого ×1,20, радиус +12 пкс, дальность ×1,12. Активная перегрузка на 7 с, перезарядка способности 50 с.',
    delta: {countAdd: 4, damageMul: 1.2, splashAdd: 12, rangeMul: 1.12},
    abilities: [{id: 'mortar-cluster-overclock', name: 'Барабанный шквал', description: 'На 7 секунд усиливает темп кассет.', kind: 'overclock', cooldown: 50, power: 0.3, duration: 7, radius: 0, element: 'kinetic'}],
    visual: visual('b5', '#4bfff0', 'mortar-swarm', 'mortar-cluster', 1.12, 0.9),
  },
];

const illuminator: UpgradeDef[] = [
  {
    id: 'mortar-c1', tier: 1, name: 'Люминесцентный заряд', cost: 400,
    description: 'Обнаруживает скрытых; раскрывает поражённые цели на 4 с.',
    delta: {detects: true}, addStatuses: [reveal],
    visual: visual('c1', '#fbe9a2', 'mortar-flare', 'mortar-flareburst', 1.02, 0.43),
  },
  {
    id: 'mortar-c2', tier: 2, name: 'Сигнальная метка', cost: 800,
    description: 'Накладывает метку на 4 с (+10% входящего урона по отмеченной цели); дальность ×1,12.',
    delta: {rangeMul: 1.12}, addStatuses: [mark],
    visual: visual('c2', '#fbe9a2', 'mortar-flare', 'mortar-flareburst', 1.04, 0.51),
  },
  {
    id: 'mortar-c3', tier: 3, name: 'Прожекторный веер', cost: 2000,
    description: 'Второй светящийся снаряд, радиус взрыва +24 пкс; союзные башни в радиусе 180 пкс обнаруживают скрытых.',
    delta: {countAdd: 1, splashAdd: 24},
    effects: [{id: 'mortar-signal-net', kind: 'aura', stat: 'detect', power: 1, radius: 180, interval: 0, duration: 0, cap: 0}],
    visual: visual('c3', '#fff2b4', 'mortar-signal', 'mortar-flareburst', 1.07, 0.62),
  },
  {
    id: 'mortar-c4', tier: 4, name: 'Зенитные маячки', cost: 4800,
    description: 'Третий заряд, интервал ×0,80, по боссам ×1,18; попадание замедляет цель на 18% на 2,5 с.',
    delta: {countAdd: 1, intervalMul: 0.8, bossMultiplierMul: 1.18},
    addStatuses: [{kind: 'slow', power: 0.18, duration: 2.5}],
    visual: visual('c4', '#fff2b4', 'mortar-signal', 'mortar-beacon', 1.09, 0.74),
  },
  {
    id: 'mortar-c5', tier: 5, name: 'Ночь становится днём', cost: 12000,
    description: 'Шесть парашютных сигнальных зарядов; радиус +34 пкс, интервал ×0,85. Аура обнаружения 320 пкс; метка длится 6 с.',
    delta: {countAdd: 3, splashAdd: 34, intervalMul: 0.85},
    addStatuses: [{kind: 'mark', power: 0.1, duration: 6}],
    effects: [{id: 'mortar-signal-net', kind: 'aura', stat: 'detect', power: 1.1, radius: 320, interval: 0, duration: 0, cap: 0}],
    visual: visual('c5', '#fff8d0', 'mortar-parachute', 'mortar-beacon', 1.12, 0.96),
  },
];

const definition: TowerDef = {
  id: 'mortar', name: 'Небесная мортира',
  description: 'Дальнобойная навесная артиллерия: метеорные кратеры, кассетные залпы или сигнальное освещение.',
  category: 'tech', cost: 800, footprint: 26, placement: 'land',
  attack, effects: [], abilities: [],
  visual: visual('base', '#dfb574', 'mortar-shell', 'mortar-crater'),
  paths: [
    {id: 'meteor', name: 'Метеор', description: 'Сверхтяжёлые навесные взрывы и активный удар с небес.', upgrades: meteor},
    {id: 'cluster', name: 'Кассета', description: 'Много небольших зон поражения и скоростная подача.', upgrades: cluster},
    {id: 'illuminator', name: 'Осветитель', description: 'Раскрытие маскировки, метки и поддержка обзора.', upgrades: illuminator},
  ],
};

/** Independent mutable content object on every call, including nested statuses and visuals. */
export function getTower(): TowerDef {
  return structuredClone(definition);
}
