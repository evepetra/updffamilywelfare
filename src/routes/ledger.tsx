import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Aid Distribution Ledger | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Detailed ledger of family aid disbursals with regional filtering and export tools.",
      },
    ],
  }),
  component: LedgerPage,
});

const REGIONS = ["All Regions", "Central", "Western", "Northern", "Eastern", "West Nile"];
const TYPES = ["All Types", "Financial", "Food", "Medical", "Education"];

function LedgerPage() {
  const [region, setRegion] = useState("All Regions");
  const [type, setType] = useState("All Types");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      LEDGER.filter((r) => {
        if (region !== "All Regions" && r.region !== region) return false;
        if (type !== "All Types" && r.type !== type) return false;
        if (query && !`${r.recipient} ${r.id}`.toLowerCase().includes(query.toLowerCase()))
          return false;
        return true;
      }),
    [region, type, query]
  );

  const total = rows.reduce((acc, r) => acc + r.amount, 0);

  return (
    <AppShell
      title="Aid Distribution Ledger"
      subtitle="Full disbursement history. Filter, search and export institutional records."
      actions={
        <>
          <button className="inline-flex items-center gap-2 border border-outline-variant px-4 py-2.5 rounded-md text-sm font-medium hover:bg-surface-container">
            <Icon name="picture_as_pdf" className="text-[18px]" />
            Export PDF
          </button>
          <button className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container">
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
                  <td className="px-5 py-3 font-medium text-primary">{r.id}</td>
                  <td className="px-5 py-3">{r.recipient}</td>
                  <td className="px-5 py-3">{r.type}</td>
                  <td className="px-5 py-3">{r.region}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{r.date}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmtUGX(r.amount)}</td>
                  <td className="px-5 py-3">
                    <span className="bg-primary-fixed-dim text-primary px-2.5 py-1 rounded-full text-xs font-medium">
                      Disbursed
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-on-surface-variant text-sm">
                    No records match the current filters.
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

const LEDGER = [
  { id: "DSB-26-0042", recipient: "Sarah Nakato", type: "Medical", region: "Central", date: "12 Jun 2026", amount: 850000 },
  { id: "DSB-26-0041", recipient: "James Okello", type: "Education", region: "Northern", date: "10 Jun 2026", amount: 1200000 },
  { id: "DSB-26-0040", recipient: "Grace Atim", type: "Food", region: "Eastern", date: "08 Jun 2026", amount: 400000 },
  { id: "DSB-26-0039", recipient: "Peter Wamala", type: "Financial", region: "Western", date: "05 Jun 2026", amount: 2000000 },
  { id: "DSB-26-0038", recipient: "Mary Adongo", type: "Medical", region: "Central", date: "03 Jun 2026", amount: 650000 },
  { id: "DSB-26-0037", recipient: "Daniel Sserwadda", type: "Education", region: "Central", date: "01 Jun 2026", amount: 1500000 },
  { id: "DSB-26-0036", recipient: "Esther Acen", type: "Food", region: "West Nile", date: "30 May 2026", amount: 350000 },
  { id: "DSB-26-0035", recipient: "Robert Kato", type: "Financial", region: "Western", date: "28 May 2026", amount: 1800000 },
];