import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Advanced Reporting | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Generate, schedule and export advanced welfare reports across regions, periods and aid types.",
      },
      { property: "og:title", content: "Advanced Reporting | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Generate, schedule and export advanced welfare reports across regions, periods and aid types.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/reports" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [format, setFormat] = useState<"PDF" | "CSV" | "XLSX">("PDF");

  return (
    <AppShell
      title="Advanced Reporting Tools"
      subtitle="Configure parameters, preview analytics, and export institutional reports."
    >
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-card border border-outline-variant rounded-lg p-5">
            <h2 className="text-lg font-semibold text-primary mb-4">Report Parameters</h2>
            <Field label="Report Type">
              <select className="select-input">
                <option>Aid Distribution Summary</option>
                <option>Regional Welfare Breakdown</option>
                <option>Request Resolution Timing</option>
                <option>Officer Performance</option>
              </select>
            </Field>
            <Field label="Date Range">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" defaultValue="2026-01-01" className="select-input" />
                <input type="date" defaultValue="2026-06-14" className="select-input" />
              </div>
            </Field>
            <Field label="Region">
              <select className="select-input">
                <option>All Regions</option>
                <option>Central</option>
                <option>Western</option>
                <option>Northern</option>
                <option>Eastern</option>
                <option>West Nile</option>
              </select>
            </Field>
            <Field label="Aid Type">
              <select className="select-input">
                <option>All Types</option>
                <option>Financial</option>
                <option>Medical</option>
                <option>Education</option>
                <option>Food</option>
              </select>
            </Field>
            <Field label="Export Format">
              <div className="grid grid-cols-3 gap-2">
                {(["PDF", "CSV", "XLSX"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={
                      "py-2 rounded-md text-sm font-medium border-2 transition-colors " +
                      (format === f
                        ? "border-primary bg-primary-fixed-dim text-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary/40")
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Field>
            <button className="w-full mt-3 py-3 bg-primary text-on-primary rounded-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container">
              <Icon name="download" className="text-[18px]" />
              Generate &amp; Download
            </button>
          </div>

          <div className="bg-card border border-outline-variant rounded-lg p-5">
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Icon name="schedule" className="text-[18px]" />
              Scheduled Reports
            </h3>
            <ul className="text-sm space-y-2.5">
              {[
                { name: "Monthly Disbursal Summary", freq: "1st of every month" },
                { name: "Quarterly Regional Audit", freq: "Quarterly" },
              ].map((s) => (
                <li
                  key={s.name}
                  className="flex justify-between items-center p-3 bg-surface-container-low rounded-md"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-on-surface-variant">{s.freq}</p>
                  </div>
                  <button className="text-primary text-xs font-medium hover:underline">
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-8 bg-card border border-outline-variant rounded-lg p-6">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-lg font-semibold text-primary">Report Preview</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Aid Distribution Summary · Jan – Jun 2026 · All Regions
              </p>
            </div>
            <span className="bg-primary-fixed-dim text-primary px-3 py-1 rounded-full text-xs font-medium">
              {format} preview
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label="Disbursals" value="412" />
            <Stat label="Total Value" value="UGX 184.2M" />
            <Stat label="Families" value="298" />
          </div>

          <h3 className="text-sm font-semibold mb-3">Monthly Distribution</h3>
          <div className="h-56 flex items-end gap-3 mb-6">
            {[40, 55, 48, 70, 65, 82].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-primary rounded-t-md"
                  style={{ height: v + "%" }}
                />
                <span className="text-xs text-on-surface-variant">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i]}
                </span>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold mb-3">Top Regions</h3>
          <div className="space-y-3">
            {[
              { name: "Central", value: 38 },
              { name: "Western", value: 24 },
              { name: "Northern", value: 18 },
              { name: "Eastern", value: 12 },
              { name: "West Nile", value: 8 },
            ].map((r) => (
              <div key={r.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-on-surface-variant">{r.value}%</span>
                </div>
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary"
                    style={{ width: r.value + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-on-surface-variant mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
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