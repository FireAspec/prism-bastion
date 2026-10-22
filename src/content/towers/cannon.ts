import type {AttackDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

/** Cannon content is declarative. The combat resolver owns all timing and impacts. */
const ROOT = '/art/towers/cannon/';
const baseAttack: AttackDef = {
  mode: 'shot', element: 'kinetic', damage: 30, interval: 1.7, range: 170,
  pierce: 1, count: 1, splash: 0, chains: 0, chainRadius: 0,
  detects: false, armorPierce: 0, shieldMultiplier: 1, bossMultiplier: 1,
  executeBelow: 0, push: 0, statuses: [],
  projectileSpeed: 410, projectileRadius: 5, homing: false, windup: 0.14, arc: 0,
};

const stun = (duration: number): StatusSpec => ({kind: 'stun', power: 1, duration});
const shred = (power: number, duration: number): StatusSpec => ({kind: 'shred', power, duration});

function visual(asset: string, accent: string, projectile: string, impact: string, glow: number, motion: VisualState['motion']): VisualState {
  return {asset: ROOT + asset + '.svg', accent, muzzle: 'cannon-flash', projectile, impact, scale: 1, glow, motion};
}

type Path = 'a' | 'b' | 'c';
function upgrade(path: Path, tier: 1 | 2 | 3 | 4 | 5, name: string, description: string,
  cost: number, delta: StatDelta, appearance: [string, string, string, number, VisualState['motion']],
  replaceAttack?: AttackDef): UpgradeDef {
  const [accent, projectile, impact, glow, motion] = appearance;
  return {
    id: `cannon-${path}${tier}`, tier, name, description, cost, delta,
    ...(replaceAttack ? {replaceAttack} : {}),
    visual: visual(`${path}${tier}`, accent, projectile, impact, glow, motion),
  };
}

const siege = (damage: number, interval: number, splash: number, count: number, bossMultiplier: number): AttackDef => ({
  ...baseAttack, mode: 'splash', damage, interval, splash, count, bossMultiplier,
  projectileSpeed: 335, projectileRadius: 8, windup: 0.26,
});

const buckshot = (damage: number, interval: number, count: number, pierce: number, arc: number): AttackDef => ({
  ...baseAttack, mode: 'cone', damage, interval, count, pierce, arc,
  range: 164, projectileSpeed: 510, projectileRadius: 3, windup: 0.10,
});

const shock = (damage: number, interval: number, radius: number, stunDuration: number, shredPower: number): AttackDef => ({
  ...baseAttack, mode: 'splash', element: 'electric', damage, interval,
  splash: radius, projectileSpeed: 540, projectileRadius: 7, windup: 0.22,
  statuses: [stun(stunDuration), shred(shredPower, 3.4)],
});

const definition: TowerDef = {
  id: 'cannon', name: 'Бастионная пушка',
  description: 'Медная осадная пушка с тяжёлым ядром. Осада расширяет взрыв, картечь накрывает группу, шоковый ствол ломает броню и сбивает темп.',
  category: 'weapon', placement: 'land', cost: 550, footprint: 26,
  attack: baseAttack, effects: [], abilities: [],
  visual: visual('base', '#F8BD66', 'cannonball', 'stone-burst', 0.22, 'breathe'),
  paths: [
    {
      id: 'cannon-siege', name: 'Осада',
      description: 'Тяжёлые разрывы и точный огонь по бронированным предводителям.',
      upgrades: [
        upgrade('a', 1, 'Усиленная камора', 'Урон каждого ядра ×1,25, скорость снаряда ×1,15 — полезно и картечи, и шоковому стволу.', 275,
          {damageMul: 1.25, projectileSpeedMul: 1.15}, ['#FFD18A', 'heavy-shell', 'stone-burst', 0.28, 'breathe']),
        upgrade('a', 2, 'Дальнобойный станок', 'Дальность ×1,18; урон по боссам ×1,10. Крестовые пути получают оба бонуса.', 550,
          {rangeMul: 1.18, bossMultiplierMul: 1.10}, ['#F2B85D', 'heavy-shell', 'stone-burst', 0.32, 'rotate']),
        upgrade('a', 3, 'Разрывной сердечник', 'Осадный снаряд: базовые 43 урона, взрыв радиусом 36, множитель по боссам ×1,25 до улучшений.', 1375,
          {}, ['#FFD589', 'burst-shell', 'siege-burst', 0.47, 'pulse'], siege(43, 1.85, 36, 1, 1.25)),
        upgrade('a', 4, 'Проломный механизм', 'Взрыв +16 радиуса, пробитие брони +5, урон по боссам ×1,24.', 3300,
          {splashAdd: 16, armorPierceAdd: 5, bossMultiplierMul: 1.24}, ['#FFE3A7', 'burst-shell', 'siege-burst', 0.64, 'pulse']),
        upgrade('a', 5, 'Цитадель двух залпов', 'Два независимых тяжёлых ядра за 2,45 с; каждое наносит базовые 96 урона и взрывается радиусом 60, босс ×1,55 до бонусов. Двойной лафет меняет форму атаки.', 8250,
          {}, ['#FFE1A0', 'twin-shell', 'citadel-detonation', 0.93, 'pulse'], siege(96, 2.45, 60, 2, 1.55)),
      ],
    },
    {
      id: 'cannon-grapeshot', name: 'Картечь',
      description: 'Широкий веер независимо поражающих осколков.',
      upgrades: [
        upgrade('b', 1, 'Сквозной сердечник', 'Прямое пробитие +1 уникальная цель и скорость снаряда ×1,12 на любом пути.', 305,
          {pierceAdd: 1, projectileSpeedMul: 1.12}, ['#F2AE79', 'split-bolt', 'copper-sparks', 0.30, 'rotate']),
        upgrade('b', 2, 'Быстрый затвор', 'Интервал между атаками ×0,82, дальность ×1,06 — универсальное ускорение.', 605,
          {intervalMul: 0.82, rangeMul: 1.06}, ['#FFBF78', 'split-bolt', 'copper-sparks', 0.39, 'rotate']),
        upgrade('b', 3, 'Трёхзарядная картечь', 'Три независимых выстрела веером 38°: базовые 24 урона, 2 прямые цели на заряд.', 1515,
          {}, ['#FFD3A0', 'copper-pellet', 'copper-sparks', 0.53, 'pulse'], buckshot(24, 1.70, 3, 2, 38)),
        upgrade('b', 4, 'Пятиствольный веер', 'Дополнительные 2 заряда за залп, угол веера +12°, урон каждого ×1,10.', 3630,
          {countAdd: 2, arcAdd: 12, damageMul: 1.10}, ['#FFC08C', 'copper-pellet', 'shrapnel-cascade', 0.67, 'pulse']),
        upgrade('b', 5, 'Медный семизалп', 'Семь зарядов веером 68° после +2 от T4: каждый базово 39 урона, 3 прямые цели; новое каскадное перекрытие.', 9075,
          {}, ['#FFE0B0', 'seven-pellets', 'shrapnel-cascade', 0.96, 'pulse'], buckshot(39, 1.95, 5, 3, 56)),
      ],
    },
    {
      id: 'cannon-shock', name: 'Шоковый ствол',
      description: 'Электромагнитные удары подавляют броню и кратко останавливают угрозы.',
      upgrades: [
        upgrade('c', 1, 'Бронеломный штырь', 'Пробитие брони +5 единиц, урон по боссам ×1,05 на любом основном пути.', 250,
          {armorPierceAdd: 5, bossMultiplierMul: 1.05}, ['#79EAF0', 'magnet-bolt', 'electric-crack', 0.37, 'breathe']),
        upgrade('c', 2, 'Обратный импульс', 'Отталкивание +7 пикселей за попадание и урон по щитам ×1,18.', 495,
          {pushAdd: 7, shieldMultiplierMul: 1.18}, ['#71FAEC', 'magnet-bolt', 'electric-crack', 0.46, 'pulse']),
        upgrade('c', 3, 'Электроразлом', 'Электрический взрыв радиусом 20: базовые 46 урона, оглушение 0,18 с и разрушение 7 брони на 3,4 с.', 1240,
          {}, ['#91FFF3', 'shock-core', 'hex-shock', 0.61, 'pulse'], shock(46, 1.80, 20, 0.18, 7)),
        upgrade('c', 4, 'Магнитный молот', 'Радиус ударной волны +14, прямое пробитие брони +4, урон ×1,13.', 2970,
          {splashAdd: 14, armorPierceAdd: 4, damageMul: 1.13}, ['#A5FFF0', 'shock-core', 'hex-shock', 0.76, 'pulse']),
        upgrade('c', 5, 'Гексатонный резонатор', 'Подвешенный ударник создаёт шестигранный взрыв: 99 базового урона, радиус 54, оглушение 0,32 с, разрушение 15 брони на 3,4 с.', 7425,
          {}, ['#C4FFF7', 'hex-core', 'hex-collapse', 1.0, 'pulse'], shock(99, 2.15, 54, 0.32, 15)),
      ],
    },
  ],
};

/** Returns a detached tree: knowledge scaling and local tests cannot mutate the catalog. */
export function getTower(): TowerDef {
  return structuredClone(definition);
}
