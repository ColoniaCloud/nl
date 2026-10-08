"use client";

import { useCallback, useRef } from "react";
import { GoogleMap, Circle } from "@react-google-maps/api";

// Estilo "dark mode" para el mapa (paleta zinc, coherente con el resto de la UI).
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#18181b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#18181b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a1a1aa" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3f3f46" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#71717a" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#71717a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#27272a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14532d" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#27272a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#52525b" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#3f3f46" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3f3f46" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#71717a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#27272a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#09090b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3f3f46" }] },
];

type LatLng = { lat: number; lng: number };

type Props = {
  center: LatLng;
  radiusKm: number;
  onCenterChange: (center: LatLng) => void;
  isLoaded: boolean;
  loadError?: Error;
};

export function ScrapeMap({ center, radiusKm, onCenterChange, isLoaded, loadError }: Props) {
  const circleRef = useRef<any>(null);

  const handleMapClick = useCallback((e: any) => {
    if (e.latLng) onCenterChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }, [onCenterChange]);

  const handleCircleDragEnd = useCallback(() => {
    const c = circleRef.current?.getCenter?.();
    if (c) onCenterChange({ lat: c.lat(), lng: c.lng() });
  }, [onCenterChange]);

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-red-400 bg-zinc-900 rounded-lg">
        No se pudo cargar el mapa de Google
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground bg-zinc-900 rounded-lg">
        Cargando mapa...
      </div>
    );
  }

  return (
    <GoogleMap
      center={center}
      zoom={12}
      onClick={handleMapClick}
      mapContainerClassName="w-full h-full rounded-lg overflow-hidden"
      options={{
        styles: DARK_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        backgroundColor: "#18181b",
      }}
    >
      <Circle
        center={center}
        radius={radiusKm * 1000}
        onLoad={(circle) => { circleRef.current = circle; }}
        onDragEnd={handleCircleDragEnd}
        options={{
          fillColor: "#10b981",
          fillOpacity: 0.15,
          strokeColor: "#10b981",
          strokeOpacity: 0.7,
          strokeWeight: 2,
          draggable: true,
          clickable: false,
        }}
      />
    </GoogleMap>
  );
}
