import type { TideExtreme } from "./types";
import { madridToEpoch, HOUR } from "./time";

// Acceso al API oficial de mareas del Instituto Hidrográfico de la Marina (IHM).
// Endpoint: https://ideihm.covam.es/api-ihm/getmarea?request=gettide&id=ID&format=json&month=YYYYMM
// Respuesta: { mareas: { puerto, datos: { marea: [{ fecha, hora, altura, tipo }] } } }
// `tipo` es "pleamar" | "bajamar".

const BASE = "https://ideihm.covam.es/api-ihm/getmarea";

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(",", "."));
}

/** Parsea "fecha" (admite YYYY-MM-DD o DD/MM/YYYY) + "hora" (HH:MM) como hora local de Madrid. */
function parseDateTime(fecha: string, hora: string): number | null {
  const f = fecha.trim();
  let y: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}/.test(f)) {
    [y, m, d] = f.slice(0, 10).split("-").map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(f)) {
    [d, m, y] = f.slice(0, 10).split("/").map(Number);
  } else {
    return null;
  }
  const [hh, mm] = hora.trim().split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return madridToEpoch(y, m, d, hh, mm);
}

interface RawTide {
  fecha: string;
  hora: string;
  altura: string | number;
  tipo: string;
}

/** Descarga y normaliza los extremos de marea de un mes para una estación. */
export async function fetchMonth(
  stationId: number,
  year: number,
  month: number
): Promise<TideExtreme[]> {
  const ym = `${year}${String(month).padStart(2, "0")}`;
  const url = `${BASE}?request=gettide&id=${stationId}&format=json&month=${ym}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Cacheamos en el edge de Next durante 6 h: las predicciones no cambian.
    next: { revalidate: 6 * 3600 },
  });
  if (!res.ok) throw new Error(`IHM getmarea ${res.status} (estación ${stationId})`);
  const json: any = await res.json();
  const raw = json?.mareas?.datos?.marea;
  const list: RawTide[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const out: TideExtreme[] = [];
  for (const r of list) {
    const time = parseDateTime(r.fecha, r.hora);
    if (time == null) continue;
    const tipo = String(r.tipo).toLowerCase();
    out.push({
      time,
      height: parseNum(r.altura),
      type: tipo.startsWith("plea") ? "pleamar" : "bajamar",
    });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** Extremos de marea que cubren la ventana [from, to], descargando los meses necesarios. */
export async function fetchExtremes(
  stationId: number,
  from: number,
  to: number
): Promise<TideExtreme[]> {
  const months = new Set<string>();
  // Margen de un día a cada lado para poder interpolar en los bordes.
  for (let t = from - HOUR * 24; t <= to + HOUR * 24; t += HOUR * 24) {
    const d = new Date(t);
    months.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
  }
  const results = await Promise.all(
    [...months].map((key) => {
      const [y, m] = key.split("-").map(Number);
      return fetchMonth(stationId, y, m);
    })
  );
  const merged = results.flat();
  // Dedup por instante y orden.
  const seen = new Set<number>();
  const dedup = merged.filter((e) => {
    if (seen.has(e.time)) return false;
    seen.add(e.time);
    return true;
  });
  dedup.sort((a, b) => a.time - b.time);
  return dedup;
}

/**
 * Altura y velocidad de la marea en un instante, interpolando entre extremos
 * con un modelo sinusoidal (la marea entre pleamar y bajamar sigue ~ media coseno).
 * Devuelve altura (m) y tasa de cambio (m/h, signo + si sube).
 */
export function tideAt(
  extremes: TideExtreme[],
  t: number
): { height: number; rate: number } {
  if (extremes.length === 0) return { height: 0, rate: 0 };
  // Localizar el extremo previo y el siguiente.
  let i = 0;
  while (i < extremes.length && extremes[i].time <= t) i++;
  const prev = extremes[i - 1];
  const next = extremes[i];
  if (!prev) return { height: next.height, rate: 0 };
  if (!next) return { height: prev.height, rate: 0 };

  const span = next.time - prev.time;
  const x = (t - prev.time) / span; // 0..1
  const A = (prev.height - next.height) / 2;
  const mid = (prev.height + next.height) / 2;
  // h(x) = mid + A*cos(pi*x); en x=0 -> prev, en x=1 -> next.
  const height = mid + A * Math.cos(Math.PI * x);
  // dh/dt = -A*pi*sin(pi*x)/span  (span en ms) -> pasar a por hora.
  const rate = (-A * Math.PI * Math.sin(Math.PI * x) * HOUR) / span;
  return { height, rate };
}

/**
 * Coeficiente de marea estimado (~20..120). El IHM no lo publica, así que lo
 * aproximamos a partir de la amplitud (pleamar-bajamar) del día relativa al
 * rango astronómico típico de la zona. Es una estimación, no el coeficiente
 * oficial del SHOM, pero sirve para comparar "mareas vivas vs muertas".
 */
export function dayCoefficient(extremes: TideExtreme[]): number | null {
  const highs = extremes.filter((e) => e.type === "pleamar").map((e) => e.height);
  const lows = extremes.filter((e) => e.type === "bajamar").map((e) => e.height);
  if (!highs.length || !lows.length) return null;
  const range = Math.max(...highs) - Math.min(...lows);
  // Rango típico del Golfo de Cádiz: ~1,0 m (muertas) a ~3,6 m (vivas grandes).
  const RANGE_MIN = 1.0;
  const RANGE_MAX = 3.6;
  const f = (range - RANGE_MIN) / (RANGE_MAX - RANGE_MIN);
  const coef = 20 + Math.max(0, Math.min(1, f)) * 100; // 20..120
  return Math.round(coef);
}
