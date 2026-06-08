import type { Station } from "./types";

// Estaciones oficiales de marea del Instituto Hidrográfico de la Marina (IHM)
// en la costa de Huelva y Cádiz. El campo `id` es el identificador de puerto
// del API getmarea (https://ideihm.covam.es/api-ihm/getmarea), que coincide con
// el parámetro `puerto` de la app de mareas de la Armada.
//
// Los IDs incluidos aquí están verificados. Se pueden añadir más estaciones
// (Isla Cristina, Punta Umbría, Bonanza, Chipiona, Pto. de Santa María...) en
// cuanto se confirme su ID consultando el endpoint getlist del API.
export const STATIONS: Station[] = [
  { id: 32, name: "Ayamonte", province: "Huelva", lat: 37.2104, lon: -7.4087 },
  { id: 36, name: "Mazagón (Huelva)", province: "Huelva", lat: 37.1283, lon: -6.8276 },
  { id: 40, name: "Rota", province: "Cádiz", lat: 36.6207, lon: -6.3597 },
  { id: 42, name: "Cádiz", province: "Cádiz", lat: 36.5345, lon: -6.2926 },
  { id: 47, name: "Barbate", province: "Cádiz", lat: 36.1918, lon: -5.9214 },
  { id: 48, name: "Tarifa", province: "Cádiz", lat: 36.0067, lon: -5.6039 },
];

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
