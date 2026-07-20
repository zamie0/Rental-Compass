import { supabase } from "@/integrations/supabase/client";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null; // storage path
  phone: string | null;
  notification_prefs: {
    viewings: boolean;
    deciding: boolean;
    weekly: boolean;
    marketing: boolean;
  };
  privacy_prefs: {
    analytics: boolean;
    share_activity: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ProfileWithUrl extends Profile {
  avatarSignedUrl: string | null;
  email: string | null;
}

export const profileQuery = queryOptions({
  queryKey: ["profile", "me"],
  queryFn: async (): Promise<ProfileWithUrl | null> => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;

    let profile = data as unknown as Profile | null;
    if (!profile) {
      // Backfill safety net
      const { data: inserted, error: insertErr } = await supabase
        .from("profiles")
        .insert({ id: user.id, display_name: user.email?.split("@")[0] ?? null })
        .select()
        .single();
      if (insertErr) throw insertErr;
      profile = inserted as unknown as Profile;
    }

    let signed: string | null = null;
    if (profile.avatar_url) {
      const { data: s } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 60 * 60);
      signed = s?.signedUrl ?? null;
    }
    return { ...profile, avatarSignedUrl: signed, email: user.email ?? null };
  },
  staleTime: 60_000,
});

export function useProfile() {
  return useQuery(profileQuery);
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, "display_name" | "phone" | "notification_prefs" | "privacy_prefs" | "avatar_url">>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(patch).eq("id", userRes.user.id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["profile", "me"] });
      const prev = qc.getQueryData<ProfileWithUrl>(["profile", "me"]);
      if (prev) qc.setQueryData<ProfileWithUrl>(["profile", "me"], { ...prev, ...patch } as ProfileWithUrl);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["profile", "me"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["profile", "me"] }),
  });
}

export async function uploadAvatar(blob: Blob): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Not signed in");
  const path = `${userRes.user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

export async function removeAvatarFile(path: string): Promise<void> {
  await supabase.storage.from("avatars").remove([path]);
}

export function initialsFrom(name: string | null | undefined, email: string | null | undefined) {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+|@/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
