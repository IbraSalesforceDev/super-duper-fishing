"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ForecastView from "@/components/ForecastView";
import { STATIONS, REGION_ORDER, nearestStation } from "@/lib/stations";
import { madridDateKey, madridTime } from "@/lib/time";
import type { ForecastResponse, Station } from "@/lib/types";

// Leaflet usa `window`, así que cargamos el mapa solo en cliente.
const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-sea-400">
      Cargando mapa…
    </div>
  ),
});

export default function Home() {
  const [station, setStation] = useState<Station>(
    () => STATIONS.find((s) => s.id === 42) ?? STATIONS[0]
  );
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Día local actual (Europe/Madrid). Al cruzar la medianoche fuerza un
  // refetch (la previsión de "hoy" cambia) y particiona la caché del CDN por
  // día, evitando servir el payload de ayer recién pasada la medianoche.
  const [dayKey, setDayKey] = useState(() => madridDateKey(Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const k = madridDateKey(Date.now());
      setDayKey((prev) => (prev === k ? prev : k));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Estación desde la URL (?st=ID) al cargar: enlaces compartibles.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = STATIONS.find((x) => x.id === Number(sp.get("st")));
    if (s) setStation(s);
  }, []);

  // Mantener la URL sincronizada con la estación elegida.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("st", String(station.id));
    window.history.replaceState(null, "", url);
  }, [station]);

  // Carga la previsión de la estación seleccionada. La guarda `active` evita
  // que una respuesta antigua (de una estación anterior) que llegue tarde
  // sobrescriba los datos de la estación actual (condición de carrera).
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/forecast?stationId=${station.id}&days=7&d=${dayKey}`
        );
        const json = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(json.error ?? "Error desconocido");
        setData(json as ForecastResponse);
      } catch (e: any) {
        if (active) {
          setError(e.message);
          setData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [station, dayKey]);

  const handlePick = useCallback((lat: number, lon: number) => {
    setStation(nearestStation(lat, lon));
  }, []);

  const bestDay = useMemo(() => {
    if (!data || data.station.id !== station.id) return null;
    return data.days.reduce((a, b) => (b.score > a.score ? b : a));
  }, [data, station.id]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1 border-b border-sea-800/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">
          🎣{" "}
          <span className="bg-gradient-to-r from-sea-200 via-sea-300 to-emerald-300 bg-clip-text text-transparent">
            Mareas &amp; Pesca
          </span>{" "}
          <span className="text-base font-medium text-sea-300">
            · {station.region}
          </span>
        </h1>
        <p className="text-sm text-sea-300">
          Mejores días y horas para pescar desde costa, combinando mareas
          oficiales del IHM, periodos solunares y estado de la mar. Golfo de
          Cádiz y Costa da Morte.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
        <section className="space-y-3 min-w-0">
          <div className="h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-sea-700/60 shadow-lg shadow-sea-950/50">
            <MapPicker
              stations={STATIONS}
              selectedId={station.id}
              onPick={handlePick}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm text-sea-300">Estación:</label>
            <select
              value={station.id}
              onChange={(e) =>
                setStation(
                  STATIONS.find((s) => s.id === Number(e.target.value))!
                )
              }
              className="bg-sea-900 border border-sea-700 rounded-lg px-3 py-1.5 text-sm"
            >
              {REGION_ORDER.map((region) => (
                <optgroup key={region} label={region}>
                  {STATIONS.filter((s) => s.region === region).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.province})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <p className="text-xs text-sea-400">
            Pincha en el mapa para usar la estación de marea oficial más
            cercana. El enlace de la página ya incluye tu zona: cópialo para
            compartirla.
          </p>
        </section>

        <section className="space-y-3 min-h-[300px] min-w-0">
          {bestDay && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <span className="text-xs uppercase tracking-wide text-emerald-300">
                Mejor día próximo
              </span>
              <p className="text-sm mt-0.5">
                <span className="font-semibold capitalize">
                  {new Intl.DateTimeFormat("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date(bestDay.date + "T12:00:00"))}
                </span>{" "}
                — {bestDay.rating} ({bestDay.score}/100){" "}
                {bestDay.windows[0] && (
                  <>
                    · mejor franja alrededor de las{" "}
                    {madridTime(bestDay.windows[0].peak)}
                  </>
                )}
              </p>
            </div>
          )}

          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-14 rounded-xl bg-sea-800/50" />
              <div className="h-24 rounded-xl bg-sea-800/40" />
              <div className="h-56 rounded-xl bg-sea-800/30" />
            </div>
          )}
          {error && (
            <p className="text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}
          {data && !loading && data.station.id === station.id && (
            <ForecastView data={data} />
          )}
        </section>
      </div>

      <footer className="text-xs text-sea-400 border-t border-sea-800 pt-4 space-y-1">
        <p>
          Datos de marea: Instituto Hidrográfico de la Marina (IHM). Estado de la
          mar y viento: Open-Meteo. Cálculos solares/lunares: propios (SunCalc).
        </p>
        <p>
          La puntuación es orientativa para pesca deportiva desde playa
          (surfcasting) y no sustituye al criterio del pescador ni a los avisos
          oficiales de Salvamento/AEMET. Comprueba siempre el estado de la mar
          antes de salir.
        </p>
      </footer>
    </main>
  );
}
