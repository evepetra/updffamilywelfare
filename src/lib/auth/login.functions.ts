import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RequestedRole = "family" | "officer" | "admin";

const NIN_RE = /^C[MF][A-Z0-9]{12}$/;

/**
 * Server-side NIN validation. Uganda NIN: 14 chars, starts with CM or CF,
 * then 12 alphanumerics. Returns a normalized (uppercase) NIN.
 */
export const validateNin = createServerFn({ method: "POST" })
  .inputValidator((input: { nin: string }) => input)
  .handler(async ({ data }) => {
    const nin = (data.nin ?? "").trim().toUpperCase();
    if (!nin) return { valid: false, reason: "NIN is required", nin: "" };
    if (nin.length !== 14)
      return { valid: false, reason: "NIN must be exactly 14 characters", nin };
    if (!/^C[MF]/.test(nin))
      return { valid: false, reason: "NIN must start with CM (male) or CF (female)", nin };
    if (!NIN_RE.test(nin))
      return {
        valid: false,
        reason: "NIN must be 14 uppercase letters/digits (e.g. CM12345678ABCD)",
        nin,
      };
    return { valid: true, reason: null, nin };
  });

/**
 * Server-validated login authorization check.
 * - Verifies the bearer token (requireSupabaseAuth).
 * - Looks up real roles from user_roles (cannot be spoofed by the client).
 * - Rejects admin self-attempts by non-admins.
 * - Records every attempt (success/failure) in login_audit.
 *
 * The client calls this AFTER signInWithPassword succeeds. If `authorized`
 * is false, the client must immediately sign out.
 */
export const authorizeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestedRole: RequestedRole; email?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (data.email ?? (claims as { email?: string })?.email ?? "").toLowerCase();
    const requested = data.requestedRole;

    const { data: roleRows, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleErr) throw new Error(roleErr.message);
    const roles = ((roleRows ?? []) as { role: RequestedRole }[]).map((r) => r.role);

    let authorized = true;
    let reason: string | null = null;

    if (requested === "admin" && !roles.includes("admin")) {
      authorized = false;
      reason =
        "Admin access denied: account is not provisioned as admin. Admin accounts must be pre-created by the welfare directorate.";
    } else if (
      requested === "officer" &&
      !(roles.includes("officer") || roles.includes("admin"))
    ) {
      authorized = false;
      reason = "Militant (Soldier) access denied: account lacks officer role.";
    }

    await supabase.from("login_audit").insert({
      user_id: userId,
      email,
      requested_role: requested,
      outcome: authorized ? "success" : "failure",
      reason,
    });

    return { authorized, reason, roles };
  });

/**
 * Record a pre-auth failed attempt (bad password, unknown user, etc.).
 * No middleware — anyone can log a failure for their attempted email so
 * the audit table reflects unauthorized access attempts too. Capped fields.
 */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { email: string; requestedRole: RequestedRole; reason: string }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_audit").insert({
      user_id: null,
      email: (data.email ?? "").toLowerCase().slice(0, 255),
      requested_role: data.requestedRole,
      outcome: "failure",
      reason: (data.reason ?? "").slice(0, 500),
    });
    return { ok: true };
  });