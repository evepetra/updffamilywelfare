import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "family" | "officer" | "admin";

/**
 * Server-validated role lookup for the current authenticated user.
 * Bearer token is verified by `requireSupabaseAuth`; roles come from
 * `public.user_roles` via the user's RLS context — clients cannot spoof.
 */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    return {
      userId: context.userId,
      roles,
      isAdmin: roles.includes("admin"),
      isOfficer: roles.includes("officer"),
      isStaff: roles.includes("admin") || roles.includes("officer"),
    };
  });

export const requireStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
    const isStaff = roles.includes("admin") || roles.includes("officer");
    return {
      userId: context.userId,
      roles,
      isAdmin: roles.includes("admin"),
      isStaff,
      authorized: isStaff,
    };
  });

export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { userId: context.userId, authorized: Boolean(data) };
  });