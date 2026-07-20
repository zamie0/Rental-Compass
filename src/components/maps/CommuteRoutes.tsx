import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { computeRoute, type TravelMode } from "@/lib/maps.functions";
import { loadGoogleMaps, SANCTUARY_MAP_STYLE } from "@/lib/googleMaps";
import { Car, Bike, Footprints, Train, Zap, Clock, Route as RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommuteTarget } from "@/types/property";

const MODES: { id: TravelMode; label: string; icon: any }[] = [
  { id: "DRIVE", label: "Drive", icon: Car },
  { id: "TWO_WHEELER", label: "Moto", icon: Zap },
  { id: "TRANSIT", label: "Transit", icon: Train },
  { id: "BICYCLE", label: "Cycle", icon: Bike },
  { id: "WALK", label: "Walk", icon: Footprints },
];

interface Props {
  origin: { lat: number; lng: number };
  targets: CommuteTarget[];
}

export function CommuteRoutes({ origin, targets }: Props) {
  const usable = targets.filter((t) => t.latitude != null && t.longitude != null);
  const [selectedId, setSelectedId] = useState<string | null>(usable[0]?.id ?? null);
  const [mode, setMode] = useState<TravelMode>("DRIVE");
  const routeFn = useServerFn(computeRoute);

  const target = usable.find((t) => t.id === selectedId);

  const q = useQuery({
    queryKey: ["route", origin.lat, origin.lng, target?.id, mode],
    enabled: !!target,
    queryFn: async () => {
      if (!target) return null;
      return routeFn({
        data: {
          origin,
          destination: { lat: target.latitude!, lng: target.longitude! },
          mode,
        },
      });
    },
    staleTime: 60_000,
  });

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const originMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const polyRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      await loadGoogleMaps();
      if (cancel || !mapEl.current || mapRef.current) return;
      mapRef.current = new google.maps.Map(mapEl.current, {
        center: origin,
        zoom: 13,
        styles: SANCTUARY_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      originMarker.current = new google.maps.Marker({
        map: mapRef.current,
        position: origin,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#5D5CDE", fillOpacity: 1, strokeColor: "white", strokeWeight: 3 },
      });
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    polyRef.current?.setMap(null);
    destMarker.current?.setMap(null);
    if (!target || !q.data) return;

    destMarker.current = new google.maps.Marker({
      map: mapRef.current,
      position: { lat: target.latitude!, lng: target.longitude! },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#E85D75", fillOpacity: 1, strokeColor: "white", strokeWeight: 3 },
      title: target.label,
    });

    try {
      const path = google.maps.geometry.encoding.decodePath(q.data.polyline);
      polyRef.current = new google.maps.Polyline({
        map: mapRef.current,
        path,
        strokeColor: "#5D5CDE",
        strokeOpacity: 0.9,
        strokeWeight: 5,
      });
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend({ lat: target.latitude!, lng: target.longitude! });
      mapRef.current.fitBounds(bounds, 60);
    } catch { /* noop */ }
  }, [q.data, target?.id]);

  if (usable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add commute destinations below to see live routes and travel times.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Destination chips */}
      <div className="flex flex-wrap gap-2">
        {usable.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              selectedId === t.id
                ? "border-brand bg-brand text-brand-foreground shadow-brand"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mode toggles */}
      <div className="grid grid-cols-5 gap-1.5 rounded-2xl bg-secondary/60 p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wider transition-all",
              mode === m.id ? "bg-surface text-brand shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <m.icon size={16} strokeWidth={2.2} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Result card */}
      <div className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft">
        {q.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" /> Calculating route…</div>}
        {q.isError && <div className="text-sm text-destructive">Couldn't calculate this route.</div>}
        {q.data && target && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">to {target.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-bold tabular-nums">{Math.round(q.data.durationSec / 60)}</div>
                <div className="text-sm text-muted-foreground">min</div>
              </div>
            </div>
            <div className="grid gap-1 text-right text-xs">
              <div className="flex items-center justify-end gap-1 text-muted-foreground">
                <RouteIcon size={12} /> {(q.data.distanceMeters / 1000).toFixed(1)} km
              </div>
              <div className="flex items-center justify-end gap-1 text-muted-foreground">
                <Clock size={12} /> {mode === "DRIVE" || mode === "TWO_WHEELER" ? "traffic-aware" : "typical"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-2xl border border-border-soft shadow-soft">
        <div ref={mapEl} className="h-[280px] w-full" />
      </div>
    </div>
  );
}
