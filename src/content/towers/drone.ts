import type {AttackDef, EffectDef, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

// Content only; the combat module owns targeting, flight paths and damage application.
const attack = (overrides: Partial<AttackDef> = {}): AttackDef => ({
  mode: 'drone', element: 'kinetic', damage: 12, interval: 0.8, range: 230,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [],
  projectileSpeed: 440, projectileRadius: 4, homing: true, windup: 0, arc: 360,
  ...overrides,
});

const mark: StatusSpec = {kind: 'mark', power: 0.1, duration: 2.6};
const reveal: StatusSpec = {kind: 'reveal', power: 1, duration: 3};
const shred: StatusSpec = {kind: 'shred', power: 0.18, duration: 3};

const aura = (id: string, stat: NonNullable<EffectDef['stat']>, power: number, radius: number): EffectDef => ({
  id, kind: 'aura', stat, power, radius, interval: 0, duration: 0, cap: 0,
});

const visual = (asset: string, accent: string, motion: VisualState['motion'], glow = 0.5): VisualState => ({
  asset: `./art/towers/drone/${asset}.svg`, accent,
  muzzle: 'drone-launch', projectile: 'drone-bolt', impact: 'kinetic-spark',
  scale: 1, glow, motion,
});

const upgrade = (
  id: string, name: string, description: string, cost: number,
  tier: UpgradeDef['tier'], delta: UpgradeDef['delta'],
  extras: Partial<Pick<UpgradeDef, 'replaceAttack' | 'effects' | 'addStatuses' | 'abilities'>> = {},
): UpgradeDef => {
  const path = id.split('-')[1][0];
  const accent = path === 'a' ? '#56e7e4' : path === 'b' ? '#ffb869' : '#9af5bc';
  return {
    id, name, description, cost, tier, delta, ...extras,
    visual: visual(`${path}${tier}`, accent, path === 'a' ? 'orbit' : path === 'b' ? 'pulse' : 'breathe',
      tier === 5 ? 0.95 : 0.52 + tier * 0.075),
  };
};

const DEFINITION: TowerDef = {
  id: 'drone',
  name: 'Ангар дронов',
  description: 'Наземная платформа выпускает управляемые аппараты: рой, тяжёлый удар или координация обороны.',
  category: 'tech', cost: 900, footprint: 26, placement: 'land',
  attack: attack(), effects: [], abilities: [],
  visual: visual('base', '#69e0e6', 'orbit', 0.45),
  paths: [
    {
      id: 'drone-swarm', name: 'Рой',
      description: 'Быстрые ударные дроны с независимыми целями и плотным перекрёстным огнём.',
      upgrades: [
        upgrade('drone-a1', 'Парная палуба', 'Ещё один дрон на каждом цикле: 2 аппарата вместо 1.', 450, 1,
          {countAdd: 1}),
        upgrade('drone-a2', 'Стабилизаторы звена', 'Интервал ×0,88; дальность ×1,08. Улучшает и тяжёлый борт, и разведчиков.', 900, 2,
          {intervalMul: 0.88, rangeMul: 1.08}),
        upgrade('drone-a3', 'Штурмовое крыло', 'Три дрона с ранними улучшениями; база 15 урона / 0,72 с / 245 дальности.', 2250, 3, {},
          {replaceAttack: attack({damage: 15, interval: 0.72, range: 245, count: 2, projectileSpeed: 495})}),
        upgrade('drone-a4', 'Перекрёстный заход', 'Четвёртый дрон, урон ×1,18 и дальность ×1,05.', 5400, 4,
          {countAdd: 1, damageMul: 1.18, rangeMul: 1.05}),
        upgrade('drone-a5', 'Шесть небесных доков', 'Шесть аппаратов, по 2 цели на пролёт и 1 цепной переход; база 28 урона / 0,58 с.', 13500, 5, {},
          {replaceAttack: attack({damage: 28, interval: 0.58, range: 272, count: 4,
            pierce: 2, chains: 1, chainRadius: 65, projectileSpeed: 600, projectileRadius: 5})}),
      ],
    },
    {
      id: 'drone-gunship', name: 'Тяжёлый борт',
      description: 'Бронебойные снаряды, залпы по площади и мощный осадный аппарат.',
      upgrades: [
        upgrade('drone-b1', 'Бронебойные контейнеры', 'Бронепробитие +3, пробитие +1 цель, скорость снаряда ×1,2.', 430, 1,
          {armorPierceAdd: 3, pierceAdd: 1, projectileSpeedMul: 1.2}),
        upgrade('drone-b2', 'Усилитель залпа', 'Урон ×1,28 и урон щитам ×1,2; работает с любой основной веткой.', 855, 2,
          {damageMul: 1.28, shieldMultiplierMul: 1.2}),
        upgrade('drone-b3', 'Бомбовый челнок', 'Тяжёлый дрон: 92 урона / 2,1 с, взрыв радиусом 32 и бонус против боссов.', 2140, 3, {},
          {replaceAttack: attack({damage: 92, interval: 2.1, range: 252, splash: 32,
            armorPierce: 7, shieldMultiplier: 1.6, bossMultiplier: 1.25,
            projectileSpeed: 310, projectileRadius: 7, windup: 0.3})}),
        upgrade('drone-b4', 'Осадные пилоны', 'Урон ×1,2, радиус взрыва +22, бронепробитие +5, урон боссам ×1,12.', 5130, 4,
          {damageMul: 1.2, splashAdd: 22, armorPierceAdd: 5, bossMultiplierMul: 1.12}),
        upgrade('drone-b5', 'Левиафан стапеля', 'Гигантский борт: 265 урона / 2,6 с, взрыв 68, отталкивание 20, ослабление брони.', 12825, 5, {},
          {replaceAttack: attack({damage: 265, interval: 2.6, range: 292, pierce: 2,
            splash: 68, armorPierce: 16, shieldMultiplier: 2.4, bossMultiplier: 1.7,
            projectileSpeed: 340, projectileRadius: 11, windup: 0.7, push: 20,
            statuses: [shred]})}),
      ],
    },
    {
      id: 'drone-relay', name: 'Ретранслятор',
      description: 'Разведка скрытых угроз, метки на целях и поддержка ближайших башен.',
      upgrades: [
        upgrade('drone-c1', 'Спектральный радар', 'Обнаруживает скрытых врагов; дальность атаки ×1,12.', 500, 1,
          {detects: true, rangeMul: 1.12}),
        upgrade('drone-c2', 'Лазерные маячки', 'Попадание раскрывает врага на 3 с и помечает на 2,6 с (+10% входящего урона).', 995, 2,
          {shieldMultiplierMul: 1.1}, {addStatuses: [reveal, mark]}),
        upgrade('drone-c3', 'Узел сопровождения', 'Два разведчика: 16 урона / 0,72 с; аура обнаружения скрытых радиусом 210.', 2480, 3, {},
          {replaceAttack: attack({damage: 16, interval: 0.72, range: 246, count: 2,
            detects: true, projectileSpeed: 560, statuses: [reveal, mark]}),
           effects: [aura('drone-relay-detect', 'detect', 1, 210)]}),
        upgrade('drone-c4', 'Сеть целеуказания', 'Третий разведчик, интервал ×0,86; соседям +10% урона и +8% дальности.', 5945, 4,
          {countAdd: 1, intervalMul: 0.86},
          {effects: [aura('drone-relay-damage', 'damage', 0.1, 190),
                     aura('drone-relay-range', 'range', 0.08, 190)]}),
        upgrade('drone-c5', 'Небесная решётка', 'Четыре разведчика с площадным разрядом и цепью; обнаружение 310, соседям +18% урона, +12% скорости и дальности.', 14855, 5, {},
          {replaceAttack: attack({damage: 25, interval: 0.64, range: 278, count: 3,
            pierce: 2, splash: 24, chains: 1, chainRadius: 85, detects: true,
            projectileSpeed: 620, projectileRadius: 5, statuses: [reveal, mark]}),
           effects: [aura('drone-relay-detect', 'detect', 1, 310),
                     aura('drone-relay-damage', 'damage', 0.18, 235),
                     aura('drone-relay-range', 'range', 0.12, 235),
                     aura('drone-relay-speed', 'attackSpeed', 0.12, 235)]}),
      ],
    },
  ],
};

/** Independent copies avoid cross-run mutation by catalogs, engines, and tests. */
export function getTower(): TowerDef {
  return structuredClone(DEFINITION);
}
