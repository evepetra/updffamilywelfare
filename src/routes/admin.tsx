import { createFileRoute, Link } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { requireStaff } from "@/lib/auth/roles.functions";

function DocsCell({ requestId }: { requestId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["request-docs", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_documents")
        .select("id, file_path, file_name")
        .eq("request_id", requestId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [open, setOpen] = useState(false);
  if (isLoading) return <span className="text-xs text-on-surface-variant">…</span>;
  const docs = data ?? [];
  if (docs.length === 0) {
    return <span className="text-xs text-on-surface-variant">None</span>;
  }
  async function openDoc(path: string) {
    const { data, error } = await supabase.storage
      .from("support-documents")
      .createSignedUrl(path, 60);
    if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank");
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Icon name="description" className="text-[16px]" />
        {docs.length}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-card border border-outline-variant rounded-md shadow-lg p-2">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => openDoc(d.file_path)}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface-container flex items-center gap-2"
            >
              <Icon name="open_in_new" className="text-[14px] text-primary" />
              <span className="truncate">{d.file_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const res = await requireStaff();
      if (!res.authorized) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Officer Console | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Officer and administrator view of welfare requests, regional distribution, and personnel queues.",
      },
      { property: "og:title", content: "Officer Console | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Officer and administrator view of welfare requests, regional distribution, and personnel queues.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [pendingOnly, setPendingOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [auditOpen, setAuditOpen] = useState(false);
  const [ledgerFromDate, setLedgerFromDate] = useState("");
  const [ledgerToDate, setLedgerToDate] = useState("");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>("all");
  // System Administrators may VIEW the Welfare Officer console for oversight,
  // but they cannot approve, reject, or disburse aid — only officers/admins
  // can take action on requests.
  const isStaff = auth.isOfficer || auth.isAdmin || auth.isSystemAdmin;
  const canActOnRequests = auth.isOfficer || auth.isAdmin;
  const viewOnly = auth.isSystemAdmin && !auth.isOfficer && !auth.isAdmin;
  const lockTooltip =
    "Locked for System Administrators. Only Welfare Officers and Administrators can act on requests; system_admin holds oversight-only access enforced in the database (RLS).";

  const requestsQuery = useQuery({
    queryKey: ["admin-requests"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ledgerQuery = useQuery({
    queryKey: ["admin-ledger"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aid_ledger")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = requestsQuery.data ?? [];
  const ledger = ledgerQuery.data ?? [];

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (pendingOnly && r.status !== "pending" && r.status !== "verifying") return false;
      if (!q) return true;
      return (
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.request_type ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [requests, pendingOnly, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRequests = filteredRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const auditQuery = useQuery({
    queryKey: ["status-audit"],
    enabled: isStaff && auditOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_status_audit")
        .select("id, request_id, actor_id, old_status, new_status, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const total = ledger.reduce((s, l) => s + Number(l.amount || 0), 0);
    const pending = requests.filter((r) => r.status === "pending" || r.status === "verifying").length;
    return [
      { label: "Active Requests", value: String(requests.length), icon: "assignment", iconBg: "bg-primary text-on-primary" },
      { label: "Disbursed (UGX)", value: fmtCompactUGX(total), icon: "payments", iconBg: "bg-secondary text-on-secondary" },
      { label: "Pending Review", value: String(pending), icon: "pending_actions", iconBg: "bg-tertiary text-on-tertiary" },
      { label: "Ledger Entries", value: String(ledger.length), icon: "receipt_long", iconBg: "bg-primary-container text-on-primary" },
    ];
  }, [requests, ledger]);

  const regionStats = useMemo(() => {
    const byRegion: Record<string, number> = {};
    let max = 0;
    ledger.forEach((l) => {
      byRegion[l.region] = (byRegion[l.region] || 0) + Number(l.amount || 0);
      if (byRegion[l.region] > max) max = byRegion[l.region];
    });
    return Object.entries(byRegion)
      .map(([name, value]) => ({ name, percent: max ? Math.round((value / max) * 100) : 0, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [ledger]);

  async function updateStatus(
    id: string,
    status: string,
    extra?: { amount_approved?: number | null; decision_reason?: string | null },
  ) {
    await supabase
      .from("support_requests")
      .update({
        status,
        ...(extra && "amount_approved" in extra ? { amount_approved: extra.amount_approved } : {}),
        ...(extra && "decision_reason" in extra ? { decision_reason: extra.decision_reason } : {}),
      })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["status-audit"] });
    qc.invalidateQueries({ queryKey: ["pending-disbursals"] });
  }

  async function approveWithAmount(id: string) {
    const raw = window.prompt(
      "Enter approved aid amount in UGX (the administrator will disburse it):",
      "",
    );
    if (raw == null) return;
    const amt = Number(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      window.alert("Please enter a valid positive amount.");
      return;
    }
    const reason = window.prompt(
      "Reason / note for this approval (recorded in the audit log):",
      "",
    );
    if (reason == null) return;
    await updateStatus(id, "approved", { amount_approved: amt, decision_reason: reason });
  }

  async function rejectWithReason(id: string) {
    const reason = window.prompt(
      "Reason for rejecting this request (required, recorded in the audit log):",
      "",
    );
    if (reason == null) return;
    if (!reason.trim()) {
      window.alert("A rejection reason is required.");
      return;
    }
    await updateStatus(id, "rejected", { decision_reason: reason.trim() });
  }

  if (auth.loading) return null;
  if (!isStaff) {
    return (
      <AppShell title="Officer Management Console" subtitle="Restricted area">
        <div className="bg-card border border-outline-variant rounded-lg p-10 text-center">
          <Icon name="lock" fill className="text-5xl text-outline mb-3" />
          <h2 className="text-lg font-semibold text-primary mb-1">Officer access required</h2>
          <p className="text-sm text-on-surface-variant mb-5">
            This console is restricted to welfare officers and administrators. Contact your welfare directorate to be promoted.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Officer Management Console"
      subtitle="Regional welfare distribution, pending verifications and personnel oversight."
      actions={
        <>
          <Link
            to="/ledger"
            className="inline-flex items-center gap-2 border border-outline-variant px-4 py-2.5 rounded-md text-sm font-medium hover:bg-surface-container"
          >
            <Icon name="receipt_long" className="text-[18px]" />
            Open Ledger
          </Link>
          {auth.isAdmin && (
            <Link
              to="/admin-console"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container"
            >
              <Icon name="payments" className="text-[18px]" />
              Disbursal Console
            </Link>
          )}
        </>
      }
    >
      {viewOnly && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-lg border border-primary/40 bg-primary-fixed-dim/50 px-4 py-3 text-sm"
        >
          <Icon name="visibility" fill className="text-[20px] text-primary mt-0.5" />
          <div>
            <p className="font-semibold text-primary">View-only oversight mode</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              You are signed in as a <span className="font-semibold">System Administrator</span>.
              Approve, Reject and Disburse actions are disabled — these are reserved for
              Welfare Officers and Administrators and are also blocked at the database level (RLS)
              for system_admin accounts.
            </p>
          </div>
        </div>
      )}
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-card border border-outline-variant rounded-lg p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">
                {k.label}
              </span>
              <div
                className={
                  "w-9 h-9 rounded-md flex items-center justify-center " + k.iconBg
                }
              >
                <Icon name={k.icon} fill className="text-[18px]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-primary">{k.value}</p>
            <p className="text-xs mt-1 text-on-surface-variant">Live from database</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 bg-card border border-outline-variant rounded-lg p-6">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-lg font-semibold text-primary">Disbursals by Aid Type</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">All time · live</p>
            </div>
          </div>
          <AidTypeChart ledger={ledger} />
        </section>

        {/* Regional breakdown */}
        <section className="col-span-12 lg:col-span-4 bg-card border border-outline-variant rounded-lg p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">
            Regional Breakdown
          </h2>
          <div className="space-y-4">
            {regionStats.length === 0 && (
              <p className="text-sm text-on-surface-variant">No disbursal data yet.</p>
            )}
            {regionStats.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-on-surface-variant">{fmtCompactUGX(r.value)}</span>
                </div>
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: r.percent + "%" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pending requests queue */}
        <section className="col-span-12 bg-card border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex flex-wrap gap-3 justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-primary">Request Queue</h2>
              <p className="text-xs text-on-surface-variant">
                {filteredRequests.length} shown · {requests.length} total
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Icon
                  name="search"
                  className="text-[16px] absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search title, type, ID…"
                  className="pl-7 pr-3 py-2 text-xs border border-outline-variant rounded-md bg-surface-container-low w-56"
                />
              </div>
              <button
                onClick={() => {
                  setPendingOnly((p) => !p);
                  setPage(1);
                }}
                className={
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border " +
                  (pendingOnly
                    ? "bg-primary text-on-primary border-primary"
                    : "border-outline-variant hover:bg-surface-container")
                }
              >
                <Icon name="pending_actions" className="text-[14px]" />
                Pending only
              </button>
              <button
                onClick={() => setAuditOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-outline-variant hover:bg-surface-container"
              >
                <Icon name="history" className="text-[14px]" />
                {auditOpen ? "Hide audit" : "View audit"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Title</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Urgency</th>
                  <th className="text-left px-5 py-3 font-medium">Submitted</th>
                  <th className="text-left px-5 py-3 font-medium">Docs</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {requestsQuery.isLoading && (
                  <tr><td colSpan={7} className="text-center py-10 text-on-surface-variant text-sm">Loading…</td></tr>
                )}
                {!requestsQuery.isLoading && filteredRequests.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-on-surface-variant text-sm">No requests match the current filter.</td></tr>
                )}
                {pagedRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-bright">
                    <td className="px-5 py-4">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-outline">#{r.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="px-5 py-4">{r.request_type}</td>
                    <td className="px-5 py-4 capitalize">{r.urgency}</td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <DocsCell requestId={r.id} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {canActOnRequests ? (
                          <>
                            <button
                              onClick={() => approveWithAmount(r.id)}
                              disabled={r.status === "approved" || r.status === "completed"}
                              title="Approve this request and set the aid amount"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40"
                            >
                              <Icon name="check" className="text-[14px]" />
                              Approve
                            </button>
                            <button
                              onClick={() => rejectWithReason(r.id)}
                              disabled={r.status === "rejected"}
                              title="Reject this request"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-error text-error hover:bg-red-50 disabled:opacity-40"
                            >
                              <Icon name="close" className="text-[14px]" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              disabled
                              title={lockTooltip}
                              aria-label={"Approve disabled. " + lockTooltip}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-primary text-on-primary opacity-40 cursor-not-allowed"
                            >
                              <Icon name="lock" className="text-[14px]" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled
                              title={lockTooltip}
                              aria-label={"Reject disabled. " + lockTooltip}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-error text-error opacity-40 cursor-not-allowed"
                            >
                              <Icon name="lock" className="text-[14px]" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant text-xs text-on-surface-variant">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded border border-outline-variant hover:bg-surface-container disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded border border-outline-variant hover:bg-surface-container disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {auditOpen && (
          <section className="col-span-12 bg-card border border-outline-variant rounded-lg overflow-hidden">
            <div className="p-5 border-b border-outline-variant">
              <h2 className="text-lg font-semibold text-primary">Status Change Audit</h2>
              <p className="text-xs text-on-surface-variant">
                Most recent 100 approvals, rejections and status updates.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">When</th>
                    <th className="text-left px-5 py-3 font-medium">Request</th>
                    <th className="text-left px-5 py-3 font-medium">From</th>
                    <th className="text-left px-5 py-3 font-medium">To</th>
                    <th className="text-left px-5 py-3 font-medium">Reason</th>
                    <th className="text-left px-5 py-3 font-medium">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {auditQuery.isLoading && (
                    <tr><td colSpan={6} className="text-center py-8 text-on-surface-variant text-sm">Loading…</td></tr>
                  )}
                  {auditQuery.data?.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-on-surface-variant text-sm">No audit entries yet.</td></tr>
                  )}
                  {(auditQuery.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">#{a.request_id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-5 py-3 capitalize">{a.old_status ?? "—"}</td>
                      <td className="px-5 py-3"><StatusPill status={a.new_status} /></td>
                      <td className="px-5 py-3 text-xs text-on-surface-variant max-w-[24ch] truncate" title={a.reason ?? ""}>
                        {a.reason ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-on-surface-variant">
                        {a.actor_id ? a.actor_id.slice(0, 8) : "system"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Disbursed Aid Report — read-only ledger view for the welfare officer */}
        <section className="col-span-12 bg-card border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <Icon name="payments" fill className="text-[20px]" />
                Disbursed Aid Report
              </h2>
              <p className="text-xs text-on-surface-variant">
                {ledger.filter((l) => l.status === "disbursed").length} disbursals · {fmtCompactUGX(
                  ledger.filter((l) => l.status === "disbursed").reduce((s, l) => s + Number(l.amount || 0), 0),
                )} released
              </p>
            </div>
            <Link
              to="/ledger"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-outline-variant hover:bg-surface-container"
            >
              <Icon name="open_in_new" className="text-[14px]" />
              Open full ledger
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Recipient</th>
                  <th className="text-left px-5 py-3 font-medium">Region</th>
                  <th className="text-left px-5 py-3 font-medium">Aid Type</th>
                  <th className="text-right px-5 py-3 font-medium">Amount (UGX)</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {ledgerQuery.isLoading && (
                  <tr><td colSpan={6} className="text-center py-8 text-on-surface-variant text-sm">Loading…</td></tr>
                )}
                {!ledgerQuery.isLoading && ledger.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-on-surface-variant text-sm">No disbursals recorded yet.</td></tr>
                )}
                {ledger.slice(0, 25).map((l) => (
                  <tr key={l.id} className="hover:bg-surface-bright">
                    <td className="px-5 py-3 text-on-surface-variant whitespace-nowrap">
                      {new Date(l.disbursed_at ?? l.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-medium">{l.recipient_name}</td>
                    <td className="px-5 py-3">{l.region}</td>
                    <td className="px-5 py-3">{l.aid_type}</td>
                    <td className="px-5 py-3 text-right font-mono">
                      {Number(l.amount || 0).toLocaleString("en-UG")}
                    </td>
                    <td className="px-5 py-3"><StatusPill status={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

    </AppShell>
  );
}

function AidTypeChart({ ledger }: { ledger: { aid_type: string; amount: number | string }[] }) {
  const totals: Record<string, number> = {};
  ledger.forEach((l) => {
    totals[l.aid_type] = (totals[l.aid_type] || 0) + Number(l.amount || 0);
  });
  const entries = Object.entries(totals);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant py-10 text-center">
        No disbursals recorded yet. Use <span className="font-semibold">Record Disbursal</span> to add the first one.
      </p>
    );
  }
  return (
    <div className="flex items-end gap-3 h-56">
      {entries.map(([type, value]) => (
        <div key={type} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-xs font-semibold text-primary">{fmtCompactUGX(value)}</span>
          <div
            className="w-full bg-primary rounded-t-sm"
            style={{ height: Math.max(8, (value / max) * 100) + "%" }}
          />
          <span className="text-xs text-on-surface-variant truncate w-full text-center">{type}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-secondary-container text-on-secondary-container",
    verifying: "bg-secondary-container text-on-secondary-container",
    approved: "bg-primary-fixed-dim text-primary",
    completed: "bg-primary-fixed-dim text-primary",
    rejected: "bg-red-100 text-error",
  };
  const cls = map[status] || "bg-surface-container text-on-surface-variant";
  return (
    <span className={"px-2.5 py-1 rounded-full text-xs font-medium capitalize " + cls}>
      {status}
    </span>
  );
}

function fmtCompactUGX(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M UGX";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K UGX";
  return n.toLocaleString("en-UG") + " UGX";
}

function RecordDisbursalDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [recipientUserId, setRecipientUserId] = useState("");
  const [region, setRegion] = useState("Central");
  const [aidType, setAidType] = useState("Medical");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("disbursed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("aid_ledger").insert({
      recipient_name: recipientName.trim(),
      recipient_user_id: recipientUserId.trim(),
      region,
      aid_type: aidType,
      amount: Number(amount) || 0,
      status,
      disbursed_at: status === "disbursed" ? new Date().toISOString() : null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg max-w-md w-full p-6 border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-primary mb-1">Record Disbursal</h3>
        <p className="text-xs text-on-surface-variant mb-5">
          Add an entry to the official aid ledger.
        </p>
        <div className="space-y-3">
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Recipient name"
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
          />
          <input
            value={recipientUserId}
            onChange={(e) => setRecipientUserId(e.target.value)}
            placeholder="Recipient user ID (UUID)"
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm">
              {["Central", "Western", "Northern", "Eastern", "West Nile"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <select value={aidType} onChange={(e) => setAidType(e.target.value)} className="px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm">
              {["Financial", "Food", "Medical", "Education"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (UGX)"
            className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disbursed">Disbursed</option>
          </select>
          {err && <p className="text-sm text-error">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-outline-variant rounded-md hover:bg-surface-container">
            Cancel
          </button>
          <button
            disabled={busy || !recipientName || !recipientUserId || !amount}
            onClick={save}
            className="px-5 py-2.5 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}