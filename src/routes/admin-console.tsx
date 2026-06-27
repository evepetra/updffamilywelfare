import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { adminListUsers, requireAdmin } from "@/lib/auth/roles.functions";
import { useAuth } from "@/hooks/use-auth";
import {
  buildMembersCsv,
  buildDisbursementsCsv,
  downloadCsv,
} from "@/lib/admin/service-filters";

type AppRole = "family" | "soldier" | "officer" | "admin" | "system_admin";
const ROLE_LABEL: Record<AppRole, string> = {
  family: "Family",
  soldier: "Soldier",
  officer: "Officer",
  admin: "Admin",
  system_admin: "Sys Admin",
};
type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  service_number: string | null;
  service: string | null;
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
  const auth = useAuth();
  // System Administrators have oversight but cannot disburse aid — only
  // Administrators move money out of the welfare account.
  const canDisburse = auth.isAdmin;
  const viewOnlyDisbursals = auth.isSystemAdmin && !auth.isAdmin;
  const disburseLockTooltip =
    "Locked for System Administrators. Only Administrators can release funds; system_admin disbursal writes are blocked at the database level (RLS).";
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created_at" | "service" | "full_name">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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
      const data = await adminListUsers();
      return (data ?? []) as AdminUserRow[];
    },
  });

  // ---- Pending Disbursals (approved requests awaiting administrator payout) ----
  type DisbursalRow = {
    id: string;
    title: string;
    request_type: string;
    amount_approved: number | null;
    user_id: string;
    updated_at: string;
    profiles: {
      full_name: string | null;
      service_number: string | null;
      service: string | null;
      payout_method: string | null;
      payout_provider: string | null;
      payout_account_name: string | null;
      payout_account_number: string | null;
    } | null;
  };
  const disbursalsQuery = useQuery({
    queryKey: ["pending-disbursals"],
    queryFn: async () => {
      const { data: reqs, error: rErr } = await supabase
        .from("support_requests")
        .select("id, title, request_type, amount_approved, user_id, updated_at")
        .eq("status", "approved")
        .order("updated_at", { ascending: true });
      if (rErr) throw rErr;
      const userIds = Array.from(new Set((reqs ?? []).map((r) => r.user_id)));
      let profilesById = new Map<string, DisbursalRow["profiles"]>();
      if (userIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, service_number, service, payout_method, payout_provider, payout_account_name, payout_account_number")
          .in("id", userIds);
        if (pErr) throw pErr;
        profilesById = new Map((profs ?? []).map((p) => [p.id, {
          full_name: p.full_name,
          service_number: p.service_number,
          service: p.service,
          payout_method: p.payout_method,
          payout_provider: p.payout_provider,
          payout_account_name: p.payout_account_name,
          payout_account_number: p.payout_account_number,
        }]));
      }
      return (reqs ?? []).map((r) => ({ ...r, profiles: profilesById.get(r.user_id) ?? null })) as DisbursalRow[];
    },
  });
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [disbursalError, setDisbursalError] = useState<string | null>(null);

  async function disburse(row: DisbursalRow) {
    setDisbursalError(null);
    const p = row.profiles;
    if (!p?.payout_account_number || !p?.payout_provider) {
      setDisbursalError(
        `Cannot disburse: ${p?.full_name ?? "recipient"} has no deposit account on file. Ask them to set one in their dashboard.`,
      );
      return;
    }
    const amt = row.amount_approved ?? 0;
    if (!amt || amt <= 0) {
      const raw = window.prompt("Enter amount to disburse (UGX):", "");
      if (raw == null) return;
      const parsed = Number(raw.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setDisbursalError("Invalid amount.");
        return;
      }
      row.amount_approved = parsed;
    }
    if (!window.confirm(
      `Disburse UGX ${(row.amount_approved ?? 0).toLocaleString()} to ${p.full_name} (${p.payout_provider} • ${p.payout_account_number})?`,
    )) return;
    const reason = window.prompt(
      "Reason / note for this disbursal (recorded in the audit log):",
      "",
    );
    if (reason == null) return;
    setDisbursingId(row.id);
    const { error: insErr } = await supabase.from("aid_ledger").insert({
      recipient_user_id: row.user_id,
      recipient_name: p.full_name ?? "Unknown",
      region: "—",
      request_id: row.id,
      aid_type: row.request_type,
      amount: row.amount_approved ?? 0,
      status: "disbursed",
      disbursed_at: new Date().toISOString(),
      reason: reason.trim() || null,
      payout_method: p.payout_method,
      payout_provider: p.payout_provider,
      payout_account_name: p.payout_account_name,
      payout_account_number: p.payout_account_number,
    });
    if (insErr) {
      setDisbursingId(null);
      setDisbursalError(insErr.message);
      return;
    }
    await supabase.from("support_requests").update({ status: "completed" }).eq("id", row.id);
    setDisbursingId(null);
    qc.invalidateQueries({ queryKey: ["pending-disbursals"] });
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-ledger"] });
    qc.invalidateQueries({ queryKey: ["ledger"] });
  }

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
    const matched = users.filter((u) => {
      if (serviceFilter !== "all" && (u.service ?? "") !== serviceFilter) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.service_number ?? "").toLowerCase().includes(q) ||
        (u.service ?? "").toLowerCase().includes(q)
      );
    });
    const sorted = [...matched].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "service") {
        return ((a.service ?? "").localeCompare(b.service ?? "")) * dir;
      }
      if (sortBy === "full_name") {
        return ((a.full_name ?? "").localeCompare(b.full_name ?? "")) * dir;
      }
      return (a.created_at < b.created_at ? 1 : -1) * dir;
    });
    return sorted;
  }, [users, search, serviceFilter, sortBy, sortDir]);

  function toggleSort(col: "created_at" | "service" | "full_name") {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const UPDF_SERVICES = ["Air Force", "SFC", "Land Force", "Reserve Force"] as const;

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

  const sysAdmins = users.filter((u) => u.roles?.includes("system_admin")).length;
  const admins = users.filter((u) => u.roles?.includes("admin")).length;
  const officers = users.filter((u) => u.roles?.includes("officer")).length;
  const soldiers = users.filter((u) => u.roles?.includes("soldier")).length;
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard label="System Admins" value={String(sysAdmins)} icon="verified_user" tone="bg-primary text-on-primary" />
        <KpiCard label="Administrators" value={String(admins)} icon="admin_panel_settings" tone="bg-primary text-on-primary" />
        <KpiCard label="Welfare Officers" value={String(officers)} icon="military_tech" tone="bg-secondary text-on-secondary" />
        <KpiCard label="Soldiers" value={String(soldiers)} icon="military_tech" tone="bg-tertiary text-on-tertiary" />
        <KpiCard label="Family Accounts" value={String(families)} icon="family_restroom" tone="bg-tertiary text-on-tertiary" />
      </div>

      {/* Pending Disbursals — administrator-only payouts */}
      <section className="mb-8 bg-card border-2 border-primary/30 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between bg-primary-fixed-dim/30">
          <div>
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Icon name="payments" fill className="text-[20px]" />
              Pending Disbursals
            </h2>
            <p className="text-xs text-on-surface-variant">
              Requests approved by welfare officers. Only administrators can release funds to recipient accounts.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary text-on-primary font-semibold">
            {disbursalsQuery.data?.length ?? 0} awaiting
          </span>
        </div>
        {viewOnlyDisbursals && (
          <div
            role="status"
            className="px-5 py-3 bg-primary-fixed-dim/60 border-b border-primary/30 text-xs flex items-start gap-2"
          >
            <Icon name="visibility" fill className="text-[16px] text-primary mt-0.5" />
            <p>
              <span className="font-semibold text-primary">View-only oversight: </span>
              You're signed in as System Administrator. Disburse is disabled and blocked at the
              database level — only Administrators can release funds.
            </p>
          </div>
        )}
        {disbursalError && (
          <div className="px-5 py-2 text-xs text-error bg-error-container/40 border-b border-error/30">
            {disbursalError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-5 py-3 text-left">Recipient</th>
                <th className="px-5 py-3 text-left">UPDF Service</th>
                <th className="px-5 py-3 text-left">Request</th>
                <th className="px-5 py-3 text-left">Amount (UGX)</th>
                <th className="px-5 py-3 text-left">Deposit account</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {disbursalsQuery.isLoading && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-on-surface-variant">Loading…</td></tr>
              )}
              {disbursalsQuery.data?.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-on-surface-variant">
                  Nothing to disburse. Approved requests will appear here.
                </td></tr>
              )}
              {disbursalsQuery.data?.map((row) => {
                const p = row.profiles;
                const hasAcc = !!(p?.payout_account_number && p?.payout_provider);
                return (
                  <tr key={row.id} className="hover:bg-surface-container/40">
                    <td className="px-5 py-3">
                      <div className="font-medium">{p?.full_name ?? "Unknown"}</div>
                      <div className="text-xs text-on-surface-variant font-mono">{p?.service_number ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {p?.service ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed-dim text-primary font-medium">
                          <Icon name="military_tech" className="text-[12px]" />
                          {p.service}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-on-surface-variant capitalize">{row.request_type}</div>
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {row.amount_approved ? row.amount_approved.toLocaleString() : <span className="text-on-surface-variant">— ask</span>}
                    </td>
                    <td className="px-5 py-3">
                      {hasAcc ? (
                        <div className="text-xs">
                          <div className="font-medium capitalize">{p?.payout_method === "mobile_money" ? "Mobile Money" : "Bank"} · {p?.payout_provider}</div>
                          <div className="font-mono text-on-surface-variant">{p?.payout_account_number}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-error">No account on file</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canDisburse ? (
                        <button
                          disabled={!hasAcc || disbursingId === row.id}
                          onClick={() => disburse(row)}
                          title={!hasAcc ? "Recipient has no deposit account on file" : "Release funds to recipient"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40"
                        >
                          <Icon name="send_money" className="text-[14px]" />
                          {disbursingId === row.id ? "Disbursing…" : "Disburse"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={disburseLockTooltip}
                          aria-label={"Disburse disabled. " + disburseLockTooltip}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-on-primary opacity-40 cursor-not-allowed"
                        >
                          <Icon name="lock" className="text-[14px]" />
                          Disburse
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 bg-card border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary">Role Assignment Toolkit</h2>
              <p className="text-xs text-on-surface-variant">
                Toggle Admin, Welfare Officer, or Family on any account. Users can hold multiple roles.
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, service # or UPDF service"
              className="px-3 py-2 text-sm bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary w-full md:w-64"
            />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              title="Filter by UPDF Service"
              className="px-3 py-2 text-sm bg-surface-container-low border border-outline-variant rounded-md focus:outline-none focus:border-primary"
            >
              <option value="all">All services</option>
              {UPDF_SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="">— Unassigned —</option>
            </select>
          </div>

          {selected.size > 0 && (
            <div className="px-5 py-3 bg-primary-fixed-dim/40 border-b border-outline-variant flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-primary mr-2">
                {selected.size} selected
              </span>
              {(["system_admin", "admin", "officer", "soldier", "family"] as AppRole[]).flatMap((r) => [
                <button
                  key={`g-${r}`}
                  disabled={bulkBusy}
                  onClick={() => bulkApply(r, "grant")}
                  className="px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-on-primary disabled:opacity-50"
                >Grant {ROLE_LABEL[r]}</button>,
                <button
                  key={`r-${r}`}
                  disabled={bulkBusy}
                  onClick={() => bulkApply(r, "revoke")}
                  className="px-2.5 py-1 rounded border border-error text-error hover:bg-error hover:text-on-error disabled:opacity-50"
                >Revoke {ROLE_LABEL[r]}</button>,
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
                  <th className="text-left px-5 py-3 font-medium">
                    <button onClick={() => toggleSort("full_name")} className="inline-flex items-center gap-1 hover:text-primary uppercase tracking-wider">
                      User
                      {sortBy === "full_name" && (
                        <Icon name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"} className="text-[12px]" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">
                    <button onClick={() => toggleSort("service")} className="inline-flex items-center gap-1 hover:text-primary uppercase tracking-wider">
                      UPDF Service
                      {sortBy === "service" && (
                        <Icon name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"} className="text-[12px]" />
                      )}
                    </button>
                  </th>
                  <th className="text-center px-3 py-3 font-medium">Sys Admin</th>
                  <th className="text-center px-3 py-3 font-medium">Admin</th>
                  <th className="text-center px-3 py-3 font-medium">Officer</th>
                  <th className="text-center px-3 py-3 font-medium">Soldier</th>
                  <th className="text-center px-3 py-3 font-medium">Family</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {usersQuery.isLoading && (
                  <tr><td colSpan={9} className="text-center py-8 text-on-surface-variant">Loading users…</td></tr>
                )}
                {usersQuery.error && !usersQuery.isLoading && (
                  <tr><td colSpan={9} className="text-center py-8 text-error">
                    {(usersQuery.error as Error).message}
                  </td></tr>
                )}
                {!usersQuery.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-on-surface-variant">No users match.</td></tr>
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
                      <td className="px-5 py-3 text-xs">
                        {u.service ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed-dim text-primary font-medium">
                            <Icon name="military_tech" className="text-[12px]" />
                            {u.service}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                      {(["system_admin", "admin", "officer", "soldier", "family"] as AppRole[]).map((role) => {
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
              <option value="system_admin">System Admin</option>
              <option value="admin">Admin</option>
              <option value="officer">Welfare Officer</option>
              <option value="soldier">Soldier</option>
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