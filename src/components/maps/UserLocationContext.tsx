import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Coords = { lat: number; lng: number };
type Ctx = {
  location: Coords | null;
  status: "idle" | "granted" | "denied" | "unsupported" | "prompt";
  request: () => Promise<Coords | null>;
  clear: () => void;
};

const UserLocationCtx = createContext<Ctx | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Ctx["status"]>("idle");

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("rh:userloc");
      if (cached) {
        const p = JSON.parse(cached);
        setLocation(p);
        setStatus("granted");
      }
    } catch { /* noop */ }
  }, []);

  const request = useCallback(async (): Promise<Coords | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return null;
    }
    setStatus("prompt");
    return new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(c);
          setStatus("granted");
          try { sessionStorage.setItem("rh:userloc", JSON.stringify(c)); } catch { /* noop */ }
          resolve(c);
        },
        () => { setStatus("denied"); resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setStatus("idle");
    try { sessionStorage.removeItem("rh:userloc"); } catch { /* noop */ }
  }, []);

  return (
    <UserLocationCtx.Provider value={{ location, status, request, clear }}>
      {children}
    </UserLocationCtx.Provider>
  );
}

export function useUserLocation() {
  const ctx = useContext(UserLocationCtx);
  if (!ctx) throw new Error("useUserLocation must be inside UserLocationProvider");
  return ctx;
}
