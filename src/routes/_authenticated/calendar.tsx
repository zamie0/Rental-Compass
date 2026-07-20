import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { Fragment, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { propertiesQuery } from "@/lib/api";
import { deriveCalendarEvents, detectCalendarConflicts, estimateTravelMinutes, groupAgenda, type CalendarEvent } from "@/lib/calendarEvents";
import { STAGE_META } from "@/types/property";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ListFilter, MapPin, Navigation, Search, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const calendarSearch = z.object({
  view: z.enum(["month", "week", "day", "agenda"]).optional(),
  date: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: calendarSearch,
  component: CalendarPage,
});

type ViewMode = "month" | "week" | "day" | "agenda";

function CalendarPage() {
  const { data: properties = [] } = useQuery(propertiesQuery);
  const navigate = useNavigate({ from: Route.fullPath });
  const { view, date } = useSearch({ from: "/_authenticated/calendar" });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const mode: ViewMode = view ?? "agenda";
  const cursor = useMemo(() => {
    const parsed = date ? parseISO(date) : null;
    return parsed && isValid(parsed) ? parsed : new Date();
  }, [date]);

  function setMode(next: ViewMode) {
    navigate({ search: (prev) => ({ ...prev, view: next }) });
  }
  function setCursor(next: Date | ((d: Date) => Date)) {
    const value = typeof next === "function" ? next(cursor) : next;
    navigate({ search: (prev) => ({ ...prev, date: format(value, "yyyy-MM-dd") }) });
  }

  const events = useMemo(() => deriveCalendarEvents(properties), [properties]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesType = typeFilter === "all" || event.type === typeFilter;
      const matchesQuery = !q || [event.property.title, event.location, event.label, event.notes].some((v) => v?.toLowerCase().includes(q));
      return matchesType && matchesQuery;
    });
  }, [events, query, typeFilter]);
  const conflicts = useMemo(() => detectCalendarConflicts(filtered), [filtered]);

  const todaysEvents = filtered.filter((event) => isSameDay(event.startsAt, new Date()));
  const weekEvents = filtered.filter((event) => isWithinInterval(event.startsAt, { start: startOfWeek(new Date()), end: endOfWeek(new Date()) }));
  const upcomingMoveIns = filtered.filter((event) => event.type === "move_in" && isAfter(event.startsAt, new Date()));
  const deadlines = filtered.filter((event) => event.type === "decision_deadline" && isAfter(event.startsAt, addDays(new Date(), -1)));
  const overdue = filtered.filter((event) => isBefore(event.startsAt, startOfDay(new Date())) && ["follow_up", "decision_deadline", "reminder", "workflow"].includes(event.type));

  function step(direction: -1 | 1) {
    if (mode === "month") setCursor((d) => direction > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (mode === "week") setCursor((d) => direction > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCursor((d) => addDays(d, direction));
  }

  function selectDay(day: Date) {
    setCursor(day);
    setMode("day");
  }

  function openWeek() {
    setCursor(new Date());
    setMode("week");
  }

  if (properties.length === 0) {
    return (
      <AppShell>
        <div className="px-5 pt-6 md:pt-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Calendar</h1>
          <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
              <CalendarDays size={24} />
            </div>
            <h3 className="mt-4 text-lg font-bold">Nothing to schedule yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Viewings, move-ins, and deadlines will show up here automatically once you add a property.
            </p>
            <Link
              to="/add"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:scale-[0.98] active:scale-95"
            >
              <Sparkles size={16} /> Add your first property
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 pt-6 md:pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rental dates, reminders, viewing workflows, and deadlines gathered from your properties.
            </p>
          </div>
          <div
            className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-border-soft bg-surface p-1 shadow-soft"
            role="tablist"
            aria-label="Calendar view"
          >
            {(["month", "week", "day", "agenda"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={mode === v}
                onClick={() => setMode(v)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                  mode === v ? "bg-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "agenda" ? "Agenda" : v}
              </button>
            ))}
          </div>
        </div>

        <CalendarDashboard
          today={todaysEvents}
          tomorrow={filtered.filter((event) => isSameDay(event.startsAt, addDays(new Date(), 1)))}
          moveIns={upcomingMoveIns}
          deadlines={deadlines}
          overdue={overdue}
          weekTotal={weekEvents.length}
          onOpenWeek={openWeek}
        />

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-3xl border border-border-soft bg-surface p-3 shadow-soft sm:p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous"
                  className="grid size-9 place-items-center rounded-xl border border-border-soft hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCursor(new Date())}
                  className="rounded-xl border border-border-soft px-3 py-2 text-xs font-bold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next"
                  className="grid size-9 place-items-center rounded-xl border border-border-soft hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="ml-1 text-sm font-bold md:text-base">{titleForMode(mode, cursor)}</div>
              </div>

              <div className="flex flex-1 flex-wrap justify-end gap-2">
                <label className="relative min-w-[180px] flex-1 sm:max-w-xs">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search events"
                    aria-label="Search events"
                    className="h-9 w-full rounded-xl border border-border-soft bg-background pl-9 pr-3 text-sm outline-none focus:border-brand"
                  />
                </label>
                <label className="relative">
                  <ListFilter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter by event type"
                    className="h-9 rounded-xl border border-border-soft bg-background pl-9 pr-8 text-sm outline-none focus:border-brand"
                  >
                    <option value="all">All types</option>
                    <option value="viewing">Viewings</option>
                    <option value="move_in">Move-ins</option>
                    <option value="follow_up">Follow-ups</option>
                    <option value="decision_deadline">Deadlines</option>
                    <option value="reminder">Reminders</option>
                    <option value="workflow">Workflow</option>
                  </select>
                </label>
              </div>
            </div>

            {mode === "month" && <MonthView cursor={cursor} events={filtered} onSelectDay={selectDay} />}
            {mode === "week" && <WeekView cursor={cursor} events={filtered} onSelectDay={selectDay} />}
            {mode === "day" && <DayView cursor={cursor} events={filtered} />}
            {mode === "agenda" && <AgendaView events={filtered} />}
          </div>

          <aside className="space-y-3">
            <PlannerPanel events={todaysEvents} />
            <ConflictPanel conflicts={conflicts} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function CalendarDashboard({
  today,
  tomorrow,
  moveIns,
  deadlines,
  overdue,
  weekTotal,
  onOpenWeek,
}: {
  today: CalendarEvent[];
  tomorrow: CalendarEvent[];
  moveIns: CalendarEvent[];
  deadlines: CalendarEvent[];
  overdue: CalendarEvent[];
  weekTotal: number;
  onOpenWeek: () => void;
}) {
  const items: { label: string; value: number; event?: CalendarEvent; onClick?: () => void }[] = [
    { label: "Today's Viewings", value: today.filter((event) => event.type === "viewing").length, event: today.find((event) => event.type === "viewing") },
    { label: "Tomorrow's Schedule", value: tomorrow.length, event: tomorrow[0] },
    { label: "Upcoming Move-ins", value: moveIns.length, event: moveIns[0] },
    { label: "Decision Deadlines", value: deadlines.length, event: deadlines[0] },
    { label: "Overdue Tasks", value: overdue.length, event: overdue[0] },
    { label: "Events This Week", value: weekTotal, onClick: onOpenWeek },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const content = (
          <div className="rounded-2xl border border-border-soft bg-surface p-3.5 shadow-soft transition-transform hover:-translate-y-0.5 sm:p-4">
            <div className="text-xl font-bold tabular-nums sm:text-2xl">{item.value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-widest text-muted-foreground sm:text-[11px]">{item.label}</div>
          </div>
        );
        if (item.event) {
          return (
            <Link
              key={item.label}
              to="/property/$id"
              params={{ id: item.event.property.id }}
              className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {content}
            </Link>
          );
        }
        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {content}
            </button>
          );
        }
        return <div key={item.label}>{content}</div>;
      })}
    </div>
  );
}

function MonthView({ cursor, events, onSelectDay }: { cursor: Date; events: CalendarEvent[]; onSelectDay: (day: Date) => void }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft">
      <div className="grid grid-cols-7 border-b border-border-soft bg-secondary/60">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground sm:px-2 sm:text-[10px]">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events
            .filter((event) => isSameDay(event.startsAt, day))
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-16 border-b border-r border-border-soft p-1 text-left transition-colors hover:bg-secondary/40 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset sm:min-h-28 sm:p-2",
                !isSameMonth(day, cursor) && "bg-secondary/30 text-muted-foreground",
              )}
            >
              <div className={cn("mb-1 grid size-6 place-items-center rounded-full text-xs font-bold sm:mb-2", isToday(day) && "bg-brand text-brand-foreground")}>
                {format(day, "d")}
              </div>

              {/* Mobile: dot indicators keep the grid legible at phone width */}
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {dayEvents.slice(0, 4).map((event) => (
                  <span key={event.id} className="size-1.5 rounded-full" style={{ background: event.color }} />
                ))}
                {dayEvents.length > 4 && <span className="text-[8px] font-semibold text-muted-foreground">+{dayEvents.length - 4}</span>}
              </div>

              {/* Tablet/desktop: room for real event chips */}
              <div className="hidden space-y-1 sm:block">
                {dayEvents.slice(0, 3).map((event) => <CompactEvent key={event.id} event={event} />)}
                {dayEvents.length > 3 && <div className="text-[10px] font-semibold text-muted-foreground">+{dayEvents.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, events, onSelectDay }: { cursor: Date; events: CalendarEvent[]; onSelectDay: (day: Date) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0 lg:pb-0 lg:snap-none">
      {days.map((day) => (
        <div
          key={day.toISOString()}
          className={cn(
            "min-h-[14rem] w-[72%] shrink-0 snap-center rounded-2xl border border-border-soft bg-background p-3 sm:w-64 lg:w-auto lg:min-h-80",
            isToday(day) && "border-brand/50 bg-brand-soft/40",
          )}
        >
          <button
            type="button"
            onClick={() => onSelectDay(day)}
            className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{format(day, "EEE")}</div>
            <div className="mt-1 text-2xl font-bold">{format(day, "d")}</div>
          </button>
          <div className="mt-3 space-y-2">
            {events
              .filter((event) => isSameDay(event.startsAt, day))
              .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
              .map((event) => <EventCard key={event.id} event={event} compact />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayView({ cursor, events }: { cursor: Date; events: CalendarEvent[] }) {
  const dayEvents = events
    .filter((event) => isSameDay(event.startsAt, cursor))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const now = new Date();
  const showNow = isToday(cursor);
  // Index of the first event that starts after "now" — the Now marker renders
  // just before it, so it sits at its actual chronological position instead
  // of a fixed offset that ignored event count/times.
  const nowInsertIndex = dayEvents.findIndex((event) => isAfter(event.startsAt, now));

  return (
    <div className="rounded-2xl border border-border-soft bg-background p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold">
        <Clock size={16} className="text-brand" />
        {format(cursor, "EEEE, MMMM d")}
      </div>
      <div className="relative space-y-3 border-l border-border-soft pl-5">
        {dayEvents.length === 0 ? (
          <EmptyState label="No rental events on this day." />
        ) : (
          dayEvents.map((event, index) => (
            <Fragment key={event.id}>
              {showNow && index === (nowInsertIndex === -1 ? dayEvents.length : nowInsertIndex) && <NowMarker />}
              <TimelineEvent event={event} />
            </Fragment>
          ))
        )}
        {showNow && dayEvents.length > 0 && nowInsertIndex === -1 && <NowMarker />}
      </div>
    </div>
  );
}

function NowMarker() {
  return (
    <div className="relative -my-1 flex items-center gap-2 py-1" aria-hidden>
      <span className="absolute -left-[27px] size-3 rounded-full border-2 border-background bg-destructive" />
      <div className="h-px flex-1 bg-destructive/60" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Now</span>
    </div>
  );
}

function AgendaView({ events }: { events: CalendarEvent[] }) {
  const groups = groupAgenda(events.filter((event) => isAfter(event.startsAt, addDays(new Date(), -1))));
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([label, group]) => (
        <section key={label}>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <CalendarDays size={14} /> {label}
          </div>
          {group.length === 0 ? (
            <EmptyState label="Nothing scheduled." />
          ) : (
            <div className="grid gap-2">
              {group.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function PlannerPanel({ events }: { events: CalendarEvent[] }) {
  const ordered = events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return (
    <div className="rounded-3xl border border-border-soft bg-surface p-4 shadow-soft">
      <div className="text-sm font-bold">Daily planner</div>
      <div className="mt-1 text-xs text-muted-foreground">Today timeline, free slots, and travel hints.</div>
      <div className="mt-4 space-y-3">
        {ordered.length === 0 ? (
          <EmptyState label="No events today." />
        ) : (
          ordered.map((event, index) => {
            const previous = ordered[index - 1];
            const travel = previous ? estimateTravelMinutes(previous.property, event.property) : null;
            return (
              <div key={event.id}>
                {travel != null && <div className="mb-2 ml-3 text-[11px] text-muted-foreground">Estimated travel: {travel} min</div>}
                <TimelineEvent event={event} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ConflictPanel({ conflicts }: { conflicts: ReturnType<typeof detectCalendarConflicts> }) {
  return (
    <div className="rounded-3xl border border-border-soft bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-2 text-sm font-bold">
        <TriangleAlert size={16} className={conflicts.length ? "text-destructive" : "text-muted-foreground"} />
        Schedule check
      </div>
      <div className="mt-3 space-y-2">
        {conflicts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No viewing conflicts detected.</p>
        ) : (
          conflicts.map((conflict) => (
            <div key={conflict.id} className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
              <div className="text-xs font-bold text-destructive">{conflict.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{conflict.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EventCard({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const stage = STAGE_META[event.property.stage];
  return (
    <Link
      to="/property/$id"
      params={{ id: event.property.id }}
      className={cn(
        "block rounded-2xl border border-border-soft bg-surface p-3 shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        compact && "p-2",
      )}
    >
      <div className="flex gap-3">
        <PropertyThumb event={event} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: `color-mix(in oklab, ${event.color} 16%, transparent)`, color: event.color }}>
              {event.label}
            </span>
            {event.generated && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Auto</span>}
          </div>
          <div className="mt-1 truncate text-sm font-bold">{event.property.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{format(event.startsAt, "MMM d, h:mm a")}</span>
            {event.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {event.location}</span>}
          </div>
          {!compact && event.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.notes}</p>}
          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: event.color }} />
            {stage.label}
          </div>
        </div>
        <Navigation size={15} className="mt-1 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}

function CompactEvent({ event }: { event: CalendarEvent }) {
  return (
    <Link to="/property/$id" params={{ id: event.property.id }} className="block truncate rounded-lg px-2 py-1 text-[10px] font-semibold text-white" style={{ background: event.color }}>
      {format(event.startsAt, "h:mm a")} {event.label}
    </Link>
  );
}

function TimelineEvent({ event }: { event: CalendarEvent }) {
  const missed = isBefore(event.endsAt, new Date());
  return (
    <Link
      to="/property/$id"
      params={{ id: event.property.id }}
      className="relative block rounded-2xl border border-border-soft bg-surface p-3 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <span className="absolute -left-[27px] top-4 size-3 rounded-full border-2 border-background" style={{ background: event.color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-muted-foreground">{format(event.startsAt, "h:mm a")} - {format(event.endsAt, "h:mm a")}</div>
          <div className="mt-1 truncate text-sm font-bold">{event.label}</div>
          <div className="truncate text-xs text-muted-foreground">{event.property.title}</div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", missed ? "bg-secondary text-muted-foreground" : "bg-brand-soft text-brand")}>
          {missed ? "Missed" : "Upcoming"}
        </span>
      </div>
    </Link>
  );
}

function PropertyThumb({ event }: { event: CalendarEvent }) {
  if (event.property.image_url) {
    return <img src={event.property.image_url} alt="" className="size-14 rounded-xl object-cover" />;
  }
  return (
    <div className="grid size-14 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: event.color }}>
      {event.property.title.slice(0, 1).toUpperCase()}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-border-soft p-4 text-center text-xs text-muted-foreground">{label}</div>;
}

function titleForMode(mode: ViewMode, cursor: Date) {
  if (mode === "month") return format(cursor, "MMMM yyyy");
  if (mode === "week") return `${format(startOfWeek(cursor), "MMM d")} - ${format(endOfWeek(cursor), "MMM d")}`;
  if (mode === "day") return format(cursor, "MMMM d, yyyy");
  return "Agenda";
}