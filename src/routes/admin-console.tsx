import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/lib/auth/roles.functions";

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
  const rolesQuery = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  const roles = rolesQuery.data ?? [];
  const officers = roles.filter((r) => r.role === "officer").length;
  const admins = roles.filter((r) => r.role === "admin").length;
  const families = roles.filter((r) => r.role === "family").length;

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
        <section className="col-span-12 lg:col-span-7 bg-card border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-5 border-b border-outline-variant">
            <h2 className="text-lg font-semibold text-primary">Role Assignments</h2>
            <p className="text-xs text-on-surface-variant">{roles.length} total entries · most recent first</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-left px-5 py-3 font-medium">Granted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {rolesQuery.isLoading && (
                  <tr><td colSpan={3} className="text-center py-8 text-on-surface-variant">Loading…</td></tr>
                )}
                {!rolesQuery.isLoading && roles.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-on-surface-variant">No role assignments yet.</td></tr>
                )}
                {roles.slice(0, 25).map((r) => (
                  <tr key={`${r.user_id}-${r.role}`} className="hover:bg-surface-bright">
                    <td className="px-5 py-3 font-mono text-xs">{r.user_id.slice(0, 8)}…</td>
                    <td className="px-5 py-3 capitalize">{r.role}</td>
                    <td className="px-5 py-3 text-on-surface-variant">
                      {new Date(r.created_at as string).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 bg-card border border-outline-variant rounded-lg p-6">
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