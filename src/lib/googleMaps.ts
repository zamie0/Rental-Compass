/// <reference types="@types/google.maps" />
// Client-only Google Maps JS API loader (singleton)

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if ((window as any).google?.maps?.importLibrary) {
    return Promise.resolve((window as any).google);
  }
  if (loadPromise) return loadPromise;
  if (!BROWSER_KEY) {
    return Promise.reject(new Error("Google Maps browser key missing. Connect Google Maps Platform."));
  }

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const cbName = `__gmapsCb_${Math.random().toString(36).slice(2)}`;
    const cleanup = () => {
      delete (window as any)[cbName];
      delete (window as any).gm_authFailure;
    };
    (window as any)[cbName] = () => {
      cleanup();
      resolve((window as any).google);
    };
    (window as any).gm_authFailure = () => {
      cleanup();
      loadPromise = null;
      reject(new Error("Google Maps authentication failed. Check your API key, billing, and restrictions."));
    };
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      v: "weekly",
      loading: "async",
      libraries: "places,marker,geometry",
      callback: cbName,
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (!(window as any).google?.maps?.importLibrary) {
        cleanup();
        loadPromise = null;
        reject(new Error("Google Maps script loaded, but the API was not available."));
      }
    };
    s.onerror = () => {
      cleanup();
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script."));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

// Soft, warm "Sanctuary" map style
export const SANCTUARY_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f6f2ec" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6f2ec" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6b6b" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e6ede0" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#7a8a72" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#efe6d8" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#a0a0a0" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e0d7c8" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#7a7a7a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe0e6" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6b8a92" }] },
];

// Build an inline SVG data URL pin in the given color
export function stagePinIcon(color: string, size = 40): google.maps.Icon {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 40 52'>
      <defs>
        <filter id='s' x='-20%' y='-20%' width='140%' height='140%'>
          <feDropShadow dx='0' dy='2' stdDeviation='2' flood-color='#000' flood-opacity='0.25'/>
        </filter>
      </defs>
      <path filter='url(#s)' d='M20 2 C10 2 3 9 3 19 c0 13 17 31 17 31 s17-18 17-31 C37 9 30 2 20 2 z' fill='${color}' stroke='white' stroke-width='3'/>
      <circle cx='20' cy='19' r='6' fill='white'/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size * 1.3),
    anchor: new google.maps.Point(size / 2, size * 1.3),
  };
}

export function userLocationIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
      <circle cx='14' cy='14' r='12' fill='rgba(93,92,222,0.18)'/>
      <circle cx='14' cy='14' r='6' fill='#5D5CDE' stroke='white' stroke-width='3'/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(28, 28),
    anchor: new google.maps.Point(14, 14),
  };
}
