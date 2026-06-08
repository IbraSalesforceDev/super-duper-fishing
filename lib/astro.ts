import SunCalc from "suncalc";
import { HOUR, MINUTE } from "./time";

// Cálculos solares y lunares (sin API externa) con SunCalc, y derivación de los
// periodos solunares usados en pesca.

export interface SunMoonDay {
  sunrise: number | null;
  sunset: number | null;
  moonrise: number | null;
  moonset: number | null;
  /** Tránsito lunar: luna en su punto más alto (paso por el meridiano). */
  lunarTransit: number | null;
  /** Anti-tránsito: luna "bajo los pies" (mínima altitud). */
  lunarAntiTransit: number | null;
  moonPhase: { fraction: number; name: string; emoji: string };
}

/** Ventana solunar [inicio, fin] en epoch ms, con su tipo. */
export interface SolunarPeriod {
  start: number;
  end: number;
  kind: "major" | "minor";
}

function moonPhaseName(phase: number): { name: string; emoji: string } {
  // phase: 0=nueva, 0.25=creciente, 0.5=llena, 0.75=menguante (SunCalc).
  if (phase < 0.03 || phase > 0.97) return { name: "Luna nueva", emoji: "🌑" };
  if (phase < 0.22) return { name: "Creciente", emoji: "🌒" };
  if (phase < 0.28) return { name: "Cuarto creciente", emoji: "🌓" };
  if (phase < 0.47) return { name: "Gibosa creciente", emoji: "🌔" };
  if (phase < 0.53) return { name: "Luna llena", emoji: "🌕" };
  if (phase < 0.72) return { name: "Gibosa menguante", emoji: "🌖" };
  if (phase < 0.78) return { name: "Cuarto menguante", emoji: "🌗" };
  return { name: "Menguante", emoji: "🌘" };
}

/**
 * Calcula el tránsito y anti-tránsito lunar muestreando la altitud de la luna
 * a lo largo del día (resolución 5 min). El tránsito es el máximo de altitud;
 * el anti-tránsito, el mínimo.
 */
function lunarTransits(
  startOfDay: number,
  lat: number,
  lon: number
): { transit: number | null; antiTransit: number | null } {
  let maxAlt = -Infinity;
  let minAlt = Infinity;
  let transit: number | null = null;
  let antiTransit: number | null = null;
  for (let t = startOfDay; t < startOfDay + 24 * HOUR; t += 5 * MINUTE) {
    const pos = SunCalc.getMoonPosition(new Date(t), lat, lon);
    if (pos.altitude > maxAlt) {
      maxAlt = pos.altitude;
      transit = t;
    }
    if (pos.altitude < minAlt) {
      minAlt = pos.altitude;
      antiTransit = t;
    }
  }
  return { transit, antiTransit };
}

export function sunMoonForDay(
  startOfDay: number,
  lat: number,
  lon: number
): SunMoonDay {
  const noon = new Date(startOfDay + 12 * HOUR);
  const sun = SunCalc.getTimes(noon, lat, lon);
  const moon = SunCalc.getMoonTimes(new Date(startOfDay), lat, lon, true);
  const illum = SunCalc.getMoonIllumination(noon);
  const { transit, antiTransit } = lunarTransits(startOfDay, lat, lon);

  const valid = (d: Date | undefined): number | null =>
    d && !isNaN(d.getTime()) ? d.getTime() : null;

  return {
    sunrise: valid(sun.sunrise),
    sunset: valid(sun.sunset),
    moonrise: moon.rise ? moon.rise.getTime() : null,
    moonset: moon.set ? moon.set.getTime() : null,
    lunarTransit: transit,
    lunarAntiTransit: antiTransit,
    moonPhase: { fraction: illum.fraction, ...moonPhaseName(illum.phase) },
  };
}

/**
 * Periodos solunares del día:
 *  - Mayores: ±1 h alrededor del tránsito y anti-tránsito lunar (ventanas de 2 h).
 *  - Menores: ±0,5 h alrededor del orto y ocaso de la luna (ventanas de 1 h).
 */
export function solunarPeriods(day: SunMoonDay): SolunarPeriod[] {
  const out: SolunarPeriod[] = [];
  const major = (c: number | null) => {
    if (c != null) out.push({ start: c - HOUR, end: c + HOUR, kind: "major" });
  };
  const minor = (c: number | null) => {
    if (c != null)
      out.push({ start: c - 0.5 * HOUR, end: c + 0.5 * HOUR, kind: "minor" });
  };
  major(day.lunarTransit);
  major(day.lunarAntiTransit);
  minor(day.moonrise);
  minor(day.moonset);
  return out;
}
