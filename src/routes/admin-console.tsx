import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/auth/roles.functions";

type AppRole = "family" | "officer" | "admin";
type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  service_number: string | null;
  roles: AppRole[] | null;
  created_at: string;
};

export const Route = createFileRoute("/admin-console")({
  ssr: false,
  beforeLoad: async () => {
    try {
      await requireAdmin();
    } catch (err) {
      const status =
        err instanceof Response
          ? err.status
          : typeof err === "object" && err && "status" in err
            ? Number((err as { status: unknown }).status)
            : 0;
      if (status === 403) throw redirect({ to: "/dashboard" });
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Administrator Console | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Administrator landing for UPDF welfare directorate — manage roles, oversee officers, and audit the welfare system.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConsole,
});

function AdminConsole() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: AdminUserRow[] | null; error: { message: string } | null }>)(
        "admin_list_users",
      );
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const auditQuery = useQuery({
    queryKey: ["admin-role-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_change_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.service_number ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const admins = users.filter((u) => u.roles?.includes("admin")).length;
  const officers = users.filter((u) => u.roles?.includes("officer")).length;
  const families = users.filter((u) => u.roles?.includes("family")).length;

  async function toggleRole(userId: string, role: AppRole, has: boolean) {
    const key = `${userId}:${role}`;
    setBusyKey(key);
    setActionError(null);
    try {
      if (has) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      await qc.invalidateQueries({ queryKey: ["admin-role-audit"] });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Role update failed");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <AppShell
      title="Administrator Console"
      subtitle="Welfare directorate controls — role oversight, audit trail and officer operations."
      actions={
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container"
        >
          <Icon name="dashboard" className="text-[18px]" />
          Open Officer Queue
        </Link>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KpiCard label="Administrators" value={String(admins)} icon="admin_panel_settings" tone="bg-primary text-on-primary" />
        <KpiCard label="Officers (Soldiers)" value={String(officers)} icon="military_tech" tone="bg-secondary text-on-secondary" />
        <KpiCard label="Family Accounts" value={String(families)} icon="family_restroom" tone="bg-tertiary text-on-tertiary" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 bg-card border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Role Assignment Toolkit</h2>
              <p className="text-xs text-on-surface-variant">
                Toggle Admin, Soldier (Officer), or Family on any account. Users can hold multiple roles.
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or service #"
              className="px-3 py-2 text-sm bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary w-full md:w-64"
            />
          </div>
          {actionError && (
            <div className="px-5 py-2 text-xs text-error bg-error-container/40 border-b border-error/30">
              {actionError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-center px-3 py-3 font-medium">Admin</th>
                  <th className="text-center px-3 py-3 font-medium">Soldier</th>
                  <th className="text-center px-3 py-3 font-medium">Family</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {usersQuery.isLoading && (
                  <tr><td colSpan={5} className="text-center py-8 text-on-surface-variant">Loading users…</td></tr>
                )}
                {usersQuery.error && !usersQuery.isLoading && (
                  <tr><td colSpan={5} className="text-center py-8 text-error">
                    {(usersQuery.error as Error).message}
                  </td></tr>
                )}
                {!usersQuery.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-on-surface-variant">No users match.</td></tr>
                )}
                {filtered.map((u) => {
                  const userRoles = u.roles ?? [];
                  return (
                    <tr key={u.id} className="hover:bg-surface-bright align-middle">
                      <td className="px-5 py-3">
                        <p className="font-medium">{u.full_name || "—"}</p>
                        <p className="text-xs text-outline font-mono">
                          {u.service_number || u.id.slice(0, 8) + "…"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-on-surface-variant">{u.email}</td>
                      {(["admin", "officer", "family"] as AppRole[]).map((role) => {
                        const has = userRoles.includes(role);
                        const key = `${u.id}:${role}`;
                        return (
                          <td key={role} className="px-3 py-3 text-center">
                            <button
                              disabled={busyKey === key}
                              onClick={() => toggleRole(u.id, role, has)}
                              className={
                                "px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors " +
                                (has
                                  ? "bg-primary text-on-primary border-primary hover:bg-primary-container"
                                  : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/40")
                              }
                              title={has ? `Revoke ${role}` : `Assign ${role}`}
                            >
                              {busyKey === key ? "…" : has ? "Granted" : "Assign"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-outline border-t border-outline-variant">
            Self role-grants are blocked at the database level. Every change is logged in <span className="font-mono">role_change_audit</span>.
          </p>
        </section>

        <section className="col-span-12 lg:col-span-4 bg-card border border-outline-variant rounded-lg p-6">
          <h2 className="text-lg font-semibold text-primary mb-1">Recent Role Audit</h2>
          <p className="text-xs text-on-surface-variant mb-4">Last 15 role changes</p>
          <div className="space-y-3">
            {auditQuery.isLoading && (
              <p className="text-sm text-on-surface-variant">Loading…</p>
            )}
            {!auditQuery.isLoading && (auditQuery.data ?? []).length === 0 && (
              <p className="text-sm text-on-surface-variant">No role changes recorded.</p>
            )}
            {(auditQuery.data ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 border border-outline-variant rounded-md">
                <Icon name="history" className="text-primary text-[18px] mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">
                    {a.action.toUpperCase()} · <span className="capitalize">{a.role}</span>
                  </p>
                  <p className="text-on-surface-variant font-mono">target {String(a.target_user_id).slice(0, 8)}…</p>
                  <p className="text-outline">{new Date(a.created_at as string).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: string }) {
  return (
    <div className="bg-card border border-outline-variant rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">{label}</span>
        <div className={"w-9 h-9 rounded-md flex items-center justify-center " + tone}>
          <Icon name={icon} fill className="text-[18px]" />
        </div>
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-xs mt-1 text-on-surface-variant">Live from database</p>
    </div>
  );
}