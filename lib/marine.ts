import type { HourlyMarine } from "./types";

// Datos meteo-marinos vía Open-Meteo (gratis, sin clave, con CORS).
//  - Marine API: altura y periodo de ola.
//  - Forecast API: viento y presión en superficie.
// Pedimos en UTC (timezone=GMT) y convertimos los timestamps a epoch.

const MARINE = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

function toEpochMap(times: string[]): number[] {
  // Open-Meteo con timezone=GMT devuelve "YYYY-MM-DDTHH:mm" en UTC.
  return times.map((s) => Date.parse(s + ":00Z"));
}

export async function fetchMarine(
  lat: number,
  lon: number,
  days: number
): Promise<HourlyMarine[]> {
  const common = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(
    4
  )}&forecast_days=${days}&timezone=GMT`;
  const marineUrl = `${MARINE}?${common}&hourly=wave_height,wave_period`;
  const wxUrl = `${FORECAST}?${common}&hourly=wind_speed_10m,wind_direction_10m,surface_pressure`;

  const opts = { next: { revalidate: 3 * 3600 } } as const;
  const [mRes, wRes] = await Promise.all([
    fetch(marineUrl, opts),
    fetch(wxUrl, opts),
  ]);

  const byTime = new Map<number, HourlyMarine>();
  const ensure = (t: number): HourlyMarine => {
    let e = byTime.get(t);
    if (!e) {
      e = {
        time: t,
        waveHeight: null,
        wavePeriod: null,
        windSpeed: null,
        windDir: null,
        pressure: null,
      };
      byTime.set(t, e);
    }
    return e;
  };

  if (mRes.ok) {
    const m: any = await mRes.json();
    const times = toEpochMap(m?.hourly?.time ?? []);
    const wh = m?.hourly?.wave_height ?? [];
    const wp = m?.hourly?.wave_period ?? [];
    times.forEach((t, i) => {
      const e = ensure(t);
      e.waveHeight = wh[i] ?? null;
      e.wavePeriod = wp[i] ?? null;
    });
  }
  if (wRes.ok) {
    const w: any = await wRes.json();
    const times = toEpochMap(w?.hourly?.time ?? []);
    const ws = w?.hourly?.wind_speed_10m ?? [];
    const wd = w?.hourly?.wind_direction_10m ?? [];
    const sp = w?.hourly?.surface_pressure ?? [];
    times.forEach((t, i) => {
      const e = ensure(t);
      e.windSpeed = ws[i] ?? null;
      e.windDir = wd[i] ?? null;
      e.pressure = sp[i] ?? null;
    });
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Interpola linealmente el dato marino más cercano para un instante dado. */
export function marineAt(
  series: HourlyMarine[],
  t: number
): HourlyMarine | null {
  if (series.length === 0) return null;
  let i = 0;
  while (i < series.length && series[i].time <= t) i++;
  const prev = series[i - 1] ?? series[0];
  const next = series[i] ?? series[series.length - 1];
  if (prev === next) return prev;
  const f = (t - prev.time) / (next.time - prev.time);
  const lerp = (a: number | null, b: number | null) =>
    a == null || b == null ? a ?? b : a + (b - a) * f;
  return {
    time: t,
    waveHeight: lerp(prev.waveHeight, next.waveHeight),
    wavePeriod: lerp(prev.wavePeriod, next.wavePeriod),
    windSpeed: lerp(prev.windSpeed, next.windSpeed),
    windDir: prev.windDir, // dirección: no interpolamos circularmente, tomamos la previa
    pressure: lerp(prev.pressure, next.pressure),
  };
}
