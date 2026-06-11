import { NextResponse } from "next/server";

// Ruta temporal de diagnóstico: proxy del listado oficial de puertos del IHM
// (getlist). Sirve para descubrir IDs/nombres exactos de estaciones a añadir.
export const revalidate = 86400;

export async function GET() {
  const url =
    "https://ideihm.covam.es/api-ihm/getmarea?request=getlist&format=json";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok)
    return NextResponse.json(
      { error: `IHM getlist ${res.status}` },
      { status: 502 }
    );
  const json = await res.json();
  return NextResponse.json(json);
}
