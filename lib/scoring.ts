import type {
  DayForecast,
  FishingWindow,
  HourScore,
  HourlyMarine,
  TideExtreme,
} from "./types";
import { tideAt } from "./tides";
import { marineAt } from "./marine";
import {
  sunMoonForDay,
  solunarPeriods,
  tidalCoefficient,
  type SolunarPeriod,
} from "./astro";
import { HOUR, madridDateKey, madridStartOfDay } from "./time";

// Modelo de puntuación para pesca deportiva desde playa (surfcasting).
//
// Cada hora recibe una nota 0..100 = combinación ponderada de:
//   - Marea en movimiento (peso 40): el pez come con corriente. Máximo en la
//     mitad de la subida/bajada; mínimo en el agua muerta. Modulado por el
//     coeficiente del día (mareas vivas mueven más agua). Se prima la subida.
//   - Solunar (peso 25): periodos mayores (tránsito lunar) y menores (orto/ocaso lunar).
//   - Luz (peso 20): amanecer y atardecer son horas punta; bonus si hay luna de noche.
//   - Meteo-marina (peso 15): penaliza temporal/viento fuerte; premia mar moderada.
//
// Además, una "sinergia" potencia la nota cuando un periodo solunar coincide con
// el orto/ocaso solar (la ventana premium de la teoría solunar).
//
// Los pesos son ajustables; reflejan la práctica habitual del surfcasting.

const WEIGHTS = { tide: 0.4, solunar: 0.25, light: 0.2, weather: 0.15 };

function inAnyPeriod(
  periods: SolunarPeriod[],
  t: number,
  kind: "major" | "minor"
): boolean {
  return periods.some((p) => p.kind === kind && t >= p.start && t <= p.end);
}

/** Proximidad (0..1) a un instante objetivo dentro de una ventana de `win` ms. */
function proximity(t: number, target: number | null, win: number): number {
  if (target == null) return 0;
  const d = Math.abs(t - target);
  return d >= win ? 0 : 1 - d / win;
}

function scoreTide(rate: number, coef: number | null): number {
  // |rate| típico: 0 (parado) .. ~0,8 m/h en vivas. Normalizamos a ~0,7.
  const movement = Math.min(1, Math.abs(rate) / 0.7);
  // Bonus por marea subiendo (mejor para surfcasting): subida x1, bajada x0,78.
  const dir = rate >= 0 ? 1 : 0.78;
  // Modulación por coeficiente: muertas reducen, vivas potencian.
  const coefF = coef == null ? 0.8 : 0.5 + 0.5 * Math.min(1, (coef - 20) / 100);
  return Math.max(0, Math.min(1, movement * dir * coefF));
}

function scoreSolunar(periods: SolunarPeriod[], t: number): number {
  let s = 0;
  if (inAnyPeriod(periods, t, "major")) s = 1;
  else if (inAnyPeriod(periods, t, "minor")) s = 0.6;
  return s;
}

function scoreLight(
  t: number,
  sunrise: number | null,
  sunset: number | null,
  moonUp: boolean
): { score: number; sunriseFlag: boolean; sunsetFlag: boolean; night: boolean } {
  const win = 1.5 * HOUR;
  const pr = proximity(t, sunrise, win);
  const ps = proximity(t, sunset, win);
  const isNight =
    sunrise != null && sunset != null && (t < sunrise || t > sunset);
  // Base: punta en orto/ocaso; noche con luna algo de actividad; mediodía bajo.
  let base = Math.max(pr, ps);
  if (isNight) base = Math.max(base, moonUp ? 0.55 : 0.4);
  else base = Math.max(base, 0.25); // día con poca luz aún algo
  return {
    score: base,
    sunriseFlag: pr > 0.5,
    sunsetFlag: ps > 0.5,
    night: isNight,
  };
}

function scoreWeather(m: HourlyMarine | null): number {
  if (!m) return 0.6; // sin dato: neutro
  let s = 1;
  const wave = m.waveHeight ?? 0;
  const wind = m.windSpeed ?? 0;
  // Ola: ideal 0,4..1,2 m. Plato (<0,2) algo peor; temporal (>2,5) malo.
  if (wave > 2.5) s -= 0.6;
  else if (wave > 1.8) s -= 0.35;
  else if (wave < 0.2) s -= 0.15;
  else if (wave >= 0.4 && wave <= 1.2) s += 0.05;
  // Viento: >35 km/h difícil/peligroso; moderado removido es bueno.
  if (wind > 40) s -= 0.5;
  else if (wind > 28) s -= 0.25;
  return Math.max(0, Math.min(1, s));
}

function ratingFromScore(s: number): DayForecast["rating"] {
  if (s >= 70) return "excelente";
  if (s >= 55) return "buena";
  if (s >= 40) return "regular";
  return "floja";
}

/** Detecta ventanas continuas por encima de un umbral relativo. */
function detectWindows(hours: HourScore[]): FishingWindow[] {
  if (hours.length === 0) return [];
  const max = Math.max(...hours.map((h) => h.score));
  const threshold = Math.max(45, max * 0.8);
  const windows: FishingWindow[] = [];
  let run: HourScore[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const peak = run.reduce((a, b) => (b.score > a.score ? b : a));
      const avg = run.reduce((s, h) => s + h.score, 0) / run.length;
      windows.push({
        start: run[0].time,
        end: run[run.length - 1].time,
        peak: peak.time,
        score: Math.round(avg),
      });
    }
    run = [];
  };
  for (const h of hours) {
    if (h.score >= threshold) run.push(h);
    else flush();
  }
  flush();
  return windows.sort((a, b) => b.score - a.score);
}

/**
 * Construye la previsión completa de `days` días a partir de los extremos de
 * marea y la serie meteo-marina. Resolución horaria.
 */
export function buildForecast(
  extremes: TideExtreme[],
  marine: HourlyMarine[],
  lat: number,
  lon: number,
  startEpoch: number,
  days: number
): DayForecast[] {
  const result: DayForecast[] = [];
  const day0 = madridStartOfDay(startEpoch);

  for (let d = 0; d < days; d++) {
    const dayStart = madridStartOfDay(day0 + d * 25 * HOUR); // 25h evita saltos por DST
    const sm = sunMoonForDay(dayStart, lat, lon);
    const periods = solunarPeriods(sm);
    const dayExtremes = extremes.filter(
      (e) => e.time >= dayStart && e.time < dayStart + 24 * HOUR
    );
    // Coeficiente astronómico por pleamar (varía algo entre las dos del día).
    const annotatedExtremes = dayExtremes.map((e) =>
      e.type === "pleamar"
        ? { ...e, coefficient: tidalCoefficient(e.time) }
        : e
    );
    // Coeficiente del día: el de la pleamar principal (mayor altura),
    // o a mediodía si no hay datos de marea para ese día.
    const mainHigh = dayExtremes
      .filter((e) => e.type === "pleamar")
      .sort((a, b) => b.height - a.height)[0];
    const coef = tidalCoefficient(mainHigh ? mainHigh.time : dayStart + 12 * HOUR);

    const hours: HourScore[] = [];
    for (let h = 0; h < 24; h++) {
      const t = dayStart + h * HOUR;
      const { height, rate } = tideAt(extremes, t);
      const m = marineAt(marine, t);
      const moonUp =
        (sm.moonrise != null && sm.moonset != null && sm.moonrise < sm.moonset
          ? t >= sm.moonrise && t <= sm.moonset
          : sm.moonrise != null && t >= sm.moonrise) || false;

      const fTide = scoreTide(rate, coef);
      const fSol = scoreSolunar(periods, t);
      const light = scoreLight(t, sm.sunrise, sm.sunset, moonUp);
      const fWeather = scoreWeather(m);

      const isMajor = inAnyPeriod(periods, t, "major");
      const isMinor = inAnyPeriod(periods, t, "minor");
      const lightPeak = light.sunriseFlag || light.sunsetFlag;

      let combined =
        WEIGHTS.tide * fTide +
        WEIGHTS.solunar * fSol +
        WEIGHTS.light * light.score +
        WEIGHTS.weather * fWeather;

      // Sinergia: un periodo solunar que coincide con el orto/ocaso solar es la
      // ventana premium de la teoría solunar -> se potencia la nota.
      const synergy = (isMajor && lightPeak) || (isMinor && lightPeak);
      if (isMajor && lightPeak) combined *= 1.15;
      else if (isMinor && lightPeak) combined *= 1.08;

      const score = Math.round(100 * Math.min(1, combined));

      hours.push({
        time: t,
        score,
        tideHeight: Number(height.toFixed(2)),
        tideRate: Number(rate.toFixed(2)),
        factors: { tide: fTide, solunar: fSol, light: light.score, weather: fWeather },
        flags: {
          major: isMajor,
          minor: isMinor,
          sunrise: light.sunriseFlag,
          sunset: light.sunsetFlag,
          night: light.night,
          synergy,
        },
      });
    }

    const windows = detectWindows(hours);
    // Nota del día: media de las mejores ventanas (o de las mejores horas si no hay).
    const top = [...hours].sort((a, b) => b.score - a.score).slice(0, 4);
    const dayScore = Math.round(top.reduce((s, h) => s + h.score, 0) / top.length);

    result.push({
      date: madridDateKey(dayStart),
      score: dayScore,
      rating: ratingFromScore(dayScore),
      coefficient: coef,
      moonPhase: sm.moonPhase,
      sunrise: sm.sunrise,
      sunset: sm.sunset,
      extremes: annotatedExtremes,
      windows,
      hours,
    });
  }

  return result;
}
