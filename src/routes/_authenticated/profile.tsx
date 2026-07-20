import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/RhCard";
import { Button } from "@/components/ui/RhButton";
import { Input } from "@/components/ui/RhInput";
import { Checkbox } from "@/components/ui/RhCheckbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserAvatar } from "@/components/UserAvatar";
import { AvatarCropper } from "@/components/AvatarCropper";
import {
  useProfile,
  useUpdateProfile,
  uploadAvatar,
  removeAvatarFile,
} from "@/lib/profile";
import {
  User as UserIcon,
  Settings,
  Palette,
  Bell,
  ShieldCheck,
  Link as LinkIcon,
  Database,
  Info,
  LogOut,
  Check,
  Mail,
  ChevronRight,
  ChevronLeft,
  Camera,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type TabId =
  | "profile"
  | "account"
  | "appearance"
  | "notifications"
  | "security"
  | "connected"
  | "data"
  | "about";

const TABS: { id: TabId; label: string; icon: typeof UserIcon; desc: string }[] = [
  { id: "profile", label: "Profile", icon: UserIcon, desc: "Name, avatar & contact" },
  { id: "account", label: "Account", icon: Settings, desc: "Language, timezone, IDs" },
  { id: "appearance", label: "Appearance", icon: Palette, desc: "Theme & feel" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "What reaches you" },
  { id: "security", label: "Security", icon: ShieldCheck, desc: "Password & sessions" },
  { id: "connected", label: "Connected", icon: LinkIcon, desc: "Sign-in methods" },
  { id: "data", label: "Data & Privacy", icon: Database, desc: "Your info & controls" },
  { id: "about", label: "About", icon: Info, desc: "Version & sign out" },
];

function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabId | null>(null);
  const isMobile = useIsMobile();
  const { data: profile } = useProfile();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Desktop defaults to profile tab; mobile stays on list until user drills in
  useEffect(() => {
    if (!isMobile && tab === null) setTab("profile");
  }, [isMobile, tab]);

  const activeTab = TABS.find((t) => t.id === tab);
  const inSubPage = isMobile && tab !== null;

  return (
    <AppShell>
      <div className="px-5 pt-6 md:pt-8">
        {/* --- Mobile sub-page header --- */}
        {inSubPage ? (
          <MobileSubHeader title={activeTab?.label ?? ""} onBack={() => setTab(null)} />
        ) : (
          <ProfileHeader
            user={user}
            displayName={profile?.display_name}
            onEdit={() => setTab("profile")}
          />
        )}

        {/* --- Desktop tabs --- */}
        {!isMobile && (
          <div className="mt-6">
            <div className="flex gap-2 pb-2 flex-wrap">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95",
                      active
                        ? "border-transparent bg-foreground text-background shadow-lift"
                        : "border-border-soft bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon size={14} strokeWidth={2.4} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Content --- */}
        <div className="mt-6 pb-10">
          {isMobile && tab === null ? (
            <MobileList onSelect={setTab} />
          ) : (
            <div key={tab ?? "list"} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              {tab === "profile" && <ProfileInfoTab user={user} />}
              {tab === "account" && <AccountTab user={user} />}
              {tab === "appearance" && <AppearanceTab />}
              {tab === "notifications" && <NotificationsTab />}
              {tab === "security" && <SecurityTab user={user} />}
              {tab === "connected" && <ConnectedTab user={user} />}
              {tab === "data" && <DataPrivacyTab />}
              {tab === "about" && <AboutTab />}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------ Header pieces ------------------ */

function ProfileHeader({
  user,
  displayName,
  onEdit,
}: {
  user: User | null;
  displayName: string | null | undefined;
  onEdit: () => void;
}) {
  const [cropperOpen, setCropperOpen] = useState(false);
  const update = useUpdateProfile();
  const { data: profile } = useProfile();

  async function handleSave(blob: Blob) {
    try {
      // remove old avatar
      if (profile?.avatar_url) await removeAvatarFile(profile.avatar_url);
      const path = await uploadAvatar(blob);
      await update.mutateAsync({ avatar_url: path });
      toast.success("Photo updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  }

  async function handleRemove() {
    if (!profile?.avatar_url) return;
    await removeAvatarFile(profile.avatar_url);
    await update.mutateAsync({ avatar_url: null });
    toast.success("Photo removed");
  }

  return (
    <>
      <header className="flex flex-col items-center gap-4 pt-4 text-center md:flex-row md:text-left">
        <button
          onClick={() => setCropperOpen(true)}
          className="group relative rounded-full transition-transform active:scale-95"
          aria-label="Change photo"
        >
          <UserAvatar size={96} className="shadow-lift" />
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-4 border-background bg-foreground text-background transition-transform group-hover:scale-110">
            <Camera size={14} strokeWidth={2.4} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {displayName || user?.email?.split("@")[0] || "Your account"}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email ?? "Loading…"}</p>
          <button
            onClick={onEdit}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Pencil size={12} strokeWidth={2.4} />
            Edit profile
          </button>
        </div>
      </header>
      <AvatarCropper
        open={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onSave={handleSave}
        onRemove={handleRemove}
        hasExisting={!!profile?.avatar_url}
      />
    </>
  );
}

function MobileSubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button
        onClick={onBack}
        className="-ml-2 flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
      >
        <ChevronLeft size={18} strokeWidth={2.4} />
        Settings
      </button>
      <h1 className="mx-auto pr-16 text-base font-bold tracking-tight">{title}</h1>
    </div>
  );
}

/* ------------------ iOS-style mobile list ------------------ */

function MobileList({ onSelect }: { onSelect: (id: TabId) => void }) {
  const groups: { title?: string; items: TabId[] }[] = [
    { items: ["profile", "account"] },
    { title: "Preferences", items: ["appearance", "notifications"] },
    { title: "Security", items: ["security", "connected", "data"] },
    { title: "App", items: ["about"] },
  ];

  return (
    <div className="space-y-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && (
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </p>
          )}
          <div className="overflow-hidden rounded-3xl border border-border-soft bg-surface">
            {g.items.map((id, i) => {
              const t = TABS.find((x) => x.id === id)!;
              const Icon = t.icon;
              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className={cn(
                    "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-black/5",
                    i > 0 && "border-t border-border-soft",
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.desc}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted-foreground/60" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------ Tabs ------------------ */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </Card>
  );
}

function ProfileInfoTab({ user }: { user: User | null }) {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  async function save() {
    const name = displayName.trim();
    if (name.length > 60) return toast.error("Name is too long");
    const p = phone.trim();
    if (p && !/^[+\d\s().-]{6,20}$/.test(p)) return toast.error("Enter a valid phone number");
    try {
      await update.mutateAsync({ display_name: name || null, phone: p || null });
      // keep auth user metadata in sync so other clients pick up the name
      await supabase.auth.updateUser({ data: { display_name: name } });
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save");
    }
  }

  async function changeEmail() {
    const e = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast.error("Enter a valid email");
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: e });
    setSavingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Check both inboxes to confirm the change");
    setNewEmail("");
  }

  return (
    <div className="space-y-6">
      <Section title="Profile information" description="How you appear inside Rental Hub.">
        <Input label="Display name" placeholder="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <Input label="Phone (optional)" placeholder="+1 555 000 1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex justify-end">
          <Button onClick={save} loading={update.isPending}>Save changes</Button>
        </div>
      </Section>

      <Section title="Email address" description="Used for sign-in and important notifications.">
        <Input label="Current email" value={user?.email ?? ""} disabled />
        <Input
          label="New email"
          type="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <div className="flex justify-end">
          <Button onClick={changeEmail} loading={savingEmail} disabled={!newEmail}>
            Update email
          </Button>
        </div>
      </Section>
    </div>
  );
}

function AccountTab({ user }: { user: User | null }) {
  const created = user?.created_at ? new Date(user.created_at) : null;
  return (
    <Section title="Account settings" description="Details about your account.">
      <Row label="User ID" value={<code className="rounded-lg bg-black/5 px-2 py-1 text-[11px]">{user?.id?.slice(0, 8) ?? "—"}…</code>} />
      <Row label="Member since" value={created ? created.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "—"} />
      <Row label="Language" value="English (US)" />
      <Row label="Timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
    </Section>
  );
}

function AppearanceTab() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const stored = getStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);
  function apply(t: Theme) {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem("rh:theme", t);
    } catch {}
    toast.success("Appearance saved");
  }
  const options: { id: Theme; label: string; hint: string }[] = [
    { id: "light", label: "Light", hint: "Soft sanctuary" },
    { id: "dark", label: "Dark", hint: "Rich low-light mode" },
    { id: "system", label: "System", hint: "Match device" },
  ];
  return (
    <Section title="Appearance" description="Pick how Rental Hub feels.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => apply(o.id)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all active:scale-[0.98]",
              theme === o.id
                ? "border-brand bg-brand-soft"
                : "border-border-soft bg-surface hover:border-brand/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{o.label}</span>
              {theme === o.id && <Check size={14} className="text-brand" strokeWidth={3} />}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{o.hint}</p>
          </button>
        ))}
      </div>
    </Section>
  );
}

function NotificationsTab() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const prefs = profile?.notification_prefs ?? { viewings: true, deciding: true, weekly: false, marketing: false };

  function set<K extends keyof typeof prefs>(k: K, v: boolean) {
    update.mutate({ notification_prefs: { ...prefs, [k]: v } });
  }
  const items: { key: keyof typeof prefs; title: string; desc: string }[] = [
    { key: "viewings", title: "Viewing reminders", desc: "Ping me before scheduled viewings." },
    { key: "deciding", title: "Decision nudges", desc: "Weekly summary of properties in Deciding." },
    { key: "weekly", title: "Weekly digest", desc: "One quiet email each Sunday." },
    { key: "marketing", title: "Product updates", desc: "New features and improvements." },
  ];
  return (
    <Section title="Notification preferences" description="You control what reaches you.">
      {items.map((i) => (
        <div key={i.key} className="flex items-start justify-between gap-4 rounded-2xl border border-border-soft bg-surface p-4">
          <div>
            <p className="text-sm font-bold">{i.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{i.desc}</p>
          </div>
          <Checkbox checked={prefs[i.key]} onChange={(v) => set(i.key, v)} />
        </div>
      ))}
    </Section>
  );
}

function SecurityTab({ user }: { user: User | null }) {
  const hasPassword = useMemo(
    () => (user?.identities ?? []).some((i) => i.provider === "email"),
    [user],
  );
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(pw);

  async function change() {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPw(""); setConfirm("");
    }
  }

  return (
    <Section title="Security" description={hasPassword ? "Update your password." : "Set a password to also sign in with email."}>
      <Input label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      {pw && (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{strength.label}</p>
        </div>
      )}
      <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div className="flex justify-end">
        <Button onClick={change} loading={busy}>Update password</Button>
      </div>
    </Section>
  );
}

function ConnectedTab({ user }: { user: User | null }) {
  const providers = (user?.identities ?? []).map((i) => i.provider);
  const items = [
    { id: "email", label: "Email & password", icon: Mail },
    { id: "google", label: "Google", icon: GoogleGlyph },
  ];
  return (
    <Section title="Connected accounts" description="Sign-in methods linked to your account.">
      {items.map((i) => {
        const connected = providers.includes(i.id);
        const Icon = i.icon as any;
        return (
          <div key={i.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border-soft bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl border border-border-soft bg-background">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">{i.label}</p>
                <p className="text-xs text-muted-foreground">{connected ? "Connected" : "Not connected"}</p>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                connected ? "bg-brand-soft text-brand" : "bg-black/5 text-muted-foreground",
              )}
            >
              {connected ? "Linked" : "Available"}
            </span>
          </div>
        );
      })}
    </Section>
  );
}

function DataPrivacyTab() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const p = profile?.privacy_prefs ?? { analytics: true, share_activity: false };
  return (
    <Section title="Data & privacy" description="You own your rental data.">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border-soft bg-surface p-4">
        <div>
          <p className="text-sm font-bold">Anonymous analytics</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Help us improve Rental Hub with anonymized usage.</p>
        </div>
        <Checkbox checked={p.analytics} onChange={(v) => update.mutate({ privacy_prefs: { ...p, analytics: v } })} />
      </div>
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border-soft bg-surface p-4">
        <div>
          <p className="text-sm font-bold">Share activity with collaborators</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Show when you last viewed a shared property.</p>
        </div>
        <Checkbox checked={p.share_activity} onChange={(v) => update.mutate({ privacy_prefs: { ...p, share_activity: v } })} />
      </div>
      <div className="rounded-2xl border border-border-soft bg-surface p-4">
        <p className="text-sm font-bold">Your data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Properties, checklists, and commute targets are stored securely and only visible to you.
        </p>
      </div>
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-bold text-destructive">Delete account</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Account deletion is coming soon. Contact support to remove all your data.
        </p>
      </div>
    </Section>
  );
}

function AboutTab() {
  const router = useRouter();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-6">
      <Section title="About Rental Hub" description="A calm home for apartment hunting.">
        <Row label="Version" value="1.0.0" />
        <Row label="Made with" value="Care in California" />
        <Row label="Support" value="hello@rentalhub.app" />
      </Section>

      <Card className="border-destructive/30 bg-destructive/5 p-6 sm:p-8">
        <h2 className="text-lg font-bold tracking-tight">Sign out</h2>
        <p className="mt-1 text-sm text-muted-foreground">You'll need to sign back in to access your properties.</p>
        <Button variant="danger" className="mt-6 w-full sm:w-auto" onClick={signOut} loading={busy}>
          <LogOut size={16} />
          Sign out
        </Button>
      </Card>
    </div>
  );
}

/* ------------------ helpers ------------------ */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3 last:border-none last:pb-0">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Okay", "Strong", "Excellent"];
  const colors = ["oklch(0.7 0.16 20)", "oklch(0.7 0.16 20)", "oklch(0.82 0.14 85)", "oklch(0.75 0.14 160)", "oklch(0.55 0.19 285)"];
  return { score, label: labels[score], color: colors[score] };
}

function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A7.03 7.03 0 015.48 12c0-.73.13-1.44.36-2.09V7.07H2.18A11 11 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
