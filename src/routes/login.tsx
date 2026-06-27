import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { authorizeLogin, recordFailedLogin, validateNin } from "@/lib/auth/login.functions";

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

type Role = "family" | "soldier" | "officer" | "admin" | "system_admin";

// Army Number: RA/ or RAV/ require exactly 6 digits, RO/ or ROV/ require exactly 5 digits.
const ARMY_NUMBER_REGEX = /^(?:(?:RA|RAV)\/\d{6}|(?:RO|ROV)\/\d{5})$/i;
// Uganda NIN: 14 chars, starts with CM (male) or CF (female), then 12 alphanumerics
const NIN_REGEX = /^C[MF][A-Z0-9]{12}$/;

// Ranks from Private to General (UPDF order of precedence)
const UPDF_RANKS = [
  "Private",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Warrant Officer Class II",
  "Warrant Officer Class I",
  "Second Lieutenant",
  "Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Brigadier",
  "Major General",
  "Lieutenant General",
  "General",
] as const;

// UPDF service regions (also constrained on profiles.region in the database)
const UPDF_REGIONS = [
  "Central",
  "Western",
  "Northern",
  "Eastern",
  "West Nile",
] as const;

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

const baseSignUpSchema = signInSchema.extend({
  fullName: z
    .string()
    .trim()
    .nonempty({ message: "Full name is required" })
    .max(100, { message: "Full name must be less than 100 characters" }),
  nin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(NIN_REGEX, {
      message: "Enter a valid 14-character National ID (e.g. CM12345678ABCD)",
    }),
  region: z
    .string()
    .trim()
    .refine((v) => (UPDF_REGIONS as readonly string[]).includes(v), {
      message: "Select your region",
    }),
});

const familySignUpSchema = baseSignUpSchema;

const soldierSignUpSchema = baseSignUpSchema.extend({
  armyNumber: z
    .string()
    .trim()
    .regex(ARMY_NUMBER_REGEX, {
      message: "RA/ or RAV/ must be followed by 6 digits; RO/ or ROV/ by 5 digits",
    }),
  rank: z
    .string()
    .trim()
    .refine((v) => (UPDF_RANKS as readonly string[]).includes(v), {
      message: "Select a valid rank (Private to General)",
    }),
});

function LoginPage() {
  const navigate = useNavigate();
  const callAuthorize = useServerFn(authorizeLogin);
  const callRecordFail = useServerFn(recordFailedLogin);
  const callValidateNin = useServerFn(validateNin);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // Role only matters during signup (admins cannot self-register).
  // For sign-in the destination is derived from the user's actual public.user_roles.
  const [signupRole, setSignupRole] = useState<Extract<Role, "family" | "soldier">>(
    "family",
  );
  const [showPass, setShowPass] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [nin, setNin] = useState("");
  const [armyNumber, setArmyNumber] = useState("");
  const [rank, setRank] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupNotice, setSignupNotice] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [lastSignupEmail, setLastSignupEmail] = useState<string>("");
  // Anti-spam: hard cap + cooldown countdown for the resend confirmation email.
  const RESEND_COOLDOWN_SECONDS = 60;
  const RESEND_MAX_ATTEMPTS = 3;
  const [resendCount, setResendCount] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    fullName?: string;
    nin?: string;
    armyNumber?: string;
    rank?: string;
  }>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const strength = passwordStrength(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSignupNotice(null);
    setFieldErrors({});
    setLoading(true);
    try {
      if (mode === "signup") {
        const role = signupRole;
        const schema = role === "soldier" ? soldierSignUpSchema : familySignUpSchema;
        const parsed = schema.safeParse(
          role === "soldier"
            ? { email, password, fullName, nin, armyNumber, rank }
            : { email, password, fullName, nin },
        );
        if (!parsed.success) {
          const fe: typeof fieldErrors = {};
          for (const iss of parsed.error.issues) {
            const k = iss.path[0] as keyof typeof fieldErrors;
            if (k && !fe[k]) fe[k] = iss.message;
          }
          setFieldErrors(fe);
          throw new Error("Please correct the highlighted fields.");
        }
        // Server-side NIN validation (defense-in-depth; DB also enforces the format)
        const ninCheck = await callValidateNin({ data: { nin: parsed.data.nin } });
        if (!ninCheck.valid) {
          setFieldErrors({ nin: ninCheck.reason ?? "Invalid NIN" });
          throw new Error(ninCheck.reason ?? "Invalid NIN");
        }
        const army = role === "soldier" ? armyNumber.trim().toUpperCase() : "";
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: parsed.data.fullName,
              nin: ninCheck.nin,
              signup_role: role,
              ...(role === "soldier"
                ? { army_number: army, service_number: army, rank }
                : {}),
            },
          },
        });
        if (error) throw error;
        // If email confirmation is enabled, no session is returned. Show a
        // clear notice so members know to check spam if the email doesn't
        // appear in their inbox.
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          navigate({ to: "/dashboard" });
        } else {
          setSignupNotice(
            `Account created. We've sent a confirmation email to ${parsed.data.email}. If you don't see it in your inbox within a few minutes, please check your Spam or Junk folder.`,
          );
          setLastSignupEmail(parsed.data.email);
          setResendMsg(null);
          setResendCount(0);
          setResendCooldown(0);
          setMode("signin");
        }
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          const fe: typeof fieldErrors = {};
          for (const iss of parsed.error.issues) {
            const k = iss.path[0] as keyof typeof fieldErrors;
            if (k && !fe[k]) fe[k] = iss.message;
          }
          setFieldErrors(fe);
          throw new Error("Please correct the highlighted fields.");
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          await callRecordFail({
            data: {
              email: parsed.data.email,
              requestedRole: "family",
              reason: error.message,
            },
          }).catch(() => {});
          throw error;
        }
        // Determine the user's effective role from public.user_roles and route
        // accordingly. Admin > Officer > Family precedence. Server-side audit
        // logs the resolved role (cannot be spoofed by the client).
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        let resolved: Role = "family";
        if (uid) {
          const { data: rs } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid);
          const roles = ((rs ?? []) as { role: Role }[]).map((r) => r.role);
          if (roles.includes("system_admin")) resolved = "system_admin";
          else if (roles.includes("admin")) resolved = "admin";
          else if (roles.includes("officer")) resolved = "officer";
          else if (roles.includes("soldier")) resolved = "soldier";
        }
        await callAuthorize({
          data: { requestedRole: resolved, email: parsed.data.email },
        }).catch(() => ({ authorized: true }));
        const dest =
          resolved === "system_admin" || resolved === "admin"
            ? "/admin-console"
            : resolved === "officer"
              ? "/admin"
              : "/dashboard";
        navigate({ to: dest });
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
            <span className="text-on-primary-container text-xs uppercase tracking-[0.2em] font-medium text-center w-full">
              UPDF FAMILY WELFARE
            </span>
          </div>

          <div className="p-8 md:p-10">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-primary mb-1.5 text-center">
                {mode === "signup"
                  ? signupRole === "soldier"
                    ? "New Soldier Create account"
                    : "Create Portal Account"
                  : "PORTAL LOGIN"}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {mode === "signup"
                  ? "Register a family or soldier account. Welfare-officer, admin and system-admin access are provisioned by the welfare directorate."
                  : "Authenticate with your institutional credentials."}
              </p>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              {/* Top-level Sign In / Create Account tab switcher (matches the
                  approved visual). The role selector only appears inside
                  Create Account because admins cannot self-register and the
                  signed-in destination is derived from public.user_roles. */}
              <div role="tablist" aria-label="Authentication mode" className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low border border-outline-variant rounded-md">
                {(["signin", "signup"] as const).map((m) => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setError(null); setMode(m); }}
                      className={
                        "py-2.5 rounded-md text-sm font-semibold transition-colors " +
                        (active
                          ? "bg-card text-primary shadow-sm border border-outline-variant"
                          : "text-on-surface-variant hover:text-primary")
                      }
                    >
                      {m === "signin" ? "Sign In" : "Create Account"}
                    </button>
                  );
                })}
              </div>

              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Account Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SIGNUP_ROLES.map((r) => {
                      const active = signupRole === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setSignupRole(r.value)}
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
                  <p className="mt-2 text-[11px] text-on-surface-variant">
                    Admin accounts are provisioned by the welfare directorate and cannot be self-registered.
                  </p>
                </div>
              )}

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
                    aria-invalid={!!fieldErrors.email}
                    className={
                      "w-full pl-10 pr-4 py-3 bg-surface-container-low border rounded-md focus:outline-none text-sm " +
                      (fieldErrors.email
                        ? "border-error focus:border-error"
                        : "border-outline-variant focus:border-primary")
                    }
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-error">{fieldErrors.email}</p>
                )}
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
                      aria-invalid={!!fieldErrors.fullName}
                      className={
                        "w-full px-4 py-3 bg-surface-container-low border rounded-md focus:outline-none text-sm " +
                        (fieldErrors.fullName
                          ? "border-error focus:border-error"
                          : "border-outline-variant focus:border-primary")
                      }
                    />
                    {fieldErrors.fullName && (
                      <p className="mt-1.5 text-xs text-error">{fieldErrors.fullName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-1.5">
                      National ID Number (NIN)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={14}
                      placeholder="CM12345678ABCD"
                      pattern="^[Cc][MmFf][A-Za-z0-9]{12}$"
                      title="14 characters, starting with CM or CF"
                      value={nin}
                      onChange={(e) => setNin(e.target.value.toUpperCase())}
                      aria-invalid={!!fieldErrors.nin}
                      className={
                        "w-full px-4 py-3 bg-surface-container-low border rounded-md focus:outline-none text-sm font-mono uppercase " +
                        (fieldErrors.nin
                          ? "border-error focus:border-error"
                          : "border-outline-variant focus:border-primary")
                      }
                    />
                    {fieldErrors.nin ? (
                      <p className="mt-1.5 text-xs text-error">{fieldErrors.nin}</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-on-surface-variant">
                        14-character Ugandan NIN starting with <span className="font-medium">CM</span> or <span className="font-medium">CF</span>.
                      </p>
                    )}
                  </div>
                  {signupRole === "soldier" && (
                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1.5">
                        Rank
                      </label>
                      <select
                        required
                        value={rank}
                        onChange={(e) => setRank(e.target.value)}
                        aria-invalid={!!fieldErrors.rank}
                        className={
                          "w-full px-4 py-3 bg-surface-container-low border rounded-md focus:outline-none text-sm " +
                          (fieldErrors.rank
                            ? "border-error focus:border-error"
                            : "border-outline-variant focus:border-primary")
                        }
                      >
                        <option value="">Select rank…</option>
                        {UPDF_RANKS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {fieldErrors.rank && (
                        <p className="mt-1.5 text-xs text-error">{fieldErrors.rank}</p>
                      )}
                    </div>
                  )}
                  {signupRole === "soldier" && (
                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1.5">
                        Army Number
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={40}
                        placeholder="RA/123456"
                        pattern="^(?:(?:RA|RAV|ra|rav)/\d{6}|(?:RO|ROV|ro|rov)/\d{5})$"
                        title="RA/ or RAV/ + 6 digits, or RO/ or ROV/ + 5 digits"
                        value={armyNumber}
                        onChange={(e) => setArmyNumber(e.target.value)}
                        aria-invalid={!!fieldErrors.armyNumber}
                        className={
                          "w-full px-4 py-3 bg-surface-container-low border rounded-md focus:outline-none text-sm " +
                          (fieldErrors.armyNumber
                            ? "border-error focus:border-error"
                            : "border-outline-variant focus:border-primary")
                        }
                      />
                      {fieldErrors.armyNumber ? (
                        <p className="mt-1.5 text-xs text-error">{fieldErrors.armyNumber}</p>
                      ) : (
                        <p className="mt-1.5 text-xs text-on-surface-variant">
                          <span className="font-medium">RA/</span> or <span className="font-medium">RAV/</span> followed by 6 digits (e.g. RA/123456), or <span className="font-medium">RO/</span> or <span className="font-medium">ROV/</span> followed by 5 digits (e.g. RO/12345).
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-on-surface"
                  >
                    Password
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

              {signupNotice && (
                <div
                  role="status"
                  className="text-sm text-primary bg-primary-fixed-dim/60 border border-primary/30 rounded-md px-3 py-2 flex gap-2"
                >
                  <Icon name="mark_email_read" className="text-[18px] mt-0.5" />
                  <div className="flex-1">
                    <p>{signupNotice}</p>
                    {lastSignupEmail && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            resendBusy ||
                            resendCooldown > 0 ||
                            resendCount >= RESEND_MAX_ATTEMPTS
                          }
                          onClick={async () => {
                            if (resendCount >= RESEND_MAX_ATTEMPTS) {
                              setResendMsg(
                                `Resend limit reached (${RESEND_MAX_ATTEMPTS} attempts). Please contact support if the email still hasn't arrived.`,
                              );
                              return;
                            }
                            if (resendCooldown > 0) return;
                            setResendBusy(true);
                            setResendMsg(null);
                            const { error } = await supabase.auth.resend({
                              type: "signup",
                              email: lastSignupEmail,
                              options: {
                                emailRedirectTo: `${window.location.origin}/dashboard`,
                              },
                            });
                            setResendBusy(false);
                            if (!error) {
                              setResendCount((c) => c + 1);
                              setResendCooldown(RESEND_COOLDOWN_SECONDS);
                            }
                            setResendMsg(
                              error
                                ? `Could not resend: ${error.message}`
                                : `Confirmation email resent to ${lastSignupEmail}. Please check your inbox and Spam folder. (${resendCount + 1}/${RESEND_MAX_ATTEMPTS})`,
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-primary text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
                        >
                          <Icon name="forward_to_inbox" className="text-[14px]" />
                          {resendBusy
                            ? "Resending…"
                            : resendCooldown > 0
                              ? `Resend in ${resendCooldown}s`
                              : resendCount >= RESEND_MAX_ATTEMPTS
                                ? "Resend limit reached"
                                : "Resend confirmation email"}
                        </button>
                        {resendMsg && (
                          <span className="text-xs text-on-surface-variant">{resendMsg}</span>
                        )}
                      </div>
                    )}
                  </div>
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

const SIGNUP_ROLES: {
  value: Extract<Role, "family" | "soldier">;
  label: string;
  icon: string;
}[] = [
  { value: "family", label: "Family Member", icon: "family_restroom" },
  { value: "soldier", label: "Soldier", icon: "military_tech" },
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