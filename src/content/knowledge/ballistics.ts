import type { KnowledgeNode } from '../../contracts';

const nodes: KnowledgeNode[] = [
  {
    "id": "ballistics-01",
    "branch": "ballistics",
    "index": 1,
    "name": "Пристрелка",
    "description": "Постоянное улучшение. Урон +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 30,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-01.svg"
  },
  {
    "id": "ballistics-02",
    "branch": "ballistics",
    "index": 2,
    "name": "Полированные каналы",
    "description": "Постоянное улучшение. Темп атаки +1%: Игломёт, Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-01"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 35,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "needle",
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-02.svg"
  },
  {
    "id": "ballistics-03",
    "branch": "ballistics",
    "index": 3,
    "name": "Надёжный затвор",
    "description": "Постоянное улучшение. Темп атаки +1%: Бастионная пушка, Рельсотрон, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-02"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 40,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "cannon",
          "rail",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-03.svg"
  },
  {
    "id": "ballistics-04",
    "branch": "ballistics",
    "index": 4,
    "name": "Дальний прицел",
    "description": "Постоянное улучшение. Дальность +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-03"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 50,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-04.svg"
  },
  {
    "id": "ballistics-05",
    "branch": "ballistics",
    "index": 5,
    "name": "Школа залпа",
    "description": "Постоянное улучшение. Урон +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Темп атаки +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-04"
    ],
    "minLevel": 1,
    "pointCost": 1,
    "sealCost": 55,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-05.svg"
  },
  {
    "id": "ballistics-06",
    "branch": "ballistics",
    "index": 6,
    "name": "Тяжёлый сердечник",
    "description": "Постоянное улучшение. Урон +2%: Бастионная пушка, Рельсотрон, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-05"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 65,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.02,
        "towers": [
          "cannon",
          "rail",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-06.svg"
  },
  {
    "id": "ballistics-07",
    "branch": "ballistics",
    "index": 7,
    "name": "Мягкая отдача",
    "description": "Постоянное улучшение. Темп атаки +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-06"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 75,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-07.svg"
  },
  {
    "id": "ballistics-08",
    "branch": "ballistics",
    "index": 8,
    "name": "Разведка траектории",
    "description": "Постоянное улучшение. Дальность +1%: Ангар дронов, Ракетная батарея, Рельсотрон.",
    "requires": [
      "ballistics-07"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 85,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "drone",
          "rocket",
          "rail"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-08.svg"
  },
  {
    "id": "ballistics-09",
    "branch": "ballistics",
    "index": 9,
    "name": "Охотник на панцирь",
    "description": "Постоянное улучшение. Урон по боссам +1%: Бастионная пушка, Рельсотрон, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-08"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 95,
    "effects": [
      {
        "stat": "bossDamage",
        "value": 0.01,
        "towers": [
          "cannon",
          "rail",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-09.svg"
  },
  {
    "id": "ballistics-10",
    "branch": "ballistics",
    "index": 10,
    "name": "Полевой баллистик",
    "description": "Постоянное улучшение. Урон +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Дальность +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-09"
    ],
    "minLevel": 5,
    "pointCost": 1,
    "sealCost": 105,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-10.svg"
  },
  {
    "id": "ballistics-11",
    "branch": "ballistics",
    "index": 11,
    "name": "Двойная направляющая",
    "description": "Постоянное улучшение. Дальность +1%: Игломёт, Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-10"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 120,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "needle",
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-11.svg"
  },
  {
    "id": "ballistics-12",
    "branch": "ballistics",
    "index": 12,
    "name": "Сменный барабан",
    "description": "Постоянное улучшение. Темп атаки +1%: Ангар дронов, Ракетная батарея, Рельсотрон.",
    "requires": [
      "ballistics-11"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 130,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "drone",
          "rocket",
          "rail"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-12.svg"
  },
  {
    "id": "ballistics-13",
    "branch": "ballistics",
    "index": 13,
    "name": "Чистый срез",
    "description": "Постоянное улучшение. Урон +2%: Игломёт, Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-12"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 145,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.02,
        "towers": [
          "needle",
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-13.svg"
  },
  {
    "id": "ballistics-14",
    "branch": "ballistics",
    "index": 14,
    "name": "Точный дальномер",
    "description": "Постоянное улучшение. Дальность +2%: Бастионная пушка, Рельсотрон, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-13"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 160,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.02,
        "towers": [
          "cannon",
          "rail",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-14.svg"
  },
  {
    "id": "ballistics-15",
    "branch": "ballistics",
    "index": 15,
    "name": "Командир батареи",
    "description": "Постоянное улучшение. Темп атаки +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Урон по боссам +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-14"
    ],
    "minLevel": 9,
    "pointCost": 1,
    "sealCost": 170,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "bossDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-15.svg"
  },
  {
    "id": "ballistics-16",
    "branch": "ballistics",
    "index": 16,
    "name": "Дисковая сталь",
    "description": "Постоянное улучшение. Урон +2%: Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-15"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 190,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.02,
        "towers": [
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-16.svg"
  },
  {
    "id": "ballistics-17",
    "branch": "ballistics",
    "index": 17,
    "name": "Рельсовая геометрия",
    "description": "Постоянное улучшение. Дальность +1%: Рельсотрон.",
    "requires": [
      "ballistics-16"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 205,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "rail"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-17.svg"
  },
  {
    "id": "ballistics-18",
    "branch": "ballistics",
    "index": 18,
    "name": "Разрывной конус",
    "description": "Постоянное улучшение. Урон +2%: Бастионная пушка, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-17"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 220,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.02,
        "towers": [
          "cannon",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-18.svg"
  },
  {
    "id": "ballistics-19",
    "branch": "ballistics",
    "index": 19,
    "name": "Кольцевой обстрел",
    "description": "Постоянное улучшение. Темп атаки +1%: Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-18"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 240,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-19.svg"
  },
  {
    "id": "ballistics-20",
    "branch": "ballistics",
    "index": 20,
    "name": "Мастер артиллерии",
    "description": "Постоянное улучшение. Урон +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Урон по боссам +1%: Бастионная пушка, Рельсотрон, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-19"
    ],
    "minLevel": 13,
    "pointCost": 1,
    "sealCost": 255,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "bossDamage",
        "value": 0.01,
        "towers": [
          "cannon",
          "rail",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-20.svg"
  },
  {
    "id": "ballistics-21",
    "branch": "ballistics",
    "index": 21,
    "name": "Тяжёлый залп",
    "description": "Постоянное улучшение. Урон +2%: Бастионная пушка, Рельсотрон, Небесная мортира, Ракетная батарея.",
    "requires": [
      "ballistics-20"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 275,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.02,
        "towers": [
          "cannon",
          "rail",
          "mortar",
          "rocket"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-21.svg"
  },
  {
    "id": "ballistics-22",
    "branch": "ballistics",
    "index": 22,
    "name": "Выверенный рикошет",
    "description": "Постоянное улучшение. Дальность +1%: Игломёт, Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-21"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 295,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "needle",
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-22.svg"
  },
  {
    "id": "ballistics-23",
    "branch": "ballistics",
    "index": 23,
    "name": "Сжатая пружина",
    "description": "Постоянное улучшение. Темп атаки +2%: Игломёт.",
    "requires": [
      "ballistics-22"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 315,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.02,
        "towers": [
          "needle"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-23.svg"
  },
  {
    "id": "ballistics-24",
    "branch": "ballistics",
    "index": 24,
    "name": "Ветер в спину",
    "description": "Постоянное улучшение. Дальность +1%: Ангар дронов, Ракетная батарея, Рельсотрон.",
    "requires": [
      "ballistics-23"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 335,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "drone",
          "rocket",
          "rail"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-24.svg"
  },
  {
    "id": "ballistics-25",
    "branch": "ballistics",
    "index": 25,
    "name": "Орудийный расчёт",
    "description": "Постоянное улучшение. Темп атаки +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Дальность +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-24"
    ],
    "minLevel": 17,
    "pointCost": 1,
    "sealCost": 355,
    "effects": [
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-25.svg"
  },
  {
    "id": "ballistics-26",
    "branch": "ballistics",
    "index": 26,
    "name": "Прицельный сектор",
    "description": "Постоянное улучшение. Дальность +2%: Веерный страж, Пилон пил.",
    "requires": [
      "ballistics-25"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 380,
    "effects": [
      {
        "stat": "weaponRange",
        "value": 0.02,
        "towers": [
          "scatter",
          "saw"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-26.svg"
  },
  {
    "id": "ballistics-27",
    "branch": "ballistics",
    "index": 27,
    "name": "Кристальная игла",
    "description": "Постоянное улучшение. Урон +2%: Игломёт.",
    "requires": [
      "ballistics-26"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 400,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.02,
        "towers": [
          "needle"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-27.svg"
  },
  {
    "id": "ballistics-28",
    "branch": "ballistics",
    "index": 28,
    "name": "Охотничий рубеж",
    "description": "Постоянное улучшение. Урон по боссам +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-27"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 425,
    "effects": [
      {
        "stat": "bossDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-28.svg"
  },
  {
    "id": "ballistics-29",
    "branch": "ballistics",
    "index": 29,
    "name": "Единый залп",
    "description": "Постоянное улучшение. Урон +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Темп атаки +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-28"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 450,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "weaponSpeed",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-29.svg"
  },
  {
    "id": "ballistics-30",
    "branch": "ballistics",
    "index": 30,
    "name": "Главный калибр",
    "description": "Постоянное улучшение. Урон +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Дальность +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов; Урон по боссам +1%: Игломёт, Бастионная пушка, Рельсотрон, Веерный страж, Пилон пил, Небесная мортира, Ракетная батарея, Ангар дронов.",
    "requires": [
      "ballistics-29"
    ],
    "minLevel": 21,
    "pointCost": 1,
    "sealCost": 470,
    "effects": [
      {
        "stat": "weaponDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "weaponRange",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      },
      {
        "stat": "bossDamage",
        "value": 0.01,
        "towers": [
          "needle",
          "cannon",
          "rail",
          "scatter",
          "saw",
          "mortar",
          "rocket",
          "drone"
        ]
      }
    ],
    "icon": "art/knowledge/ballistics/ballistics-30.svg"
  }
];

export function getKnowledge(): KnowledgeNode[] {
  return nodes.map(node => ({ ...node, requires: [...node.requires], effects: node.effects.map(effect => ({ ...effect, ...(effect.towers ? { towers: [...effect.towers] } : {}) })) }));
}
