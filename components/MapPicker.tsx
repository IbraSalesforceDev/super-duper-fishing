"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Station } from "@/lib/types";
import { REGIONS } from "@/lib/stations";

// Icono por defecto de Leaflet apuntando a la CDN (evita el bug de iconos rotos
// con bundlers). Marca la estación seleccionada.
const stationIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Vuela a la región de la estación seleccionada cuando cambia de zona. */
function Recenter({ station }: { station: Station | null }) {
  const map = useMap();
  const region = station?.region;
  useEffect(() => {
    if (!region) return;
    const { center, zoom } = REGIONS[region];
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [region, map]);
  return null;
}

export default function MapPicker({
  stations,
  selectedId,
  onPick,
}: {
  stations: Station[];
  selectedId: number | null;
  onPick: (lat: number, lon: number) => void;
}) {
  const selected = stations.find((s) => s.id === selectedId) ?? null;
  // Centro y zoom iniciales según la región de la estación seleccionada.
  const initial = useMemo(
    () => REGIONS[selected?.region ?? "Golfo de Cádiz"],
    [selected?.region]
  );

  return (
    <MapContainer
      center={initial.center}
      zoom={initial.zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <Recenter station={selected} />

      {stations.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lon]}
          radius={6}
          pathOptions={{
            color: s.id === selectedId ? "#73bdd9" : "#3f9cc2",
            fillColor: s.id === selectedId ? "#a9d8ea" : "#1f668a",
            fillOpacity: 0.9,
            weight: 2,
          }}
          eventHandlers={{ click: () => onPick(s.lat, s.lon) }}
        >
          <Tooltip>{s.name}</Tooltip>
        </CircleMarker>
      ))}

      {selected && (
        <Marker position={[selected.lat, selected.lon]} icon={stationIcon}>
          <Tooltip permanent direction="top" offset={[0, -38]}>
            {selected.name}
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
