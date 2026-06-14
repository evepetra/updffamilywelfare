import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Secure Login | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Authenticate with your institutional credentials to access UPDF family welfare services.",
      },
    ],
  }),
  component: LoginPage,
});

type Role = "family" | "officer" | "admin";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, service_number: serviceNumber },
          },
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
            UPDF Welfare Portal
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
                      placeholder="UPDF-W-8842"
                      value={serviceNumber}
                      onChange={(e) => setServiceNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                    />
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
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
  { value: "officer", label: "Officer", icon: "military_tech" },
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