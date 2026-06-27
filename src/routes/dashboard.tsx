import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Family Dashboard | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Monitor the status of your family welfare requests, aid disbursals, and institutional notifications.",
      },
      { property: "og:title", content: "Family Dashboard | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Monitor the status of your family welfare requests, aid disbursals, and institutional notifications.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamilyDashboard,
});

function FamilyDashboard() {
  const { user, profile, isSoldier } = useAuth();
  const qc = useQueryClient();

  const payoutQuery = useQuery({
    queryKey: ["my-payout", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("payout_method, payout_provider, payout_account_name, payout_account_number")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: !!user,
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
    queryKey: ["my-ledger", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aid_ledger")
        .select("*")
        .eq("recipient_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = requestsQuery.data ?? [];
  const ledger = ledgerQuery.data ?? [];
  const active = requests.find((r) => r.status === "pending" || r.status === "verifying" || r.status === "approved");
  const totalDisbursed = ledger
    .filter((l) => l.status === "disbursed")
    .reduce((s, l) => s + Number(l.amount || 0), 0);
  const approvedCount = ledger.filter((l) => l.status === "disbursed").length;
  const firstName = (profile?.full_name || "").split(" ")[0] || "there";

  return (
    <AppShell
      title={`Welcome back, ${firstName}`}
      subtitle="Your family welfare status is secure and monitored."
      actions={
        <Link
          to="/support"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container"
        >
          <Icon name="add" className="text-[18px]" />
          New Support Request
        </Link>
      }
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Identity card — visible to every member; shows the UPDF service a soldier is under */}
        <section className="col-span-12 bg-card rounded-lg border border-outline-variant p-6">
          <ProfileDetailsCard
            userId={user?.id ?? ""}
            isSoldier={isSoldier}
            email={user?.email}
            initial={profile}
            onSaved={() => qc.invalidateQueries({ queryKey: ["my-payout"] })}
          />
        </section>

        {/* Soldier relationship — captured from family members (and editable by soldiers too) */}
        <section className="col-span-12 bg-card rounded-lg border border-outline-variant p-6">
          <SoldierRelationshipCard userId={user?.id ?? ""} />
        </section>

        <section className="col-span-12 bg-card rounded-lg border border-outline-variant border-l-4 border-l-primary p-6">
          <PayoutAccountCard
            userId={user?.id ?? ""}
            initial={payoutQuery.data ?? null}
            onSaved={() => qc.invalidateQueries({ queryKey: ["my-payout"] })}
          />
        </section>

        {/* Active aid request */}
        <section className="col-span-12 lg:col-span-8 bg-card rounded-lg border border-outline-variant border-l-4 border-l-secondary p-6">
          <div className="flex justify-between items-start mb-6 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-primary">
                Active Aid Request
              </h2>
              <p className="text-xs text-outline mt-0.5">
                {active ? `Application ID · #${active.id.slice(0, 8).toUpperCase()}` : "No active request"}
              </p>
            </div>
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
              {active ? statusLabel(active.status) : "—"}
            </span>
          </div>
          {active ? (
            <>
              <p className="text-sm text-on-surface mb-3">
                <span className="font-semibold">{active.title}</span> — {active.request_type} ({active.urgency})
              </p>
              <div className="flex justify-between text-xs mb-2 text-on-surface-variant">
                <span>Verification Progress</span>
                <span>Step {progressStep(active.status)} of 4</span>
              </div>
              <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden flex mb-3">
                <div className={"bg-primary h-full border-r border-card " + widthFor(progressStep(active.status), 1)} />
                <div className={"bg-secondary h-full border-r border-card " + widthFor(progressStep(active.status), 2)} />
                <div className={"bg-primary/70 h-full border-r border-card " + widthFor(progressStep(active.status), 3)} />
                <div className={"bg-primary h-full " + widthFor(progressStep(active.status), 4)} />
              </div>
              <div className="grid grid-cols-4 text-center text-xs">
                <span className="text-primary font-semibold">Submitted</span>
                <span className={progressStep(active.status) >= 2 ? "text-secondary font-semibold" : "text-outline"}>Verifying</span>
                <span className={progressStep(active.status) >= 3 ? "text-primary font-semibold" : "text-outline"}>Approval</span>
                <span className={progressStep(active.status) >= 4 ? "text-primary font-semibold" : "text-outline"}>Disbursal</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant py-6 text-center">
              You have no active aid requests. <Link to="/support" className="text-primary underline">Submit a new request</Link>.
            </p>
          )}
          <div className="mt-6 flex gap-2">
            <Link
              to="/ledger"
              className="border border-primary text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-surface-container"
            >
              View Details
            </Link>
            <Link
              to="/support"
              className="text-primary px-4 py-2 rounded-md text-sm font-medium hover:bg-surface-container"
            >
              Update Documents
            </Link>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4 bg-card rounded-lg border border-outline-variant p-6 flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-widest text-primary font-semibold mb-1">
            Quick Actions
          </h2>
          <QuickAction icon="add_box" title="Start New Request" desc="Educational or medical aid" to="/support" />
          <QuickAction icon="fact_check" title="Check Eligibility" desc="Update your family profile" color="secondary" to="/support" />
          <QuickAction icon="help" title="Welfare Guidance" desc="Contact assigned officer" color="tertiary" to="/support" />
        </section>

        <section className="col-span-12 lg:col-span-6 bg-card rounded-lg border border-outline-variant overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-lg font-semibold text-primary">Recent Requests</h2>
            <Icon name="more_vert" className="text-outline" />
          </div>
          <div className="divide-y divide-outline-variant">
            {requestsQuery.isLoading && (
              <p className="p-4 text-sm text-on-surface-variant">Loading…</p>
            )}
            {!requestsQuery.isLoading && requests.length === 0 && (
              <p className="p-4 text-sm text-on-surface-variant">No requests yet.</p>
            )}
            {requests.slice(0, 4).map((r) => (
              <div key={r.id} className="p-4 flex gap-3 hover:bg-surface-bright">
                <Icon name="assignment" className="text-[22px] text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface truncate">{r.title}</p>
                  <p className="text-sm text-on-surface-variant line-clamp-1">
                    {r.request_type} · {r.urgency}
                  </p>
                  <p className="text-xs text-outline mt-1">
                    {statusLabel(r.status)} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/support"
            className="block text-center w-full p-3 text-sm font-medium text-primary hover:bg-surface-container border-t border-outline-variant"
          >
            Submit New Request
          </Link>
        </section>

        <section className="col-span-12 lg:col-span-6 bg-card rounded-lg border border-outline-variant overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-lg font-semibold text-primary">Support Summary</h2>
            <Icon name="history" className="text-outline" />
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Stat label="Total Disbursed" value={fmtUGX(totalDisbursed)} />
              <Stat label="Items Approved" value={String(approvedCount).padStart(2, "0")} />
            </div>
            <h3 className="text-xs uppercase tracking-wider text-on-surface-variant mb-3 font-medium">
              Recent History
            </h3>
            <div className="space-y-2">
              {ledger.length === 0 && (
                <p className="text-sm text-on-surface-variant">No disbursals yet.</p>
              )}
              {ledger.slice(0, 4).map((h) => (
                <div
                  key={h.id}
                  className="flex justify-between items-center px-3 py-2.5 border border-outline-variant rounded-md hover:bg-surface-bright"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">{h.aid_type}</span>
                  </div>
                  <span className="text-sm font-semibold">{fmtUGX(Number(h.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function fmtUGX(n: number) {
  return n.toLocaleString("en-UG") + " UGX";
}
function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function progressStep(s: string) {
  if (s === "pending") return 1;
  if (s === "verifying") return 2;
  if (s === "approved") return 3;
  if (s === "disbursed" || s === "completed") return 4;
  return 1;
}
function widthFor(current: number, slot: number) {
  return current >= slot ? "w-1/4" : "w-0";
}

function QuickAction({
  icon,
  title,
  desc,
  to,
  color = "primary",
}: {
  icon: string;
  title: string;
  desc: string;
  to: string;
  color?: "primary" | "secondary" | "tertiary";
}) {
  const colorMap = {
    primary: "bg-primary text-on-primary",
    secondary: "bg-secondary text-on-secondary",
    tertiary: "bg-tertiary text-on-tertiary",
  };
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 bg-surface-container-low hover:bg-surface-container rounded-md text-left"
    >
      <div className={"w-10 h-10 rounded-md flex items-center justify-center " + colorMap[color]}>
        <Icon name={icon} className="text-[20px]" />
      </div>
      <div>
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant">{desc}</p>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-surface-container-low rounded-md">
      <p className="text-[10px] uppercase tracking-wider text-outline mb-1 font-medium">
        {label}
      </p>
      <p className="text-xl font-bold text-primary">{value}</p>
    </div>
  );
}

type PayoutInfo = {
  payout_method: string | null;
  payout_provider: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
} | null;

function PayoutAccountCard({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: PayoutInfo;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<string>(initial?.payout_method ?? "bank");
  const [provider, setProvider] = useState<string>(initial?.payout_provider ?? "");
  const [accName, setAccName] = useState<string>(initial?.payout_account_name ?? "");
  const [accNum, setAccNum] = useState<string>(initial?.payout_account_number ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMethod(initial?.payout_method ?? "bank");
    setProvider(initial?.payout_provider ?? "");
    setAccName(initial?.payout_account_name ?? "");
    setAccNum(initial?.payout_account_number ?? "");
  }, [initial]);

  const hasAccount = !!(initial?.payout_account_number && initial?.payout_provider);

  async function save() {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        payout_method: method,
        payout_provider: provider.trim() || null,
        payout_account_name: accName.trim() || null,
        payout_account_number: accNum.trim() || null,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(false);
    onSaved();
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
            <Icon name="account_balance" fill className="text-[22px]" />
            Aid Deposit Account
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Approved aid is deposited to this account by the administrator.
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary border border-primary px-3 py-1.5 rounded-md hover:bg-primary hover:text-on-primary"
          >
            <Icon name={hasAccount ? "edit" : "add"} className="text-[16px]" />
            {hasAccount ? "Update" : "Add account"}
          </button>
        )}
      </div>
      {!editing ? (
        hasAccount ? (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Method" value={initial?.payout_method === "mobile_money" ? "Mobile Money" : "Bank"} />
            <Field label={initial?.payout_method === "mobile_money" ? "Carrier" : "Bank"} value={initial?.payout_provider ?? "—"} />
            <Field label="Account name" value={initial?.payout_account_name ?? "—"} />
            <Field label="Account number" value={initial?.payout_account_number ?? "—"} mono />
          </dl>
        ) : (
          <p className="text-sm text-on-surface-variant">
            No deposit account on file. Add one so welfare aid can be transferred to you.
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Method</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            >
              <option value="bank">Bank account</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">
              {method === "mobile_money" ? "Carrier (MTN, Airtel…)" : "Bank name"}
            </span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Account name</span>
            <input
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">
              {method === "mobile_money" ? "Mobile number" : "Account number"}
            </span>
            <input
              value={accNum}
              onChange={(e) => setAccNum(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            />
          </label>
          {err && <p className="md:col-span-2 text-sm text-error">{err}</p>}
          <div className="md:col-span-2 flex justify-end gap-2 mt-1">
            <button
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-4 py-2 text-sm border border-outline-variant rounded-md hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SoldierRelationshipCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-relationship", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "relationship_to_soldier, related_soldier_full_name, related_soldier_service_number, related_soldier_rank, related_soldier_service",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const initial = q.data;
  const [editing, setEditing] = useState(false);
  const [rel, setRel] = useState("");
  const [name, setName] = useState("");
  const [svcNum, setSvcNum] = useState("");
  const [rnk, setRnk] = useState("");
  const [svc, setSvc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRel(initial?.relationship_to_soldier ?? "");
    setName(initial?.related_soldier_full_name ?? "");
    setSvcNum(initial?.related_soldier_service_number ?? "");
    setRnk(initial?.related_soldier_rank ?? "");
    setSvc(initial?.related_soldier_service ?? "");
  }, [initial]);

  const hasData = !!(initial?.relationship_to_soldier || initial?.related_soldier_full_name);

  async function save() {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        relationship_to_soldier: rel || null,
        related_soldier_full_name: name.trim() || null,
        related_soldier_service_number: svcNum.trim().toUpperCase() || null,
        related_soldier_rank: rnk || null,
        related_soldier_service: svc || null,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["my-relationship", userId] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
            <Icon name="diversity_3" fill className="text-[22px]" />
            Soldier Relationship Details
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Details of the soldier you are related to (used to verify welfare eligibility).
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary border border-primary px-3 py-1.5 rounded-md hover:bg-primary hover:text-on-primary"
          >
            <Icon name={hasData ? "edit" : "add"} className="text-[16px]" />
            {hasData ? "Update" : "Add details"}
          </button>
        )}
      </div>
      {!editing ? (
        hasData ? (
          <dl className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <Field label="Relationship" value={initial?.relationship_to_soldier || "—"} />
            <Field label="Soldier's Full Name" value={initial?.related_soldier_full_name || "—"} />
            <Field label="Service Number" value={initial?.related_soldier_service_number || "—"} mono />
            <Field label="Rank" value={initial?.related_soldier_rank || "—"} />
            <Field label="UPDF Service" value={initial?.related_soldier_service || "—"} />
          </dl>
        ) : (
          <p className="mt-4 text-sm text-on-surface-variant">
            No soldier relationship details on file yet. Add them so welfare officers can verify your link.
          </p>
        )
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Relationship to Soldier</span>
            <select
              value={rel}
              onChange={(e) => setRel(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            >
              <option value="">—</option>
              <optgroup label="Primary">
                {["Father","Mother","Wife","Husband","Son","Daughter"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </optgroup>
              <optgroup label="Adopted / Extended">
                {["Brother","Sister","Aunt","Uncle","Cousin","Other"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Soldier's Full Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Soldier's Service Number</span>
            <input
              value={svcNum}
              onChange={(e) => setSvcNum(e.target.value.toUpperCase())}
              placeholder="e.g. RA/123456"
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm font-mono uppercase"
            />
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Soldier's Rank</span>
            <select
              value={rnk}
              onChange={(e) => setRnk(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            >
              <option value="">—</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-xs md:col-span-2">
            <span className="block mb-1 text-on-surface-variant">Soldier's UPDF Service</span>
            <select
              value={svc}
              onChange={(e) => setSvc(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            >
              <option value="">—</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {/* Hint to keep RELATIONSHIPS referenced (full list lives in select above) */}
          <input type="hidden" value={RELATIONSHIPS.length} readOnly />
          {err && <p className="md:col-span-2 text-sm text-error">{err}</p>}
          <div className="md:col-span-2 flex justify-end gap-2 mt-1">
            <button
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-4 py-2 text-sm border border-outline-variant rounded-md hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-outline font-medium">{label}</dt>
      <dd className={"mt-0.5 text-on-surface " + (mono ? "font-mono text-sm" : "")}>{value}</dd>
    </div>
  );
}

type ProfileInfo = {
  full_name: string | null;
  service_number: string | null;
  service: string | null;
  rank: string | null;
  region: string | null;
  nin: string | null;
  created_at: string | null;
} | null;

const RANKS = [
  "Private","Lance Corporal","Corporal","Sergeant","Staff Sergeant","Warrant Officer II","Warrant Officer I",
  "Second Lieutenant","Lieutenant","Captain","Major","Lieutenant Colonel","Colonel","Brigadier","Major General","Lieutenant General","General",
];
const REGIONS = ["Central","Western","Northern","Eastern","West Nile"];
const SERVICES = ["Air Force","SFC","Land Force","Reserve Force"];

const RELATIONSHIPS = [
  "Father","Mother","Wife","Husband","Son","Daughter",
  "Brother","Sister","Aunt","Uncle","Cousin","Other",
];

function ProfileDetailsCard({
  userId,
  isSoldier,
  email,
  initial,
  onSaved,
}: {
  userId: string;
  isSoldier: boolean;
  email: string | undefined;
  initial: ProfileInfo;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [rank, setRank] = useState(initial?.rank ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [service, setService] = useState(initial?.service ?? "");
  const [snapshot, setSnapshot] = useState<ProfileInfo>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(initial);
    setFullName(initial?.full_name ?? "");
    setRank(initial?.rank ?? "");
    setRegion(initial?.region ?? "");
    setService(initial?.service ?? "");
  }, [initial]);

  async function save() {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    const payload = {
      full_name: fullName.trim() || null,
      rank: rank.trim() || null,
      region: region.trim() || null,
      ...(isSoldier ? { service: service.trim() || null } : {}),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSnapshot({
      full_name: payload.full_name,
      service_number: snapshot?.service_number ?? null,
      service: isSoldier ? service.trim() || null : snapshot?.service ?? null,
      rank: payload.rank,
      region: payload.region,
      nin: snapshot?.nin ?? null,
      created_at: snapshot?.created_at ?? null,
    });
    setEditing(false);
    onSaved();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
            <Icon name="badge" fill className="text-[22px]" />
            My Profile
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Your service identification on file with the welfare directorate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSoldier && snapshot?.service && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-on-primary text-xs font-semibold">
              <Icon name="military_tech" fill className="text-[14px]" />
              {snapshot.service}
            </span>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary border border-primary px-3 py-1.5 rounded-md hover:bg-primary hover:text-on-primary"
            >
              <Icon name="edit" className="text-[16px]" />
              Edit details
            </button>
          )}
        </div>
      </div>
      {!editing ? (
        <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Full name" value={snapshot?.full_name || "—"} />
          {isSoldier ? (
            <>
              <Field label="UPDF Service" value={snapshot?.service || "Not assigned"} />
              <Field label="Rank" value={snapshot?.rank || "—"} />
              <Field label="Service / Army #" value={snapshot?.service_number || "—"} mono />
            </>
          ) : (
            <>
              <Field label="Email" value={email || "—"} />
              <Field label="NIN" value={snapshot?.nin || "—"} mono />
              <Field label="Date for sign in" value={snapshot?.created_at ? new Date(snapshot.created_at).toLocaleDateString() : "—"} />
            </>
          )}
          <Field label="Region" value={snapshot?.region || "—"} />
        </dl>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Rank</span>
            <select
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            >
              <option value="">—</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block mb-1 text-on-surface-variant">Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
            >
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          {isSoldier && (
            <label className="text-xs">
              <span className="block mb-1 text-on-surface-variant">UPDF Service</span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm"
              >
                <option value="">—</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <div className="md:col-span-2 text-[11px] text-on-surface-variant">
            Identity fields (NIN, Army Number, Service Number) cannot be changed here. Contact a welfare officer if they need correcting.
          </div>
          {err && <p className="md:col-span-2 text-sm text-error">{err}</p>}
          <div className="md:col-span-2 flex justify-end gap-2 mt-1">
            <button
              onClick={() => setEditing(false)}
              disabled={busy}
              className="px-4 py-2 text-sm border border-outline-variant rounded-md hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
