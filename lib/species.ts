import type { Region } from "./types";

// Especies habituales de pesca deportiva desde costa (surfcasting / roca) por
// región. Datos orientativos: temporada y preferencias son generales y varían
// con la zona, el año y las condiciones.

export type TidePref = "vivas" | "muertas" | "subida" | "noche" | "dia";

export interface Species {
  name: string;
  emoji: string;
  /** Regiones donde es relevante. */
  regions: Region[];
  /** Meses de mejor actividad (1=enero .. 12=diciembre). */
  months: number[];
  /** Preferencias que, si coinciden con el día, lo marcan como buen día. */
  pref: TidePref[];
  note: string;
}

export const SPECIES: Species[] = [
  // --- Comunes / Golfo de Cádiz ---
  {
    name: "Dorada",
    emoji: "🐟",
    regions: ["Golfo de Cádiz"],
    months: [9, 10, 11, 12, 1, 2, 3],
    pref: ["vivas", "subida"],
    note: "Otoño-invierno; busca el agua revuelta de la subida con marea viva.",
  },
  {
    name: "Lubina / Robaliza",
    emoji: "🐟",
    regions: ["Golfo de Cádiz", "Costa da Morte"],
    months: [10, 11, 12, 1, 2, 3],
    pref: ["vivas", "noche", "subida"],
    note: "Mejor con mar movida y temporal reciente; muy activa de noche. En Galicia, 'robaliza'.",
  },
  {
    name: "Sargo",
    emoji: "🐠",
    regions: ["Golfo de Cádiz", "Costa da Morte"],
    months: [10, 11, 12, 1, 2, 3, 4],
    pref: ["vivas"],
    note: "Zonas de roca y mixto; coeficientes altos y rompiente.",
  },
  {
    name: "Herrera",
    emoji: "🐠",
    regions: ["Golfo de Cádiz"],
    months: [9, 10, 11, 12, 1, 2, 3, 4, 5],
    pref: ["subida"],
    note: "Muy típica en playas de Huelva-Cádiz; cómoda casi todo el año.",
  },
  {
    name: "Corvina",
    emoji: "🐟",
    regions: ["Golfo de Cádiz"],
    months: [5, 6, 7, 8, 9],
    pref: ["noche", "vivas"],
    note: "Primavera-verano, desembocaduras y nocturna; ejemplares grandes.",
  },
  {
    name: "Lisa / Mújol",
    emoji: "🐟",
    regions: ["Golfo de Cádiz", "Costa da Morte"],
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    pref: ["subida"],
    note: "Todo el año; aguas someras y estuarios con la marea entrando.",
  },
  {
    name: "Lenguado",
    emoji: "🐟",
    regions: ["Golfo de Cádiz", "Costa da Morte"],
    months: [11, 12, 1, 2, 3, 4],
    pref: ["noche", "muertas"],
    note: "Invierno-primavera; de noche y con mar tranquila sobre arena.",
  },
  {
    name: "Choco / Sepia",
    emoji: "🦑",
    regions: ["Golfo de Cádiz", "Costa da Morte"],
    months: [2, 3, 4, 5],
    pref: ["dia"],
    note: "Desove de primavera; se acerca a la costa.",
  },
  {
    name: "Salmonete",
    emoji: "🐠",
    regions: ["Golfo de Cádiz"],
    months: [6, 7, 8, 9, 10],
    pref: ["dia"],
    note: "Verano-otoño sobre fondos de arena.",
  },
  {
    name: "Baila",
    emoji: "🐟",
    regions: ["Golfo de Cádiz"],
    months: [6, 7, 8, 9, 10],
    pref: ["subida", "noche"],
    note: "Prima de la lubina; verano-otoño en playa y barras.",
  },
  {
    name: "Pargo / Pageles",
    emoji: "🐠",
    regions: ["Golfo de Cádiz"],
    months: [6, 7, 8, 9],
    pref: ["vivas"],
    note: "Verano; mejor en mixto y con corriente.",
  },
  // --- Costa da Morte (Galicia) ---
  {
    name: "Maragota",
    emoji: "🐠",
    regions: ["Costa da Morte"],
    months: [3, 4, 5, 6, 9, 10, 11],
    pref: ["dia"],
    note: "Reina de la roca gallega; activa de día sobre fondos de piedra y alga.",
  },
  {
    name: "Faneca",
    emoji: "🐟",
    regions: ["Costa da Morte"],
    months: [10, 11, 12, 1, 2],
    pref: ["noche"],
    note: "Otoño-invierno y de noche; muy habitual en la Costa da Morte.",
  },
  {
    name: "Reo (trucha de mar)",
    emoji: "🐟",
    regions: ["Costa da Morte"],
    months: [4, 5, 6, 7, 8],
    pref: ["subida", "noche"],
    note: "Primavera-verano en rías y desembocaduras; muy deportiva.",
  },
  {
    name: "Xarda / Caballa",
    emoji: "🐟",
    regions: ["Costa da Morte"],
    months: [4, 5, 6, 7, 8, 9],
    pref: ["dia"],
    note: "Primavera-verano; cardúmenes cerca de costa, pelágica.",
  },
  {
    name: "Pancho / Aligote",
    emoji: "🐠",
    regions: ["Costa da Morte"],
    months: [5, 6, 7, 8, 9, 10],
    pref: ["vivas"],
    note: "Pequeños espáridos de roca-mixto, muy presentes en verano-otoño.",
  },
];

/** Marca un día por sus condiciones para casar con las preferencias de especie. */
export interface DayConditions {
  region: Region;
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

/** Especies de temporada para el día y la región, las que encajan hoy primero. */
export function speciesForDay(c: DayConditions): SpeciesPick[] {
  return SPECIES.filter((s) => s.regions.includes(c.region))
    .map((s) => {
      const inSeason = s.months.includes(c.month);
      return { ...s, inSeason, fitsToday: inSeason && prefMatches(s, c) };
    })
    .filter((s) => s.inSeason)
    .sort((a, b) => Number(b.fitsToday) - Number(a.fitsToday));
}
