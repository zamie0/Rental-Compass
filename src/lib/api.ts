import { supabase } from "@/integrations/supabase/client";
import type { Property, ChecklistItem, CommuteTarget, Stage } from "@/types/property";
import { queryOptions } from "@tanstack/react-query";

export const propertiesQuery = queryOptions({
  queryKey: ["properties"],
  queryFn: async (): Promise<Property[]> => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as Property[];
  },
});

export const propertyQuery = (id: string) =>
  queryOptions({
    queryKey: ["properties", id],
    queryFn: async (): Promise<Property> => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Property not found");
      return data as unknown as Property;
    },
  });

export const checklistQuery = (propertyId: string) =>
  queryOptions({
    queryKey: ["checklist", propertyId],
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("property_id", propertyId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ChecklistItem[];
    },
  });

export const commuteTargetsQuery = queryOptions({
  queryKey: ["commute_targets"],
  queryFn: async (): Promise<CommuteTarget[]> => {
    const { data, error } = await supabase
      .from("commute_targets")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as CommuteTarget[];
  },
});

export async function createProperty(input: {
  title: string;
  listing_url?: string;
  address?: string;
  monthly_rent: number;
  security_deposit: number;
  utilities_estimate: number;
  stage?: Stage;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnished?: string | null;
  parking?: boolean | null;
  pet_friendly?: boolean | null;
  internet?: boolean | null;
  facilities?: string[];
  property_type?: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  image_url?: string | null;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...input, user_id: user.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Property;
}

export async function updateProperty(id: string, patch: Partial<Property>) {
  const { error } = await supabase.from("properties").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProperty(id: string) {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleChecklist(id: string, checked: boolean) {
  const { error } = await supabase.from("checklist_items").update({ checked }).eq("id", id);
  if (error) throw error;
}

export async function addChecklistItem(propertyId: string, label: string, position: number) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not signed in");
  const { error } = await supabase.from("checklist_items").insert({
    property_id: propertyId,
    user_id: user.user.id,
    label,
    position,
  });
  if (error) throw error;
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertCommuteTarget(input: Partial<CommuteTarget> & { label: string }) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not signed in");
  if (input.id) {
    const { error } = await supabase.from("commute_targets").update(input).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("commute_targets").insert({ ...input, user_id: user.user.id });
    if (error) throw error;
  }
}

export async function deleteCommuteTarget(id: string) {
  const { error } = await supabase.from("commute_targets").delete().eq("id", id);
  if (error) throw error;
}
