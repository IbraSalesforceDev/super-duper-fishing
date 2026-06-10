// Especies habituales de pesca deportiva desde costa (surfcasting) en el Golfo
// de Cádiz (Huelva y Cádiz). Datos orientativos: la temporada y las preferencias
// son generales y varían con la zona, el año y las condiciones.

export type TidePref = "vivas" | "muertas" | "subida" | "noche" | "dia";

export interface Species {
  name: string;
  emoji: string;
  /** Meses de mejor actividad (1=enero .. 12=diciembre). */
  months: number[];
  /** Preferencias que, si coinciden con el día, lo marcan como buen día. */
  pref: TidePref[];
  note: string;
}

export const SPECIES: Species[] = [
  {
    name: "Dorada",
    emoji: "🐟",
    months: [9, 10, 11, 12, 1, 2, 3],
    pref: ["vivas", "subida"],
    note: "Otoño-invierno; busca el agua revuelta de la subida con marea viva.",
  },
  {
    name: "Lubina",
    emoji: "🐟",
    months: [10, 11, 12, 1, 2, 3],
    pref: ["vivas", "noche", "subida"],
    note: "Mejor con mar movida y temporal reciente; muy activa de noche.",
  },
  {
    name: "Sargo",
    emoji: "🐠",
    months: [10, 11, 12, 1, 2, 3, 4],
    pref: ["vivas"],
    note: "Zonas de roca y mixto; coeficientes altos y rompiente.",
  },
  {
    name: "Herrera",
    emoji: "🐠",
    months: [9, 10, 11, 12, 1, 2, 3, 4, 5],
    pref: ["subida"],
    note: "Muy típica en playas de Huelva-Cádiz; cómoda casi todo el año.",
  },
  {
    name: "Corvina",
    emoji: "🐟",
    months: [5, 6, 7, 8, 9],
    pref: ["noche", "vivas"],
    note: "Primavera-verano, desembocaduras y nocturna; ejemplares grandes.",
  },
  {
    name: "Lisa / Mújol",
    emoji: "🐟",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    pref: ["subida"],
    note: "Todo el año; aguas someras y estuarios con la marea entrando.",
  },
  {
    name: "Lenguado",
    emoji: "🐟",
    months: [11, 12, 1, 2, 3, 4],
    pref: ["noche", "muertas"],
    note: "Invierno-primavera; de noche y con mar tranquila sobre arena.",
  },
  {
    name: "Choco / Sepia",
    emoji: "🦑",
    months: [2, 3, 4, 5],
    pref: ["dia"],
    note: "Desove de primavera; se acerca a la costa, muy buscado en la zona.",
  },
  {
    name: "Salmonete",
    emoji: "🐠",
    months: [6, 7, 8, 9, 10],
    pref: ["dia"],
    note: "Verano-otoño sobre fondos de arena.",
  },
  {
    name: "Brótola",
    emoji: "🐟",
    months: [11, 12, 1, 2],
    pref: ["noche"],
    note: "Invierno y de noche, mejor en zonas de roca.",
  },
  {
    name: "Baila",
    emoji: "🐟",
    months: [6, 7, 8, 9, 10],
    pref: ["subida", "noche"],
    note: "Prima de la lubina; verano-otoño en playa y barras.",
  },
  {
    name: "Pargo / Pageles",
    emoji: "🐠",
    months: [6, 7, 8, 9],
    pref: ["vivas"],
    note: "Verano; mejor en mixto y con corriente.",
  },
];

/** Marca un día por sus condiciones para casar con las preferencias de especie. */
export interface DayConditions {
  month: number; // 1..12
  coefficient: number | null;
  nightBest: boolean; // la mejor franja cae de noche
  risingBest: boolean; // la mejor franja es con marea subiendo
}

export interface SpeciesPick extends Species {
  inSeason: boolean;
  /** Encaja con las condiciones del día (temporada + preferencia). */
  fitsToday: boolean;
}

function prefMatches(s: Species, c: DayConditions): boolean {
  return s.pref.some((p) => {
    if (p === "vivas") return c.coefficient != null && c.coefficient >= 70;
    if (p === "muertas") return c.coefficient != null && c.coefficient <= 50;
    if (p === "noche") return c.nightBest;
    if (p === "dia") return !c.nightBest;
    if (p === "subida") return c.risingBest;
    return false;
  });
}

/** Especies de temporada para el día, ordenadas: las que encajan hoy primero. */
export function speciesForDay(c: DayConditions): SpeciesPick[] {
  return SPECIES.map((s) => {
    const inSeason = s.months.includes(c.month);
    return { ...s, inSeason, fitsToday: inSeason && prefMatches(s, c) };
  })
    .filter((s) => s.inSeason)
    .sort((a, b) => Number(b.fitsToday) - Number(a.fitsToday));
}
