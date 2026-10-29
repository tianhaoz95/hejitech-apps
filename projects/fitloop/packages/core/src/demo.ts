// The App Review demo account's plan and settings (the Worker's /api/review-sign-in resets the
// account to these): the local seed athlete's week, as a weekly template starting `startsOn`.
import type { Plan, Settings } from "./types.ts";
import { normalizeSettings } from "./settings.ts";

export function demoPlan(startsOn: string): Plan {
  return {
    "format": 1,
    "title": "Strength + lean-out (demo)",
    "summary": "Three full-body strength sessions and two short cardio days a week, built around 45-minute weekday lunch breaks and a bad left knee. Meals hit about 2200 kcal with 160 g protein, vegetarian on weekdays.",
    "starts_on": startsOn,
    "goals": [
      {
        "id": "lose-fat",
        "text": "Lose 4 kg while keeping strength",
        "metric": "weight",
        "target": 78,
        "unit": "kg"
      },
      {
        "id": "squat",
        "text": "Goblet squat 32 kg for 3x10 without knee pain"
      }
    ],
    "constraints": [
      "Left knee: no jumping, no deep lunges",
      "45 min on weekdays, at the office gym (dumbbells, cable, bike)",
      "Vegetarian Monday to Friday"
    ],
    "targets": {
      "calories": 2200,
      "protein_g": 160,
      "carbs_g": 220,
      "fat_g": 70,
      "water_l": 2.5
    },
    "week": {
      "mon": {
        "title": "Full body A",
        "workouts": [
          {
            "id": "full-body-a",
            "title": "Full body A",
            "time": "12:00",
            "duration_min": 45,
            "kind": "strength",
            "exercises": [
              {
                "id": "bike",
                "name": "Bike warm-up",
                "sets": 1,
                "duration_sec": 300,
                "load": "easy",
                "rest_sec": 60,
                "cues": [
                  "Easy pace, nose breathing",
                  "Cadence around 80"
                ]
              },
              {
                "id": "goblet-squat",
                "name": "Goblet squat",
                "sets": 3,
                "reps": "8-10",
                "load": "24 kg",
                "rest_sec": 90,
                "cues": [
                  "Bell at chest, elbows in",
                  "Sit between the hips",
                  "Knees track over toes",
                  "Stop above pain"
                ],
                "instructions": "Hold the dumbbell vertically at your chest. Sit down between your hips to a box if needed, pause, drive up through the whole foot.",
                "alternative": "Box squat to a bench"
              },
              {
                "id": "db-row",
                "name": "One-arm dumbbell row",
                "sets": 3,
                "reps": 10,
                "load": "22 kg",
                "rest_sec": 60,
                "cues": [
                  "Flat back, hand on bench",
                  "Pull elbow to hip",
                  "2 s down"
                ]
              },
              {
                "id": "db-press",
                "name": "Dumbbell bench press",
                "sets": 3,
                "reps": "8-10",
                "load": "20 kg",
                "rest_sec": 90,
                "cues": [
                  "Shoulder blades pinned",
                  "Wrists over elbows",
                  "Touch, then press"
                ]
              },
              {
                "id": "plank",
                "name": "Plank",
                "sets": 3,
                "duration_sec": 40,
                "rest_sec": 45,
                "cues": [
                  "Ribs down, squeeze glutes",
                  "Straight line ear to ankle"
                ]
              }
            ]
          }
        ],
        "meals": [
          {
            "id": "breakfast",
            "name": "Breakfast",
            "time": "07:30",
            "items": [
              {
                "name": "Greek yogurt",
                "amount": "300 g"
              },
              {
                "name": "Berries",
                "amount": "1 cup"
              },
              {
                "name": "Granola",
                "amount": "40 g"
              }
            ],
            "macros": {
              "calories": 520,
              "protein_g": 36,
              "carbs_g": 60,
              "fat_g": 14
            }
          },
          {
            "id": "lunch",
            "name": "Lunch",
            "time": "13:00",
            "items": [
              {
                "name": "Tofu rice bowl",
                "amount": "1 bowl"
              },
              {
                "name": "Edamame",
                "amount": "100 g"
              }
            ],
            "macros": {
              "calories": 680,
              "protein_g": 48,
              "carbs_g": 75,
              "fat_g": 20
            },
            "prep": [
              "Press tofu 10 min",
              "Pan-fry with soy and garlic"
            ]
          },
          {
            "id": "snack",
            "name": "Protein shake",
            "time": "16:00",
            "items": [
              {
                "name": "Whey or pea protein",
                "amount": "1 scoop"
              },
              {
                "name": "Banana",
                "amount": "1"
              }
            ],
            "macros": {
              "calories": 250,
              "protein_g": 26,
              "carbs_g": 30,
              "fat_g": 3
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Lentil curry",
                "amount": "1.5 cups"
              },
              {
                "name": "Brown rice",
                "amount": "1 cup"
              },
              {
                "name": "Spinach",
                "amount": "2 cups"
              }
            ],
            "macros": {
              "calories": 720,
              "protein_g": 45,
              "carbs_g": 60,
              "fat_g": 30
            }
          }
        ]
      },
      "tue": {
        "title": "Zone 2 bike",
        "workouts": [
          {
            "id": "zone-2",
            "title": "Zone 2 bike",
            "time": "12:00",
            "duration_min": 35,
            "kind": "cardio",
            "exercises": [
              {
                "id": "bike-z2",
                "name": "Steady bike, zone 2",
                "sets": 1,
                "duration_sec": 1800,
                "load": "zone 2",
                "rest_sec": 0,
                "cues": [
                  "You can still talk",
                  "HR about 125-140"
                ]
              }
            ]
          }
        ],
        "meals": [
          {
            "id": "breakfast",
            "name": "Breakfast",
            "time": "07:30",
            "items": [
              {
                "name": "Oats with whey",
                "amount": "1 bowl"
              },
              {
                "name": "Walnuts",
                "amount": "20 g"
              }
            ],
            "macros": {
              "calories": 520,
              "protein_g": 38,
              "carbs_g": 62,
              "fat_g": 14
            }
          },
          {
            "id": "lunch",
            "name": "Lunch",
            "time": "13:00",
            "items": [
              {
                "name": "Bean burrito bowl",
                "amount": "1 bowl"
              }
            ],
            "macros": {
              "calories": 700,
              "protein_g": 42,
              "carbs_g": 85,
              "fat_g": 18
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Tempeh stir-fry",
                "amount": "1 plate"
              },
              {
                "name": "Noodles",
                "amount": "1 cup"
              }
            ],
            "macros": {
              "calories": 900,
              "protein_g": 70,
              "carbs_g": 80,
              "fat_g": 30
            }
          }
        ]
      },
      "wed": {
        "title": "Rest day",
        "workouts": [],
        "meals": [
          {
            "id": "breakfast",
            "name": "Breakfast",
            "time": "07:30",
            "items": [
              {
                "name": "Greek yogurt",
                "amount": "300 g"
              },
              {
                "name": "Berries",
                "amount": "1 cup"
              }
            ],
            "macros": {
              "calories": 420,
              "protein_g": 34,
              "carbs_g": 40,
              "fat_g": 10
            }
          },
          {
            "id": "lunch",
            "name": "Lunch",
            "time": "13:00",
            "items": [
              {
                "name": "Tofu rice bowl",
                "amount": "1 bowl"
              }
            ],
            "macros": {
              "calories": 680,
              "protein_g": 48,
              "carbs_g": 75,
              "fat_g": 20
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Lentil pasta",
                "amount": "2 cups"
              },
              {
                "name": "Side salad",
                "amount": "1 bowl"
              }
            ],
            "macros": {
              "calories": 950,
              "protein_g": 60,
              "carbs_g": 105,
              "fat_g": 30
            }
          }
        ]
      },
      "thu": {
        "title": "Full body B",
        "workouts": [
          {
            "id": "full-body-b",
            "title": "Full body B",
            "time": "12:00",
            "duration_min": 45,
            "kind": "strength",
            "exercises": [
              {
                "id": "bike",
                "name": "Bike warm-up",
                "sets": 1,
                "duration_sec": 300,
                "load": "easy",
                "rest_sec": 60,
                "cues": [
                  "Easy pace"
                ]
              },
              {
                "id": "rdl",
                "name": "Dumbbell Romanian deadlift",
                "sets": 3,
                "reps": 10,
                "load": "2x22 kg",
                "rest_sec": 90,
                "cues": [
                  "Soft knees, hips back",
                  "Bells slide down thighs",
                  "Neutral spine"
                ]
              },
              {
                "id": "lat-pulldown",
                "name": "Lat pulldown",
                "sets": 3,
                "reps": 12,
                "load": "50 kg",
                "rest_sec": 60,
                "cues": [
                  "Chest up",
                  "Elbows to back pockets"
                ]
              },
              {
                "id": "step-up",
                "name": "Low step-up",
                "sets": 3,
                "reps": 8,
                "load": "bodyweight",
                "rest_sec": 60,
                "cues": [
                  "Low box, right leg leads",
                  "Stop if the knee hurts"
                ],
                "alternative": "Glute bridge"
              },
              {
                "id": "pallof",
                "name": "Pallof press",
                "sets": 3,
                "reps": 10,
                "load": "cable",
                "rest_sec": 45,
                "cues": [
                  "Resist the twist",
                  "Press straight out"
                ]
              }
            ]
          }
        ],
        "meals": [
          {
            "id": "breakfast",
            "name": "Breakfast",
            "time": "07:30",
            "items": [
              {
                "name": "Greek yogurt",
                "amount": "300 g"
              },
              {
                "name": "Granola",
                "amount": "40 g"
              }
            ],
            "macros": {
              "calories": 520,
              "protein_g": 36,
              "carbs_g": 60,
              "fat_g": 14
            }
          },
          {
            "id": "lunch",
            "name": "Lunch",
            "time": "13:00",
            "items": [
              {
                "name": "Chickpea salad wrap",
                "amount": "2"
              }
            ],
            "macros": {
              "calories": 700,
              "protein_g": 40,
              "carbs_g": 80,
              "fat_g": 22
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Tofu curry",
                "amount": "1.5 cups"
              },
              {
                "name": "Rice",
                "amount": "1 cup"
              }
            ],
            "macros": {
              "calories": 950,
              "protein_g": 80,
              "carbs_g": 80,
              "fat_g": 34
            }
          }
        ]
      },
      "fri": {
        "title": "Intervals",
        "workouts": [
          {
            "id": "intervals",
            "title": "Bike intervals",
            "time": "12:00",
            "duration_min": 30,
            "kind": "hiit",
            "exercises": [
              {
                "id": "warm-up",
                "name": "Easy spin",
                "sets": 1,
                "duration_sec": 300,
                "rest_sec": 0,
                "cues": [
                  "Easy"
                ]
              },
              {
                "id": "hard",
                "name": "Hard interval",
                "sets": 6,
                "duration_sec": 60,
                "load": "RPE 8",
                "rest_sec": 90,
                "cues": [
                  "Hard but steady",
                  "Easy spin in the rest"
                ]
              },
              {
                "id": "cool-down",
                "name": "Cool-down spin",
                "sets": 1,
                "duration_sec": 300,
                "rest_sec": 0,
                "cues": [
                  "Bring the HR down"
                ]
              }
            ]
          }
        ],
        "meals": [
          {
            "id": "breakfast",
            "name": "Breakfast",
            "time": "07:30",
            "items": [
              {
                "name": "Oats with whey",
                "amount": "1 bowl"
              }
            ],
            "macros": {
              "calories": 500,
              "protein_g": 36,
              "carbs_g": 62,
              "fat_g": 12
            }
          },
          {
            "id": "lunch",
            "name": "Lunch",
            "time": "13:00",
            "items": [
              {
                "name": "Tofu rice bowl",
                "amount": "1 bowl"
              }
            ],
            "macros": {
              "calories": 680,
              "protein_g": 48,
              "carbs_g": 75,
              "fat_g": 20
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Veggie pizza",
                "amount": "3 slices"
              },
              {
                "name": "Side salad",
                "amount": "1 bowl"
              }
            ],
            "macros": {
              "calories": 1000,
              "protein_g": 50,
              "carbs_g": 110,
              "fat_g": 38
            }
          }
        ]
      },
      "sat": {
        "title": "Long walk",
        "workouts": [
          {
            "id": "walk",
            "title": "Long walk",
            "duration_min": 60,
            "kind": "cardio",
            "exercises": [
              {
                "id": "walk",
                "name": "Brisk walk",
                "sets": 1,
                "duration_sec": 3600,
                "rest_sec": 0,
                "cues": [
                  "Hills welcome",
                  "Phone in pocket"
                ]
              }
            ]
          }
        ],
        "meals": [
          {
            "id": "brunch",
            "name": "Brunch",
            "time": "10:00",
            "items": [
              {
                "name": "Eggs",
                "amount": "3"
              },
              {
                "name": "Toast",
                "amount": "2 slices"
              },
              {
                "name": "Avocado",
                "amount": "1/2"
              }
            ],
            "macros": {
              "calories": 700,
              "protein_g": 32,
              "carbs_g": 50,
              "fat_g": 38
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Salmon",
                "amount": "180 g"
              },
              {
                "name": "Potatoes",
                "amount": "250 g"
              },
              {
                "name": "Green beans",
                "amount": "1 cup"
              }
            ],
            "macros": {
              "calories": 850,
              "protein_g": 50,
              "carbs_g": 70,
              "fat_g": 35
            }
          }
        ]
      },
      "sun": {
        "title": "Rest day",
        "workouts": [],
        "meals": [
          {
            "id": "brunch",
            "name": "Brunch",
            "time": "10:00",
            "items": [
              {
                "name": "Protein pancakes",
                "amount": "3"
              },
              {
                "name": "Berries",
                "amount": "1 cup"
              }
            ],
            "macros": {
              "calories": 650,
              "protein_g": 45,
              "carbs_g": 80,
              "fat_g": 15
            }
          },
          {
            "id": "dinner",
            "name": "Dinner",
            "time": "19:00",
            "items": [
              {
                "name": "Chicken stir-fry",
                "amount": "1 plate"
              },
              {
                "name": "Rice",
                "amount": "1 cup"
              }
            ],
            "macros": {
              "calories": 850,
              "protein_g": 60,
              "carbs_g": 85,
              "fat_g": 25
            }
          }
        ]
      }
    }
  } as Plan;
}

export function demoSettings(): Settings {
  return normalizeSettings({
    about: {
      goals: "Lose about 4 kg by mid-December and keep my strength.",
      restrictions: "Left knee: no jumping or deep lunges.",
      equipment: "Office gym: dumbbells to 30 kg, cable, bike.",
      schedule: "45 min at lunch on weekdays; free on weekends.",
      diet: "Vegetarian on weekdays.",
      notes: "",
    },
  });
}
