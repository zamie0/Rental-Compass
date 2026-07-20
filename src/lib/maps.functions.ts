import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function gwHeaders(extra?: HeadersInit): HeadersInit {
  const lovable = process.env.LOVABLE_API_KEY;
  const gmaps = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !gmaps) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": gmaps,
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}

async function gwFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gwHeaders(), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Maps ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// ---------- Reverse geocode ----------
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) => d)
  .handler(async ({ data }) => {
    const j = await gwFetch(
      `/maps/api/geocode/json?latlng=${data.lat},${data.lng}`,
    );
    const first = j.results?.[0];
    return {
      address: first?.formatted_address ?? null,
      place_id: first?.place_id ?? null,
    };
  });

// ---------- Forward geocode (address -> coords) ----------
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { address: string }) => d)
  .handler(async ({ data }) => {
    const j = await gwFetch(
      `/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`,
    );
    const first = j.results?.[0];
    if (!first) return null;
    return {
      address: first.formatted_address as string,
      lat: first.geometry.location.lat as number,
      lng: first.geometry.location.lng as number,
      place_id: first.place_id as string,
    };
  });

// ---------- Nearby places ----------
const NEARBY_TYPES = [
  "transit_station",
  "supermarket",
  "restaurant",
  "hospital",
  "park",
  "school",
] as const;
export type NearbyType = (typeof NEARBY_TYPES)[number];

export const nearbyPlaces = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number; radius?: number; types?: NearbyType[] }) => d)
  .handler(async ({ data }) => {
    const types = data.types?.length ? data.types : (NEARBY_TYPES as unknown as NearbyType[]);
    const radius = data.radius ?? 800;
    const j = await gwFetch(`/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: data.lat, longitude: data.lng },
            radius,
          },
        },
      }),
    });
    return (j.places ?? []).map((p: any) => ({
      id: p.id as string,
      name: p.displayName?.text as string,
      address: p.formattedAddress as string | undefined,
      lat: p.location.latitude as number,
      lng: p.location.longitude as number,
      types: (p.types ?? []) as string[],
      primary: p.primaryTypeDisplayName?.text as string | undefined,
      rating: p.rating as number | undefined,
    }));
  });

// ---------- Directions (Routes API v2) ----------
export type TravelMode = "DRIVE" | "TWO_WHEELER" | "WALK" | "BICYCLE" | "TRANSIT";

export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      mode: TravelMode;
    }) => d,
  )
  .handler(async ({ data }) => {
    const body: any = {
      origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
      destination: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
      travelMode: data.mode,
      polylineEncoding: "ENCODED_POLYLINE",
    };
    if (data.mode === "DRIVE" || data.mode === "TWO_WHEELER") {
      body.routingPreference = "TRAFFIC_AWARE";
    }
    const j = await gwFetch(`/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.transitDetails",
      },
      body: JSON.stringify(body),
    });
    const r = j.routes?.[0];
    if (!r) return null;
    return {
      durationSec: parseDuration(r.duration),
      distanceMeters: r.distanceMeters as number,
      polyline: r.polyline?.encodedPolyline as string,
    };
  });

function parseDuration(d: string | undefined): number {
  if (!d) return 0;
  // "1234s"
  const m = d.match(/^(\d+)s$/);
  return m ? Number(m[1]) : 0;
}
