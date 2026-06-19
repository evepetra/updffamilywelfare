import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Secure Login | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Authenticate with your institutional credentials to access UPDF family welfare services.",
      },
      { property: "og:title", content: "Secure Login | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Authenticate with your institutional credentials to access UPDF family welfare services.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/login" },
    ],
    links: [
      { rel: "canonical", href: "https://updffamilywelfare.lovable.app/login" },
    ],
  }),
  component: LoginPage,
});

type Role = "family" | "officer" | "admin";

const SERVICE_NUMBER_REGEX = /^(RA|RO|RAV|ROV|CIV)\/[A-Za-z0-9-]{1,32}$/i;

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

const signUpSchema = signInSchema.extend({
  fullName: z
    .string()
    .trim()
    .nonempty({ message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" }),
  serviceNumber: z
    .string()
    .trim()
    .regex(SERVICE_NUMBER_REGEX, {
      message: "Service number must start with RA/, RO/, RAV/, ROV/ or CIV/",
    }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("family");
  const [showPass, setShowPass] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const strength = passwordStrength(password);

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, fullName, serviceNumber });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: parsed.data.fullName,
              service_number: parsed.data.serviceNumber.toUpperCase(),
            },
          },
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        }
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        const uid = signInData.user?.id;
        let userRoles: Role[] = [];
        if (uid) {
          const { data: rs } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid);
          userRoles = ((rs ?? []) as { role: Role }[]).map((r) => r.role);
        }
        if (role === "admin" && !userRoles.includes("admin")) {
          await supabase.auth.signOut();
          throw new Error(
            "Admin access is restricted. Family and Militant accounts cannot sign in as Admin.",
          );
        }
        if (role === "officer" && !(userRoles.includes("officer") || userRoles.includes("admin"))) {
          await supabase.auth.signOut();
          throw new Error("Your account is not authorised for Militant (Soldier) access.");
        }
        navigate({ to: role === "family" ? "/dashboard" : "/admin" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-pattern-dots">
      <header className="bg-primary fixed top-0 inset-x-0 z-40 h-16 flex items-center px-4 md:px-8 border-b border-primary-container">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-on-primary flex items-center justify-center rounded-sm">
            <Icon name="shield" fill className="text-primary text-[22px]" />
          </div>
          <h1 className="text-on-primary font-bold tracking-tight">
            UPDF Welfare Portal — Secure Institutional Access
          </h1>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-12">
        <div className="w-full max-w-[480px] bg-card border border-outline-variant rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="h-32 bg-primary-container relative flex flex-col items-center justify-center">
            <Icon
              name="account_balance"
              fill
              className="text-on-primary-container text-5xl mb-1"
            />
            <span className="text-on-primary-container text-xs uppercase tracking-[0.2em] font-medium">
              Institutional Access
            </span>
          </div>

          <div className="p-8 md:p-10">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-primary mb-1.5">
                {mode === "signup" ? "Create Portal Account" : "Secure Portal Login"}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {mode === "signup"
                  ? "Register a family account. Officer/admin access is granted by your welfare directorate."
                  : "Please authenticate using your institutional credentials to access welfare services."}
              </p>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-2">
                  Access Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => {
                    const active = role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={
                          "py-3 rounded-md flex flex-col items-center gap-1 text-xs font-medium transition-all border-2 " +
                          (active
                            ? "border-primary bg-primary-fixed-dim text-primary"
                            : "border-outline-variant text-on-surface-variant hover:border-primary/40")
                        }
                      >
                        <Icon name={r.icon} className="text-[20px]" />
                        <span>{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="service-number"
                  className="block text-sm font-medium text-on-surface mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Icon
                    name="mail"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]"
                  />
                  <input
                    id="service-number"
                    type="email"
                    required
                    maxLength={255}
                    placeholder="name@updf.go.ug"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                  />
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Sarah Nakato"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1.5">Service Number / National ID</label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      placeholder="RA/12345"
                      pattern="^(?:RA|RO|RAV|ROV|CIV|ra|ro|rav|rov|civ)/[A-Za-z0-9-]{1,32}$"
                      title="Must start with RA/, RO/, RAV/, ROV/ or CIV/"
                      value={serviceNumber}
                      onChange={(e) => setServiceNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                    />
                    <p className="mt-1.5 text-xs text-on-surface-variant">
                      Accepted prefixes: <span className="font-medium">RA/</span>, <span className="font-medium">RO/</span>, <span className="font-medium">RAV/</span>, <span className="font-medium">ROV/</span> or <span className="font-medium">CIV/</span>
                    </p>
                  </div>
                </>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-on-surface"
                  >
                    Security Password
                  </label>
                  <a className="text-xs text-secondary hover:underline" href="#">
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <Icon
                    name="lock"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]"
                  />
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    aria-pressed={showPass}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                  >
                    <Icon
                      name={showPass ? "visibility_off" : "visibility"}
                      className="text-[20px]"
                    />
                  </button>
                </div>
                <PasswordMeter strength={strength} />
              </div>

              {error && (
                <div className="text-sm text-error bg-error-container/40 border border-error/30 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-primary text-on-primary rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-colors active:scale-[0.99]"
              >
                <Icon name="verified_user" fill className="text-[20px]" />
                {loading ? "Please wait…" : mode === "signup" ? "Create Account" : "Secure Login"}
              </button>

              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <div className="flex-1 h-px bg-outline-variant" />
                <span>or</span>
                <div className="flex-1 h-px bg-outline-variant" />
              </div>

              <button
                type="button"
                onClick={onGoogle}
                disabled={googleLoading}
                className="w-full py-3 bg-surface border-2 border-outline-variant text-on-surface rounded-md font-semibold flex items-center justify-center gap-2.5 hover:border-primary transition-colors active:scale-[0.99]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
                </svg>
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </button>

              <button
                type="button"
                onClick={() => { setError(null); setMode(mode === "signin" ? "signup" : "signin"); }}
                className="block w-full text-center text-xs text-secondary hover:underline"
              >
                {mode === "signin"
                  ? "New family? Create an account"
                  : "Already have an account? Sign in"}
              </button>

              <Link
                to="/support"
                className="block text-center text-xs text-secondary hover:underline"
              >
                <Icon name="support_agent" className="text-sm mr-1 align-middle" />
                Need help? Contact Support
              </Link>
            </form>

            <div className="mt-8 pt-6 border-t border-outline-variant text-center">
              <p className="text-xs text-on-surface-variant flex items-center justify-center gap-1.5">
                <Icon name="info" className="text-sm" />
                Unauthorized access is strictly prohibited and monitored.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-surface-dim w-full border-t border-outline-variant px-4 md:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="text-center md:text-left">
          <p className="font-semibold text-primary text-sm">
            Uganda People's Defence Forces
          </p>
          <p className="text-xs text-on-surface-variant">
            © 2026 UPDF. Secure Institutional Portal.
          </p>
        </div>
        <div className="flex gap-6 text-xs text-on-surface-variant">
          <a href="#" className="hover:text-secondary">Privacy Policy</a>
          <a href="#" className="hover:text-secondary">Security Protocol</a>
          <a href="#" className="hover:text-secondary">Contact Admin</a>
        </div>
      </footer>
    </div>
  );
}

const ROLES: { value: Role; label: string; icon: string }[] = [
  { value: "family", label: "Family", icon: "family_restroom" },
  { value: "officer", label: "Militant (Soldier)", icon: "military_tech" },
  { value: "admin", label: "Admin", icon: "admin_panel_settings" },
];

function passwordStrength(p: string): "weak" | "medium" | "strong" {
  if (p.length < 6) return "weak";
  if (p.length < 10 || !/[A-Z]/.test(p) || !/\d/.test(p)) return "medium";
  return "strong";
}

function PasswordMeter({ strength }: { strength: "weak" | "medium" | "strong" }) {
  const map = {
    weak: { label: "Weak", color: "bg-error", filled: 1, text: "text-error" },
    medium: {
      label: "Medium",
      color: "bg-secondary",
      filled: 2,
      text: "text-secondary",
    },
    strong: {
      label: "Strong",
      color: "bg-primary",
      filled: 3,
      text: "text-primary",
    },
  } as const;
  const m = map[strength];
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-on-surface-variant">Password Strength</span>
        <span className={"text-xs font-semibold " + m.text}>{m.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              "h-full flex-1 rounded-full transition-all " +
              (i <= m.filled ? m.color : "bg-surface-variant")
            }
          />
        ))}
      </div>
    </div>
  );
}