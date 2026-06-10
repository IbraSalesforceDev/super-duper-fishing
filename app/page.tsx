"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ForecastView from "@/components/ForecastView";
import { STATIONS, nearestStation } from "@/lib/stations";
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
  const [locating, setLocating] = useState(false);

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

  const loadForecast = useCallback(async (s: Station) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?stationId=${s.id}&days=7`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error desconocido");
      setData(json as ForecastResponse);
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForecast(station);
  }, [station, loadForecast]);

  const handlePick = useCallback((lat: number, lon: number) => {
    setStation(nearestStation(lat, lon));
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite geolocalización.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setStation(nearestStation(p.coords.latitude, p.coords.longitude));
      },
      () => {
        setLocating(false);
        setError("No se pudo obtener tu ubicación.");
      },
      { timeout: 8000 }
    );
  }, []);

  const bestDay = useMemo(() => {
    if (!data) return null;
    return data.days.reduce((a, b) => (b.score > a.score ? b : a));
  }, [data]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1 border-b border-sea-800/80 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">
          🎣{" "}
          <span className="bg-gradient-to-r from-sea-200 via-sea-300 to-emerald-300 bg-clip-text text-transparent">
            Mareas &amp; Pesca
          </span>{" "}
          <span className="text-base font-medium text-sea-300">
            · Huelva y Cádiz
          </span>
        </h1>
        <p className="text-sm text-sea-300">
          Mejores días y horas para pescar desde playa, combinando mareas
          oficiales del IHM, periodos solunares y estado de la mar.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
        <section className="space-y-3">
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
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.province})
                </option>
              ))}
            </select>
            <button
              onClick={locateMe}
              disabled={locating}
              className="px-3 py-1.5 rounded-lg text-sm bg-sea-800 border border-sea-600 hover:bg-sea-700 disabled:opacity-50 transition"
              title="Usar la estación más cercana a tu posición"
            >
              {locating ? "Localizando…" : "📍 Mi ubicación"}
            </button>
          </div>
          <p className="text-xs text-sea-400">
            Pincha en el mapa para usar la estación de marea oficial más
            cercana. El enlace de la página ya incluye tu zona: cópialo para
            compartirla.
          </p>
        </section>

        <section className="space-y-3 min-h-[300px]">
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
                    {new Intl.DateTimeFormat("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Madrid",
                    }).format(new Date(bestDay.windows[0].peak))}
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
          {data && !loading && <ForecastView data={data} />}
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
