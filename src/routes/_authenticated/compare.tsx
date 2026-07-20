import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/RhCard";
import { Button } from "@/components/ui/RhButton";
import { Checkbox } from "@/components/ui/RhCheckbox";
import { propertiesQuery, checklistQuery } from "@/lib/api";
import { STAGE_META, fmtMoney, totalMonthly, totalInitial, type Property } from "@/types/property";
import { GitCompareArrows, Check, XCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/compare")({
  component: ComparePage,
});

function ComparePage() {
  const { data: props = [] } = useQuery(propertiesQuery);
  const [selected, setSelected] = useState<string[]>([]);
  const list = props.filter((p) => selected.includes(p.id));

  const checklistResults = useQueries({
    queries: list.map((p) => ({ ...checklistQuery(p.id) })),
  });

  function toggle(id: string) {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 3) return s;
      return [...s, id];
    });
  }

  return (
    <AppShell>
      <div className="px-5 pt-6 md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Side-by-side compare</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick up to 3 properties.</p>

        <Card className="mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Choose properties</div>
            <div className="text-xs text-muted-foreground">{selected.length}/3</div>
          </div>
          {props.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a property first.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {props.map((p) => {
                const isSel = selected.includes(p.id);
                const disabled = !isSel && selected.length >= 3;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => toggle(p.id)}
                      disabled={disabled}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                        isSel ? "border-brand bg-brand-soft" : "border-border-soft bg-surface hover:border-brand/40",
                        disabled && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <Checkbox checked={isSel} onChange={() => toggle(p.id)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{fmtMoney(p.monthly_rent)} · {STAGE_META[p.stage].label}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {list.length < 2 ? (
          <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-border-soft p-10 text-center">
            <GitCompareArrows size={28} className="text-brand" />
            <p className="mt-3 text-sm text-muted-foreground">Pick at least two to compare.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
            {list.map((p, idx) => {
              const items = checklistResults[idx]?.data ?? [];
              const done = items.filter((i) => i.checked).length;
              const total = items.length;
              const pct = total ? done / total : 0;
              return (
                <CompareCol key={p.id} property={p} pct={pct} done={done} total={total} />
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CompareCol({ property, pct, done, total }: { property: Property; pct: number; done: number; total: number }) {
  const stage = STAGE_META[property.stage];
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border-soft bg-secondary/40 px-4 py-4">
        <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `color-mix(in oklab, ${stage.tokenVar} 15%, transparent)`, color: `color-mix(in oklab, ${stage.tokenVar} 85%, black)` }}>
          <span className="size-1.5 rounded-full" style={{ background: stage.tokenVar }} />
          {stage.label}
        </div>
        <h3 className="mt-2 truncate text-base font-bold">{property.title}</h3>
        {property.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{property.address}</p>}
      </div>
      <dl className="divide-y divide-border-soft">
        <Row label="Rent" value={fmtMoney(property.monthly_rent)} />
        <Row label="Utilities" value={fmtMoney(property.utilities_estimate)} />
        <Row label="All-in / mo" value={fmtMoney(totalMonthly(property))} strong />
        <Row label="Deposit" value={fmtMoney(property.security_deposit)} />
        <Row label="Agent fee" value={fmtMoney(property.agent_fee)} />
        <Row label="Move-in" value={fmtMoney(totalInitial(property))} strong />
        <div className="px-4 py-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Inspection</span>
            <span className="font-bold tabular-nums">{done}/{total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Decision</span>
          <DecisionBadge d={property.decision} />
        </div>
      </dl>
      <div className="border-t border-border-soft p-3">
        <Link to="/property/$id" params={{ id: property.id }}>
          <Button variant="outline" className="w-full">Open</Button>
        </Link>
      </div>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-bold" : "text-sm")}>{value}</span>
    </div>
  );
}

function DecisionBadge({ d }: { d: string }) {
  if (d === "accepted") return <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-bold text-accent-green"><Check size={11} /> Accepted</span>;
  if (d === "rejected") return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive"><XCircle size={11} /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"><Minus size={11} /> Open</span>;
}
