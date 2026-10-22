import type {TowerDef} from '../../contracts';

/** Returns an independent copy; upgrades and nested attacks are never shared. */
const definition: TowerDef = {
  "id": "storm",
  "name": "Штормовой шпиль",
  "description": "Медный погодный шпиль с электрическими разрядами: шквал, гром или ливень.",
  "category": "element",
  "cost": 1100,
  "footprint": 26,
  "placement": "land",
  "attack": {
    "mode": "chain",
    "element": "electric",
    "damage": 22,
    "interval": 1.2,
    "range": 200,
    "pierce": 1,
    "count": 1,
    "splash": 0,
    "chains": 1,
    "chainRadius": 96,
    "detects": false,
    "armorPierce": 0,
    "shieldMultiplier": 1,
    "bossMultiplier": 1,
    "executeBelow": 0,
    "push": 0,
    "statuses": [],
    "projectileSpeed": 650,
    "projectileRadius": 4,
    "homing": true,
    "windup": 0.12,
    "arc": 0
  },
  "effects": [],
  "abilities": [],
  "visual": {
    "asset": "/art/towers/storm/base.svg",
    "accent": "#6ce8ef",
    "muzzle": "storm-charge",
    "projectile": "storm-bolt",
    "impact": "storm-flash",
    "scale": 1,
    "glow": 0.55,
    "motion": "pulse"
  },
  "paths": [
    {
      "id": "storm-hurricane",
      "name": "Ураган",
      "description": "Кольцевой урон, замедление и ограниченное отталкивание.",
      "upgrades": [
        {
          "id": "storm-a1",
          "name": "Ветровые рули",
          "description": "Отталкивание +7 пикселей и дальность ×1,08 для любой специализации.",
          "cost": 550,
          "tier": 1,
          "delta": {
            "pushAdd": 7,
            "rangeMul": 1.08
          },
          "visual": {
            "asset": "/art/towers/storm/a1.svg",
            "accent": "#7dfae9",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 0.55,
            "motion": "rotate"
          }
        },
        {
          "id": "storm-a2",
          "name": "Спиральное ускорение",
          "description": "Интервал ×0,90, урон ×1,12 и отталкивание ещё +4 пикселя.",
          "cost": 1100,
          "tier": 2,
          "delta": {
            "intervalMul": 0.9,
            "damageMul": 1.12,
            "pushAdd": 4
          },
          "visual": {
            "asset": "/art/towers/storm/a2.svg",
            "accent": "#7dfae9",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 0.55,
            "motion": "rotate"
          }
        },
        {
          "id": "storm-a3",
          "name": "Кольцо шквала",
          "description": "Ядро круговой атаки до дельт: 38 урона, 1,28 с, радиус 215, толчок 10 и замедление 18% на 1,5 с.",
          "cost": 2750,
          "tier": 3,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/a3.svg",
            "accent": "#7dfae9",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.05,
            "motion": "rotate"
          },
          "replaceAttack": {
            "mode": "ring",
            "element": "electric",
            "damage": 38,
            "interval": 1.28,
            "range": 215,
            "pierce": 1,
            "count": 1,
            "splash": 0,
            "chains": 0,
            "chainRadius": 0,
            "detects": false,
            "armorPierce": 0,
            "shieldMultiplier": 1,
            "bossMultiplier": 1,
            "executeBelow": 0,
            "push": 10,
            "statuses": [
              {
                "kind": "slow",
                "power": 0.18,
                "duration": 1.5,
                "maxStacks": 1
              }
            ],
            "projectileSpeed": 0,
            "projectileRadius": 0,
            "homing": false,
            "windup": 0.18,
            "arc": 0
          }
        },
        {
          "id": "storm-a4",
          "name": "Двойная буря",
          "description": "Кольцо: урон ×1,30, интервал ×0,84, радиус ×1,12, толчок +8; эхо 35% через 0,38 с до 8 целей.",
          "cost": 6600,
          "tier": 4,
          "delta": {
            "damageMul": 1.3,
            "intervalMul": 0.84,
            "rangeMul": 1.12,
            "pushAdd": 8
          },
          "visual": {
            "asset": "/art/towers/storm/a4.svg",
            "accent": "#7dfae9",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.05,
            "motion": "rotate"
          },
          "effects": [
            {
              "id": "storm-gale-echo",
              "kind": "echo",
              "power": 0.35,
              "radius": 0,
              "interval": 0.38,
              "duration": 0,
              "cap": 8
            }
          ]
        },
        {
          "id": "storm-a5",
          "name": "Сердце сверхурагана",
          "description": "Ядро воронки до дельт: кольцо 76 урона каждые 0,86 с, радиус 255, толчок 28, slow 32%/2,2 с, wet 3 с; эхо 50%, нова 160/46 с.",
          "cost": 16500,
          "tier": 5,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/a5.svg",
            "accent": "#7dfae9",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.45,
            "motion": "rotate"
          },
          "replaceAttack": {
            "mode": "ring",
            "element": "electric",
            "damage": 76,
            "interval": 0.86,
            "range": 255,
            "pierce": 1,
            "count": 1,
            "splash": 0,
            "chains": 0,
            "chainRadius": 0,
            "detects": false,
            "armorPierce": 0,
            "shieldMultiplier": 1,
            "bossMultiplier": 1,
            "executeBelow": 0,
            "push": 28,
            "statuses": [
              {
                "kind": "slow",
                "power": 0.32,
                "duration": 2.2,
                "maxStacks": 1
              },
              {
                "kind": "wet",
                "power": 1,
                "duration": 3,
                "maxStacks": 1
              }
            ],
            "projectileSpeed": 0,
            "projectileRadius": 0,
            "homing": false,
            "windup": 0.12,
            "arc": 0
          },
          "effects": [
            {
              "id": "storm-gale-echo",
              "kind": "echo",
              "power": 0.5,
              "radius": 0,
              "interval": 0.28,
              "duration": 0,
              "cap": 12
            }
          ],
          "abilities": [
            {
              "id": "storm-eye-nova",
              "name": "Глаз бури",
              "description": "Электрическая нова 160 урона в радиусе 255, перезарядка 46 с.",
              "cooldown": 46,
              "kind": "nova",
              "power": 160,
              "duration": 0,
              "radius": 255,
              "element": "electric"
            }
          ]
        }
      ]
    },
    {
      "id": "storm-thunderer",
      "name": "Громовержец",
      "description": "Бронепробитие и ветвящиеся молнии против прочных целей.",
      "upgrades": [
        {
          "id": "storm-b1",
          "name": "Позолоченный сердечник",
          "description": "Бронепробитие +4, множитель урона щитам ×1,15 для всех форм молний.",
          "cost": 580,
          "tier": 1,
          "delta": {
            "armorPierceAdd": 4,
            "shieldMultiplierMul": 1.15
          },
          "visual": {
            "asset": "/art/towers/storm/b1.svg",
            "accent": "#ffe59c",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 0.55,
            "motion": "pulse"
          }
        },
        {
          "id": "storm-b2",
          "name": "Грозовые контакты",
          "description": "Урон по боссам ×1,20, общий урон ×1,10, радиус переходов цепи +22 пикселя.",
          "cost": 1155,
          "tier": 2,
          "delta": {
            "bossMultiplierMul": 1.2,
            "damageMul": 1.1,
            "chainRadiusAdd": 22
          },
          "visual": {
            "asset": "/art/towers/storm/b2.svg",
            "accent": "#ffe59c",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 0.55,
            "motion": "pulse"
          }
        },
        {
          "id": "storm-b3",
          "name": "Громовой стержень",
          "description": "Новое ядро цепи до дельт: 68 урона /1,42 с /245, четыре перехода по 116, бронепробитие 8, боссам ×1,5, щитам ×1,35.",
          "cost": 2890,
          "tier": 3,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/b3.svg",
            "accent": "#ffe59c",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.05,
            "motion": "pulse"
          },
          "replaceAttack": {
            "mode": "chain",
            "element": "electric",
            "damage": 68,
            "interval": 1.42,
            "range": 245,
            "pierce": 1,
            "count": 1,
            "splash": 0,
            "chains": 4,
            "chainRadius": 116,
            "detects": false,
            "armorPierce": 8,
            "shieldMultiplier": 1.35,
            "bossMultiplier": 1.5,
            "executeBelow": 0,
            "push": 0,
            "statuses": [],
            "projectileSpeed": 950,
            "projectileRadius": 5,
            "homing": true,
            "windup": 0.14,
            "arc": 0
          }
        },
        {
          "id": "storm-b4",
          "name": "Приговор небес",
          "description": "Урон ×1,32, интервал ×0,88, +2 перехода; концентрация +9% урона за секунду по цели, максимум +54%.",
          "cost": 6930,
          "tier": 4,
          "delta": {
            "damageMul": 1.32,
            "intervalMul": 0.88,
            "chainsAdd": 2
          },
          "visual": {
            "asset": "/art/towers/storm/b4.svg",
            "accent": "#ffe59c",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.05,
            "motion": "pulse"
          },
          "effects": [
            {
              "id": "storm-judgement-focus",
              "kind": "focus",
              "power": 0.09,
              "radius": 0,
              "interval": 0,
              "duration": 0,
              "cap": 0.54
            }
          ]
        },
        {
          "id": "storm-b5",
          "name": "Игла громовержца",
          "description": "Ядро до дельт: 152 урона /1,36 с /270, девять переходов по 148; бронепробитие 16, боссам ×2,1, щитам ×2; focus +13%/с до +91%, форсаж ×1,5 /7 с/55 с.",
          "cost": 17325,
          "tier": 5,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/b5.svg",
            "accent": "#ffe59c",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.45,
            "motion": "pulse"
          },
          "replaceAttack": {
            "mode": "chain",
            "element": "electric",
            "damage": 152,
            "interval": 1.36,
            "range": 270,
            "pierce": 1,
            "count": 1,
            "splash": 0,
            "chains": 9,
            "chainRadius": 148,
            "detects": false,
            "armorPierce": 16,
            "shieldMultiplier": 2,
            "bossMultiplier": 2.1,
            "executeBelow": 0,
            "push": 0,
            "statuses": [],
            "projectileSpeed": 1350,
            "projectileRadius": 7,
            "homing": true,
            "windup": 0.1,
            "arc": 0
          },
          "effects": [
            {
              "id": "storm-judgement-focus",
              "kind": "focus",
              "power": 0.13,
              "radius": 0,
              "interval": 0,
              "duration": 0,
              "cap": 0.91
            }
          ],
          "abilities": [
            {
              "id": "storm-golden-overclock",
              "name": "Грозовой перегруз",
              "description": "Форсаж ×1,5 на семь секунд; перезарядка 55 с.",
              "cooldown": 55,
              "kind": "overclock",
              "power": 1.5,
              "duration": 7,
              "radius": 0,
              "element": "electric"
            }
          ]
        }
      ]
    },
    {
      "id": "storm-downpour",
      "name": "Ливень",
      "description": "Намокание повышает электрический урон на 20%.",
      "upgrades": [
        {
          "id": "storm-c1",
          "name": "Капельный конденсатор",
          "description": "Каждое попадание накладывает wet на 2,8 с; последующий электрический урон по мокрым целям +20%.",
          "cost": 525,
          "tier": 1,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/c1.svg",
            "accent": "#b9e4ff",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 0.55,
            "motion": "breathe"
          },
          "addStatuses": [
            {
              "kind": "wet",
              "power": 1,
              "duration": 2.8,
              "maxStacks": 1
            }
          ]
        },
        {
          "id": "storm-c2",
          "name": "Дождевой такт",
          "description": "Интервал ×0,87 и дальность ×1,07 усиливают всякую основную специализацию.",
          "cost": 1045,
          "tier": 2,
          "delta": {
            "intervalMul": 0.87,
            "rangeMul": 1.07
          },
          "visual": {
            "asset": "/art/towers/storm/c2.svg",
            "accent": "#b9e4ff",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 0.55,
            "motion": "breathe"
          }
        },
        {
          "id": "storm-c3",
          "name": "Ливневой купол",
          "description": "Ядро до дельт: импульсы 28 урона /1,08 с /210, splash 58, wet 4,5 с, slow 12% на 1,5 с.",
          "cost": 2615,
          "tier": 3,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/c3.svg",
            "accent": "#b9e4ff",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.05,
            "motion": "breathe"
          },
          "replaceAttack": {
            "mode": "pulse",
            "element": "electric",
            "damage": 28,
            "interval": 1.08,
            "range": 210,
            "pierce": 1,
            "count": 1,
            "splash": 58,
            "chains": 0,
            "chainRadius": 0,
            "detects": false,
            "armorPierce": 0,
            "shieldMultiplier": 1,
            "bossMultiplier": 1,
            "executeBelow": 0,
            "push": 0,
            "statuses": [
              {
                "kind": "wet",
                "power": 1,
                "duration": 4.5,
                "maxStacks": 1
              },
              {
                "kind": "slow",
                "power": 0.12,
                "duration": 1.5,
                "maxStacks": 1
              }
            ],
            "projectileSpeed": 0,
            "projectileRadius": 0,
            "homing": false,
            "windup": 0.16,
            "arc": 0
          }
        },
        {
          "id": "storm-c4",
          "name": "Небесный водосброс",
          "description": "Урон ×1,28, интервал ×0,90, радиус ×1,12, splash +24; эхо 28% через 0,40 с до 7 целей.",
          "cost": 6270,
          "tier": 4,
          "delta": {
            "damageMul": 1.28,
            "intervalMul": 0.9,
            "rangeMul": 1.12,
            "splashAdd": 24
          },
          "visual": {
            "asset": "/art/towers/storm/c4.svg",
            "accent": "#b9e4ff",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.05,
            "motion": "breathe"
          },
          "effects": [
            {
              "id": "storm-rain-echo",
              "kind": "echo",
              "power": 0.28,
              "radius": 0,
              "interval": 0.4,
              "duration": 0,
              "cap": 7
            }
          ]
        },
        {
          "id": "storm-c5",
          "name": "Владыка проливня",
          "description": "Ядро зонта до дельт: импульсы 58 /0,78 с /255, splash 100, wet 6 с, slow 22%/2 с; эхо 45%, нова 115 каждые 44 с.",
          "cost": 15675,
          "tier": 5,
          "delta": {},
          "visual": {
            "asset": "/art/towers/storm/c5.svg",
            "accent": "#b9e4ff",
            "muzzle": "storm-charge",
            "projectile": "storm-bolt",
            "impact": "storm-flash",
            "scale": 1,
            "glow": 1.45,
            "motion": "breathe"
          },
          "replaceAttack": {
            "mode": "pulse",
            "element": "electric",
            "damage": 58,
            "interval": 0.78,
            "range": 255,
            "pierce": 1,
            "count": 1,
            "splash": 100,
            "chains": 0,
            "chainRadius": 0,
            "detects": false,
            "armorPierce": 0,
            "shieldMultiplier": 1,
            "bossMultiplier": 1,
            "executeBelow": 0,
            "push": 0,
            "statuses": [
              {
                "kind": "wet",
                "power": 1,
                "duration": 6,
                "maxStacks": 1
              },
              {
                "kind": "slow",
                "power": 0.22,
                "duration": 2,
                "maxStacks": 1
              }
            ],
            "projectileSpeed": 0,
            "projectileRadius": 0,
            "homing": false,
            "windup": 0.12,
            "arc": 0
          },
          "effects": [
            {
              "id": "storm-rain-echo",
              "kind": "echo",
              "power": 0.45,
              "radius": 0,
              "interval": 0.28,
              "duration": 0,
              "cap": 10
            }
          ],
          "abilities": [
            {
              "id": "storm-cloudburst",
              "name": "Разрыв тучи",
              "description": "Электрическая нова на 115 урона в радиусе 260, перезарядка 44 с.",
              "cooldown": 44,
              "kind": "nova",
              "power": 115,
              "duration": 0,
              "radius": 260,
              "element": "electric"
            }
          ]
        }
      ]
    }
  ]
};

export function getTower(): TowerDef {
  return structuredClone(definition);
}
