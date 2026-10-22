import type {AttackDef, EffectDef, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const root = '/art/towers/saw/';
const visual = (asset: string, accent: string, motion: VisualState['motion'], projectile: string,
  impact: string, scale = 1, glow = 0.3): VisualState => ({
  asset: `${root}${asset}.svg`, accent, muzzle: 'spark-copper', projectile, impact,
  scale, glow, motion,
});
const shred = (power: number, duration: number, maxStacks = 2): StatusSpec =>
  ({kind: 'shred', power, duration, maxStacks});
const slow = (power: number, duration: number): StatusSpec =>
  ({kind: 'slow', power, duration, maxStacks: 1});

const baseAttack: AttackDef = {
  mode: 'melee', element: 'kinetic', damage: 16, interval: 0.65, range: 115,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [], projectileSpeed: 300,
  projectileRadius: 8, homing: false, windup: 0.08, arc: 0,
};
// A resolver selects the top replacement of the main path, then applies all deltas.
const attack = (overrides: Partial<AttackDef>): AttackDef => ({
  ...baseAttack, ...overrides,
  statuses: overrides.statuses?.map(status => ({...status})) ?? [],
});
const effect = (id: string, kind: EffectDef['kind'], values: Partial<EffectDef>): EffectDef => ({
  id, kind, power: 0, radius: 0, interval: 0, duration: 0, cap: 0, ...values,
});
const tier = (id: string, name: string, description: string, cost: number,
  level: UpgradeDef['tier'], patch: Omit<UpgradeDef, 'id' | 'name' | 'description' | 'cost' | 'tier'>): UpgradeDef =>
  ({id, name, description, cost, tier: level, ...patch});

const definition: TowerDef = {
  id: 'saw', name: 'Пилон пил',
  description: 'Медный привод вращает стальные диски у самой дороги. Круговая оборона, бронерез или дальние броски.',
  category: 'weapon', cost: 650, footprint: 26, placement: 'land',
  attack: baseAttack, effects: [], abilities: [],
  visual: visual('base', '#F8BD69', 'rotate', 'saw-disc', 'metal-sparks'),
  paths: [
    {
      id: 'orbit', name: 'Орбитальная корона',
      description: 'Множество самостоятельных дисков режет врагов по окружности.',
      upgrades: [
        tier('saw-a1', 'Второй шпиндель', 'Дополнительный диск: +1 независимый удар за цикл.', 345, 1, {
          delta: {countAdd: 1}, visual: visual('a1', '#EAD2A0', 'rotate', 'saw-pair', 'steel-sparks', 1.02),
        }),
        tier('saw-a2', 'Синхронные подшипники', 'Интервал ×0,90, дальность ×1,08; действует и на другие специализации.', 685, 2, {
          delta: {intervalMul: 0.90, rangeMul: 1.08},
          visual: visual('a2', '#BDEFE3', 'orbit', 'saw-pair', 'steel-sparks', 1.04, 0.4),
        }),
        tier('saw-a3', 'Зубчатый венец', 'Кольцевая атака: 3 удара по 25, интервал 0,57 с, радиус 132; пробитие 2.', 1710, 3, {
          delta: {}, replaceAttack: attack({mode: 'ring', damage: 25, interval: 0.57, range: 132,
            pierce: 2, count: 3, projectileRadius: 11, windup: 0, projectileSpeed: 0}),
          visual: visual('a3', '#B9F8EE', 'orbit', 'triple-saw', 'orbital-cut', 1.08, 0.5),
        }),
        tier('saw-a4', 'Контрвращение', '4 удара по 32 каждые 0,48 с, радиус 150, пробитие 3; замедление 12% на 0,65 с.', 4095, 4, {
          delta: {}, replaceAttack: attack({mode: 'ring', damage: 32, interval: 0.48, range: 150,
            pierce: 3, count: 4, projectileRadius: 12, windup: 0, projectileSpeed: 0,
            statuses: [slow(0.12, 0.65)]}),
          visual: visual('a4', '#9DF5E8', 'orbit', 'counter-saws', 'orbital-cut', 1.12, 0.65),
        }),
        tier('saw-a5', 'Три орбиты короны', '6 ударов по 38 каждые 0,39 с, радиус 168, пробитие 4; дополнительный импульс 24 каждые 0,80 с в радиусе 115.', 10240, 5, {
          delta: {}, replaceAttack: attack({mode: 'ring', damage: 38, interval: 0.39, range: 168,
            pierce: 4, count: 6, projectileRadius: 14, windup: 0, projectileSpeed: 0,
            statuses: [slow(0.18, 0.8)]}),
          effects: [effect('saw-orbit-field', 'trap', {
            power: 24, radius: 115, interval: 0.80, duration: 0, cap: 4, element: 'kinetic',
          })],
          visual: visual('a5', '#C5FFF2', 'orbit', 'orbital-crown', 'prismatic-cut', 1.17, 0.92),
        }),
      ],
    },
    {
      id: 'logger', name: 'Лесоруб',
      description: 'Усиленный маховик снимает броню и прорезает плотные колонны.',
      upgrades: [
        tier('saw-b1', 'Карбидная кромка', 'Каждая атака игнорирует ещё 4 единицы брони.', 325, 1, {
          delta: {armorPierceAdd: 4},
          visual: visual('b1', '#FFAD76', 'rotate', 'carbide-disc', 'copper-shards', 1.02),
        }),
        tier('saw-b2', 'Травящие зубья', 'Урон ×1,12; попадание снижает броню на 3 на 2 с (до 2 слоёв).', 650, 2, {
          delta: {damageMul: 1.12}, addStatuses: [shred(3, 2)],
          visual: visual('b2', '#F99B68', 'pulse', 'serrated-disc', 'copper-shards', 1.04, 0.45),
        }),
        tier('saw-b3', 'Пресс-лесоруб', 'Сектор: 58 урона за 0,74 с, пробитие 3, бронепробитие 11, ×1,20 по боссам, срез брони 5.', 1625, 3, {
          delta: {}, replaceAttack: attack({mode: 'cone', damage: 58, interval: 0.74,
            range: 122, pierce: 3, armorPierce: 11, bossMultiplier: 1.20,
            arc: 1.22, windup: 0.14, statuses: [shred(5, 2.2)]}),
          visual: visual('b3', '#FB8356', 'rotate', 'heavy-flywheel', 'copper-shards', 1.08, 0.52),
        }),
        tier('saw-b4', 'Шестерни дробления', '88 урона каждые 0,70 с, пробитие 4, бронепробитие 18, ×1,30 по боссам, срез брони 7.', 3900, 4, {
          delta: {}, replaceAttack: attack({mode: 'cone', damage: 88, interval: 0.70,
            range: 128, pierce: 4, armorPierce: 18, bossMultiplier: 1.30,
            arc: 1.35, windup: 0.13, statuses: [shred(7, 2.5, 3)]}),
          visual: visual('b4', '#FA7452', 'pulse', 'crusher-wheel', 'molten-teeth', 1.11, 0.65),
        }),
        tier('saw-b5', 'Красномедный жатвенный вал', '2 секторных удара по 145 за 0,66 с, пробитие 6, бронепробитие 26, ×1,45 по боссам. Активный вихрь: 180 урона, радиус 170, перезарядка 36 с.', 9750, 5, {
          delta: {}, replaceAttack: attack({mode: 'cone', damage: 145, interval: 0.66,
            range: 140, pierce: 6, count: 2, armorPierce: 26, bossMultiplier: 1.45,
            arc: 1.55, windup: 0.12, statuses: [shred(9, 2.8, 3), slow(0.18, 0.85)]}),
          abilities: [{id: 'saw-harvest-storm', name: 'Жатвенный вихрь',
            description: 'Медная волна наносит 180 кинетического урона в радиусе 170.',
            cooldown: 36, kind: 'nova', power: 180, duration: 0, radius: 170, element: 'kinetic'}],
          visual: visual('b5', '#FF8A5B', 'rotate', 'harvest-flywheel', 'molten-teeth', 1.15, 0.9),
        }),
      ],
    },
    {
      id: 'boomerang', name: 'Бумеранг',
      description: 'Катапультирует диски на большое расстояние; эхо изображает повторное прохождение.',
      upgrades: [
        tier('saw-c1', 'Направляющие возврата', 'Дальность ×1,20 и скорость дисков ×1,25.', 310, 1, {
          delta: {rangeMul: 1.20, projectileSpeedMul: 1.25},
          visual: visual('c1', '#84E7EA', 'breathe', 'guided-disc', 'cyan-glint', 1.02),
        }),
        tier('saw-c2', 'Удвоенный обод', 'Пробивает ещё 1 цель и отталкивает на 5 px; действует со всеми ветками.', 620, 2, {
          delta: {pierceAdd: 1, pushAdd: 5},
          visual: visual('c2', '#84E7FA', 'pulse', 'guided-disc', 'return-flare', 1.04, 0.45),
        }),
        tier('saw-c3', 'Дисковая праща', '2 самонаводящихся диска по 30 за 0,49 с, дальность 195, пробитие 2; эхо 35% через 0,65 с.', 1545, 3, {
          delta: {}, replaceAttack: attack({mode: 'shot', damage: 30, interval: 0.49,
            range: 195, count: 2, pierce: 2, projectileSpeed: 430,
            projectileRadius: 9, homing: true, windup: 0.08, arc: 0.25}),
          effects: [effect('saw-return-echo', 'echo', {
            power: 0.35, radius: 195, interval: 0.65, duration: 0, cap: 2,
          })],
          visual: visual('c3', '#7AEFF6', 'breathe', 'boomerang-pair', 'return-flare', 1.08, 0.55),
        }),
        tier('saw-c4', 'Двойные катапульты', '3 диска по 43 за 0,43 с, дальность 225, пробитие 3; эхо 45% через 0,52 с.', 3705, 4, {
          delta: {}, replaceAttack: attack({mode: 'shot', damage: 43, interval: 0.43,
            range: 225, count: 3, pierce: 3, projectileSpeed: 490,
            projectileRadius: 10, homing: true, windup: 0.06, arc: 0.35, push: 4}),
          effects: [effect('saw-return-echo', 'echo', {
            power: 0.45, radius: 225, interval: 0.52, duration: 0, cap: 3,
          })],
          visual: visual('c4', '#69E8F9', 'pulse', 'boomerang-fan', 'return-flare', 1.12, 0.72),
        }),
        tier('saw-c5', 'Возвратная комета', '4 диска по 66 за 0,37 с, дальность 260, пробитие 4; эхо 60% через 0,42 с, не более 4 целей.', 9265, 5, {
          delta: {}, replaceAttack: attack({mode: 'shot', damage: 66, interval: 0.37,
            range: 260, count: 4, pierce: 4, projectileSpeed: 560,
            projectileRadius: 12, homing: true, windup: 0.05, arc: 0.45, push: 7}),
          effects: [effect('saw-return-echo', 'echo', {
            power: 0.60, radius: 260, interval: 0.42, duration: 0, cap: 4,
          })],
          visual: visual('c5', '#A3FFFF', 'orbit', 'comet-boomerang', 'return-comet', 1.16, 0.96),
        }),
      ],
    },
  ],
};

/** Separate, mutation-safe catalogue objects for independent game runs. */
export function getTower(): TowerDef {
  return structuredClone(definition);
}
