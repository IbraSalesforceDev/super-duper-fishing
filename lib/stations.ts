import type { Region, Station } from "./types";

// Estaciones oficiales de marea del Instituto Hidrográfico de la Marina (IHM).
// El campo `id` es el identificador de puerto del API getmarea
// (https://ideihm.covam.es/api-ihm/getmarea) y las coordenadas proceden del
// listado oficial (request=getlist).
//
// Dos regiones soportadas: el Golfo de Cádiz (Huelva y Cádiz) y la Costa da
// Morte (Galicia, A Coruña). Muxía no tiene mareógrafo propio en el IHM: su
// estación de referencia es Camariñas, en la misma ría a ~6 km.
export const STATIONS: Station[] = [
  // --- Golfo de Cádiz ---
  { id: 32, name: "Ayamonte", region: "Golfo de Cádiz", province: "Huelva", lat: 37.2117, lon: -7.405 },
  { id: 33, name: "Isla Canela", region: "Golfo de Cádiz", province: "Huelva", lat: 37.1883, lon: -7.34 },
  { id: 34, name: "Isla Cristina", region: "Golfo de Cádiz", province: "Huelva", lat: 37.205, lon: -7.325 },
  { id: 35, name: "Punta Umbría", region: "Golfo de Cádiz", province: "Huelva", lat: 37.18, lon: -6.9567 },
  { id: 36, name: "Mazagón (Huelva)", region: "Golfo de Cádiz", province: "Huelva", lat: 37.1317, lon: -6.8333 },
  { id: 37, name: "Sanlúcar de Barrameda (Bonanza)", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.8017, lon: -6.3383 },
  { id: 39, name: "Chipiona", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.7467, lon: -6.4283 },
  { id: 40, name: "Rota", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.615, lon: -6.33 },
  { id: 42, name: "Cádiz", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.54, lon: -6.2867 },
  { id: 45, name: "Sancti Petri", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.395, lon: -6.2083 },
  { id: 46, name: "Conil", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.295, lon: -6.1367 },
  { id: 47, name: "Barbate", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.185, lon: -5.9333 },
  { id: 48, name: "Tarifa", region: "Golfo de Cádiz", province: "Cádiz", lat: 36.0067, lon: -5.6033 },
  // --- Costa da Morte (Galicia) ---
  { id: 21, name: "Malpica", region: "Costa da Morte", province: "A Coruña", lat: 43.3233, lon: -8.8083 },
  { id: 22, name: "Camariñas (Muxía)", region: "Costa da Morte", province: "A Coruña", lat: 43.1267, lon: -9.1817 },
  { id: 23, name: "Fisterra", region: "Costa da Morte", province: "A Coruña", lat: 42.9083, lon: -9.2583 },
  { id: 24, name: "Portosín (Muros-Noia)", region: "Costa da Morte", province: "A Coruña", lat: 42.7633, lon: -8.9483 },
];

/** Centro y zoom del mapa por región, para recentrar al cambiar de zona. */
export const REGIONS: Record<Region, { center: [number, number]; zoom: number }> = {
  "Golfo de Cádiz": { center: [36.7, -6.5], zoom: 8 },
  "Costa da Morte": { center: [43.05, -9.0], zoom: 9 },
};

export const REGION_ORDER: Region[] = ["Golfo de Cádiz", "Costa da Morte"];

export function getStation(id: number): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}

/** Distancia aproximada en km entre dos coordenadas (haversine). */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estación oficial más cercana a un punto del mapa. */
export function nearestStation(lat: number, lon: number): Station {
  let best = STATIONS[0];
  let bestD = Infinity;
  for (const s of STATIONS) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
