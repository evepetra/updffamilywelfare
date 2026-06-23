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

type AuditRow = {
  id: string;
  actor_id: string | null;
  target_user_id: string;
  role: AppRole;
  action: string;
  created_at: string;
};

export const Route = createFileRoute("/admin-console")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const res = await requireAdmin();
      if (!res.authorized) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [auditUserFilter, setAuditUserFilter] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState<"all" | AppRole>("all");
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_PAGE_SIZE = 50;

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
    queryKey: ["admin-role-audit", auditPage, auditRoleFilter],
    queryFn: async () => {
      let q = supabase
        .from("role_change_audit")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(auditPage * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE - 1);
      if (auditRoleFilter !== "all") q = q.eq("role", auditRoleFilter);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
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

  const filteredAudit = useMemo(() => {
    const list = auditQuery.data?.rows ?? [];
    const q = auditUserFilter.trim().toLowerCase();
    return list.filter((a) => {
      if (auditRoleFilter !== "all" && a.role !== auditRoleFilter) return false;
      if (q) {
        const u = users.find((u) => u.id === a.target_user_id);
        const hay = [a.target_user_id, u?.email ?? "", u?.full_name ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditQuery.data, auditUserFilter, auditRoleFilter, users]);

  const auditTotal = auditQuery.data?.count ?? 0;
  const auditPageCount = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));

  function exportAuditCsv() {
    const rows = filteredAudit;
    const header = ["created_at", "action", "role", "target_user_id", "target_email", "actor_id"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const a of rows) {
      const u = users.find((u) => u.id === a.target_user_id);
      lines.push([
        a.created_at, a.action, a.role, a.target_user_id, u?.email ?? "", a.actor_id ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `role-change-audit-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const admins = users.filter((u) => u.roles?.includes("admin")).length;
  const officers = users.filter((u) => u.roles?.includes("officer")).length;
  const families = users.filter((u) => u.roles?.includes("family")).length;

  async function toggleRole(userId: string, role: AppRole, has: boolean) {
    const key = `${userId}:${role}`;
    const verb = has ? "REVOKE" : "GRANT";
    if (!window.confirm(`${verb} ${role.toUpperCase()} for this user?\n\nThis change is audited.`)) return;
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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkApply(role: AppRole, action: "grant" | "revoke") {
    if (selected.size === 0) return;
    const verb = action === "grant" ? "GRANT" : "REVOKE";
    if (!window.confirm(
      `${verb} role "${role}" for ${selected.size} selected user(s)?\n\nThis cannot be undone (changes are audited).`,
    )) return;
    setBulkBusy(true);
    setActionError(null);
    const ids = Array.from(selected);
    const failures: string[] = [];
    try {
      for (const uid of ids) {
        const u = users.find((x) => x.id === uid);
        const has = !!u?.roles?.includes(role);
        if (action === "grant" && !has) {
          const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
          if (error) failures.push(`${u?.email ?? uid}: ${error.message}`);
        } else if (action === "revoke" && has) {
          const { error } = await supabase
            .from("user_roles").delete().eq("user_id", uid).eq("role", role);
          if (error) failures.push(`${u?.email ?? uid}: ${error.message}`);
        }
      }
      if (failures.length) setActionError(`${failures.length} failure(s): ${failures.slice(0, 3).join("; ")}`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      await qc.invalidateQueries({ queryKey: ["admin-role-audit"] });
    } finally {
      setBulkBusy(false);
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

          {selected.size > 0 && (
            <div className="px-5 py-3 bg-primary-fixed-dim/40 border-b border-outline-variant flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-primary mr-2">
                {selected.size} selected
              </span>
              {(["admin", "officer", "family"] as AppRole[]).flatMap((r) => [
                <button
                  key={`g-${r}`}
                  disabled={bulkBusy}
                  onClick={() => bulkApply(r, "grant")}
                  className="px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
                >Grant {r}</button>,
                <button
                  key={`r-${r}`}
                  disabled={bulkBusy}
                  onClick={() => bulkApply(r, "revoke")}
                  className="px-2.5 py-1 rounded border border-error text-error hover:bg-error hover:text-on-error disabled:opacity-50"
                >Revoke {r}</button>,
              ])}
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto text-on-surface-variant hover:text-primary"
              >Clear selection</button>
            </div>
          )}

          {actionError && (
            <div className="px-5 py-2 text-xs text-error bg-error-container/40 border-b border-error/30">
              {actionError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filtered.length > 0 && filtered.every((u) => selected.has(u.id))}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) filtered.forEach((u) => next.add(u.id));
                          else filtered.forEach((u) => next.delete(u.id));
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-center px-3 py-3 font-medium">Admin</th>
                  <th className="text-center px-3 py-3 font-medium">Soldier</th>
                  <th className="text-center px-3 py-3 font-medium">Family</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {usersQuery.isLoading && (
                  <tr><td colSpan={6} className="text-center py-8 text-on-surface-variant">Loading users…</td></tr>
                )}
                {usersQuery.error && !usersQuery.isLoading && (
                  <tr><td colSpan={6} className="text-center py-8 text-error">
                    {(usersQuery.error as Error).message}
                  </td></tr>
                )}
                {!usersQuery.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-on-surface-variant">No users match.</td></tr>
                )}
                {filtered.map((u) => {
                  const userRoles = u.roles ?? [];
                  return (
                    <tr key={u.id} className="hover:bg-surface-bright align-middle">
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${u.email ?? u.id}`}
                          checked={selected.has(u.id)}
                          onChange={() => toggleSelected(u.id)}
                        />
                      </td>
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
          <div className="flex items-start justify-between mb-1 gap-2">
            <h2 className="text-lg font-semibold text-primary">Role Change Audit</h2>
            <button
              onClick={exportAuditCsv}
              disabled={filteredAudit.length === 0}
              className="text-xs px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-on-primary disabled:opacity-40"
              title="Export filtered results to CSV"
            >Export CSV</button>
          </div>
          <p className="text-xs text-on-surface-variant mb-3">Filter by user (email / name / id) or role.</p>
          <div className="flex flex-col gap-2 mb-4">
            <input
              value={auditUserFilter}
              onChange={(e) => setAuditUserFilter(e.target.value)}
              placeholder="Filter by user…"
              className="px-3 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary"
            />
            <select
              value={auditRoleFilter}
              onChange={(e) => { setAuditRoleFilter(e.target.value as "all" | AppRole); setAuditPage(0); }}
              className="px-3 py-2 text-xs bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="officer">Soldier (officer)</option>
              <option value="family">Family</option>
            </select>
          </div>
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {auditQuery.isLoading && (
              <p className="text-sm text-on-surface-variant">Loading…</p>
            )}
            {!auditQuery.isLoading && filteredAudit.length === 0 && (
              <p className="text-sm text-on-surface-variant">No matching role changes.</p>
            )}
            {filteredAudit.map((a) => {
              const target = users.find((u) => u.id === a.target_user_id);
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 border border-outline-variant rounded-md">
                  <Icon name="history" className="text-primary text-[18px] mt-0.5" />
                  <div className="text-xs flex-1">
                    <p className="font-medium">
                      {a.action.toUpperCase()} · <span className="capitalize">{a.role}</span>
                    </p>
                    <p className="text-on-surface-variant">
                      {target?.email ?? <span className="font-mono">{String(a.target_user_id).slice(0, 8)}…</span>}
                    </p>
                    <p className="text-outline">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              Page {auditPage + 1} of {auditPageCount} · {auditTotal} total
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                disabled={auditPage === 0}
                className="px-2 py-1 rounded border border-outline-variant hover:border-primary disabled:opacity-40"
              >Prev</button>
              <button
                onClick={() => setAuditPage((p) => Math.min(auditPageCount - 1, p + 1))}
                disabled={auditPage >= auditPageCount - 1}
                className="px-2 py-1 rounded border border-outline-variant hover:border-primary disabled:opacity-40"
              >Next</button>
            </div>
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