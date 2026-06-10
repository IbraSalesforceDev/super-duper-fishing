// Tipos compartidos entre el backend (rutas /api) y el frontend.

export type Province = "Huelva" | "Cádiz";

export interface Station {
  /** ID de puerto del Instituto Hidrográfico de la Marina (param `id` del API getmarea). */
  id: number;
  name: string;
  province: Province;
  lat: number;
  lon: number;
}

/** Un extremo de marea (pleamar o bajamar) ya normalizado. */
export interface TideExtreme {
  /** Instante en epoch (ms, UTC). */
  time: number;
  /** Altura en metros. */
  height: number;
  type: "pleamar" | "bajamar";
  /** Coeficiente de marea (~20..120) asociado a la pleamar. Solo en pleamares. */
  coefficient?: number;
}

export interface HourlyMarine {
  time: number; // epoch ms
  waveHeight: number | null; // m
  wavePeriod: number | null; // s
  windSpeed: number | null; // km/h
  windDir: number | null; // grados
  pressure: number | null; // hPa
}

/** Puntuación y desglose de una hora concreta. */
export interface HourScore {
  time: number; // epoch ms
  score: number; // 0..100
  tideHeight: number; // m interpolado
  tideRate: number; // m/h (signo: + sube, - baja)
  factors: {
    tide: number; // 0..1
    solunar: number; // 0..1
    light: number; // 0..1
    weather: number; // 0..1
  };
  flags: {
    major: boolean; // periodo solunar mayor
    minor: boolean; // periodo solunar menor
    sunrise: boolean; // dentro de la ventana del amanecer
    sunset: boolean; // dentro de la ventana del atardecer
    night: boolean;
    synergy: boolean; // solunar + amanecer/atardecer coinciden (ventana premium)
  };
}

/** Ventana continua de buena pesca dentro de un día. */
export interface FishingWindow {
  start: number;
  end: number;
  peak: number; // instante de máxima puntuación
  score: number; // puntuación media de la ventana
}

export interface DayForecast {
  /** Fecha local (YYYY-MM-DD, Europe/Madrid). */
  date: string;
  score: number; // 0..100, nota del día
  rating: "excelente" | "buena" | "regular" | "floja";
  coefficient: number | null; // coeficiente de marea estimado (~20..120)
  moonPhase: { fraction: number; name: string; emoji: string };
  sunrise: number | null;
  sunset: number | null;
  extremes: TideExtreme[];
  windows: FishingWindow[];
  hours: HourScore[];
  /** Resumen meteo-marino del día (máximos), o null si no hay datos. */
  marine: { waveMax: number | null; windMax: number | null } | null;
}

export interface ForecastResponse {
  station: Station;
  generatedAt: number;
  days: DayForecast[];
  warnings: string[];
}
