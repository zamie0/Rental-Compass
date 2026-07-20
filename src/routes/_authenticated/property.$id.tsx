import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/RhCard";
import { Button } from "@/components/ui/RhButton";
import { Input, Textarea } from "@/components/ui/RhInput";
import { Select } from "@/components/ui/RhSelect";
import { Checkbox } from "@/components/ui/RhCheckbox";
import { Modal } from "@/components/ui/RhModal";
import {
  propertyQuery, checklistQuery, updateProperty, deleteProperty,
  toggleChecklist, addChecklistItem, deleteChecklistItem,
  commuteTargetsQuery, upsertCommuteTarget, deleteCommuteTarget,
} from "@/lib/api";
import { STAGES, STAGE_META, fmtMoney, totalMonthly, totalInitial, type Stage, type Decision } from "@/types/property";
import { ArrowLeft, ExternalLink, Trash2, Plus, Play, MapPin, X, Check, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";
import { CommuteRoutes } from "@/components/maps/CommuteRoutes";
import { PhotoManager } from "@/components/PhotoManager";


export const Route = createFileRoute("/_authenticated/property/$id")({
  component: PropertyPage,
});

function PropertyPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: property } = useQuery(propertyQuery(id));
  const { data: items = [] } = useQuery(checklistQuery(id));
  const { data: targets = [] } = useQuery(commuteTargetsQuery);
  const [inspectMode, setInspectMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total ? done / total : 0;

  const patch = useMutation({
    mutationFn: (v: Partial<typeof property>) => updateProperty(id, v as any),
    onSuccess: () => qc.invalidateQueries(propertyQuery(id)),
  });

  const del = useMutation({
    mutationFn: () => deleteProperty(id),
    onSuccess: () => { toast.success("Deleted"); nav({ to: "/board" }); },
  });

  const toggle = useMutation({
    mutationFn: ({ i, checked }: { i: string; checked: boolean }) => toggleChecklist(i, checked),
    onMutate: async ({ i, checked }) => {
      await qc.cancelQueries(checklistQuery(id));
      const prev = qc.getQueryData<any[]>(checklistQuery(id).queryKey);
      qc.setQueryData<any[]>(checklistQuery(id).queryKey, (old) => old?.map((x) => x.id === i ? { ...x, checked } : x));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(checklistQuery(id).queryKey, ctx.prev),
  });

  const addItem = useMutation({
    mutationFn: (label: string) => addChecklistItem(id, label, items.length + 1),
    onSuccess: () => qc.invalidateQueries(checklistQuery(id)),
  });

  const removeItem = useMutation({
    mutationFn: (i: string) => deleteChecklistItem(i),
    onSuccess: () => qc.invalidateQueries(checklistQuery(id)),
  });

  if (!property) {
    return (
      <AppShell>
        <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  const stageMeta = STAGE_META[property.stage];
  const stageOpts = STAGES.map((s) => ({ value: s, label: STAGE_META[s].label, dotColor: STAGE_META[s].tokenVar }));

  return (
    <AppShell>
      <div className="px-5 pt-6 md:pt-8">
        <Link to="/board" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back to pipeline
        </Link>

        {/* Header block */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: `color-mix(in oklab, ${stageMeta.tokenVar} 15%, transparent)`, color: `color-mix(in oklab, ${stageMeta.tokenVar} 85%, black)` }}>
              <span className="size-1.5 rounded-full" style={{ background: stageMeta.tokenVar }} />
              {stageMeta.label}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{property.title}</h1>
            {property.address && <p className="mt-1 text-sm text-muted-foreground">{property.address}</p>}
            {property.listing_url && (
              <a href={property.listing_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                <ExternalLink size={14} /> View listing
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={property.stage} options={stageOpts}
              onChange={(v) => patch.mutate({ stage: v as Stage })} className="min-w-52" />
            <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete">
              <Trash2 size={16} className="text-destructive" />
            </Button>
          </div>
        </div>

        {/* Decision row when archived */}
        {property.stage === "archived" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <DecisionBtn label="Accepted" value="accepted" current={property.decision} onSet={(d) => patch.mutate({ decision: d })} />
            <DecisionBtn label="Rejected" value="rejected" current={property.decision} onSet={(d) => patch.mutate({ decision: d })} />
            <DecisionBtn label="Undecided" value="none" current={property.decision} onSet={(d) => patch.mutate({ decision: d })} />
          </div>
        )}

        {/* Numbers grid */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Monthly rent" value={fmtMoney(property.monthly_rent)} />
          <StatCard label="All-in / month" value={fmtMoney(totalMonthly(property))} sub={`+ ${fmtMoney(property.utilities_estimate)} utilities`} />
          <StatCard label="Security deposit" value={fmtMoney(property.security_deposit)} />
          <StatCard label="Move-in cost" value={fmtMoney(totalInitial(property))} accent />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left column */}
          <div className="space-y-6">
            <Card className="p-6">
              <SectionTitle>Photos</SectionTitle>
              <div className="mt-4">
                <PhotoManager propertyId={property.id} />
              </div>
            </Card>


            {/* Editable fields */}
            <Card className="p-6">
              <SectionTitle>Location</SectionTitle>
              <div className="mt-4">
                <LocationPicker
                  value={property.latitude != null && property.longitude != null ? { lat: property.latitude, lng: property.longitude } : null}
                  address={property.address ?? ""}
                  pinColor={STAGE_META[property.stage].tokenVar.includes("var(") ? "#5D5CDE" : STAGE_META[property.stage].tokenVar}
                  onChange={(v) => patch.mutate({ address: v.address, latitude: v.lat, longitude: v.lng })}
                  height={280}
                />
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle>Details</SectionTitle>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Monthly rent" type="number" value={String(property.monthly_rent)} onChange={(e) => patch.mutate({ monthly_rent: Number(e.target.value) })} />
                <Input label="Utilities est." type="number" value={String(property.utilities_estimate)} onChange={(e) => patch.mutate({ utilities_estimate: Number(e.target.value) })} />
                <Input label="Deposit" type="number" value={String(property.security_deposit)} onChange={(e) => patch.mutate({ security_deposit: Number(e.target.value) })} />
                <Input label="Viewing" type="datetime-local"
                  value={property.viewing_at ? property.viewing_at.slice(0, 16) : ""}
                  onChange={(e) => patch.mutate({ viewing_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                <div className="sm:col-span-2">
                  <Textarea label="Notes" value={property.notes ?? ""} onChange={(e) => patch.mutate({ notes: e.target.value })} />
                </div>
              </div>
            </Card>

            {/* Commute */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <SectionTitle>Commute</SectionTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowTargetModal(true)}>
                  <Plus size={14} /> Add place
                </Button>
              </div>
              <div className="mt-4">
                {property.latitude != null && property.longitude != null ? (
                  <CommuteRoutes origin={{ lat: property.latitude, lng: property.longitude }} targets={targets} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Set a pin for this property in the Location card above to see live routes and travel times.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Right column: checklist */}
          <div>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <SectionTitle>Inspection</SectionTitle>
                <Button variant="ghost" size="sm" onClick={() => setInspectMode(true)}>
                  <Play size={14} /> Inspect mode
                </Button>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{done} of {total} checked</span>
                  <span className="font-bold tabular-nums">{Math.round(pct * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct * 100}%` }} />
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {items.map((i) => (
                  <li key={i.id} className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-black/5">
                    <Checkbox checked={i.checked} label={i.label}
                      onChange={(v) => toggle.mutate({ i: i.id, checked: v })} />
                    <button onClick={() => removeItem.mutate(i.id)} className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remove">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>

              <AddItemInline onAdd={(v) => addItem.mutate(v)} />
            </Card>
          </div>
        </div>
      </div>

      {/* Inspect mode */}
      {inspectMode && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Inspect mode</div>
              <div className="text-base font-bold">{property.title}</div>
            </div>
            <button onClick={() => setInspectMode(false)} className="grid size-10 place-items-center rounded-full bg-secondary">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 pb-40">
            <div className="mb-6 h-2 rounded-full bg-black/5 overflow-hidden">
              <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct * 100}%` }} />
            </div>
            <ul className="mx-auto max-w-md space-y-3">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => toggle.mutate({ i: i.id, checked: !i.checked })}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-3xl border-2 p-5 text-left transition-all active:scale-[0.98]",
                      i.checked ? "border-brand/40 bg-brand-soft" : "border-border bg-surface",
                    )}
                  >
                    <div className={cn("grid size-8 shrink-0 place-items-center rounded-xl border-2 transition-colors",
                      i.checked ? "border-brand bg-brand text-brand-foreground" : "border-black/15")}>
                      {i.checked && <Check size={18} strokeWidth={3} />}
                    </div>
                    <span className={cn("text-base font-medium", i.checked && "text-muted-foreground line-through")}>{i.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-border-soft bg-surface p-4">
            <Button size="lg" className="w-full" onClick={() => setInspectMode(false)}>
              Finish inspection · {done}/{total}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this property?">
        <p className="text-sm text-muted-foreground">
          This will remove all notes and inspection progress for {property.title}. This can't be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => del.mutate()} loading={del.isPending}>
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      </Modal>

      <CommuteTargetModal open={showTargetModal} onClose={() => setShowTargetModal(false)} onSaved={() => qc.invalidateQueries(commuteTargetsQuery)}
        targets={targets} onDelete={(tid) => { deleteCommuteTarget(tid).then(() => qc.invalidateQueries(commuteTargetsQuery)); }} />
    </AppShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "bg-brand text-brand-foreground shadow-brand")}>
      <div className={cn("text-[10px] font-bold uppercase tracking-widest", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className={cn("mt-0.5 text-[11px]", accent ? "text-brand-foreground/70" : "text-muted-foreground")}>{sub}</div>}
    </Card>
  );
}

function AddItemInline({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Add checklist item…"
        className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <Button size="sm" type="submit" disabled={!v.trim()}><Plus size={14} /></Button>
    </form>
  );
}

function DecisionBtn({ label, value, current, onSet }: { label: string; value: Decision; current: Decision; onSet: (v: Decision) => void }) {
  const active = current === value;
  const isAcc = value === "accepted";
  const isRej = value === "rejected";
  return (
    <button
      onClick={() => onSet(value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active && isAcc && "border-accent-green bg-accent-green/15 text-accent-green",
        active && isRej && "border-destructive bg-destructive/10 text-destructive",
        active && value === "none" && "border-brand bg-brand-soft text-brand",
        !active && "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {isAcc && <Check size={12} />}
      {isRej && <XCircle size={12} />}
      {label}
    </button>
  );
}

function CommuteTargetModal({ open, onClose, onSaved, targets, onDelete }: {
  open: boolean; onClose: () => void; onSaved: () => void; targets: any[]; onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<{ address: string; lat: number; lng: number } | null>(null);
  async function save() {
    if (!label.trim() || !picked) return;
    await upsertCommuteTarget({
      label: label.trim(),
      address: picked.address,
      latitude: picked.lat,
      longitude: picked.lng,
    });
    setLabel(""); setPicked(null);
    onSaved(); toast.success("Saved");
  }
  return (
    <Modal open={open} onClose={onClose} title="Commute destinations">
      <p className="text-sm text-muted-foreground">Search for places you commute to (work, gym, family). Routes and travel times are calculated automatically.</p>
      <div className="mt-4 space-y-3">
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Work, gym, parents…" />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</label>
          <PlaceAutocomplete
            value={picked?.address ?? ""}
            placeholder="Search a place…"
            onSelect={(r) => setPicked({ address: r.address, lat: r.lat, lng: r.lng })}
          />
        </div>
        <Button onClick={save} className="w-full" disabled={!label.trim() || !picked}>
          Add destination
        </Button>
      </div>
      {targets.length > 0 && (
        <ul className="mt-6 space-y-2 border-t border-border-soft pt-4">
          {targets.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.label}</div>
                {t.address && <div className="truncate text-[11px] text-muted-foreground">{t.address}</div>}
              </div>
              <button onClick={() => onDelete(t.id)} className="text-xs text-destructive">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
