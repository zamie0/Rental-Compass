import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { AppShell } from "@/components/AppShell";
import { propertiesQuery } from "@/lib/api";
import { STAGE_META, fmtMoney, type Property } from "@/types/property";
import { loadGoogleMaps, onGoogleMapsAuthFailure, SANCTUARY_MAP_STYLE, stagePinIcon, userLocationIcon } from "@/lib/googleMaps";
import { useUserLocation } from "@/components/maps/UserLocationContext";
import { nearbyPlaces } from "@/lib/maps.functions";
import { Crosshair, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type * as Leaflet from "leaflet";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

const NEARBY_LABELS: Record<string, string> = {
  transit_station: "Transit",
  supermarket: "Grocery",
  restaurant: "Food",
  hospital: "Hospital",
  park: "Park",
  school: "School",
};

function MapPage() {
  const { data: props = [] } = useQuery(propertiesQuery);
  const withCoords = props.filter((p): p is Property & { latitude: number; longitude: number } => p.latitude != null && p.longitude != null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showNearby, setShowNearby] = useState(false);
  const [mapError, setMapError] = useState<string | null>("OpenStreetMap");
  const { location: userLoc, request: requestLoc, status: locStatus } = useUserLocation();
  const nearbyFn = useServerFn(nearbyPlaces);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);
  const markers = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarker = useRef<google.maps.Marker | null>(null);
  const nearbyMarkers = useRef<google.maps.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => onGoogleMapsAuthFailure(setMapError), []);

  // Init
  useEffect(() => {
    if (mapError) return;
    let cancel = false;
    (async () => {
      try {
        await loadGoogleMaps();
      } catch (error) {
        if (cancel) return;
        setMapError(error instanceof Error ? error.message : String(error));
        return;
      }
      if (cancel || !mapEl.current || mapRef.current) return;
      const center = withCoords[0] ? { lat: withCoords[0].latitude, lng: withCoords[0].longitude } : { lat: 40.7128, lng: -74.006 };
      mapRef.current = new google.maps.Map(mapEl.current, {
        center,
        zoom: 12,
        styles: SANCTUARY_MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      clusterer.current = new MarkerClusterer({ map: mapRef.current, markers: [] });
      setReady(true);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapError]);

  // Sync property markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    clusterer.current?.clearMarkers();
    markers.current.forEach((m) => m.setMap(null));
    markers.current.clear();

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();
    withCoords.forEach((p) => {
      const color = getComputedStyle(document.documentElement).getPropertyValue(`--stage-${stageKey(p.stage)}`).trim() || "#5D5CDE";
      const m = new google.maps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        icon: stagePinIcon(color),
        animation: google.maps.Animation.DROP,
        title: p.title,
      });
      m.addListener("click", () => {
        setSelected(p);
        mapRef.current?.panTo({ lat: p.latitude, lng: p.longitude });
      });
      markers.current.set(p.id, m);
      newMarkers.push(m);
      bounds.extend({ lat: p.latitude, lng: p.longitude });
    });
    clusterer.current?.addMarkers(newMarkers);
    if (newMarkers.length > 1) mapRef.current.fitBounds(bounds, 80);
    else if (newMarkers.length === 1) mapRef.current.setZoom(14);
  }, [ready, withCoords.map((p) => `${p.id}:${p.latitude}:${p.longitude}:${p.stage}`).join(",")]);

  // User location marker
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    userMarker.current?.setMap(null);
    if (!userLoc) return;
    userMarker.current = new google.maps.Marker({
      map: mapRef.current,
      position: userLoc,
      icon: userLocationIcon(),
      title: "You",
      zIndex: 999,
    });
  }, [ready, userLoc?.lat, userLoc?.lng]);

  // Nearby places for the selected property
  type NearbyPlace = { id: string; name: string; lat: number; lng: number; types: string[]; primary?: string; rating?: number };
  const nearby = useQuery<NearbyPlace[]>({
    queryKey: ["nearby", selected?.id],
    enabled: !!selected && showNearby,
    queryFn: async () => selected ? (await nearbyFn({ data: { lat: selected.latitude!, lng: selected.longitude!, radius: 800 } })) as NearbyPlace[] : [],
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    nearbyMarkers.current.forEach((m) => m.setMap(null));
    nearbyMarkers.current = [];
    if (!showNearby || !mapRef.current || !nearby.data) return;
    nearby.data.forEach((p) => {
      const m = new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#8B7355",
          fillOpacity: 0.9,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });
      nearbyMarkers.current.push(m);
    });
  }, [nearby.data, showNearby]);

  return (
    <AppShell>
      <div className="px-5 pt-6 md:pt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Map view</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {withCoords.length === 0
                ? "Add a location when creating a property to see it here."
                : `${withCoords.length} of ${props.length} properties plotted.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => requestLoc()}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                userLoc ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              <Crosshair size={14} />
              {locStatus === "denied" ? "Location denied" : userLoc ? "Your location" : "Use my location"}
            </button>
          </div>
        </div>

        <div className="relative h-[70vh] overflow-hidden rounded-3xl border border-border-soft shadow-soft">
          {mapError ? (
            <FallbackPropertyMap
              properties={withCoords}
              selected={selected}
              onSelect={setSelected}
              userLoc={userLoc}
              nearby={showNearby ? nearby.data : undefined}
            />
          ) : (
            <div ref={mapEl} className="h-full w-full" />
          )}

          {mapError && (
            <div className="pointer-events-none absolute left-3 top-3 z-[400] max-w-sm rounded-2xl border border-border-soft bg-surface/95 px-3 py-2 text-xs text-muted-foreground shadow-soft backdrop-blur">
              <div className="font-semibold text-foreground">Using OpenStreetMap</div>
            </div>
          )}

          {withCoords.length === 0 && !mapError && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-2xl bg-surface/95 px-6 py-4 text-center text-sm text-muted-foreground shadow-soft">
                No properties on the map yet.
              </div>
            </div>
          )}

          {/* Info card */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 z-[400] mx-auto max-w-md animate-fade-in rounded-2xl border border-border-soft bg-surface/95 p-4 shadow-lift backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: STAGE_META[selected.stage].tokenVar }}>
                    {STAGE_META[selected.stage].label}
                  </div>
                  <div className="mt-0.5 truncate text-base font-bold">{selected.title}</div>
                  {selected.address && <div className="truncate text-xs text-muted-foreground">{selected.address}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-bold text-brand">{fmtMoney(selected.monthly_rent)}</div>
                  <div className="text-[10px] text-muted-foreground">/ month</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setShowNearby((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
                    showNearby ? "border-brand bg-brand-soft text-brand" : "border-border text-muted-foreground",
                  )}
                >
                  <Layers size={12} /> Nearby
                </button>
                {showNearby && nearby.isLoading && <span className="text-[11px] text-muted-foreground">Loading…</span>}
                {showNearby && nearby.data && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">{nearby.data.length} places</span>
                )}
              </div>

              {showNearby && nearby.data && nearby.data.length > 0 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {Object.entries(
                    nearby.data.reduce<Record<string, number>>((acc, p) => {
                      const t = p.types.find((x) => NEARBY_LABELS[x]) ?? "other";
                      acc[t] = (acc[t] ?? 0) + 1;
                      return acc;
                    }, {}),
                  ).map(([t, n]) => (
                    <span key={t} className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {NEARBY_LABELS[t] ?? "Other"} · {n}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => { setSelected(null); setShowNearby(false); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <X size={12} /> Close
                </button>
                <Link to="/property/$id" params={{ id: selected.id }} className="text-xs font-bold text-brand">
                  Open details →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function stageKey(s: string) {
  return s === "viewing_scheduled" ? "viewing" : s;
}

type NearbyPlace = { id: string; name: string; lat: number; lng: number; types: string[]; primary?: string; rating?: number };

function FallbackPropertyMap({
  properties,
  selected,
  onSelect,
  userLoc,
  nearby,
}: {
  properties: Array<Property & { latitude: number; longitude: number }>;
  selected: Property | null;
  onSelect: (property: Property) => void;
  userLoc: { lat: number; lng: number } | null;
  nearby?: NearbyPlace[];
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const propertyMarkers = useRef<Leaflet.Marker[]>([]);
  const nearbyMarkers = useRef<Leaflet.CircleMarker[]>([]);
  const userMarker = useRef<Leaflet.CircleMarker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const L = await import("leaflet");
      if (cancel || !mapEl.current || map.current) return;
      leaflet.current = L;
      const center = properties[0] ? [properties[0].latitude, properties[0].longitude] as Leaflet.LatLngExpression : [40.7128, -74.006] as Leaflet.LatLngExpression;
      map.current = L.map(mapEl.current, { zoomControl: true }).setView(center, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      requestAnimationFrame(() => map.current?.invalidateSize());
      setTimeout(() => map.current?.invalidateSize(), 250);
      setReady(true);
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
    if (!ready || !L || !map.current) return;

    propertyMarkers.current.forEach((marker) => marker.remove());
    propertyMarkers.current = [];

    const bounds = L.latLngBounds([]);
    properties.forEach((property) => {
      const color = getComputedStyle(document.documentElement).getPropertyValue(`--stage-${stageKey(property.stage)}`).trim() || "#5D5CDE";
      const marker = L.marker([property.latitude, property.longitude], {
        title: property.title,
        icon: createLeafletPin(L, color),
      }).addTo(map.current!);
      marker.on("click", () => {
        onSelect(property);
        map.current?.panTo([property.latitude, property.longitude]);
      });
      propertyMarkers.current.push(marker);
      bounds.extend([property.latitude, property.longitude]);
    });

    if (properties.length > 1) map.current.fitBounds(bounds, { padding: [80, 80] });
    else if (properties.length === 1) map.current.setView([properties[0].latitude, properties[0].longitude], 14);
  }, [ready, properties.map((p) => `${p.id}:${p.latitude}:${p.longitude}:${p.stage}`).join(","), onSelect]);

  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !L || !map.current) return;
    userMarker.current?.remove();
    userMarker.current = null;
    if (!userLoc) return;
    userMarker.current = L.circleMarker([userLoc.lat, userLoc.lng], {
      radius: 8,
      color: "white",
      weight: 3,
      fillColor: "#5D5CDE",
      fillOpacity: 1,
    }).addTo(map.current).bindTooltip("You");
  }, [ready, userLoc?.lat, userLoc?.lng]);

  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !L || !map.current) return;
    nearbyMarkers.current.forEach((marker) => marker.remove());
    nearbyMarkers.current = [];
    (nearby ?? []).forEach((place) => {
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: 6,
        color: "white",
        weight: 2,
        fillColor: "#8B7355",
        fillOpacity: 0.9,
      }).addTo(map.current!).bindTooltip(place.name);
      nearbyMarkers.current.push(marker);
    });
  }, [ready, nearby]);

  useEffect(() => {
    if (!selected || !map.current || selected.latitude == null || selected.longitude == null) return;
    map.current.panTo([selected.latitude, selected.longitude]);
  }, [selected?.id]);

  return <div ref={mapEl} className="h-full w-full" />;
}

function createLeafletPin(L: typeof Leaflet, color: string) {
  const html = `
    <span style="
      display:block;
      width:28px;
      height:28px;
      border-radius:50% 50% 50% 0;
      background:${color};
      border:3px solid white;
      box-shadow:0 3px 10px rgba(0,0,0,.25);
      transform:rotate(-45deg);
    ">
      <span style="
        display:block;
        width:8px;
        height:8px;
        margin:7px;
        border-radius:999px;
        background:white;
      "></span>
    </span>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 31],
  });
}
