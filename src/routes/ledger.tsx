import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Aid Distribution Ledger | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Detailed ledger of family aid disbursals with regional filtering and export tools.",
      },
      { property: "og:title", content: "Aid Distribution Ledger | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Detailed ledger of family aid disbursals with regional filtering and export tools.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/ledger" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LedgerPage,
});

const REGIONS = ["All Regions", "Central", "Western", "Northern", "Eastern", "West Nile"];
const TYPES = ["All Types", "Financial", "Food", "Medical", "Education"];

function LedgerPage() {
  const { user } = useAuth();
  const [region, setRegion] = useState("All Regions");
  const [type, setType] = useState("All Types");
  const [query, setQuery] = useState("");

  const ledgerQuery = useQuery({
    queryKey: ["ledger", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aid_ledger")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    return (ledgerQuery.data ?? []).filter((r) => {
      if (region !== "All Regions" && r.region !== region) return false;
      if (type !== "All Types" && r.aid_type !== type) return false;
      if (
        query &&
        !`${r.recipient_name} ${r.id}`.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [ledgerQuery.data, region, type, query]);

  const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

  function exportCsv() {
    const header = ["id", "recipient", "type", "region", "date", "amount", "status"];
    const lines = rows.map((r) =>
      [r.id, r.recipient_name, r.aid_type, r.region, r.created_at, r.amount, r.status]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aid-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Aid Distribution Ledger"
      subtitle="Full disbursement history. Filter, search and export institutional records."
      actions={
        <>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 border border-outline-variant px-4 py-2.5 rounded-md text-sm font-medium hover:bg-surface-container"
          >
            <Icon name="picture_as_pdf" className="text-[18px]" />
            Print / PDF
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container"
          >
            <Icon name="table_chart" className="text-[18px]" />
            Export CSV
          </button>
        </>
      }
    >
      <div className="bg-card border border-outline-variant rounded-lg p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipient or ID…"
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <Select value={region} onChange={setRegion} options={REGIONS} icon="public" />
        <Select value={type} onChange={setType} options={TYPES} icon="category" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Summary label="Records" value={rows.length.toString()} icon="receipt_long" />
        <Summary label="Total Disbursed" value={fmtUGX(total)} icon="payments" />
        <Summary label="Avg per Family" value={fmtUGX(Math.round(total / Math.max(rows.length, 1)))} icon="trending_up" />
        <Summary label="This Quarter" value="Q2 · 2026" icon="event" />
      </div>

      <div className="bg-card border border-outline-variant rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Disbursal ID</th>
                <th className="text-left px-5 py-3 font-medium">Recipient</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">Region</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-right px-5 py-3 font-medium">Amount</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-bright">
                  <td className="px-5 py-3 font-medium text-primary">{r.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-5 py-3">{r.recipient_name}</td>
                  <td className="px-5 py-3">{r.aid_type}</td>
                  <td className="px-5 py-3">{r.region}</td>
                  <td className="px-5 py-3 text-on-surface-variant">
                    {new Date(r.disbursed_at || r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">{fmtUGX(Number(r.amount))}</td>
                  <td className="px-5 py-3">
                    <span className="bg-primary-fixed-dim text-primary px-2.5 py-1 rounded-full text-xs font-medium">
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {!ledgerQuery.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-on-surface-variant text-sm">
                    No records yet. Disbursals recorded by welfare officers will appear here.
                  </td>
                </tr>
              )}
              {ledgerQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-on-surface-variant text-sm">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Select({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  icon: string;
}) {
  return (
    <div className="relative">
      <Icon
        name={icon}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-8 py-2.5 bg-surface-container-low border border-outline-variant rounded-md text-sm focus:outline-none focus:border-primary appearance-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <Icon
        name="expand_more"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none"
      />
    </div>
  );
}

function Summary({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-card border border-outline-variant rounded-lg p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-md bg-primary-fixed-dim text-primary flex items-center justify-center">
        <Icon name={icon} className="text-[20px]" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">
          {label}
        </p>
        <p className="text-base font-bold text-primary">{value}</p>
      </div>
    </div>
  );
}

function fmtUGX(n: number) {
  return n.toLocaleString("en-UG") + " UGX";
}
