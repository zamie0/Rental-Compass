import { Link, useLocation } from "@tanstack/react-router";
import { LayoutGrid, MapPin, GitCompareArrows, Plus, User } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props { children: ReactNode; }

export function AppShell({ children }: Props) {
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <header className="sticky top-0 z-40 border-b border-border-soft bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/board" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-brand text-brand-foreground shadow-brand">
              <div className="size-2.5 rounded-full bg-brand-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Rental Hub</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full bg-black/5 p-1 md:flex">
            <DesktopTab to="/board" label="Pipeline" active={loc.pathname.startsWith("/board")} />
            <DesktopTab to="/map" label="Map" active={loc.pathname.startsWith("/map")} />
            <DesktopTab to="/compare" label="Compare" active={loc.pathname.startsWith("/compare")} />
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/add"
              className="hidden items-center gap-2 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-brand transition-transform hover:scale-[0.98] md:inline-flex"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add
            </Link>
            <Link
              to="/profile"
              aria-label="Profile"
              className={cn(
                "grid place-items-center rounded-full border border-border-soft bg-surface p-0.5 transition-all",
                loc.pathname.startsWith("/profile") && "border-brand ring-2 ring-brand/20",
              )}
            >
              <UserAvatar size={36} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">{children}</main>

      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between rounded-full border border-border-soft bg-surface px-6 py-3 shadow-lift md:hidden">
        <BottomTab to="/board" icon={<LayoutGrid size={18} strokeWidth={2.2} />} label="Board" active={loc.pathname.startsWith("/board")} />
        <BottomTab to="/map" icon={<MapPin size={18} strokeWidth={2.2} />} label="Map" active={loc.pathname.startsWith("/map")} />
        <Link
          to="/add"
          aria-label="Add property"
          className="-mt-8 grid size-14 place-items-center rounded-full border-4 border-background bg-brand text-brand-foreground shadow-brand transition-transform active:scale-90"
        >
          <Plus size={22} strokeWidth={2.5} />
        </Link>
        <BottomTab to="/compare" icon={<GitCompareArrows size={18} strokeWidth={2.2} />} label="Compare" active={loc.pathname.startsWith("/compare")} />
        <BottomTab to="/profile" icon={<User size={18} strokeWidth={2.2} />} label="You" active={loc.pathname.startsWith("/profile")} />
      </nav>
    </div>
  );
}

function DesktopTab({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
        active ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

function BottomTab({ to, icon, label, active }: { to: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-brand" : "text-muted-foreground/60 hover:text-foreground",
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </Link>
  );
}
