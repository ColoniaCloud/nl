"use client";

import { useEffect, useRef } from "react";

declare const google: any;

export type PlaceBounds = { north: number; south: number; east: number; west: number };
type PlaceSelected = { description: string; lat: number; lng: number; bounds?: PlaceBounds };

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceSelected) => void;
  placeholder?: string;
  countryCode?: string;
  types: string[];
  bounds?: PlaceBounds | null;
  disabled?: boolean;
  isLoaded: boolean;
  className?: string;
};

export function GooglePlaceInput({
  value, onChange, onPlaceSelect, placeholder, countryCode, types, bounds, disabled, isLoaded, className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  // Crea el Autocomplete recién cuando el script de Google ya terminó de cargar.
  useEffect(() => {
    if (!isLoaded || !inputRef.current || typeof google === "undefined" || !google.maps?.places) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types,
      componentRestrictions: countryCode ? { country: countryCode } : undefined,
      fields: ["name", "formatted_address", "geometry"],
    });
    autocompleteRef.current = ac;

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const name = place.name || place.formatted_address || "";
      onChange(name);
      if (place.geometry?.location) {
        const viewport = place.geometry.viewport;
        onPlaceSelect?.({
          description: name,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          bounds: viewport ? {
            north: viewport.getNorthEast().lat(),
            south: viewport.getSouthWest().lat(),
            east: viewport.getNorthEast().lng(),
            west: viewport.getSouthWest().lng(),
          } : undefined,
        });
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
      google.maps.event.clearInstanceListeners(ac);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, countryCode, types.join(",")]);

  // Sesga las sugerencias al área de la provincia elegida (si se pasó bounds).
  useEffect(() => {
    if (!autocompleteRef.current || typeof google === "undefined") return;
    if (bounds) {
      const gb = new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      );
      autocompleteRef.current.setBounds(gb);
    }
  }, [bounds]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled || !isLoaded}
      autoComplete="off"
      className={className}
    />
  );
}
