import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { AppShell } from "@/components/AppShell";
import { PropertyCard } from "@/components/PropertyCard";
import { BottomSheet } from "@/components/ui/RhBottomSheet";
import { propertiesQuery, updateProperty } from "@/lib/api";
import { coversQuery } from "@/lib/photos";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, STAGE_META, type Stage, type Property } from "@/types/property";
import { Link } from "@tanstack/react-router";
import { Plus, Sparkles, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/board")({
  component: BoardPage,
});

function BoardPage() {
  const qc = useQueryClient();
  const { data: props = [] } = useQuery(propertiesQuery);
  const { data: covers = {} } = useQuery(coversQuery);
  const isMobile = useIsMobile();
  const [checklistMap, setChecklistMap] = useState<Record<string, { done: number; total: number }>>({});


  useEffect(() => {
    if (props.length === 0) return;
    supabase
      .from("checklist_items")
      .select("property_id, checked")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { done: number; total: number }> = {};
        for (const row of data as { property_id: string; checked: boolean }[]) {
          const m = map[row.property_id] ?? { done: 0, total: 0 };
          m.total += 1;
          if (row.checked) m.done += 1;
          map[row.property_id] = m;
        }
        setChecklistMap(map);
      });
  }, [props.length]);

  const byStage = useMemo(() => {
    const g: Record<Stage, Property[]> = {
      interested: [], contacted: [], viewing_scheduled: [], deciding: [], archived: [],
    };
    for (const p of props) g[p.stage].push(p);
    return g;
  }, [props]);

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => updateProperty(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries(propertiesQuery);
      const prev = qc.getQueryData<Property[]>(propertiesQuery.queryKey);
      qc.setQueryData<Property[]>(propertiesQuery.queryKey, (old) =>
        old ? old.map((p) => (p.id === id ? { ...p, stage } : p)) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(propertiesQuery.queryKey, ctx.prev);
      toast.error("Could not move property");
    },
    onSuccess: (_d, v) => toast.success(`Moved to ${STAGE_META[v.stage].label}`),
  });

  return (
    <AppShell>
      <div className="px-5 pt-6 md:pt-8">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Active Pipeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {props.length === 0
                ? "Nothing tracked yet. Add your first place to begin."
                : `${props.length} propert${props.length === 1 ? "y" : "ies"} in play.`}
            </p>
          </div>
        </div>

        {props.length === 0 ? (
          <EmptyState />
        ) : isMobile ? (
          <MobileBoard
            byStage={byStage}
            checklistMap={checklistMap}
            covers={covers}
            onMove={(id, stage) => stageMutation.mutate({ id, stage })}
          />
        ) : (
          <DesktopBoard
            props={props}
            byStage={byStage}
            checklistMap={checklistMap}
            covers={covers}
            onMove={(id, stage) => stageMutation.mutate({ id, stage })}
          />
        )}

      </div>
    </AppShell>
  );
}

function progress(x?: { done: number; total: number }) {
  if (!x || x.total === 0) return 0;
  return x.done / x.total;
}

/* ---------------- Mobile ---------------- */

function MobileBoard({
  byStage,
  checklistMap,
  covers,
  onMove,
}: {
  byStage: Record<Stage, Property[]>;
  checklistMap: Record<string, { done: number; total: number }>;
  covers: Record<string, string>;
  onMove: (id: string, stage: Stage) => void;
}) {

  const [active, setActive] = useState<Stage>("interested");
  const [moving, setMoving] = useState<Property | null>(null);

  const activeMeta = STAGE_META[active];
  const items = byStage[active];

  return (
    <div className="mt-5">
      {/* Chip nav */}
      <div className="-mx-5 overflow-x-auto px-5">
        <div className="flex gap-2 pb-3">
          {STAGES.map((s) => {
            const meta = STAGE_META[s];
            const count = byStage[s].length;
            const isActive = s === active;
            return (
              <button
                key={s}
                onClick={() => setActive(s)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95",
                  isActive
                    ? "border-transparent bg-foreground text-background shadow-lift"
                    : "border-border-soft bg-surface text-muted-foreground",
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ background: meta.tokenVar }} />
                  {meta.short}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      isActive ? "bg-background/20 text-background" : "bg-black/5 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active stage header */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="size-2.5 rounded-full" style={{ background: activeMeta.tokenVar }} />
        <h2 className="text-lg font-bold tracking-tight">{activeMeta.label}</h2>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border-soft py-16 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </div>
      ) : (
        <div key={active} className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {items.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              coverUrl={covers[p.id]}
              checklistProgress={progress(checklistMap[p.id])}
              onMove={() => setMoving(p)}
            />
          ))}

        </div>
      )}

      <StagePickerSheet
        property={moving}
        onClose={() => setMoving(null)}
        onPick={(stage) => {
          if (!moving) return;
          onMove(moving.id, stage);
          setMoving(null);
        }}
      />
    </div>
  );
}

function StagePickerSheet({
  property,
  onClose,
  onPick,
}: {
  property: Property | null;
  onClose: () => void;
  onPick: (stage: Stage) => void;
}) {
  if (!property) {
    return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>;
  }
  const currentIdx = STAGES.indexOf(property.stage);
  const nextStage = STAGES[currentIdx + 1] as Stage | undefined;

  return (
    <BottomSheet
      open={!!property}
      onClose={onClose}
      title="Move to stage"
      description={property.title}
    >
      {nextStage && (
        <button
          onClick={() => onPick(nextStage)}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-brand px-5 py-4 text-brand-foreground shadow-brand transition-transform active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-xl bg-brand-foreground/20">
              <ArrowRight size={16} strokeWidth={2.5} />
            </span>
            <span className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">Quick advance</span>
              <span className="block text-sm font-bold">{STAGE_META[nextStage].label}</span>
            </span>
          </span>
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      )}

      <div className="space-y-2">
        {STAGES.map((s) => {
          const meta = STAGE_META[s];
          const isCurrent = s === property.stage;
          return (
            <button
              key={s}
              disabled={isCurrent}
              onClick={() => onPick(s)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                isCurrent
                  ? "border-brand/30 bg-brand-soft cursor-default"
                  : "border-border-soft bg-surface hover:border-brand/40 hover:bg-brand-soft/50 active:scale-[0.99]",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ background: meta.tokenVar }} />
                <span>
                  <span className="block text-sm font-bold">{meta.label}</span>
                  {isCurrent && (
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-brand">
                      Current stage
                    </span>
                  )}
                </span>
              </span>
              {isCurrent && (
                <span className="grid size-7 place-items-center rounded-full bg-brand text-brand-foreground">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

/* ---------------- Desktop ---------------- */

function DesktopBoard({
  props,
  byStage,
  checklistMap,
  covers,
  onMove,
}: {
  props: Property[];
  byStage: Record<Stage, Property[]>;
  checklistMap: Record<string, { done: number; total: number }>;
  covers: Record<string, string>;
  onMove: (id: string, stage: Stage) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    const id = String(e.active.id);
    if (!overId || !STAGES.includes(overId as Stage)) return;
    const p = props.find((x) => x.id === id);
    if (!p || p.stage === overId) return;
    onMove(id, overId as Stage);
  }

  const activeProp = activeId ? props.find((p) => p.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="mt-6 grid grid-cols-5 gap-4 pb-8">
        {STAGES.map((s) => (
          <StageColumn key={s} stage={s} properties={byStage[s]} checklistMap={checklistMap} covers={covers} />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeProp && (
          <div className="w-72">
            <PropertyCard property={activeProp} dragging coverUrl={covers[activeProp.id]} checklistProgress={progress(checklistMap[activeProp.id])} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}


function StageColumn({
  stage,
  properties,
  checklistMap,
  covers,
}: {
  stage: Stage;
  properties: Property[];
  checklistMap: Record<string, { done: number; total: number }>;
  covers: Record<string, string>;
}) {
  const meta = STAGE_META[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-3xl p-2 transition-colors",
        isOver && "bg-brand-soft",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: meta.tokenVar }} />
          <h2 className="text-sm font-bold tracking-tight">{meta.label}</h2>
          <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {properties.length}
          </span>
        </div>
      </div>
      <div className="space-y-3 min-h-24">
        {properties.map((p) => (
          <DraggableCard key={p.id} property={p} progress={progress(checklistMap[p.id])} coverUrl={covers[p.id]} />
        ))}
        {properties.length === 0 && (
          <div className="grid h-24 place-items-center rounded-2xl border-2 border-dashed border-border-soft text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ property, progress, coverUrl }: { property: Property; progress: number; coverUrl?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: property.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-30" : ""}>
      <PropertyCard property={property} checklistProgress={progress} coverUrl={coverUrl} />
    </div>
  );
}


function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Sparkles size={24} />
      </div>
      <h3 className="mt-4 text-lg font-bold">Your calm rental hub</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Track properties from first spark to signed lease — one thumb, one screen.
      </p>
      <Link
        to="/add"
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:scale-[0.98]"
      >
        <Plus size={16} /> Add your first property
      </Link>
    </div>
  );
}
