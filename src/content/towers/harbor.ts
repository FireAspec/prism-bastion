import type {AttackDef, EffectDef, StatDelta, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ROOT = '/art/towers/harbor/';
function visual(name: string, accent: string, projectile: string, impact: string, motion: VisualState['motion'], glow = 0.35): VisualState {
  return {asset: `${ROOT}${name}.svg`, accent, muzzle: 'deck-flash', projectile, impact, scale: 1, glow, motion};
}
function effect(id: string, kind: EffectDef['kind'], power: number, radius = 0, extra: Partial<EffectDef> = {}): EffectDef {
  return {id, kind, power, radius, interval: 0, duration: 0, cap: 0, ...extra};
}
function upgrade(branch: 'a'|'b'|'c', tier: 1|2|3|4|5, name: string, description: string,
  cost: number, delta: StatDelta, options: Pick<UpgradeDef, 'replaceAttack'|'addStatuses'|'effects'|'abilities'> = {}): UpgradeDef {
  const themes = {
    a: ['#63e1d5', 'torpedo', 'water-burst', 'orbit'],
    b: ['#ffc17a', 'heavy-shell', 'broadside', 'pulse'],
    c: ['#a7f6d1', 'cargo-pulse', 'harbor-wave', 'breathe'],
  } as const;
  const [accent, projectile, impact, motion] = themes[branch];
  return {id: `harbor-${branch}${tier}`, name, description, tier, cost, delta, ...options,
    visual: visual(`${branch}${tier}`, accent, projectile, impact, motion, tier === 5 ? 0.8 : 0.25 + tier * 0.08)};
}

const shot: AttackDef = {
  mode: 'shot', element: 'kinetic', damage: 13, interval: 0.8, range: 190,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [], projectileSpeed: 340,
  projectileRadius: 4, homing: false, windup: 0, arc: 0,
};
const drones: AttackDef = {...shot, mode: 'drone', damage: 12, interval: 0.72,
  range: 220, count: 3, projectileSpeed: 410, projectileRadius: 3, homing: true};
const artillery: AttackDef = {...shot, mode: 'mortar', damage: 72, interval: 2.15,
  range: 325, splash: 36, projectileSpeed: 290, projectileRadius: 7,
  armorPierce: 3, shieldMultiplier: 1.15, bossMultiplier: 1.12};
const tide: AttackDef = {...shot, mode: 'tide', element: 'energy', damage: 24,
  interval: 1.4, range: 210, pierce: 2, splash: 30, projectileSpeed: 280,
  projectileRadius: 6, statuses: [{kind: 'wet', power: 1, duration: 3}]};

const definition: TowerDef = {
  id: 'harbor', name: 'Дозорный причал',
  description: 'Плавучий сторожевой док. Перерождается во флотилию, линкор или торговый порт.',
  category: 'water', placement: 'water', footprint: 26, cost: 750,
  attack: shot, effects: [], abilities: [],
  visual: visual('base', '#72e2d8', 'harbor-bolt', 'salt-splash', 'breathe'),
  paths: [
    {id: 'harbor-flotilla', name: 'Флотилия', description: 'Катера, перехват и торпедный шквал.', upgrades: [
      upgrade('a', 1, 'Спусковой понтон', 'Малый катер сокращает интервал выстрелов на 9%.', 375,
        {intervalMul: 0.91}),
      upgrade('a', 2, 'Парный рейд', 'Второй катер: +1 выстрел в залпе и +12% скорости снарядов.', 750,
        {countAdd: 1, projectileSpeedMul: 1.12}),
      upgrade('a', 3, 'Патрульная тройка', 'Обслуживаемые дроны: 3 катера, 12 урона, 0.72 с, дальность 220.', 1875,
        {}, {replaceAttack: drones}),
      upgrade('a', 4, 'Эшелон перехвата', '+1 катер, +20% урона, +8% дальности; эхо-торпеда каждые 3 с.', 4500,
        {countAdd: 1, damageMul: 1.2, rangeMul: 1.08},
        {effects: [effect('harbor-patrol-echo', 'echo', 0.35, 0, {interval: 3, cap: 2})]}),
      upgrade('a', 5, 'Армада трёх ярусов', 'Трёхпалубная верфь: 6 базовых катеров, 22 урона, пробитие 2, взрыв 18, мокрые торпеды; активный шквал.', 11250,
        {}, {replaceAttack: {...drones, damage: 22, interval: 0.54, range: 245, count: 6,
            pierce: 2, splash: 18, projectileRadius: 5,
            statuses: [{kind: 'wet', power: 1, duration: 3.5}]},
          abilities: [{id: 'harbor-torpedo-surge', name: 'Торпедный шквал',
            description: '160 урона в радиусе 150; 48 с перезарядки.', kind: 'nova', power: 160,
            radius: 150, duration: 0, cooldown: 48, element: 'kinetic'}]}),
    ]},
    {id: 'harbor-battleship', name: 'Линкор', description: 'Дальномеры и тяжёлый главный калибр.', upgrades: [
      upgrade('b', 1, 'Дальномерный бакен', '+16% дальности и +18% скорости снарядов.', 395,
        {rangeMul: 1.16, projectileSpeedMul: 1.18}),
      upgrade('b', 2, 'Бронебойный погреб', '+2 пробития брони и +12% урона щитам.', 790,
        {armorPierceAdd: 2, shieldMultiplierMul: 1.12}),
      upgrade('b', 3, 'Береговая батарея', 'Мортира: 72 урона за 2.15 с, взрыв 36, исходная дальность 325.', 1970,
        {}, {replaceAttack: artillery}),
      upgrade('b', 4, 'Четырёхствольная палуба', '+1 снаряд в залпе, +25% урона, +20 радиуса взрыва, +10% против боссов.', 4725,
        {countAdd: 1, damageMul: 1.25, splashAdd: 20, bossMultiplierMul: 1.1}),
      upgrade('b', 5, 'Цитадель-броненосец', 'Башни-близнецы: 2 базовых снаряда по 150 урона, взрыв 80, пробитие 3 и главный калибр.', 11815,
        {}, {replaceAttack: {...artillery, damage: 150, interval: 2.55, range: 385,
            count: 2, splash: 80, pierce: 3, projectileSpeed: 380, projectileRadius: 10,
            armorPierce: 7, bossMultiplier: 1.3, push: 18},
          abilities: [{id: 'harbor-grand-broadside', name: 'Главный калибр',
            description: '350 урона в радиусе 160; 65 с перезарядки.', kind: 'meteor',
            power: 350, radius: 160, duration: 0, cooldown: 65, element: 'kinetic'}]}),
    ]},
    {id: 'harbor-trade', name: 'Торговый порт', description: 'Груз, денежный поток и ауры снабжения.', upgrades: [
      upgrade('c', 1, 'Склад приливов', '+16 кредитов в конце волны.', 360,
        {}, {effects: [effect('harbor-port-income', 'income', 16)]}),
      upgrade('c', 2, 'Маяки снабжения', '+32 кредита в конце волны; +10% дальности соседям в радиусе 160.', 715,
        {}, {effects: [effect('harbor-port-income', 'income', 32),
          effect('harbor-port-range', 'aura', 0.1, 160, {stat: 'range'})]}),
      upgrade('c', 3, 'Торговая гавань', 'Волна 24 урона/1.4 с, взрыв 30 и wet; +105 кредитов/волну и +12% скорости соседям.', 1785,
        {}, {replaceAttack: tide, effects: [effect('harbor-port-income', 'income', 105),
          effect('harbor-port-speed', 'aura', 0.12, 185, {stat: 'attackSpeed'})]}),
      upgrade('c', 4, 'Плавучий грузовой узел', '+230 кредитов/волну, +18% скорости и +12% урона соседям; волна шире и наносит mark.', 4275,
        {splashAdd: 24, rangeMul: 1.12}, {addStatuses: [{kind: 'mark', power: 0.1, duration: 2.5}],
          effects: [effect('harbor-port-income', 'income', 230),
            effect('harbor-port-speed', 'aura', 0.18, 210, {stat: 'attackSpeed'}),
            effect('harbor-port-damage', 'aura', 0.12, 210, {stat: 'damage'})]}),
      upgrade('c', 5, 'Венец семи причалов', 'Контейнерный порт: 2 импульса по 65 урона с wet/mark; +500 за волну, ауры +25% скорости/+20% урона и поставка.', 10690,
        {}, {replaceAttack: {...tide, damage: 65, interval: 1.2, range: 250,
            count: 2, pierce: 4, splash: 78, projectileSpeed: 350, projectileRadius: 9,
            statuses: [{kind: 'wet', power: 1, duration: 4}, {kind: 'mark', power: 0.1, duration: 3}]},
          effects: [effect('harbor-port-income', 'income', 500),
            effect('harbor-port-speed', 'aura', 0.25, 250, {stat: 'attackSpeed'}),
            effect('harbor-port-damage', 'aura', 0.2, 250, {stat: 'damage'}),
            effect('harbor-port-range', 'aura', 0.12, 250, {stat: 'range'})],
          abilities: [{id: 'harbor-emergency-freight', name: 'Экстренный конвой',
            description: 'Поставка 350 кредитов; 90 с перезарядки, если доход разрешён.',
            kind: 'mint', power: 350, radius: 0, duration: 0, cooldown: 90, element: 'energy'}]}),
    ]},
  ],
};

/** Detached data: mutation by the combat resolver cannot leak into later runs. */
export function getTower(): TowerDef { return structuredClone(definition); }
