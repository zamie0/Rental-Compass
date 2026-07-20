import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/RhCard";
import { Input, Textarea } from "@/components/ui/RhInput";
import { Button } from "@/components/ui/RhButton";
import { Select } from "@/components/ui/RhSelect";
import { Checkbox } from "@/components/ui/RhCheckbox";
import { STAGES, STAGE_META, type Stage } from "@/types/property";
import { createProperty, propertiesQuery } from "@/lib/api";
import { LocationPicker } from "@/components/maps/LocationPicker";
import {
  extractFromUrl,
  extractFromText,
  extractFromImages,
  type ExtractedProperty,
} from "@/lib/extract.functions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Pencil,
  Link2,
  ClipboardPaste,
  ImageIcon,
  Sparkles,
  X,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/add")({
  component: AddPage,
});

type Method = "chooser" | "manual" | "url" | "text" | "ocr" | "review";

interface FormState {
  title: string;
  listing_url: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  monthly_rent: string;
  security_deposit: string;
  utilities_estimate: string;
  stage: Stage;
  notes: string;
  description: string;
  bedrooms: string;
  bathrooms: string;
  furnished: string;
  parking: boolean;
  pet_friendly: boolean;
  internet: boolean;
  facilities: string[];
  property_type: string;
  agent_name: string;
  agent_phone: string;
}

const emptyForm: FormState = {
  title: "",
  listing_url: "",
  address: "",
  latitude: null,
  longitude: null,
  monthly_rent: "",
  security_deposit: "",
  utilities_estimate: "",
  stage: "interested",
  notes: "",
  description: "",
  bedrooms: "",
  bathrooms: "",
  furnished: "",
  parking: false,
  pet_friendly: false,
  internet: false,
  facilities: [],
  property_type: "",
  agent_name: "",
  agent_phone: "",
};

function mergeExtracted(form: FormState, ex: ExtractedProperty): { form: FormState; touched: Set<keyof FormState> } {
  const touched = new Set<keyof FormState>();
  const next = { ...form };
  const setStr = (k: keyof FormState, v: string | null | undefined) => {
    if (v != null && String(v).trim()) {
      (next as any)[k] = String(v);
      touched.add(k);
    }
  };
  const setNum = (k: keyof FormState, v: number | null | undefined) => {
    if (v != null && !Number.isNaN(v)) {
      (next as any)[k] = String(v);
      touched.add(k);
    }
  };
  const setBool = (k: keyof FormState, v: boolean | null | undefined) => {
    if (typeof v === "boolean") {
      (next as any)[k] = v;
      touched.add(k);
    }
  };
  setStr("title", ex.title);
  setStr("address", ex.address);
  setStr("description", ex.description);
  setStr("furnished", ex.furnished);
  setStr("property_type", ex.property_type);
  setStr("agent_name", ex.agent_name);
  setStr("agent_phone", ex.agent_phone);
  setStr("listing_url", ex.listing_url);
  setNum("monthly_rent", ex.monthly_rent);
  setNum("security_deposit", ex.security_deposit);
  setNum("utilities_estimate", ex.utilities_estimate);
  setNum("bedrooms", ex.bedrooms);
  setNum("bathrooms", ex.bathrooms);
  setBool("parking", ex.parking);
  setBool("pet_friendly", ex.pet_friendly);
  setBool("internet", ex.internet);
  if (ex.facilities?.length) {
    next.facilities = Array.from(new Set(ex.facilities.map((f) => f.trim()).filter(Boolean)));
    touched.add("facilities");
  }
  return { form: next, touched };
}

function AddPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [method, setMethod] = useState<Method>("chooser");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [aiFields, setAiFields] = useState<Set<keyof FormState>>(new Set());
  const [manualStep, setManualStep] = useState(0);

  const create = useMutation({
    mutationFn: () =>
      createProperty({
        title: form.title,
        listing_url: form.listing_url || undefined,
        address: form.address || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
        monthly_rent: Number(form.monthly_rent || 0),
        security_deposit: Number(form.security_deposit || 0),
        utilities_estimate: Number(form.utilities_estimate || 0),
        stage: form.stage,
        notes: form.notes || undefined,
        description: form.description || null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        furnished: form.furnished || null,
        parking: form.parking,
        pet_friendly: form.pet_friendly,
        internet: form.internet,
        facilities: form.facilities,
        property_type: form.property_type || null,
        agent_name: form.agent_name || null,
        agent_phone: form.agent_phone || null,
      }),
    onSuccess: (p) => {
      qc.invalidateQueries(propertiesQuery);
      toast.success("Property added");
      nav({ to: "/property/$id", params: { id: p.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  function goBack() {
    if (method === "chooser") nav({ to: "/board" });
    else if (method === "review") setMethod("chooser");
    else if (method === "manual" && manualStep > 0) setManualStep(manualStep - 1);
    else setMethod("chooser");
  }

  return (
    <AppShell>
      <div className="px-5 pt-6 pb-8 md:pt-8">
        <button
          onClick={goBack}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {method === "chooser" && (
          <MethodChooser
            onPick={(m) => {
              setForm(emptyForm);
              setAiFields(new Set());
              setManualStep(0);
              setMethod(m);
            }}
          />
        )}

        {method === "manual" && (
          <ManualWizard
            form={form}
            setForm={setForm}
            step={manualStep}
            setStep={setManualStep}
            onSubmit={() => create.mutate()}
            saving={create.isPending}
          />
        )}

        {method === "url" && (
          <UrlExtract
            onExtracted={(ex) => {
              const merged = mergeExtracted(emptyForm, ex);
              setForm(merged.form);
              setAiFields(merged.touched);
              setMethod("review");
            }}
          />
        )}

        {method === "text" && (
          <TextExtract
            onExtracted={(ex) => {
              const merged = mergeExtracted(emptyForm, ex);
              setForm(merged.form);
              setAiFields(merged.touched);
              setMethod("review");
            }}
          />
        )}

        {method === "ocr" && (
          <OcrExtract
            onExtracted={(ex) => {
              const merged = mergeExtracted(emptyForm, ex);
              setForm(merged.form);
              setAiFields(merged.touched);
              setMethod("review");
            }}
          />
        )}

        {method === "review" && (
          <ReviewForm
            form={form}
            setForm={setForm}
            aiFields={aiFields}
            onSubmit={() => create.mutate()}
            saving={create.isPending}
          />
        )}
      </div>
    </AppShell>
  );
}

// -------- Method chooser --------
function MethodChooser({ onPick }: { onPick: (m: Method) => void }) {
  const methods: {
    id: Method;
    icon: React.ReactNode;
    title: string;
    desc: string;
    accent: string;
  }[] = [
    {
      id: "manual",
      icon: <Pencil size={22} strokeWidth={2.2} />,
      title: "Enter manually",
      desc: "Guided step-by-step wizard. Best when you're on-site.",
      accent: "from-brand/15 to-brand/5 text-brand",
    },
    {
      id: "url",
      icon: <Link2 size={22} strokeWidth={2.2} />,
      title: "From a listing link",
      desc: "Paste a URL — we'll pull title, rent, photos and specs.",
      accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
    },
    {
      id: "text",
      icon: <ClipboardPaste size={22} strokeWidth={2.2} />,
      title: "From an ad or message",
      desc: "Paste text from WhatsApp, Marketplace, PropertyGuru, etc.",
      accent: "from-amber-500/15 to-amber-500/5 text-amber-700",
    },
    {
      id: "ocr",
      icon: <ImageIcon size={22} strokeWidth={2.2} />,
      title: "From screenshots",
      desc: "Upload photos of listings — we'll read them with AI.",
      accent: "from-violet-500/15 to-violet-500/5 text-violet-700",
    },
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Add a property</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick how you want to start.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m.id)}
            className="group text-left"
          >
            <Card className="flex h-full flex-col gap-3 p-5 transition-all group-hover:shadow-lift group-active:scale-[0.99]">
              <div
                className={cn(
                  "grid size-11 place-items-center rounded-2xl bg-gradient-to-br",
                  m.accent,
                )}
              >
                {m.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold">{m.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{m.desc}</p>
              </div>
              <div className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand">
                Continue <ArrowRight size={12} />
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

// -------- URL extract --------
function UrlExtract({ onExtracted }: { onExtracted: (ex: ExtractedProperty) => void }) {
  const fn = useServerFn(extractFromUrl);
  const [url, setUrl] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { url } }),
    onSuccess: onExtracted,
    onError: (e: any) => toast.error(e?.message ?? "Could not extract"),
  });
  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
        <Sparkles size={12} /> AI import
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Paste a listing URL</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Works with most public listing sites. You'll review everything before saving.
      </p>
      <div className="mt-6 space-y-4">
        <Input
          label="Listing URL"
          type="url"
          autoFocus
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          onClick={() => m.mutate()}
          loading={m.isPending}
          disabled={!/^https?:\/\//i.test(url)}
        >
          <Sparkles size={16} /> Extract details
        </Button>
      </div>
    </Card>
  );
}

// -------- Text extract --------
function TextExtract({ onExtracted }: { onExtracted: (ex: ExtractedProperty) => void }) {
  const fn = useServerFn(extractFromText);
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { text } }),
    onSuccess: onExtracted,
    onError: (e: any) => toast.error(e?.message ?? "Could not extract"),
  });
  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
        <Sparkles size={12} /> AI import
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Paste the ad</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Copy the full text from WhatsApp, Facebook Marketplace, Telegram, PropertyGuru, iProperty, Mudah — anywhere.
      </p>
      <div className="mt-6">
        <Textarea
          label="Ad text"
          rows={10}
          className="min-h-48"
          placeholder="Paste the entire listing here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">{text.length} chars</span>
        <Button
          size="lg"
          onClick={() => m.mutate()}
          loading={m.isPending}
          disabled={text.trim().length < 20}
        >
          <Sparkles size={16} /> Extract details
        </Button>
      </div>
    </Card>
  );
}

// -------- OCR extract --------
async function fileToCompressedDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function OcrExtract({ onExtracted }: { onExtracted: (ex: ExtractedProperty) => void }) {
  const fn = useServerFn(extractFromImages);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      const next: string[] = [];
      for (const f of Array.from(files).slice(0, 8 - images.length)) {
        if (!f.type.startsWith("image/")) continue;
        next.push(await fileToCompressedDataUrl(f));
      }
      setImages((prev) => [...prev, ...next].slice(0, 8));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read image");
    } finally {
      setBusy(false);
    }
  }

  const m = useMutation({
    mutationFn: () => fn({ data: { images } }),
    onSuccess: onExtracted,
    onError: (e: any) => toast.error(e?.message ?? "Could not extract"),
  });

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-700">
        <Sparkles size={12} /> AI OCR
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Upload screenshots</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Snap or upload up to 8 listing screenshots. Images are compressed before upload.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-2xl border border-border-soft bg-black/5">
            <img src={src} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setImages(images.filter((_, j) => j !== i))}
              className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/70 text-white active:scale-90"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length < 8 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-border bg-surface text-muted-foreground transition-colors hover:border-brand hover:text-brand active:scale-[0.98]"
          >
            <div className="flex flex-col items-center gap-1">
              <Upload size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Add</span>
            </div>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">{images.length} / 8</span>
        <Button
          size="lg"
          onClick={() => m.mutate()}
          loading={m.isPending || busy}
          disabled={images.length === 0}
        >
          <Sparkles size={16} /> Extract details
        </Button>
      </div>
    </Card>
  );
}

// -------- Manual wizard (original 4 steps) --------
function ManualWizard({
  form,
  setForm,
  step,
  setStep,
  onSubmit,
  saving,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  step: number;
  setStep: (n: number) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const steps = [
    { title: "The basics", fields: ["title", "listing_url"] as const },
    { title: "Where is it?", fields: ["address"] as const },
    { title: "The numbers", fields: ["monthly_rent", "security_deposit", "utilities_estimate"] as const },
    { title: "Property details", fields: [] as readonly string[] },
    { title: "Pipeline & notes", fields: ["stage", "notes"] as const },
  ];

  function validate(fields: readonly string[]) {
    const errs: Record<string, string> = {};
    if (fields.includes("title") && !form.title.trim()) errs.title = "Give it a name.";
    if (fields.includes("monthly_rent") && !form.monthly_rent) errs.monthly_rent = "Rent is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validate(steps[step].fields)) return;
    if (step < steps.length - 1) setStep(step + 1);
    else onSubmit();
  }

  const stageOpts = STAGES.map((s) => ({
    value: s,
    label: STAGE_META[s].label,
    dotColor: STAGE_META[s].tokenVar,
  }));

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-brand" : "bg-black/10")} />
        ))}
      </div>

      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{steps[step].title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {step + 1} of {steps.length}</p>

        <div className="mt-6 space-y-4">
          {step === 0 && (
            <>
              <Input label="Property name" placeholder="The Willow Lofts" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} autoFocus />
              <Input label="Listing URL" type="url" placeholder="https://…" value={form.listing_url}
                onChange={(e) => setForm({ ...form, listing_url: e.target.value })} />
            </>
          )}
          {step === 1 && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Location
              </label>
              <LocationPicker
                value={form.latitude != null && form.longitude != null ? { lat: form.latitude, lng: form.longitude } : null}
                address={form.address}
                onChange={(v) => setForm({ ...form, latitude: v.lat, longitude: v.lng, address: v.address })}
                height={360}
              />
            </div>
          )}
          {step === 2 && (
            <>
              <Input label="Monthly rent" type="number" inputMode="decimal" min={0} placeholder="2850" value={form.monthly_rent}
                onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} error={errors.monthly_rent} autoFocus />
              <Input label="Security deposit" type="number" inputMode="decimal" min={0} placeholder="2850" value={form.security_deposit}
                onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} />
              <Input label="Est. utilities / month" type="number" inputMode="decimal" min={0} placeholder="180" value={form.utilities_estimate}
                onChange={(e) => setForm({ ...form, utilities_estimate: e.target.value })}
                hint="Rough is fine. You can refine later." />
            </>
          )}
          {step === 3 && <DetailFields form={form} setForm={setForm} />}
          {step === 4 && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage</label>
                <Select value={form.stage} options={stageOpts} onChange={(v) => setForm({ ...form, stage: v as Stage })} />
              </div>
              <Textarea label="Notes" placeholder="First impressions, questions to ask, red flags…" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={next} loading={saving}>
            {step === steps.length - 1 ? (<><Check size={16} /> Add property</>) : (<>Continue <ArrowRight size={16} /></>)}
          </Button>
        </div>
      </Card>
    </>
  );
}

// -------- Review (post-extraction) --------
function ReviewForm({
  form,
  setForm,
  aiFields,
  onSubmit,
  saving,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  aiFields: Set<keyof FormState>;
  onSubmit: () => void;
  saving: boolean;
}) {
  const stageOpts = STAGES.map((s) => ({
    value: s,
    label: STAGE_META[s].label,
    dotColor: STAGE_META[s].tokenVar,
  }));
  const badge = (k: keyof FormState) =>
    aiFields.has(k) ? (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand">
        <Sparkles size={9} /> AI
      </span>
    ) : null;

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand">
        <Sparkles size={12} /> Extracted — review before saving
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Looks right?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Edit anything the AI got wrong. Missing fields are yours to fill in.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel k="title" ai={badge("title")}>Property name</FieldLabel>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <FieldLabel k="monthly_rent" ai={badge("monthly_rent")}>Monthly rent</FieldLabel>
          <Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} />
        </div>
        <div>
          <FieldLabel k="security_deposit" ai={badge("security_deposit")}>Deposit</FieldLabel>
          <Input type="number" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel k="address" ai={badge("address")}>Address</FieldLabel>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <DetailFields form={form} setForm={setForm} aiFields={aiFields} />
        </div>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel k="agent_name" ai={badge("agent_name")}>Agent name</FieldLabel>
            <Input value={form.agent_name} onChange={(e) => setForm({ ...form, agent_name: e.target.value })} />
          </div>
          <div>
            <FieldLabel k="agent_phone" ai={badge("agent_phone")}>Agent phone</FieldLabel>
            <Input value={form.agent_phone} onChange={(e) => setForm({ ...form, agent_phone: e.target.value })} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <FieldLabel k="description" ai={badge("description")}>Description</FieldLabel>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <FieldLabel k="listing_url" ai={badge("listing_url")}>Listing URL</FieldLabel>
          <Input type="url" value={form.listing_url} onChange={(e) => setForm({ ...form, listing_url: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage</label>
          <div className="mt-1.5">
            <Select value={form.stage} options={stageOpts} onChange={(v) => setForm({ ...form, stage: v as Stage })} />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button size="lg" onClick={onSubmit} loading={saving} disabled={!form.title.trim()}>
          <Check size={16} /> Add property
        </Button>
      </div>
    </Card>
  );
}

function FieldLabel({ children, ai }: { k: keyof FormState; children: React.ReactNode; ai: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {ai}
    </label>
  );
}

// -------- Shared detail fields (bedrooms/baths/furnished/etc) --------
function DetailFields({
  form,
  setForm,
  aiFields,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  aiFields?: Set<keyof FormState>;
}) {
  const badge = (k: keyof FormState) =>
    aiFields?.has(k) ? (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand">
        <Sparkles size={9} /> AI
      </span>
    ) : null;

  const typeOpts = [
    { value: "", label: "Any type" },
    { value: "apartment", label: "Apartment" },
    { value: "house", label: "House" },
    { value: "studio", label: "Studio" },
    { value: "condo", label: "Condo" },
    { value: "townhouse", label: "Townhouse" },
    { value: "room", label: "Room" },
  ];
  const furnishedOpts = [
    { value: "", label: "Unspecified" },
    { value: "fully", label: "Fully furnished" },
    { value: "partially", label: "Partially furnished" },
    { value: "unfurnished", label: "Unfurnished" },
  ];
  const [facilityDraft, setFacilityDraft] = useState("");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bedrooms{badge("bedrooms")}
          </label>
          <Input type="number" min={0} inputMode="numeric" value={form.bedrooms}
            onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bathrooms{badge("bathrooms")}
          </label>
          <Input type="number" min={0} step={0.5} inputMode="decimal" value={form.bathrooms}
            onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Property type{badge("property_type")}
          </label>
          <Select value={form.property_type} options={typeOpts}
            onChange={(v) => setForm({ ...form, property_type: v })} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Furnished{badge("furnished")}
          </label>
          <Select value={form.furnished} options={furnishedOpts}
            onChange={(v) => setForm({ ...form, furnished: v })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Checkbox label="Parking" checked={form.parking} onChange={(v) => setForm({ ...form, parking: v })} />
        <Checkbox label="Pet friendly" checked={form.pet_friendly} onChange={(v) => setForm({ ...form, pet_friendly: v })} />
        <Checkbox label="Internet" checked={form.internet} onChange={(v) => setForm({ ...form, internet: v })} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Facilities{badge("facilities")}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {form.facilities.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
              {f}
              <button
                type="button"
                onClick={() => setForm({ ...form, facilities: form.facilities.filter((x) => x !== f) })}
                aria-label={`Remove ${f}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={facilityDraft}
            onChange={(e) => setFacilityDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && facilityDraft.trim()) {
                e.preventDefault();
                setForm({ ...form, facilities: Array.from(new Set([...form.facilities, facilityDraft.trim()])) });
                setFacilityDraft("");
              }
            }}
            placeholder="pool, gym, aircon…"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
          />
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              if (!facilityDraft.trim()) return;
              setForm({ ...form, facilities: Array.from(new Set([...form.facilities, facilityDraft.trim()])) });
              setFacilityDraft("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
