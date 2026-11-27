import type { KnowledgeNode } from "../../contracts";

/** Engineering doctrine, contract v1. Return independent definitions. */
export function getKnowledge(): KnowledgeNode[] {
  return [
    {
      "id": "engineering-01",
      "branch": "engineering",
      "index": 1,
      "name": "Короткий провод",
      "description": "Радиус аур +2% (Сигнальный фонарь, Полевая кузня).",
      "requires": [],
      "minLevel": 1,
      "pointCost": 1,
      "sealCost": 30,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.02,
          "towers": [
            "beacon",
            "forge"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-01.svg"
    },
    {
      "id": "engineering-02",
      "branch": "engineering",
      "index": 2,
      "name": "Точная пайка",
      "description": "Время восстановления способностей −2% (Полевая кузня, Жаровая печь).",
      "requires": [
        "engineering-01"
      ],
      "minLevel": 1,
      "pointCost": 1,
      "sealCost": 35,
      "effects": [
        {
          "stat": "abilityCooldown",
          "value": 0.02,
          "towers": [
            "forge",
            "ember"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-02.svg"
    },
    {
      "id": "engineering-03",
      "branch": "engineering",
      "index": 3,
      "name": "Чистая линза",
      "description": "Радиус обнаруживающих аур +1,5% (Сигнальный фонарь, Обсерватория).",
      "requires": [
        "engineering-02"
      ],
      "minLevel": 1,
      "pointCost": 1,
      "sealCost": 40,
      "effects": [
        {
          "stat": "revealRadius",
          "value": 0.015,
          "towers": [
            "beacon",
            "observatory"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-03.svg"
    },
    {
      "id": "engineering-04",
      "branch": "engineering",
      "index": 4,
      "name": "Общий чертёж",
      "description": "Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-03"
      ],
      "minLevel": 1,
      "pointCost": 1,
      "sealCost": 50,
      "effects": [
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-04.svg"
    },
    {
      "id": "engineering-05",
      "branch": "engineering",
      "index": 5,
      "name": "Бригада",
      "description": "Радиус аур +1% (Сигнальный фонарь, Полевая кузня, Обсерватория, Резонатор, Хронобашня, Зеркальная галерея, Портальная арка, Дозорный причал, Искровой сад, Коралловый страж, Щитовой бастион); Время восстановления способностей −1% (Полевая кузня, Жаровая печь, Хронобашня, Щитовой бастион, Монетный двор, Кристальный банк); Скидка на постройки и улучшения +0,2% (все постройки).",
      "requires": [
        "engineering-04"
      ],
      "minLevel": 1,
      "pointCost": 1,
      "sealCost": 55,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.01,
          "towers": [
            "beacon",
            "forge",
            "observatory",
            "resonator",
            "chrono",
            "mirror",
            "portal",
            "harbor",
            "orchard",
            "coral",
            "bastion"
          ]
        },
        {
          "stat": "abilityCooldown",
          "value": 0.01,
          "towers": [
            "forge",
            "ember",
            "chrono",
            "bastion",
            "mint",
            "bank"
          ]
        },
        {
          "stat": "purchaseDiscount",
          "value": 0.002
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-05.svg"
    },
    {
      "id": "engineering-06",
      "branch": "engineering",
      "index": 6,
      "name": "Запасная катушка",
      "description": "Радиус аур +2% (Резонатор, Хронобашня).",
      "requires": [
        "engineering-05"
      ],
      "minLevel": 5,
      "pointCost": 1,
      "sealCost": 65,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.02,
          "towers": [
            "resonator",
            "chrono"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-06.svg"
    },
    {
      "id": "engineering-07",
      "branch": "engineering",
      "index": 7,
      "name": "Лёгкая рама",
      "description": "Время восстановления способностей −2% (Хронобашня, Щитовой бастион).",
      "requires": [
        "engineering-06"
      ],
      "minLevel": 5,
      "pointCost": 1,
      "sealCost": 75,
      "effects": [
        {
          "stat": "abilityCooldown",
          "value": 0.02,
          "towers": [
            "chrono",
            "bastion"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-07.svg"
    },
    {
      "id": "engineering-08",
      "branch": "engineering",
      "index": 8,
      "name": "Ранний сигнал",
      "description": "Радиус обнаруживающих аур +1,5% (Сигнальный фонарь, Зеркальная галерея).",
      "requires": [
        "engineering-07"
      ],
      "minLevel": 5,
      "pointCost": 1,
      "sealCost": 85,
      "effects": [
        {
          "stat": "revealRadius",
          "value": 0.015,
          "towers": [
            "beacon",
            "mirror"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-08.svg"
    },
    {
      "id": "engineering-09",
      "branch": "engineering",
      "index": 9,
      "name": "Сборка на месте",
      "description": "Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-08"
      ],
      "minLevel": 5,
      "pointCost": 1,
      "sealCost": 95,
      "effects": [
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-09.svg"
    },
    {
      "id": "engineering-10",
      "branch": "engineering",
      "index": 10,
      "name": "Старший мастер",
      "description": "Радиус аур +1% (Сигнальный фонарь, Полевая кузня, Обсерватория, Резонатор, Хронобашня, Зеркальная галерея, Портальная арка, Дозорный причал, Искровой сад, Коралловый страж, Щитовой бастион); Радиус обнаруживающих аур +0,5% (Сигнальный фонарь, Обсерватория, Зеркальная галерея); Скидка на постройки и улучшения +0,2% (все постройки).",
      "requires": [
        "engineering-09"
      ],
      "minLevel": 5,
      "pointCost": 1,
      "sealCost": 105,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.01,
          "towers": [
            "beacon",
            "forge",
            "observatory",
            "resonator",
            "chrono",
            "mirror",
            "portal",
            "harbor",
            "orchard",
            "coral",
            "bastion"
          ]
        },
        {
          "stat": "revealRadius",
          "value": 0.005,
          "towers": [
            "beacon",
            "observatory",
            "mirror"
          ]
        },
        {
          "stat": "purchaseDiscount",
          "value": 0.002
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-10.svg"
    },
    {
      "id": "engineering-11",
      "branch": "engineering",
      "index": 11,
      "name": "Часовой привод",
      "description": "Время восстановления способностей −2% (Хронобашня).",
      "requires": [
        "engineering-10"
      ],
      "minLevel": 9,
      "pointCost": 1,
      "sealCost": 120,
      "effects": [
        {
          "stat": "abilityCooldown",
          "value": 0.02,
          "towers": [
            "chrono"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-11.svg"
    },
    {
      "id": "engineering-12",
      "branch": "engineering",
      "index": 12,
      "name": "Тихий сервопривод",
      "description": "Радиус аур +2% (Зеркальная галерея, Портальная арка).",
      "requires": [
        "engineering-11"
      ],
      "minLevel": 9,
      "pointCost": 1,
      "sealCost": 130,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.02,
          "towers": [
            "mirror",
            "portal"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-12.svg"
    },
    {
      "id": "engineering-13",
      "branch": "engineering",
      "index": 13,
      "name": "Оптическая сеть",
      "description": "Радиус обнаруживающих аур +1,5% (Обсерватория, Зеркальная галерея).",
      "requires": [
        "engineering-12"
      ],
      "minLevel": 9,
      "pointCost": 1,
      "sealCost": 145,
      "effects": [
        {
          "stat": "revealRadius",
          "value": 0.015,
          "towers": [
            "observatory",
            "mirror"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-13.svg"
    },
    {
      "id": "engineering-14",
      "branch": "engineering",
      "index": 14,
      "name": "Сменный модуль",
      "description": "Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-13"
      ],
      "minLevel": 9,
      "pointCost": 1,
      "sealCost": 160,
      "effects": [
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-14.svg"
    },
    {
      "id": "engineering-15",
      "branch": "engineering",
      "index": 15,
      "name": "Начальник цеха",
      "description": "Радиус аур +1% (Сигнальный фонарь, Полевая кузня, Обсерватория, Резонатор, Хронобашня, Зеркальная галерея, Портальная арка, Дозорный причал, Искровой сад, Коралловый страж, Щитовой бастион); Время восстановления способностей −1% (Полевая кузня, Жаровая печь, Хронобашня, Щитовой бастион, Монетный двор, Кристальный банк); Скидка на постройки и улучшения +0,2% (все постройки).",
      "requires": [
        "engineering-14"
      ],
      "minLevel": 9,
      "pointCost": 1,
      "sealCost": 170,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.01,
          "towers": [
            "beacon",
            "forge",
            "observatory",
            "resonator",
            "chrono",
            "mirror",
            "portal",
            "harbor",
            "orchard",
            "coral",
            "bastion"
          ]
        },
        {
          "stat": "abilityCooldown",
          "value": 0.01,
          "towers": [
            "forge",
            "ember",
            "chrono",
            "bastion",
            "mint",
            "bank"
          ]
        },
        {
          "stat": "purchaseDiscount",
          "value": 0.002
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-15.svg"
    },
    {
      "id": "engineering-16",
      "branch": "engineering",
      "index": 16,
      "name": "Дальний ретранслятор",
      "description": "Радиус аур +2% (Дозорный причал, Коралловый страж).",
      "requires": [
        "engineering-15"
      ],
      "minLevel": 13,
      "pointCost": 1,
      "sealCost": 190,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.02,
          "towers": [
            "harbor",
            "coral"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-16.svg"
    },
    {
      "id": "engineering-17",
      "branch": "engineering",
      "index": 17,
      "name": "Быстрая перезарядка",
      "description": "Время восстановления способностей −2% (Полевая кузня, Жаровая печь).",
      "requires": [
        "engineering-16"
      ],
      "minLevel": 13,
      "pointCost": 1,
      "sealCost": 205,
      "effects": [
        {
          "stat": "abilityCooldown",
          "value": 0.02,
          "towers": [
            "forge",
            "ember"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-17.svg"
    },
    {
      "id": "engineering-18",
      "branch": "engineering",
      "index": 18,
      "name": "Линза наблюдения",
      "description": "Радиус обнаруживающих аур +1,5% (Обсерватория).",
      "requires": [
        "engineering-17"
      ],
      "minLevel": 13,
      "pointCost": 1,
      "sealCost": 220,
      "effects": [
        {
          "stat": "revealRadius",
          "value": 0.015,
          "towers": [
            "observatory"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-18.svg"
    },
    {
      "id": "engineering-19",
      "branch": "engineering",
      "index": 19,
      "name": "Стандарт деталей",
      "description": "Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-18"
      ],
      "minLevel": 13,
      "pointCost": 1,
      "sealCost": 240,
      "effects": [
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-19.svg"
    },
    {
      "id": "engineering-20",
      "branch": "engineering",
      "index": 20,
      "name": "Инженер маяка",
      "description": "Радиус аур +1% (Сигнальный фонарь, Полевая кузня, Обсерватория, Резонатор, Хронобашня, Зеркальная галерея, Портальная арка, Дозорный причал, Искровой сад, Коралловый страж, Щитовой бастион); Радиус обнаруживающих аур +0,5% (Сигнальный фонарь, Обсерватория, Зеркальная галерея); Скидка на постройки и улучшения +0,2% (все постройки).",
      "requires": [
        "engineering-19"
      ],
      "minLevel": 13,
      "pointCost": 1,
      "sealCost": 255,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.01,
          "towers": [
            "beacon",
            "forge",
            "observatory",
            "resonator",
            "chrono",
            "mirror",
            "portal",
            "harbor",
            "orchard",
            "coral",
            "bastion"
          ]
        },
        {
          "stat": "revealRadius",
          "value": 0.005,
          "towers": [
            "beacon",
            "observatory",
            "mirror"
          ]
        },
        {
          "stat": "purchaseDiscount",
          "value": 0.002
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-20.svg"
    },
    {
      "id": "engineering-21",
      "branch": "engineering",
      "index": 21,
      "name": "Настройка резонанса",
      "description": "Радиус аур +2% (Резонатор, Искровой сад).",
      "requires": [
        "engineering-20"
      ],
      "minLevel": 17,
      "pointCost": 1,
      "sealCost": 275,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.02,
          "towers": [
            "resonator",
            "orchard"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-21.svg"
    },
    {
      "id": "engineering-22",
      "branch": "engineering",
      "index": 22,
      "name": "Параллельный привод",
      "description": "Время восстановления способностей −2% (Монетный двор, Кристальный банк).",
      "requires": [
        "engineering-21"
      ],
      "minLevel": 17,
      "pointCost": 1,
      "sealCost": 295,
      "effects": [
        {
          "stat": "abilityCooldown",
          "value": 0.02,
          "towers": [
            "mint",
            "bank"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-22.svg"
    },
    {
      "id": "engineering-23",
      "branch": "engineering",
      "index": 23,
      "name": "Точный луч",
      "description": "Радиус обнаруживающих аур +1,5% (Сигнальный фонарь, Зеркальная галерея).",
      "requires": [
        "engineering-22"
      ],
      "minLevel": 17,
      "pointCost": 1,
      "sealCost": 315,
      "effects": [
        {
          "stat": "revealRadius",
          "value": 0.015,
          "towers": [
            "beacon",
            "mirror"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-23.svg"
    },
    {
      "id": "engineering-24",
      "branch": "engineering",
      "index": 24,
      "name": "Умная сборка",
      "description": "Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-23"
      ],
      "minLevel": 17,
      "pointCost": 1,
      "sealCost": 335,
      "effects": [
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-24.svg"
    },
    {
      "id": "engineering-25",
      "branch": "engineering",
      "index": 25,
      "name": "Гильдия",
      "description": "Радиус аур +1% (Сигнальный фонарь, Полевая кузня, Обсерватория, Резонатор, Хронобашня, Зеркальная галерея, Портальная арка, Дозорный причал, Искровой сад, Коралловый страж, Щитовой бастион); Время восстановления способностей −1% (Полевая кузня, Жаровая печь, Хронобашня, Щитовой бастион, Монетный двор, Кристальный банк); Скидка на постройки и улучшения +0,2% (все постройки).",
      "requires": [
        "engineering-24"
      ],
      "minLevel": 17,
      "pointCost": 1,
      "sealCost": 355,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.01,
          "towers": [
            "beacon",
            "forge",
            "observatory",
            "resonator",
            "chrono",
            "mirror",
            "portal",
            "harbor",
            "orchard",
            "coral",
            "bastion"
          ]
        },
        {
          "stat": "abilityCooldown",
          "value": 0.01,
          "towers": [
            "forge",
            "ember",
            "chrono",
            "bastion",
            "mint",
            "bank"
          ]
        },
        {
          "stat": "purchaseDiscount",
          "value": 0.002
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-25.svg"
    },
    {
      "id": "engineering-26",
      "branch": "engineering",
      "index": 26,
      "name": "Широкий канал",
      "description": "Радиус аур +2% (Сигнальный фонарь, Коралловый страж, Щитовой бастион).",
      "requires": [
        "engineering-25"
      ],
      "minLevel": 21,
      "pointCost": 1,
      "sealCost": 380,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.02,
          "towers": [
            "beacon",
            "coral",
            "bastion"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-26.svg"
    },
    {
      "id": "engineering-27",
      "branch": "engineering",
      "index": 27,
      "name": "Резервный контур",
      "description": "Время восстановления способностей −2% (Щитовой бастион, Кристальный банк).",
      "requires": [
        "engineering-26"
      ],
      "minLevel": 21,
      "pointCost": 1,
      "sealCost": 400,
      "effects": [
        {
          "stat": "abilityCooldown",
          "value": 0.02,
          "towers": [
            "bastion",
            "bank"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-27.svg"
    },
    {
      "id": "engineering-28",
      "branch": "engineering",
      "index": 28,
      "name": "Круговой обзор",
      "description": "Радиус обнаруживающих аур +0,5% (Сигнальный фонарь, Обсерватория, Зеркальная галерея).",
      "requires": [
        "engineering-27"
      ],
      "minLevel": 21,
      "pointCost": 1,
      "sealCost": 425,
      "effects": [
        {
          "stat": "revealRadius",
          "value": 0.005,
          "towers": [
            "beacon",
            "observatory",
            "mirror"
          ]
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-28.svg"
    },
    {
      "id": "engineering-29",
      "branch": "engineering",
      "index": 29,
      "name": "Чистая логистика",
      "description": "Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-28"
      ],
      "minLevel": 21,
      "pointCost": 1,
      "sealCost": 450,
      "effects": [
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-29.svg"
    },
    {
      "id": "engineering-30",
      "branch": "engineering",
      "index": 30,
      "name": "Совершенный механизм",
      "description": "Радиус аур +1% (Сигнальный фонарь, Полевая кузня, Обсерватория, Резонатор, Хронобашня, Зеркальная галерея, Портальная арка, Дозорный причал, Искровой сад, Коралловый страж, Щитовой бастион); Время восстановления способностей −1% (Полевая кузня, Жаровая печь, Хронобашня, Щитовой бастион, Монетный двор, Кристальный банк); Радиус обнаруживающих аур +0,5% (Сигнальный фонарь, Обсерватория, Зеркальная галерея); Скидка на постройки и улучшения +0,4% (все постройки).",
      "requires": [
        "engineering-29"
      ],
      "minLevel": 21,
      "pointCost": 1,
      "sealCost": 470,
      "effects": [
        {
          "stat": "supportRadius",
          "value": 0.01,
          "towers": [
            "beacon",
            "forge",
            "observatory",
            "resonator",
            "chrono",
            "mirror",
            "portal",
            "harbor",
            "orchard",
            "coral",
            "bastion"
          ]
        },
        {
          "stat": "abilityCooldown",
          "value": 0.01,
          "towers": [
            "forge",
            "ember",
            "chrono",
            "bastion",
            "mint",
            "bank"
          ]
        },
        {
          "stat": "revealRadius",
          "value": 0.005,
          "towers": [
            "beacon",
            "observatory",
            "mirror"
          ]
        },
        {
          "stat": "purchaseDiscount",
          "value": 0.004
        }
      ],
      "icon": "/art/knowledge/engineering/engineering-30.svg"
    }
  ];
}
