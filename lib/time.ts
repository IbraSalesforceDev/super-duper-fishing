// Utilidades de tiempo. Todo el cálculo interno se hace con epoch (ms, UTC) y
// solo se convierte a/desde hora local de Europe/Madrid en los bordes (parseo
// de datos del IHM y formateo para la UI). Esto evita errores de desfase y
// maneja el cambio de hora (CET/CEST) correctamente.

const MADRID = "Europe/Madrid";

// Formatters cacheados a nivel de módulo: construir un Intl.DateTimeFormat es
// caro y estas funciones se llaman en bucles calientes (parseo de ~120 mareas
// por mes en el servidor, etiquetas horarias en cada render del cliente).
const offsetFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: MADRID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: MADRID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("es-ES", {
  timeZone: MADRID,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Offset en minutos de Europe/Madrid respecto a UTC para un instante dado. */
export function madridOffsetMinutes(at: Date): number {
  // Formateamos el mismo instante en Madrid y comparamos con UTC.
  const parts = offsetFmt.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUTC - at.getTime()) / 60000);
}

/**
 * Convierte una fecha/hora "naive" de Europe/Madrid (sin offset) a epoch UTC.
 * Ej: madridToEpoch(2026, 6, 8, 14, 30) -> ms del 8/6/2026 14:30 hora española.
 */
export function madridToEpoch(
  year: number,
  month: number, // 1..12
  day: number,
  hour: number,
  minute: number
): number {
  // Primera aproximación tratando la hora local como si fuera UTC.
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Doble corrección: cerca de los cambios CET/CEST el offset vigente en
  // `guess` puede no ser el del instante real (desfase de 1 h en horas locales
  // próximas a la transición). Recalcular con el epoch ya corregido lo
  // resuelve; para horas ambiguas del retraso de octubre elige una
  // interpretación determinista.
  const off1 = madridOffsetMinutes(new Date(guess));
  const off2 = madridOffsetMinutes(new Date(guess - off1 * 60000));
  return guess - off2 * 60000;
}

/** Fecha local YYYY-MM-DD (Europe/Madrid) de un epoch. */
export function madridDateKey(epoch: number): string {
  return dateKeyFmt.format(new Date(epoch));
}

/** Hora local HH:MM (Europe/Madrid) de un epoch. */
export function madridTime(epoch: number): string {
  return timeFmt.format(new Date(epoch));
}

/** Medianoche local (Europe/Madrid) del día que contiene a `epoch`, en epoch UTC. */
export function madridStartOfDay(epoch: number): number {
  const key = madridDateKey(epoch);
  const [y, m, d] = key.split("-").map(Number);
  return madridToEpoch(y, m, d, 0, 0);
}

export const HOUR = 3600_000;
export const MINUTE = 60_000;
