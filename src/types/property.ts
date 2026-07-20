export const STAGES = [
  "interested",
  "contacted",
  "viewing_scheduled",
  "deciding",
  "archived",
] as const;

export type Stage = (typeof STAGES)[number];
export type Decision = "none" | "accepted" | "rejected";

export interface StageMeta {
  id: Stage;
  label: string;
  short: string;
  tokenVar: string; // css var like var(--color-stage-interested)
}

export const STAGE_META: Record<Stage, StageMeta> = {
  interested: { id: "interested", label: "Interested", short: "New", tokenVar: "var(--color-stage-interested)" },
  contacted: { id: "contacted", label: "Contacted", short: "Reach", tokenVar: "var(--color-stage-contacted)" },
  viewing_scheduled: { id: "viewing_scheduled", label: "Viewing Scheduled", short: "Viewing", tokenVar: "var(--color-stage-viewing)" },
  deciding: { id: "deciding", label: "Deciding", short: "Decide", tokenVar: "var(--color-stage-deciding)" },
  archived: { id: "archived", label: "Archived", short: "Done", tokenVar: "var(--color-stage-archived)" },
};

export interface Property {
  id: string;
  user_id: string;
  title: string;
  listing_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  monthly_rent: number;
  security_deposit: number;
  utilities_estimate: number;
  agent_fee: number;
  stage: Stage;
  decision: Decision;
  viewing_at: string | null;
  notes: string | null;
  image_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: string | null;
  parking: boolean | null;
  pet_friendly: boolean | null;
  internet: boolean | null;
  facilities: string[];
  property_type: string | null;
  description: string | null;
  agent_name: string | null;
  agent_phone: string | null;
}

export interface ChecklistItem {
  id: string;
  property_id: string;
  user_id: string;
  label: string;
  checked: boolean;
  position: number;
  created_at: string;
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  position: number;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
}


export interface CommuteTarget {
  id: string;
  user_id: string;
  label: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export function totalMonthly(p: Pick<Property, "monthly_rent" | "utilities_estimate">) {
  return Number(p.monthly_rent) + Number(p.utilities_estimate);
}
export function totalInitial(p: Pick<Property, "monthly_rent" | "security_deposit" | "agent_fee">) {
  return Number(p.monthly_rent) + Number(p.security_deposit) + Number(p.agent_fee);
}
export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
