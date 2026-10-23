import type {Difficulty, DifficultyDef, EnemyDef, SpawnGroup, WaveDef} from '../contracts';

/** Seconds are used for at/every. Lane indices are nonnegative, mapped modulo
 * the current map's lane count by the simulation. No round-robin sentinel. */
const g = (enemy: string, count: number, at: number, every: number, lane = 0): SpawnGroup =>
  ({enemy, count, at, every, lane});
const w = (number: number, preview: string, ...groups: SpawnGroup[]): WaveDef =>
  ({number, preview, groups, reward: 80 + 4 * number});
const b = (number: number, enemy: string, preview: string, ...escort: SpawnGroup[]): WaveDef =>
  ({...w(number, preview, g(enemy, 1, 12, 0), ...escort), boss: enemy});

// Exactly 100 hand-authored schedules. Each group explicitly specifies species,
// quantity, start time, cadence and (where relevant) its lane.
const CAMPAIGN: WaveDef[] = [
  // 1–10: learn single-target shots, bursts, fast targets and armoured bosses.
  w(1, 'Первый свет: алые осколки', g('scarlet', 8, 1, 2.2)),
  w(2, 'Два спокойных строя', g('scarlet', 9, 1, 1.8), g('scarlet', 5, 20, 1.3)),
  w(3, 'Первые янтарные бегуны', g('scarlet', 9, 1, 1.7), g('amber', 4, 19, 1.7)),
  w(4, 'Чередование скорости и пауз', g('amber', 8, 1, 1.25), g('scarlet', 10, 17, 1.25)),
  w(5, 'Нефритовая оболочка', g('jade', 4, 2, 3.8), g('scarlet', 12, 9, 1.35)),
  w(6, 'Лимонные искры: короткий рывок', g('scarlet', 12, 1, 1.4), g('lemon', 6, 23, 1.2)),
  w(7, 'Прочная передняя группа', g('jade', 7, 1, 2.8), g('amber', 10, 12, 1.3)),
  w(8, 'Рой искр с передышкой', g('lemon', 10, 2, 1.2), g('scarlet', 15, 21, 1.15)),
  w(9, 'Предупреждение: Панцирник', g('jade', 9, 1, 2.1), g('amber', 12, 15, 1.15), g('lemon', 6, 32, 1.2)),
  b(10, 'boss-carapace', 'Босс: Панцирник — бронепробитие', g('scarlet', 8, 1, 1.5), g('jade', 4, 38, 3)),
  // 11–20: shields, then cloaking and armour with space to buy counters.
  w(11, 'Первый щит', g('violet', 6, 2, 2.9), g('amber', 10, 16, 1.35)),
  w(12, 'Стеклянные осколки распадаются', g('glass', 9, 1, 2.15), g('scarlet', 13, 16, 1.1)),
  w(13, 'Тени: необходимо обнаружение', g('cloak', 5, 3, 3.1), g('scarlet', 14, 8, 1.3)),
  w(14, 'Щитоносцы и медленная охрана', g('shield', 5, 1, 3.1), g('jade', 9, 13, 2.2)),
  w(15, 'Железные оболочки: бронепробитие', g('iron', 6, 2, 3.1), g('amber', 15, 15, 1.1)),
  w(16, 'Быстрые стеклянные ряды', g('glass', 14, 1, 1.4), g('lemon', 11, 17, 1.1)),
  w(17, 'Промежутки между тяжелыми целями', g('shield', 7, 1, 2.6), g('cloak', 8, 10, 2)),
  w(18, 'Броня и щиты рядом', g('iron', 9, 1, 2.5), g('violet', 13, 10, 1.7)),
  w(19, 'Предупреждение: Матка осколков', g('glass', 16, 2, 1.3), g('shield', 8, 12, 2.4), g('iron', 6, 29, 2.9)),
  b(20, 'boss-brood', 'Босс: Матка осколков — массовый урон', g('glass', 12, 1, 1.8), g('swarm', 18, 30, 0.8)),
  // 21–40: splits, regeneration, elemental defences and mixed groups.
  w(21, 'Дробящиеся кристаллы', g('split', 8, 2, 2.35), g('scarlet', 13, 13, 1.2)),
  w(22, 'Регенерация на длинных прямых', g('regrow', 7, 1, 3), g('amber', 17, 14, 1.1)),
  w(23, 'Рубиновая стена', g('ruby', 7, 2, 3.4), g('glass', 12, 16, 1.55)),
  w(24, 'Ледяная броня с быстрым прикрытием', g('glacier', 8, 2, 3), g('lemon', 17, 17, 0.95)),
  w(25, 'Медные воины', g('copper', 8, 1, 2.8), g('violet', 11, 13, 1.75)),
  w(26, 'Дробление и восстановление', g('split', 12, 1, 1.9), g('regrow', 9, 18, 2.6)),
  w(27, 'Две объявленные линии', g('jade', 12, 1, 2.15, 0), g('amber', 18, 5, 1.3, 1)),
  w(28, 'Скрытые враги среди щитов', g('cloak', 11, 1, 1.9), g('shield', 10, 8, 2.8, 1)),
  w(29, 'Летящие стрелы', g('dart', 12, 2, 1.55), g('iron', 9, 14, 2.8)),
  w(30, 'Двойная волна мошек', g('swarm', 26, 1, 0.65, 0), g('swarm', 24, 20, 0.65, 1)),
  w(31, 'Обсидиан: тяжёлая броня', g('obsidian', 6, 2, 4), g('amber', 19, 13, 1.1)),
  w(32, 'Регенерация под щитами', g('regrow', 12, 1, 2.15), g('shield', 12, 17, 2.2, 1)),
  w(33, 'Летящие и наземные одновременно', g('dart', 16, 1, 1.05, 1), g('glass', 17, 10, 1.2, 0)),
  w(34, 'Три вида сопротивления', g('ruby', 7, 2, 3.1), g('glacier', 7, 7, 3.1, 1), g('copper', 7, 12, 3.1, 2)),
  w(35, 'Маскированная охрана', g('hollow', 8, 2, 2.7), g('cloak', 12, 12, 1.9, 1)),
  w(36, 'Распад перед обсидианом', g('split', 16, 1, 1.35), g('obsidian', 9, 19, 2.9, 1)),
  w(37, 'Чередование плотных пачек', g('swarm', 29, 1, 0.55), g('aegis', 6, 14, 3.8, 1), g('swarm', 25, 34, 0.55)),
  w(38, 'Первые королевские оболочки', g('royal', 5, 1, 4.2), g('iron', 15, 15, 1.7, 1)),
  w(39, 'Предупреждение: Зеркальный регент', g('aegis', 9, 2, 2.75), g('hollow', 13, 10, 1.6, 1), g('royal', 5, 28, 3.8)),
  b(40, 'boss-mirror', 'Босс: Зеркальный регент — щиты и тени', g('aegis', 8, 1, 3.2), g('cloak', 11, 32, 1.7, 1)),
  // 41–60: concurrent lanes, rushing fliers and crowded forks.
  w(41, 'Два входа: одновременные бегуны', g('amber', 22, 1, 1.1, 0), g('azure', 20, 1, 1.25, 1)),
  w(42, 'Третий вход: быстрые искры', g('lemon', 21, 1, 0.85, 2), g('jade', 13, 4, 2.3, 0)),
  w(43, 'Разнесённые ряды стрел', g('dart', 22, 1, 0.95, 1), g('iron', 12, 22, 2.15, 0)),
  w(44, 'Смена ведущей дорожки', g('shield', 13, 1, 1.85, 2), g('cloak', 17, 18, 1.25, 1)),
  w(45, 'Медные стены и лимонные фланги', g('copper', 11, 2, 2.35, 0), g('lemon', 24, 10, 0.85, 2)),
  w(46, 'Мошки обходят тяжёлый караул', g('swarm', 36, 1, 0.45, 1), g('obsidian', 10, 6, 2.85, 0)),
  w(47, 'Короткая плотная теневая пачка', g('hollow', 17, 2, 1.3, 2), g('regrow', 13, 14, 1.75, 1)),
  w(48, 'Крылья и щиты одновременно', g('dart', 25, 1, 0.8, 2), g('aegis', 10, 8, 2.8, 0)),
  w(49, 'Тяжёлые и быстрый хвост', g('royal', 8, 1, 3.1, 0), g('lemon', 30, 21, 0.75, 1)),
  w(50, 'Три входа: разные темпы', g('split', 18, 1, 1.3, 0), g('dart', 18, 6, 0.9, 1), g('shield', 14, 12, 2.1, 2)),
  w(51, 'Несколько прочных оболочек', g('prismatic', 5, 1, 4.1, 0), g('obsidian', 12, 11, 2.5, 1)),
  w(52, 'Медный заслон и невидимый обход', g('copper', 16, 1, 1.85, 1), g('hollow', 18, 12, 1.4, 2)),
  w(53, 'Регенерация между атаками', g('regrow', 19, 1, 1.5, 0), g('royal', 9, 16, 2.8, 1)),
  w(54, 'Разделяющиеся стаи', g('glass', 20, 1, 1.1, 2), g('split', 19, 7, 1.25, 0), g('dart', 13, 17, 1, 1)),
  w(55, 'Большая трёхполосная осада', g('aegis', 14, 1, 2.1, 0), g('ruby', 15, 5, 1.8, 1), g('glacier', 15, 10, 1.8, 2)),
  w(56, 'Смешанная скрытная стая', g('cloak', 20, 1, 1.15, 1), g('hollow', 19, 13, 1.25, 2), g('iron', 15, 18, 2, 0)),
  w(57, 'Три пачки быстрых стрел', g('dart', 17, 1, 0.8, 0), g('dart', 18, 20, 0.8, 1), g('dart', 19, 39, 0.8, 2)),
  w(58, 'Броня и щитовой ответ', g('obsidian', 15, 1, 2.1, 2), g('aegis', 13, 10, 2.35, 1), g('royal', 7, 28, 3.2, 0)),
  w(59, 'Предупреждение: Пожиратель секунд', g('prismatic', 8, 1, 3.3, 0), g('dart', 25, 8, 0.85, 2), g('aegis', 13, 16, 2.1, 1)),
  b(60, 'boss-chrono', 'Босс: Пожиратель секунд — ускорение фаз', g('dart', 21, 2, 1, 1), g('royal', 8, 34, 3.15, 2)),
  // 61–80: high-layer elites and announced herald preparations.
  w(61, 'Монолит в окружении быстрых', g('juggernaut', 1, 3, 0, 0), g('amber', 29, 2, 0.85, 1)),
  w(62, 'Усиленная эгида', g('aegis', 18, 1, 1.9, 0), g('iron', 18, 16, 1.65, 2)),
  w(63, 'Радужные оболочки и потомки', g('prismatic', 11, 2, 2.85, 1), g('split', 19, 12, 1.3, 0)),
  w(64, 'Три сопротивления с флангов', g('ruby', 17, 1, 1.6, 0), g('glacier', 17, 6, 1.6, 1), g('copper', 17, 11, 1.6, 2)),
  w(65, 'Монолиты между рывками', g('juggernaut', 3, 1, 12, 2), g('dart', 27, 7, 0.85, 0)),
  w(66, 'Элитная скрытная колонна', g('hollow', 24, 1, 1.1, 1), g('royal', 12, 8, 2.35, 2)),
  w(67, 'Массовая бронированная оборона', g('obsidian', 20, 2, 1.65, 0), g('shield', 21, 13, 1.5, 1)),
  w(68, 'Первый глашатай с эскортом', g('herald', 1, 7, 0, 2), g('aegis', 13, 1, 2.2, 0)),
  w(69, 'Три эшелона летающих и тяжёлых', g('dart', 29, 1, 0.65, 2), g('royal', 15, 8, 2.2, 1), g('juggernaut', 3, 17, 9, 0)),
  w(70, 'Длинная оборона: щит за щитом', g('aegis', 23, 1, 1.6, 0), g('aegis', 22, 44, 1.6, 1)),
  w(71, 'Радужный клин через две полосы', g('prismatic', 15, 1, 2.1, 0), g('prismatic', 12, 10, 2.15, 2)),
  w(72, 'Быстрые цели на коротком входе', g('lemon', 34, 1, 0.58, 1), g('dart', 28, 13, 0.75, 2)),
  w(73, 'Бронированный рой и защитники', g('obsidian', 23, 1, 1.55, 2), g('royal', 16, 8, 1.95, 0)),
  w(74, 'Монолит на каждом подходе', g('juggernaut', 3, 1, 8, 0), g('juggernaut', 3, 5, 8, 1), g('juggernaut', 3, 9, 8, 2)),
  w(75, 'Глашатаи вразнобой', g('herald', 3, 2, 15, 0), g('aegis', 20, 7, 1.9, 1)),
  w(76, 'Рубин, лёд и щит', g('ruby', 21, 1, 1.4, 0), g('glacier', 21, 5, 1.4, 1), g('aegis', 15, 10, 2, 2)),
  w(77, 'Дробление вперемежку с королями', g('split', 28, 1, 1.1, 2), g('royal', 20, 6, 1.7, 0)),
  w(78, 'Долгая элитная вереница', g('prismatic', 22, 1, 1.65, 1), g('juggernaut', 7, 9, 6.6, 2)),
  w(79, 'Предупреждение: Сердце шторма', g('herald', 4, 2, 10, 0), g('aegis', 23, 5, 1.55, 1), g('dart', 28, 13, 0.72, 2)),
  b(80, 'boss-tempest', 'Босс: Сердце шторма — щитовые фазы', g('aegis', 15, 1, 2.25, 1), g('copper', 15, 19, 2, 2)),
  // 81–100: monoliths, heralds and the fixed campaign finale.
  w(81, 'Монолит с обходом по флангам', g('juggernaut', 5, 1, 9, 0), g('hollow', 23, 5, 1.2, 2)),
  w(82, 'Радужные и королевские слои', g('prismatic', 25, 1, 1.5, 1), g('royal', 24, 8, 1.5, 2)),
  w(83, 'Глашатаи впереди щитоносцев', g('herald', 4, 1, 11, 0), g('aegis', 25, 10, 1.45, 1)),
  w(84, 'Тройной сбор бронированных', g('obsidian', 24, 1, 1.55, 0), g('obsidian', 24, 8, 1.55, 1), g('obsidian', 24, 15, 1.55, 2)),
  w(85, 'Быстрые стрелы', g('dart', 37, 1, 0.63, 2), g('lemon', 37, 11, 0.63, 1)),
  w(86, 'Тяжёлый караван', g('juggernaut', 8, 1, 6.5, 1), g('shield', 25, 7, 1.35, 0)),
  w(87, 'Глашатаи на разных линиях', g('herald', 5, 1, 10, 0), g('herald', 4, 7, 10, 2)),
  w(88, 'Тройной смешанный марш', g('prismatic', 26, 1, 1.45, 0), g('royal', 25, 6, 1.55, 1), g('aegis', 25, 11, 1.55, 2)),
  w(89, 'Обсидиан и глашатаи', g('obsidian', 29, 1, 1.25, 1), g('herald', 6, 10, 8, 2)),
  w(90, 'Большая волна разделяющихся', g('split', 37, 1, 0.9, 0), g('glass', 37, 5, 0.9, 1), g('prismatic', 15, 16, 1.9, 2)),
  w(91, 'Монолиты с защитным эшелоном', g('juggernaut', 10, 1, 5, 0), g('aegis', 30, 11, 1.4, 2)),
  w(92, 'Глашатаи и невидимый обход', g('herald', 8, 1, 7.2, 2), g('hollow', 31, 9, 0.95, 1)),
  w(93, 'Три сильных элементальных фронта', g('ruby', 30, 1, 1.2, 0), g('glacier', 30, 6, 1.2, 1), g('copper', 30, 11, 1.2, 2)),
  w(94, 'Две атаки глашатаев', g('herald', 7, 1, 8, 0), g('royal', 30, 10, 1.2, 1), g('herald', 6, 57, 8, 2)),
  w(95, 'Монолиты чередуются со стаями', g('juggernaut', 12, 1, 4.7, 2), g('dart', 39, 3, 0.65, 0), g('swarm', 45, 28, 0.45, 1)),
  w(96, 'Радужная оборона всех входов', g('prismatic', 30, 1, 1.35, 0), g('prismatic', 30, 5, 1.35, 1), g('prismatic', 30, 9, 1.35, 2)),
  w(97, 'Глашатаи проламывают заслоны', g('herald', 9, 1, 6.2, 1), g('juggernaut', 9, 8, 5.5, 2), g('aegis', 31, 14, 1.15, 0)),
  w(98, 'Последние большие стаи и броня', g('glass', 42, 1, 0.65, 0), g('obsidian', 34, 6, 1.18, 1), g('dart', 38, 14, 0.62, 2)),
  w(99, 'Предупреждение: Затмение', g('herald', 11, 1, 5.5, 0), g('juggernaut', 10, 8, 5.8, 1), g('prismatic', 30, 14, 1.35, 2)),
  b(100, 'boss-eclipse', 'Финал: Затмение — броня, щиты, ускорение', g('herald', 7, 1, 8, 0), g('aegis', 22, 19, 1.8, 1), g('prismatic', 17, 31, 2.1, 2)),
];

const ROUNDS: Record<Difficulty, number> = {easy: 40, normal: 60, hard: 80, extreme: 100};
const copy = (wave: WaveDef): WaveDef => ({...wave, groups: wave.groups.map(group => ({...group}))});

export function getWaves(): WaveDef[] { return CAMPAIGN.map(copy); }

/** Prefixes are intentionally not rescaled or re-randomised. */
export function getWaveSet(difficulty: Difficulty): WaveDef[] {
  const rounds = ROUNDS[difficulty];
  if (!rounds) throw new RangeError(`Unknown difficulty: ${String(difficulty)}`);
  return CAMPAIGN.slice(0, rounds).map(copy);
}

/**
 * Stateless endless schedule: bounded live population, no descendants, no
 * recycled storyline bosses. It grows in target toughness and speed rather
 * than increasing the enemy count indefinitely. Its reference reward is zero;
 * the simulation must also suppress meta-progress and difficulty round income
 * after the already-awarded standard victory.
 */
export function getEndlessWave(wave: number, seed: number, enemies: EnemyDef[]): WaveDef {
  if (!Number.isSafeInteger(wave) || wave <= 100 || !Number.isSafeInteger(seed)) {
    throw new RangeError('Endless requires wave > 100 and a safe-integer seed');
  }
  const pool = enemies.filter(enemy => !enemy.boss && enemy.children.length === 0 &&
    Number.isFinite(enemy.hp) && enemy.hp > 0 && Number.isFinite(enemy.speed) && enemy.speed > 0)
    .sort((a, z) => a.hp - z.hp || a.id.localeCompare(z.id));
  if (!pool.length) throw new RangeError('Endless requires a non-splitting regular enemy');

  let state = (seed ^ Math.imul(wave, 0x9e3779b9)) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x100000000;
  };
  const depth = wave - 100;
  const count = Math.min(36, 14 + Math.floor(depth / 4));
  const hpMul = Math.min(24, 1 + depth * 0.055);
  const speedMul = Math.min(1.8, 1 + depth * 0.006);
  const groups: SpawnGroup[] = [];
  let remaining = count;
  const segments = Math.min(3, Math.max(1, Math.ceil(count / 12)));
  for (let i = 0; i < segments; i++) {
    const units = i === segments - 1 ? remaining : Math.max(1, Math.floor(count / segments));
    remaining -= units;
    // The minimum selected rank rises over time, even after count is capped.
    const tier = Math.min(pool.length - 1, Math.floor((pool.length - 1) * Math.min(1, depth / 160)));
    const index = tier + Math.floor(next() * (pool.length - tier));
    groups.push({enemy: pool[index].id, count: units, at: 1 + i * 8,
      every: Math.max(0.36, 1.35 - Math.min(0.7, depth * 0.004)),
      lane: Math.floor(next() * 4), hpMul, speedMul});
  }
  return {number: wave, preview: `Бесконечная оборона ${wave}: усиленные элитные цели`,
    groups, reward: 0};
}

/**
 * Exact potential layer income assuming every parent, descendant and boss
 * phase summon is defeated. This is not a DPS or winnability calculation.
 * Does not add EnemyDef.bounty or round rewards a second time.
 * The frozen contract provides no generation limit: cycles are rejected, not
 * silently truncated to a made-up depth.
 */
function layerValue(wave: WaveDef, enemies: EnemyDef[], centsFactor?: number): number {
  if (centsFactor !== undefined && (!Number.isFinite(centsFactor) || centsFactor < 0)) {
    throw new RangeError('Invalid income factor');
  }
  const catalog = new Map(enemies.map(enemy => [enemy.id, enemy]));
  if (catalog.size !== enemies.length) throw new Error('Duplicate enemy IDs');
  const memo = new Map<string, number>();
  const active = new Set<string>();
  const total = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const enemy = catalog.get(id);
    if (!enemy) throw new Error(`Missing enemy definition: ${id}`);
    if (active.has(id)) throw new Error(`Cyclic descendant/phase income: ${id}`);
    active.add(id);
    let totalHp = 0;
    let ownCash = 0;
    let own = 0;
    for (const layer of enemy.layers) {
      if (!Number.isSafeInteger(layer.cash) || layer.cash < 0 ||
        !(layer.hp > 0) || !Number.isFinite(layer.hp)) throw new Error(`Invalid layer: ${id}`);
      totalHp += layer.hp;
      ownCash += layer.cash;
      own += centsFactor === undefined ? layer.cash : Math.round(layer.cash * centsFactor * 100);
    }
    if (ownCash !== enemy.bounty) throw new Error(`Layer cash mismatch: ${id}`);
    if (Math.abs(totalHp - enemy.hp) > 1e-6) throw new Error(`Layer HP mismatch: ${id}`);
    let value = own;
    for (const child of enemy.children) {
      if (!Number.isSafeInteger(child.count) || child.count < 0) throw new Error(`Invalid child count: ${id}`);
      value += child.count * total(child.id);
    }
    for (const phase of enemy.boss?.phases ?? []) {
      if (!Number.isSafeInteger(phase.count) || phase.count < 0) throw new Error(`Invalid phase count: ${id}`);
      if (phase.spawn && phase.count) value += phase.count * total(phase.spawn);
    }
    active.delete(id);
    if (!Number.isSafeInteger(value)) throw new Error(`Invalid layer total: ${id}`);
    memo.set(id, value);
    return value;
  };
  const budget = wave.groups.reduce((sum, group) => {
    if (!Number.isSafeInteger(group.count) || group.count < 0) throw new Error('Invalid spawn group count');
    return sum + group.count * total(group.enemy);
  }, 0);
  if (!Number.isSafeInteger(budget)) throw new Error('Invalid wave layer budget');
  return budget;
}

export function getWaveLayerBudget(wave: WaveDef, enemies: EnemyDef[]): number {
  return layerValue(wave, enemies);
}

/** Theoretical maximum cash: all payable layers/descendants/phase summons
 * destroyed, no spending, sales, farm, interest, leaks or harvest effects.
 * The fixed-point ledger deliberately rounds each individual layer payment
 * before accumulating, matching runtime.credit's hundredths convention. */
export interface WaveBudgetRow {
  wave: number;
  beforeCredits: number;
  beforeSubunits: number;
  layerCash: number;
  roundReward: number;
  afterCredits: number;
  afterSubunits: number;
}

/**
 * A reproducible 40/60/80/100-row budget report for a REAL enemy catalogue.
 * Accepts the difficulty owner’s DifficultyDef, avoiding duplicate rules.
 * Half-cash halves starting money, each layer event, and each round reward;
 * only whole credits can be spent, the remainder carries into later waves.
 */
export function getWaveBudgetLedger(difficulty: DifficultyDef, enemies: EnemyDef[], halfCash = false): WaveBudgetRow[] {
  const count = ROUNDS[difficulty.id];
  if (!count || count !== difficulty.rounds) throw new RangeError('Invalid difficulty round count');
  const values = [difficulty.startCredits, difficulty.roundRewardBase, difficulty.roundRewardStep,
    difficulty.popCashMul];
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new RangeError('Invalid economy rules');
  const factor = halfCash ? 0.5 : 1;
  let cents = Math.round(difficulty.startCredits * factor * 100);
  if (!Number.isSafeInteger(cents)) throw new RangeError('Invalid starting cash');
  const rows: WaveBudgetRow[] = [];
  for (const wave of getWaveSet(difficulty.id)) {
    const beforeCredits = Math.floor(cents / 100);
    const beforeSubunits = cents % 100;
    const layerCash = layerValue(wave, enemies);
    const layerCents = layerValue(wave, enemies, factor * difficulty.popCashMul);
    const roundReward = (difficulty.roundRewardBase + difficulty.roundRewardStep * wave.number) * factor;
    const rewardCents = Math.round(roundReward * 100);
    cents += layerCents + rewardCents;
    if (!Number.isSafeInteger(cents)) throw new RangeError('Wave cash exceeds safe integer range');
    rows.push({wave: wave.number, beforeCredits, beforeSubunits, layerCash, roundReward,
      afterCredits: Math.floor(cents / 100), afterSubunits: cents % 100});
  }
  return rows;
}
