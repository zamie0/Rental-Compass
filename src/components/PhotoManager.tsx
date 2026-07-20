import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  photosQuery,
  signedUrlsQuery,
  coversQuery,
  uploadPropertyPhoto,
  deletePropertyPhoto,
  setCoverPhoto,
  updatePhotoCaption,
  reorderPhotos,
} from "@/lib/photos";
import { propertiesQuery } from "@/lib/api";
import type { PropertyPhoto } from "@/types/property";
import { Camera, ImagePlus, Star, Trash2, Pencil, GripVertical, Loader2, Maximize2 } from "lucide-react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Modal } from "@/components/ui/RhModal";
import { Input } from "@/components/ui/RhInput";
import { Button } from "@/components/ui/RhButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  propertyId: string;
}

export function PhotoManager({ propertyId }: Props) {
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery(photosQuery(propertyId));
  const paths = useMemo(() => photos.map((p) => p.storage_path), [photos]);
  const { data: urlMap = {} } = useQuery(signedUrlsQuery(paths));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [galleryStart, setGalleryStart] = useState<number | null>(null);
  const [editing, setEditing] = useState<PropertyPhoto | null>(null);
  const [uploading, setUploading] = useState(0);

  const invalidateAll = () => {
    qc.invalidateQueries(photosQuery(propertyId));
    qc.invalidateQueries(coversQuery);
    qc.invalidateQueries(propertiesQuery);
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(files.length);
    let uploaded = 0;
    const startPos = photos.length;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith("image/")) continue;
        await uploadPropertyPhoto(propertyId, f, {
          position: startPos + i,
          makeCoverIfFirst: true,
        });
        uploaded += 1;
        setUploading(files.length - uploaded);
      }
      toast.success(`Added ${uploaded} photo${uploaded === 1 ? "" : "s"}`);
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  const del = useMutation({
    mutationFn: (p: PropertyPhoto) => deletePropertyPhoto(p),
    onSuccess: () => {
      invalidateAll();
      toast.success("Photo removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  const cover = useMutation({
    mutationFn: (p: PropertyPhoto) => setCoverPhoto(propertyId, p.id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Cover updated");
    },
  });

  const caption = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updatePhotoCaption(id, text),
    onSuccess: () => {
      invalidateAll();
      setEditing(null);
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderPhotos(ids),
    onSuccess: () => invalidateAll(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = photos.findIndex((p) => p.id === active.id);
    const newIdx = photos.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const nextOrder = arrayMove(photos, oldIdx, newIdx);
    // Optimistic update
    qc.setQueryData(photosQuery(propertyId).queryKey, nextOrder.map((p, i) => ({ ...p, position: i })));
    reorder.mutate(nextOrder.map((p) => p.id));
  }

  const galleryUrls = useMemo(
    () => photos.map((p) => urlMap[p.storage_path]).filter(Boolean) as string[],
    [photos, urlMap],
  );
  const galleryCaptions = useMemo(() => photos.map((p) => p.caption), [photos]);

  return (
    <div>
      {/* Upload actions */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading > 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-foreground shadow-brand transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <ImagePlus size={16} /> Upload photos
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading > 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-brand/40 hover:bg-brand-soft disabled:opacity-60"
        >
          <Camera size={16} /> Take photo
        </button>
        {uploading > 0 && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Uploading {uploading}…
          </span>
        )}
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 grid w-full place-items-center rounded-3xl border-2 border-dashed border-border bg-black/[0.02] py-12 text-center transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <ImagePlus size={22} />
          </div>
          <div className="mt-3 text-sm font-bold">Add photos of this property</div>
          <div className="mt-1 max-w-xs text-xs text-muted-foreground">
            Rooms, floor plans, listing screenshots, exterior — the first upload becomes the cover.
          </div>
        </button>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p, i) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  url={urlMap[p.storage_path]}
                  onOpen={() => setGalleryStart(i)}
                  onSetCover={() => cover.mutate(p)}
                  onDelete={() => del.mutate(p)}
                  onEditCaption={() => setEditing(p)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Fullscreen */}
      {galleryStart !== null && galleryUrls.length > 0 && (
        <PhotoGallery
          urls={galleryUrls}
          captions={galleryCaptions}
          startIndex={galleryStart}
          onClose={() => setGalleryStart(null)}
        />
      )}

      {/* Caption editor */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit caption">
        {editing && (
          <CaptionForm
            initial={editing.caption ?? ""}
            saving={caption.isPending}
            onCancel={() => setEditing(null)}
            onSave={(v) => caption.mutate({ id: editing.id, text: v })}
          />
        )}
      </Modal>
    </div>
  );
}

function CaptionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [v, setV] = useState(initial);
  return (
    <div>
      <Input
        label="Caption"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Kitchen, morning light…"
        autoFocus
      />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(v.trim())} loading={saving}>Save</Button>
      </div>
    </div>
  );
}

function PhotoTile({
  photo,
  url,
  onOpen,
  onSetCover,
  onDelete,
  onEditCaption,
}: {
  photo: PropertyPhoto;
  url?: string;
  onOpen: () => void;
  onSetCover: () => void;
  onDelete: () => void;
  onEditCaption: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-2xl bg-black/5 shadow-soft",
        isDragging && "z-10 opacity-70",
      )}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption ?? ""}
          loading="lazy"
          className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-[1.03]"
          onClick={onOpen}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
        </div>
      )}

      {/* Cover badge */}
      {photo.is_cover && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-foreground shadow-brand">
          <Star size={10} fill="currentColor" /> Cover
        </span>
      )}

      {/* Drag handle */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="absolute right-2 top-2 grid size-8 touch-none place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 md:opacity-0"
        aria-label="Reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Action bar (visible on hover desktop, always visible mobile) */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-linear-to-t from-black/70 to-transparent p-2">
        <button
          type="button"
          onClick={onSetCover}
          disabled={photo.is_cover}
          title="Set as cover"
          className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 disabled:opacity-40"
        >
          <Star size={14} fill={photo.is_cover ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={onEditCaption}
          title="Edit caption"
          className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onOpen}
          title="View"
          className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-destructive"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
