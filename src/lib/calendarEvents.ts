import { addDays, addMinutes, differenceInMinutes, endOfDay, format, isAfter, isBefore, isSameDay, isValid, parseISO, startOfDay } from "date-fns";
import { STAGE_META, type Property } from "@/types/property";

export type CalendarEventType =
  | "viewing"
  | "move_in"
  | "follow_up"
  | "decision_deadline"
  | "lease_start"
  | "lease_end"
  | "reminder"
  | "workflow"
  | "date";

export interface CalendarEvent {
  id: string;
  property: Property;
  type: CalendarEventType;
  label: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  notes: string | null;
  color: string;
  generated: boolean;
}

export interface CalendarConflict {
  id: string;
  day: Date;
  title: string;
  message: string;
  events: CalendarEvent[];
  severity: "warning" | "danger";
}

const DATE_FIELD_LABELS: Record<string, { label: string; type: CalendarEventType; durationMin?: number }> = {
  viewing_at: { label: "Viewing", type: "viewing", durationMin: 60 },
  viewing_date: { label: "Viewing", type: "viewing", durationMin: 60 },
  move_in_at: { label: "Move-in", type: "move_in", durationMin: 120 },
  move_in_date: { label: "Move-in", type: "move_in", durationMin: 120 },
  follow_up_at: { label: "Follow-up", type: "follow_up", durationMin: 30 },
  follow_up_date: { label: "Follow-up", type: "follow_up", durationMin: 30 },
  decision_deadline_at: { label: "Decision Deadline", type: "decision_deadline", durationMin: 30 },
  decision_deadline_date: { label: "Decision Deadline", type: "decision_deadline", durationMin: 30 },
  lease_start_at: { label: "Lease Start", type: "lease_start", durationMin: 60 },
  lease_start_date: { label: "Lease Start", type: "lease_start", durationMin: 60 },
  lease_end_at: { label: "Lease End", type: "lease_end", durationMin: 60 },
  lease_end_date: { label: "Lease End", type: "lease_end", durationMin: 60 },
  reminder_at: { label: "Reminder", type: "reminder", durationMin: 20 },
  reminder_date: { label: "Reminder", type: "reminder", durationMin: 20 },
};

const SKIP_DATE_FIELDS = new Set(["created_at", "updated_at"]);

export function deriveCalendarEvents(properties: Property[], now = new Date()): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  properties.forEach((property) => {
    Object.entries(property as unknown as Record<string, unknown>).forEach(([field, value]) => {
      if (SKIP_DATE_FIELDS.has(field) || value == null) return;
      if (!DATE_FIELD_LABELS[field] && !looksLikeDateField(field)) return;

      const startsAt = toDate(value);
      if (!startsAt) return;

      const meta = DATE_FIELD_LABELS[field] ?? { label: labelFromField(field), type: "date" as CalendarEventType, durationMin: 30 };
      events.push(makeEvent({
        property,
        id: `${property.id}:${field}`,
        type: meta.type,
        label: meta.label,
        startsAt,
        durationMin: meta.durationMin ?? 30,
        generated: false,
      }));
    });

    if (property.viewing_at) {
      const viewing = toDate(property.viewing_at);
      if (viewing && isAfter(viewing, addMinutes(now, -180))) {
        events.push(
          makeEvent({ property, id: `${property.id}:workflow:viewing-reminder`, type: "workflow", label: "Viewing Reminder", startsAt: addMinutes(viewing, -30), durationMin: 10, generated: true }),
          makeEvent({ property, id: `${property.id}:workflow:viewing-notes`, type: "workflow", label: "Write Viewing Notes", startsAt: addMinutes(viewing, 90), durationMin: 20, generated: true }),
          makeEvent({ property, id: `${property.id}:workflow:viewing-follow-up`, type: "follow_up", label: "Follow-up Reminder", startsAt: addDays(viewing, 1), durationMin: 30, generated: true }),
          makeEvent({ property, id: `${property.id}:workflow:viewing-decision`, type: "decision_deadline", label: "Suggested Decision Deadline", startsAt: addDays(viewing, 3), durationMin: 30, generated: true }),
        );
      }
    }

    const moveIn = getFirstPropertyDate(property, ["move_in_at", "move_in_date"]);
    if (moveIn) {
      events.push(
        makeEvent({ property, id: `${property.id}:workflow:move-in-7`, type: "workflow", label: "Move-in Prep", startsAt: addDays(moveIn, -7), durationMin: 30, generated: true }),
        makeEvent({ property, id: `${property.id}:workflow:move-in-3`, type: "workflow", label: "Confirm Move-in Details", startsAt: addDays(moveIn, -3), durationMin: 30, generated: true }),
        makeEvent({ property, id: `${property.id}:workflow:move-in-1`, type: "workflow", label: "Pack Essentials", startsAt: addDays(moveIn, -1), durationMin: 30, generated: true }),
        makeEvent({ property, id: `${property.id}:workflow:post-move-in`, type: "workflow", label: "Post Move-in Checklist", startsAt: addDays(moveIn, 1), durationMin: 45, generated: true }),
      );
    }
  });

  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function detectCalendarConflicts(events: CalendarEvent[]): CalendarConflict[] {
  const viewings = events.filter((event) => event.type === "viewing");
  const byDay = groupBy(viewings, (event) => format(event.startsAt, "yyyy-MM-dd"));
  const conflicts: CalendarConflict[] = [];

  Object.values(byDay).forEach((dayEvents) => {
    const ordered = dayEvents.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const current = ordered[i];
      const next = ordered[i + 1];
      const gap = differenceInMinutes(next.startsAt, current.endsAt);
      const travel = estimateTravelMinutes(current.property, next.property);
      if (gap < 0) {
        conflicts.push({
          id: `${current.id}:${next.id}:overlap`,
          day: startOfDay(current.startsAt),
          title: "Possible schedule conflict",
          message: `${current.property.title} overlaps ${next.property.title}.`,
          events: [current, next],
          severity: "danger",
        });
      } else if (travel != null && gap < travel) {
        conflicts.push({
          id: `${current.id}:${next.id}:travel`,
          day: startOfDay(current.startsAt),
          title: "Insufficient travel time",
          message: `${gap} min gap, estimated ${travel} min travel.`,
          events: [current, next],
          severity: "warning",
        });
      } else if (gap < 30) {
        conflicts.push({
          id: `${current.id}:${next.id}:tight`,
          day: startOfDay(current.startsAt),
          title: "Tight schedule",
          message: `Only ${gap} min between viewings.`,
          events: [current, next],
          severity: "warning",
        });
      }
    }
  });

  return conflicts;
}

export function groupAgenda(events: CalendarEvent[], now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = endOfDay(addDays(today, 6));
  const nextWeekEnd = endOfDay(addDays(today, 13));

  return {
    Today: events.filter((event) => isSameDay(event.startsAt, today)),
    Tomorrow: events.filter((event) => isSameDay(event.startsAt, tomorrow)),
    "This Week": events.filter((event) => isAfter(event.startsAt, tomorrow) && isBefore(event.startsAt, weekEnd)),
    "Next Week": events.filter((event) => isAfter(event.startsAt, weekEnd) && isBefore(event.startsAt, nextWeekEnd)),
    Upcoming: events.filter((event) => isAfter(event.startsAt, nextWeekEnd)),
  };
}

export function estimateTravelMinutes(a: Property, b: Property) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  return Math.max(12, Math.round((km / 28) * 60 + 12));
}

function makeEvent(input: {
  property: Property;
  id: string;
  type: CalendarEventType;
  label: string;
  startsAt: Date;
  durationMin: number;
  generated: boolean;
}): CalendarEvent {
  return {
    id: input.id,
    property: input.property,
    type: input.type,
    label: input.label,
    startsAt: input.startsAt,
    endsAt: addMinutes(input.startsAt, input.durationMin),
    location: input.property.address,
    notes: input.property.notes,
    color: STAGE_META[input.property.stage].tokenVar,
    generated: input.generated,
  };
}

function getFirstPropertyDate(property: Property, fields: string[]) {
  for (const field of fields) {
    const date = toDate((property as unknown as Record<string, unknown>)[field]);
    if (date) return date;
  }
  return null;
}

function toDate(value: unknown) {
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

function looksLikeDateField(field: string) {
  return /(^|_)(date|deadline|reminder|follow_up|move_in|lease_start|lease_end)($|_)/.test(field) || field.endsWith("_at");
}

function labelFromField(field: string) {
  return field
    .replace(/_at$|_date$/g, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    acc[k] = acc[k] ?? [];
    acc[k].push(item);
    return acc;
  }, {});
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
