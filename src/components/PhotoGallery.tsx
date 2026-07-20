import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  urls: string[];
  captions?: (string | null)[];
  startIndex?: number;
  onClose: () => void;
}

/**
 * Fullscreen swipeable gallery with pinch-zoom.
 * Uses native touch-action: pinch-zoom inside a scroll container for
 * hardware pinch/zoom, plus a horizontal snap track for swipe.
 */
export function PhotoGallery({ urls, captions, startIndex = 0, onClose }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);

  // Scroll to start index once mounted.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: startIndex * el.clientWidth, behavior: "instant" as ScrollBehavior });
  }, [startIndex]);

  // Update index on scroll.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIndex(i);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function go(delta: number) {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(urls.length - 1, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" role="dialog" aria-modal="true">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 text-white/90">
        <div className="text-sm font-semibold tabular-nums">
          {index + 1} / {urls.length}
        </div>
        <button
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {urls.map((u, i) => (
          <ZoomSlide key={i} url={u} />
        ))}
      </div>

      {/* Caption */}
      {captions?.[index] && (
        <div className="mx-auto max-w-2xl px-6 py-3 text-center text-sm text-white/80">
          {captions[index]}
        </div>
      )}

      {/* Dots */}
      {urls.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
          {urls.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/30",
              )}
            />
          ))}
        </div>
      )}

      {/* Desktop arrows */}
      {urls.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur transition-colors hover:bg-white/20 md:block"
            aria-label="Previous"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur transition-colors hover:bg-white/20 md:block"
            aria-label="Next"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </div>
  );
}

function ZoomSlide({ url }: { url: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);

  // Double-tap to zoom (mobile) / double-click (desktop).
  function onDoubleClick() {
    setZoomed((z) => !z);
  }

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full shrink-0 snap-center items-center justify-center overflow-auto"
      style={{ touchAction: "pinch-zoom" }}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        className={cn(
          "select-none transition-transform duration-300",
          zoomed ? "scale-[2] cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain",
        )}
      />
    </div>
  );
}
