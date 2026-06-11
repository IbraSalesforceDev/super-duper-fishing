import type { HourScore } from "./types";

// Módulo hoja (sin dependencias pesadas) compartido entre el scoring del
// servidor y la UI, para que los umbrales y helpers no se dupliquen y la UI
// no tenga que importar lib/scoring (que arrastra suncalc) al bundle.

/** Umbrales de nota 0..100 compartidos entre rating, colores y etiquetas. */
export const RATING_THRESHOLDS = {
  excelente: 70,
  buena: 55,
  regular: 40,
} as const;

/** Mejor hora del día por nota (O(n), sin clonar ni ordenar). */
export function bestHour(hours: HourScore[]): HourScore | undefined {
  let best: HourScore | undefined;
  for (const h of hours) if (!best || h.score > best.score) best = h;
  return best;
}
