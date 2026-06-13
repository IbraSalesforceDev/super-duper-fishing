import { NextRequest, NextResponse } from "next/server";
import { getStation, nearestStation } from "@/lib/stations";
import { fetchExtremes } from "@/lib/tides";
import { fetchMarine } from "@/lib/marine";
import { buildForecast } from "@/lib/scoring";
import { HOUR } from "@/lib/time";
import type { ForecastResponse } from "@/lib/types";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const daysRaw = Math.floor(Number(sp.get("days")));
  const days = Number.isFinite(daysRaw) ? Math.min(10, Math.max(1, daysRaw)) : 7;

  // Estación por id, o la más cercana a un punto del mapa.
  let station = null;
  const idParam = sp.get("stationId");
  if (idParam) station = getStation(Number(idParam)) ?? null;
  else {
    const lat = Number(sp.get("lat"));
    const lon = Number(sp.get("lon"));
    if (Number.isFinite(lat) && Number.isFinite(lon))
      station = nearestStation(lat, lon);
  }
  if (!station)
    return NextResponse.json(
      { error: "Falta stationId válido o lat/lon" },
      { status: 400 }
    );

  const now = Date.now();
  const from = now;
  const to = now + days * 24 * HOUR;
  const warnings: string[] = [];

  // Mareas y meteo son I/O independientes: en paralelo. Las mareas son
  // imprescindibles (502 si fallan); la meteo es opcional (warning).
  const [extremesResult, marineResult] = await Promise.allSettled([
    fetchExtremes(station.id, from, to),
    fetchMarine(station.lat, station.lon, days),
  ]);

  if (extremesResult.status === "rejected") {
    const msg =
      extremesResult.reason instanceof Error
        ? extremesResult.reason.message
        : String(extremesResult.reason);
    return NextResponse.json(
      { error: `No se pudieron obtener las mareas del IHM: ${msg}` },
      { status: 502 }
    );
  }
  const extremes = extremesResult.value;
  if (extremes.length === 0)
    warnings.push("El IHM no devolvió extremos de marea para esta estación.");

  let marine: Awaited<ReturnType<typeof fetchMarine>> = [];
  if (marineResult.status === "fulfilled") marine = marineResult.value;
  else
    warnings.push("No se pudo obtener la meteo-marina (Open-Meteo); se omite ese factor.");

  const daysOut = buildForecast(extremes, marine, station.lat, station.lon, now, days);

  const body: ForecastResponse = {
    station,
    generatedAt: now,
    days: daysOut,
    warnings,
  };
  return NextResponse.json(body);
}
