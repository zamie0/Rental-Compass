import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { PropertyPhoto } from "@/types/property";

const BUCKET = "property-photos";
const SIGN_TTL = 60 * 60; // 1h

/* ---------- Queries ---------- */

export const photosQuery = (propertyId: string) =>
  queryOptions({
    queryKey: ["property_photos", propertyId],
    queryFn: async (): Promise<PropertyPhoto[]> => {
      const { data, error } = await supabase
        .from("property_photos")
        .select("*")
        .eq("property_id", propertyId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PropertyPhoto[];
    },
  });

export const signedUrlsQuery = (paths: string[]) =>
  queryOptions({
    queryKey: ["signed_photo_urls", [...paths].sort().join("|")],
    enabled: paths.length > 0,
    staleTime: (SIGN_TTL - 60) * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      if (paths.length === 0) return {};
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGN_TTL);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      }
      return map;
    },
  });

/** Batch signed cover URLs across many properties (for list/card views). */
export const coversQuery = queryOptions({
  queryKey: ["property_covers"],
  staleTime: (SIGN_TTL - 60) * 1000,
  queryFn: async (): Promise<Record<string, string>> => {
    const { data: rows, error } = await supabase
      .from("property_photos")
      .select("property_id, storage_path, is_cover, position")
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true });
    if (error) throw error;
    const byProp = new Map<string, string>();
    for (const r of (rows ?? []) as Array<{ property_id: string; storage_path: string }>) {
      if (!byProp.has(r.property_id)) byProp.set(r.property_id, r.storage_path);
    }
    const paths = [...byProp.values()];
    if (paths.length === 0) return {};
    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGN_TTL);
    if (sErr) throw sErr;
    const urlByPath: Record<string, string> = {};
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl;
    const result: Record<string, string> = {};
    for (const [pid, path] of byProp.entries()) {
      const u = urlByPath[path];
      if (u) result[pid] = u;
    }
    return result;
  },
});

/* ---------- Client-side compression ---------- */

export async function compressImage(file: File, maxDim = 2000, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/jpeg",
      quality,
    );
  });
}

export async function readImageDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(blob);
    return { width: bmp.width, height: bmp.height };
  } catch {
    return null;
  }
}

/* ---------- Mutations ---------- */

export async function uploadPropertyPhoto(
  propertyId: string,
  file: File,
  opts: { position: number; makeCoverIfFirst?: boolean } = { position: 0 },
): Promise<PropertyPhoto> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error("Not signed in");

  const compressed = await compressImage(file);
  const dims = await readImageDimensions(compressed);
  const id = crypto.randomUUID();
  const path = `${user.id}/${propertyId}/${id}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;

  // Should we mark cover? Only if no photos yet.
  let makeCover = false;
  if (opts.makeCoverIfFirst) {
    const { count } = await supabase
      .from("property_photos")
      .select("id", { head: true, count: "exact" })
      .eq("property_id", propertyId);
    makeCover = (count ?? 0) === 0;
  }

  const { data, error } = await supabase
    .from("property_photos")
    .insert({
      property_id: propertyId,
      user_id: user.id,
      storage_path: path,
      position: opts.position,
      is_cover: makeCover,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    })
    .select()
    .single();
  if (error) {
    // Roll back the storage object on DB failure.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data as unknown as PropertyPhoto;
}

export async function deletePropertyPhoto(photo: PropertyPhoto): Promise<void> {
  const { error } = await supabase.from("property_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(() => {});
}

export async function setCoverPhoto(propertyId: string, photoId: string): Promise<void> {
  // Clear existing cover, then set new (unique index ensures single cover).
  const { error: clrErr } = await supabase
    .from("property_photos")
    .update({ is_cover: false })
    .eq("property_id", propertyId)
    .eq("is_cover", true);
  if (clrErr) throw clrErr;
  const { error } = await supabase
    .from("property_photos")
    .update({ is_cover: true })
    .eq("id", photoId);
  if (error) throw error;
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from("property_photos")
    .update({ caption: caption || null })
    .eq("id", photoId);
  if (error) throw error;
}

export async function reorderPhotos(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("property_photos").update({ position: i }).eq("id", id),
    ),
  );
}
