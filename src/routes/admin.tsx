import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Officer Console | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Officer and administrator view of welfare requests, regional distribution, and personnel queues.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <AppShell
      title="Officer Management Console"
      subtitle="Regional welfare distribution, pending verifications and personnel oversight."
      actions={
        <>
          <button className="inline-flex items-center gap-2 border border-outline-variant px-4 py-2.5 rounded-md text-sm font-medium hover:bg-surface-container">
            <Icon name="filter_list" className="text-[18px]" />
            Filter
          </button>
          <button className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container">
            <Icon name="download" className="text-[18px]" />
            Export Report
          </button>
        </>
      }
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map((k) => (
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
            <p className={"text-xs mt-1 font-medium " + (k.up ? "text-primary" : "text-error")}>
              <Icon
                name={k.up ? "trending_up" : "trending_down"}
                className="text-sm align-middle mr-1"
              />
              {k.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Distribution chart placeholder */}
        <section className="col-span-12 lg:col-span-8 bg-card border border-outline-variant rounded-lg p-6">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Aid Distribution Trend
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Last 6 months · all regions
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              {["Financial", "Food", "Medical"].map((t, i) => (
                <span key={t} className="flex items-center gap-1.5 text-on-surface-variant">
                  <span
                    className={
                      "w-2.5 h-2.5 rounded-sm " +
                      ["bg-primary", "bg-secondary", "bg-tertiary"][i]
                    }
                  />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <MiniBarChart />
        </section>

        {/* Regional breakdown */}
        <section className="col-span-12 lg:col-span-4 bg-card border border-outline-variant rounded-lg p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">
            Regional Breakdown
          </h2>
          <div className="space-y-4">
            {REGIONS.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-on-surface-variant">{r.value}%</span>
                </div>
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: r.value + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pending requests queue */}
        <section className="col-span-12 bg-card border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Pending Verifications
              </h2>
              <p className="text-xs text-on-surface-variant">
                Sorted by submission date · 24 in queue
              </p>
            </div>
            <button className="text-sm text-primary font-medium hover:underline">
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Applicant</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Region</th>
                  <th className="text-left px-5 py-3 font-medium">Submitted</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {REQUESTS.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-bright">
                    <td className="px-5 py-4">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-outline">{r.id}</p>
                    </td>
                    <td className="px-5 py-4">{r.type}</td>
                    <td className="px-5 py-4">{r.region}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{r.date}</td>
                    <td className="px-5 py-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-primary hover:underline text-xs font-medium mr-3">
                        Review
                      </button>
                      <button className="text-on-surface-variant hover:text-on-surface text-xs">
                        Assign
                      </button>
                    </td>
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

function MiniBarChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const data = [
    [40, 25, 15],
    [55, 30, 18],
    [48, 22, 12],
    [62, 35, 25],
    [70, 40, 20],
    [80, 45, 28],
  ];
  return (
    <div className="flex items-end gap-3 h-56">
      {months.map((m, i) => (
        <div key={m} className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-end gap-1 w-full h-48 justify-center">
            <div
              className="w-3 bg-primary rounded-t-sm"
              style={{ height: data[i][0] + "%" }}
            />
            <div
              className="w-3 bg-secondary rounded-t-sm"
              style={{ height: data[i][1] + "%" }}
            />
            <div
              className="w-3 bg-tertiary rounded-t-sm"
              style={{ height: data[i][2] + "%" }}
            />
          </div>
          <span className="text-xs text-on-surface-variant">{m}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: "Pending" | "Approved" | "Flagged" }) {
  const map = {
    Pending: "bg-secondary-container text-on-secondary-container",
    Approved: "bg-primary-fixed-dim text-primary",
    Flagged: "bg-red-100 text-error",
  };
  return (
    <span className={"px-2.5 py-1 rounded-full text-xs font-medium " + map[status]}>
      {status}
    </span>
  );
}

const KPIS = [
  { label: "Active Requests", value: "248", delta: "+12% MoM", up: true, icon: "assignment", iconBg: "bg-primary text-on-primary" },
  { label: "Disbursed (UGX)", value: "184.2M", delta: "+8.3% MoM", up: true, icon: "payments", iconBg: "bg-secondary text-on-secondary" },
  { label: "Pending Review", value: "24", delta: "-3 today", up: true, icon: "pending_actions", iconBg: "bg-tertiary text-on-tertiary" },
  { label: "Avg Resolution", value: "4.2d", delta: "+0.5d", up: false, icon: "timer", iconBg: "bg-primary-container text-on-primary" },
];

const REGIONS = [
  { name: "Central · Kampala", value: 38 },
  { name: "Western · Mbarara", value: 24 },
  { name: "Northern · Gulu", value: 18 },
  { name: "Eastern · Jinja", value: 12 },
  { name: "West Nile · Arua", value: 8 },
];

const REQUESTS: { id: string; name: string; type: string; region: string; date: string; status: "Pending" | "Approved" | "Flagged" }[] = [
  { id: "#UPDF-W-8842", name: "Sarah Nakato", type: "Medical Aid", region: "Central", date: "12 Jun 2026", status: "Pending" },
  { id: "#UPDF-W-8839", name: "James Okello", type: "Education Bursary", region: "Northern", date: "11 Jun 2026", status: "Approved" },
  { id: "#UPDF-W-8835", name: "Grace Atim", type: "Food Support", region: "Eastern", date: "10 Jun 2026", status: "Flagged" },
  { id: "#UPDF-W-8830", name: "Peter Wamala", type: "Financial Aid", region: "Western", date: "09 Jun 2026", status: "Pending" },
  { id: "#UPDF-W-8822", name: "Mary Adongo", type: "Medical Aid", region: "Central", date: "08 Jun 2026", status: "Approved" },
];