import { useEffect, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { cn } from "@/lib/utils";

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

interface Props {
  value?: string;
  placeholder?: string;
  onSelect: (r: { placeId: string; address: string; lat: number; lng: number }) => void;
  className?: string;
  size?: "sm" | "md";
  bias?: { lat: number; lng: number } | null;
}

export function PlaceAutocomplete({ value, placeholder = "Search address, place…", onSelect, className, size = "md", bias }: Props) {
  const [q, setQ] = useState(value ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionToken = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(value ?? ""); }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!q.trim() || q.length < 2) { setItems([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        await loadGoogleMaps();
        const places = (await google.maps.importLibrary("places")) as any;
        if (!sessionToken.current) sessionToken.current = new places.AutocompleteSessionToken();
        const request: any = {
          input: q,
          sessionToken: sessionToken.current,
        };
        if (bias) {
          request.locationBias = { radius: 30000, center: { lat: bias.lat, lng: bias.lng } };
        }
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (cancel) return;
        setItems(
          (suggestions ?? [])
            .map((s: any) => s.placePrediction)
            .filter(Boolean)
            .map((p: any) => ({
              placeId: p.placeId,
              primary: p.mainText?.text ?? p.text?.text ?? "",
              secondary: p.secondaryText?.text ?? "",
            })),
        );
        setOpen(true);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, bias?.lat, bias?.lng]);

  async function pick(s: Suggestion) {
    try {
      const places = (await google.maps.importLibrary("places")) as any;
      const place = new places.Place({ id: s.placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress", "displayName"] });
      const lat = place.location.lat();
      const lng = place.location.lng();
      const address = place.formattedAddress ?? `${s.primary}${s.secondary ? ", " + s.secondary : ""}`;
      sessionToken.current = null;
      setQ(address);
      setOpen(false);
      onSelect({ placeId: s.placeId, address, lat, lng });
    } catch (e) {
      // ignore
    }
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-2xl border border-border bg-surface pl-10 pr-3 shadow-soft focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10",
            size === "sm" ? "py-2 text-sm" : "py-3 text-base",
          )}
        />
        {loading && <div className="absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
      </div>
      {open && items.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[500] mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border-soft bg-surface p-1 shadow-lift">
          {items.map((s) => (
            <button
              key={s.placeId}
              onClick={() => pick(s)}
              type="button"
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-soft"
            >
              <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.primary}</div>
                {s.secondary && <div className="truncate text-xs text-muted-foreground">{s.secondary}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
