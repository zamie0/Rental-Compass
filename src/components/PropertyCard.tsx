import { Link } from "@tanstack/react-router";
import { STAGE_META, totalMonthly, fmtMoney, type Property } from "@/types/property";
import { Card } from "@/components/ui/RhCard";
import { Calendar, ExternalLink, ArrowRightLeft, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  property: Property;
  checklistProgress?: number;
  coverUrl?: string;
  dragging?: boolean;
  onMove?: () => void;
}

export function PropertyCard({ property, checklistProgress = 0, coverUrl, dragging, onMove }: Props) {
  const stage = STAGE_META[property.stage];
  const monthly = totalMonthly(property);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all hover:shadow-lift",
        dragging && "rotate-1 shadow-lift ring-2 ring-brand/30",
      )}
    >
      <Link
        to="/property/$id"
        params={{ id: property.id }}
        className="block active:scale-[0.99]"
      >
        {/* Cover */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/5">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={property.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground/40">
              <ImageIcon size={32} strokeWidth={1.5} />
            </div>
          )}
          {/* Stage pill floats on cover */}
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-soft backdrop-blur"
            style={{
              background: `color-mix(in oklab, ${stage.tokenVar} 85%, white)`,
              color: "white",
            }}
          >
            <span className="size-1.5 rounded-full bg-white/90" />
            {stage.label}
          </span>
          {/* Price pill */}
          <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
            {fmtMoney(property.monthly_rent)}
          </span>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-tight">{property.title}</h3>
          {property.address && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{property.address}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              {fmtMoney(monthly)} all-in
            </span>
            {property.viewing_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                <Calendar size={10} />
                {new Date(property.viewing_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            {property.listing_url && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                <ExternalLink size={10} />
                Listing
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${Math.round(checklistProgress * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-tight text-muted-foreground">
              <span>Inspection</span>
              <span className="tabular-nums">{Math.round(checklistProgress * 100)}%</span>
            </div>
          </div>
        </div>
      </Link>

      {onMove && (
        <div className="flex border-t border-border-soft">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(); }}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand active:scale-[0.98]"
          >
            <ArrowRightLeft size={14} strokeWidth={2.5} />
            Move stage
          </button>
        </div>
      )}
    </Card>
  );
}
