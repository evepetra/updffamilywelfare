import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "family" | "soldier" | "officer" | "admin" | "system_admin";

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
      isAdmin: roles.includes("admin") || roles.includes("system_admin"),
      isSystemAdmin: roles.includes("system_admin"),
      isOfficer: roles.includes("officer"),
      isStaff:
        roles.includes("admin") ||
        roles.includes("system_admin") ||
        roles.includes("officer"),
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
    const isStaff =
      roles.includes("admin") ||
      roles.includes("system_admin") ||
      roles.includes("officer");
    return {
      userId: context.userId,
      roles,
      isAdmin: roles.includes("admin") || roles.includes("system_admin"),
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
      .in("role", ["admin", "system_admin"]);
    if (error) throw new Error(error.message);
    return { userId: context.userId, authorized: (data ?? []).length > 0 };
  });

export const requireSystemAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "system_admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { userId: context.userId, authorized: Boolean(data) };
  });

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string;
  service_number: string;
  service: string;
  roles: AppRole[];
  created_at: string;
};

/**
 * Admin-only: list all users with their profiles and roles.
 * Replaces the previous `admin_list_users` SECURITY DEFINER RPC.
 * Authorization is enforced server-side: the caller must hold the `admin` role.
 */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    // Verify admin via the caller's RLS context first.
    const { data: adminCheck, error: adminErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "system_admin"]);
    if (adminErr) throw new Error(adminErr.message);
    if (!(adminCheck ?? []).length) throw new Error("Forbidden: admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersList, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (usersErr) throw new Error(usersErr.message);
    const users = usersList?.users ?? [];
    const ids = users.map((u) => u.id);

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, service_number, service")
        .in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    const profileMap = new Map(
      (
        (profiles ?? []) as {
          id: string;
          full_name: string | null;
          service_number: string | null;
          service: string | null;
        }[]
      ).map((p) => [p.id, p]),
    );
    const rolesMap = new Map<string, AppRole[]>();
    for (const r of (roles ?? []) as { user_id: string; role: AppRole }[]) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    }

    return users
      .map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email ?? null,
          full_name: p?.full_name ?? "",
          service_number: p?.service_number ?? "",
          service: p?.service ?? "",
          roles: (rolesMap.get(u.id) ?? []).sort(),
          created_at: u.created_at,
        };
      })
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  });