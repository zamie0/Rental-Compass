import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Modal } from "@/components/ui/RhModal";
import { Button } from "@/components/ui/RhButton";
import { Upload, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  hasExisting?: boolean;
}

const MAX_FILE_MB = 8;

export function AvatarCropper({ open, onClose, onSave, onRemove, hasExisting }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setZoom(1);
      setRotation(0);
      setCrop({ x: 0, y: 0 });
    }
  }, [open]);

  const onCropComplete = useCallback((_: Area, px: Area) => setCroppedPixels(px), []);

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (f.size > MAX_FILE_MB * 1024 * 1024) return toast.error(`Image must be under ${MAX_FILE_MB} MB`);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function save() {
    if (!imageSrc || !croppedPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedPixels, rotation);
      await onSave(blob);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save avatar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={imageSrc ? "Adjust your photo" : "Upload a photo"}>
      {!imageSrc ? (
        <div className="space-y-4">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              dragOver ? "border-brand bg-brand-soft" : "border-border-soft bg-surface hover:border-brand/40"
            }`}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Upload size={20} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-bold">Drop an image or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP · up to {MAX_FILE_MB} MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
          {hasExisting && onRemove && (
            <button
              onClick={async () => { await onRemove(); onClose(); }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} /> Remove current photo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-black/90">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">Zoom</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-black/10 accent-[color:var(--color-brand)]"
              />
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="grid size-10 place-items-center rounded-xl border border-border-soft bg-surface text-foreground hover:bg-black/5"
                aria-label="Rotate"
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setImageSrc(null)}>Choose another</Button>
            <Button onClick={save} loading={saving}>Save photo</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

async function getCroppedBlob(src: string, area: Area, rotation: number): Promise<Blob> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxW = img.width * cos + img.height * sin;
  const bBoxH = img.width * sin + img.height * cos;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = bBoxW;
  rotCanvas.height = bBoxH;
  const rctx = rotCanvas.getContext("2d")!;
  rctx.translate(bBoxW / 2, bBoxH / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);

  const out = document.createElement("canvas");
  const size = Math.min(512, Math.floor(area.width));
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d")!;
  octx.drawImage(rotCanvas, area.x, area.y, area.width, area.height, 0, 0, size, size);

  return await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", 0.9),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
