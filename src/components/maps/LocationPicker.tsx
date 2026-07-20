import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, onGoogleMapsAuthFailure, SANCTUARY_MAP_STYLE, stagePinIcon } from "@/lib/googleMaps";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { reverseGeocode } from "@/lib/maps.functions";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type * as Leaflet from "leaflet";

interface Props {
  value?: { lat: number; lng: number } | null;
  address?: string;
  onChange: (v: { lat: number; lng: number; address: string }) => void;
  pinColor?: string;
  className?: string;
  height?: number;
}

export function LocationPicker({ value, address, onChange, pinColor = "#5D5CDE", className, height = 320 }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>("OpenStreetMap");
  const [addr, setAddr] = useState(address ?? "");
  const reverseFn = useServerFn(reverseGeocode);

  useEffect(() => setAddr(address ?? ""), [address]);
  useEffect(() => onGoogleMapsAuthFailure(setMapError), []);

  // Init map
  useEffect(() => {
    if (mapError) return;
    let cancel = false;
    (async () => {
      try {
        await loadGoogleMaps();
      } catch (error) {
        if (!cancel) setMapError(error instanceof Error ? error.message : String(error));
        return;
      }
      if (cancel || !mapEl.current || mapRef.current) return;
      const center = value ?? { lat: 40.7128, lng: -74.006 };
      const map = new google.maps.Map(mapEl.current, {
        center,
        zoom: value ? 15 : 11,
        styles: SANCTUARY_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      mapRef.current = map;

      const marker = new google.maps.Marker({
        map,
        position: value ?? undefined,
        draggable: true,
        icon: stagePinIcon(pinColor),
        animation: value ? google.maps.Animation.DROP : undefined,
      });
      markerRef.current = marker;

      map.addListener("click", async (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        placeMarker(e.latLng.lat(), e.latLng.lng());
      });
      marker.addListener("dragend", async () => {
        const p = marker.getPosition();
        if (!p) return;
        placeMarker(p.lat(), p.lng(), false);
      });
      setReady(true);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapError]);

  // Update marker on external change
  useEffect(() => {
    if (!ready || !mapRef.current || !markerRef.current) return;
    if (value) {
      markerRef.current.setPosition(value);
      mapRef.current.panTo(value);
    }
  }, [ready, value?.lat, value?.lng]);

  async function chooseLocation(lat: number, lng: number) {
    try {
      const r = await reverseFn({ data: { lat, lng } });
      const a = r?.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddr(a);
      onChange({ lat, lng, address: a });
    } catch {
      const a = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddr(a);
      onChange({ lat, lng, address: a });
    }
  }

  async function placeMarker(lat: number, lng: number, animate = true) {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setPosition({ lat, lng });
      if (animate) {
        markerRef.current.setAnimation(google.maps.Animation.DROP);
      }
      mapRef.current.panTo({ lat, lng });
    }
    await chooseLocation(lat, lng);
  }

  function useCurrent() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => placeMarker(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <PlaceAutocomplete
        value={addr}
        placeholder="Search for the property address…"
        bias={value ?? null}
        onSelect={(r) => {
          setAddr(r.address);
          onChange({ lat: r.lat, lng: r.lng, address: r.address });
        }}
      />

      <div className="relative overflow-hidden rounded-2xl border border-border-soft shadow-soft">
        {mapError ? (
          <FallbackLocationMap value={value ?? null} height={height} pinColor={pinColor} onPick={chooseLocation} />
        ) : (
          <div ref={mapEl} style={{ height }} className="w-full" />
        )}
        <button
          type="button"
          onClick={useCurrent}
          className="absolute bottom-3 right-3 z-10 grid size-10 place-items-center rounded-full border border-border-soft bg-surface text-brand shadow-lift transition-transform hover:scale-105 active:scale-95"
          title="Use current location"
        >
          <Crosshair size={16} />
        </button>
        {!value && (
          <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-center">
            <div className="rounded-full bg-surface/95 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-soft backdrop-blur">
              Tap the map or search above to drop a pin
            </div>
          </div>
        )}
        {mapError && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-5rem)] rounded-xl border border-border-soft bg-surface/95 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-soft">
            Using OpenStreetMap
          </div>
        )}
      </div>

      {value && addr && (
        <div className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs">
          <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
          <span className="flex-1 text-foreground/80">{addr}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}

function FallbackLocationMap({
  value,
  height,
  pinColor,
  onPick,
}: {
  value: { lat: number; lng: number } | null;
  height: number;
  pinColor: string;
  onPick: (lat: number, lng: number) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const L = await import("leaflet");
      if (cancel || !mapEl.current || map.current) return;
      leaflet.current = L;
      const center = value ? [value.lat, value.lng] as Leaflet.LatLngExpression : [40.7128, -74.006] as Leaflet.LatLngExpression;
      map.current = L.map(mapEl.current).setView(center, value ? 15 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      requestAnimationFrame(() => map.current?.invalidateSize());
      setTimeout(() => map.current?.invalidateSize(), 250);
      map.current.on("click", (event: Leaflet.LeafletMouseEvent) => onPick(event.latlng.lat, event.latlng.lng));
    })();
    return () => {
      cancel = true;
      map.current?.remove();
      map.current = null;
      leaflet.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    if (!L || !map.current) return;
    marker.current?.remove();
    if (!value) return;
    marker.current = L.marker([value.lat, value.lng], {
      draggable: true,
      icon: createLeafletPin(L, pinColor),
    }).addTo(map.current);
    marker.current.on("dragend", () => {
      const point = marker.current?.getLatLng();
      if (point) onPick(point.lat, point.lng);
    });
    map.current.panTo([value.lat, value.lng]);
  }, [value?.lat, value?.lng, pinColor, onPick]);

  return <div ref={mapEl} style={{ height }} className="w-full" />;
}

function createLeafletPin(L: typeof Leaflet, color: string) {
  return L.divIcon({
    className: "",
    iconAnchor: [17, 31],
    iconSize: [34, 34],
    html: `
      <span style="display:block;width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.25);transform:rotate(-45deg)">
        <span style="display:block;width:8px;height:8px;margin:7px;border-radius:999px;background:white"></span>
      </span>`,
  });
}
