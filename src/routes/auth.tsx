import { createFileRoute, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/RhButton";
import { Input } from "@/components/ui/RhInput";
import { Card } from "@/components/ui/RhCard";
import { toast } from "sonner";
import { Home, KeyRound, ShieldCheck } from "lucide-react";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const nav = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: redirect ?? "/board", replace: true });
    });
  }, [nav, redirect]);

  const strength = passwordStrength(password);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!emailValid) return toast.error("Enter a valid email");
    if (mode === "sign-up" && password.length < 8) return toast.error("Use at least 8 characters");
    setLoading(true);
    try {
      const { error } =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (error) throw error;
      toast.success(mode === "sign-in" ? "Welcome back" : "Account created");
      router.invalidate();
      nav({ to: redirect ?? "/board", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) { toast.error("Google sign-in failed"); return; }
      if (result.redirected) return;
      router.invalidate();
      nav({ to: redirect ?? "/board", replace: true });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="grid h-[100svh] grid-cols-1 bg-background md:grid-cols-2 overflow-hidden">
      {/* Brand panel — visible md and up, becomes the hero on mobile via the header instead */}
      <div className="relative hidden h-full overflow-hidden bg-brand-panel md:flex md:flex-col md:justify-between md:p-10 lg:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 100% at 0% 0%, oklch(0.4 0.09 285) 0%, oklch(0.22 0.05 275) 55%, oklch(0.14 0.03 270) 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "oklch(0.7 0.16 40)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/3 size-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: "oklch(0.65 0.14 200)" }}
        />

        <div className="relative flex items-center gap-2 text-white">
          <div className="grid size-10 place-items-center rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Home size={18} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">Rental Hub</span>
        </div>

        <div className="relative max-w-sm text-white">
          <h2 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            Every listing, every note, one calm place.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Save the places you're touring, track follow-ups, and compare
            options side by side — without losing anything in a group chat.
          </p>
        </div>

        <ul className="relative space-y-3 text-sm text-white/70">
          <li className="flex items-center gap-2.5">
            <ShieldCheck size={16} className="shrink-0 text-white/50" />
            Your data stays private to your account
          </li>
          <li className="flex items-center gap-2.5">
            <KeyRound size={16} className="shrink-0 text-white/50" />
            Sign in with Google or email in seconds
          </li>
        </ul>
      </div>

      {/* Form panel */}
      <div className="flex h-full flex-col items-center justify-center px-5 py-10 sm:px-8 md:py-16 overflow-hidden">
        <div className="w-full max-w-md animate-auth-in">
          <div className="mb-8 flex items-center gap-2 md:hidden">
            <div className="grid size-10 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-brand">
              <Home size={18} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight">Rental Hub</span>
          </div>

          <Card className="p-6 shadow-soft sm:p-8">
            <div className="mb-6 flex items-center gap-1 rounded-full bg-black/5 p-1">
              <ModeTab active={mode === "sign-in"} onClick={() => setMode("sign-in")}>
                Sign in
              </ModeTab>
              <ModeTab active={mode === "sign-up"} onClick={() => setMode("sign-up")}>
                Create account
              </ModeTab>
            </div>

            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "sign-in" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your calm home for tracking rental options.
            </p>

            <Button
              variant="outline"
              className="mt-6 w-full gap-2.5"
              onClick={handleGoogle}
              loading={googleLoading}
              type="button"
            >
              <GoogleGlyph />
              Continue with Google
            </Button>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
              <div className="h-px flex-1 bg-border-soft" />
              or use email
              <div className="h-px flex-1 bg-border-soft" />
            </div>

            <form onSubmit={handleEmail} className="space-y-4" noValidate>
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@home.com"
                error={touched && email && !emailValid ? "Enter a valid email address" : undefined}
              />
              <div>
                <Input
                  label="Password"
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "sign-up" ? 8 : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "sign-up" ? "At least 8 characters" : "Your password"}
                />
                {mode === "sign-up" && password && (
                  <div className="mt-2 space-y-1.5" aria-live="polite">
                    <div className="flex h-1.5 w-full gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-full flex-1 overflow-hidden rounded-full bg-black/5"
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300 ease-out"
                            style={{
                              width: i < strength.score ? "100%" : "0%",
                              background: strength.color,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{strength.label}</p>
                  </div>
                )}
              </div>

              {mode === "sign-in" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => toast("Password reset isn't wired up yet")}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground md:hidden">
              {mode === "sign-in" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("sign-up")}
                    className="font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("sign-in")}
                    className="font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes auth-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-auth-in { animation: auth-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .animate-auth-in { animation: none; }
        }
      `}</style>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
        (active ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Okay", "Strong", "Excellent"];
  const colors = [
    "oklch(0.7 0.16 20)",
    "oklch(0.7 0.16 20)",
    "oklch(0.82 0.14 85)",
    "oklch(0.75 0.14 160)",
    "oklch(0.55 0.19 285)",
  ];
  return { score, label: labels[score], color: colors[score] };
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A7.03 7.03 0 015.48 12c0-.73.13-1.44.36-2.09V7.07H2.18A11 11 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}