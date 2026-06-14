import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Family Dashboard | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Monitor the status of your family welfare requests, aid disbursals, and institutional notifications.",
      },
    ],
  }),
  component: FamilyDashboard,
});

function FamilyDashboard() {
  return (
    <AppShell
      title="Welcome back, Sarah"
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
        {/* Active aid request */}
        <section className="col-span-12 lg:col-span-8 bg-card rounded-lg border border-outline-variant border-l-4 border-l-secondary p-6">
          <div className="flex justify-between items-start mb-6 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-primary">
                Active Aid Request
              </h2>
              <p className="text-xs text-outline mt-0.5">
                Application ID · #UPDF-W-2026-8842
              </p>
            </div>
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
              Verification Pending
            </span>
          </div>
          <div className="flex justify-between text-xs mb-2 text-on-surface-variant">
            <span>Verification Progress</span>
            <span>Step 2 of 4</span>
          </div>
          <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden flex mb-3">
            <div className="bg-primary h-full w-1/4 border-r border-card" />
            <div className="bg-secondary h-full w-1/4 border-r border-card" />
            <div className="bg-surface-dim h-full w-2/4" />
          </div>
          <div className="grid grid-cols-4 text-center text-xs">
            <span className="text-primary font-semibold">Submitted</span>
            <span className="text-secondary font-semibold">Verifying</span>
            <span className="text-outline">Approval</span>
            <span className="text-outline">Disbursal</span>
          </div>
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
          <QuickAction icon="help" title="Welfare Guidance" desc="Contact assigned officer" color="tertiary" to="/manual" />
        </section>

        <section className="col-span-12 lg:col-span-6 bg-card rounded-lg border border-outline-variant overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-lg font-semibold text-primary">Notifications</h2>
            <Icon name="more_vert" className="text-outline" />
          </div>
          <div className="divide-y divide-outline-variant">
            {NOTIFICATIONS.map((n, i) => (
              <div key={i} className="p-4 flex gap-3 hover:bg-surface-bright">
                <Icon
                  name={n.icon}
                  fill={n.filled}
                  className={"text-[22px] " + n.color}
                />
                <div>
                  <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                  <p className="text-sm text-on-surface-variant line-clamp-1">
                    {n.body}
                  </p>
                  <p className="text-xs text-outline mt-1">{n.meta}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full p-3 text-sm font-medium text-primary hover:bg-surface-container border-t border-outline-variant">
            View All Messages
          </button>
        </section>

        <section className="col-span-12 lg:col-span-6 bg-card rounded-lg border border-outline-variant overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center">
            <h2 className="text-lg font-semibold text-primary">Support Summary</h2>
            <Icon name="history" className="text-outline" />
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Stat label="Total Disbursed" value="2,450,000 UGX" />
              <Stat label="Items Approved" value="03" />
            </div>
            <h3 className="text-xs uppercase tracking-wider text-on-surface-variant mb-3 font-medium">
              Recent History
            </h3>
            <div className="space-y-2">
              {HISTORY.map((h) => (
                <div
                  key={h.label}
                  className="flex justify-between items-center px-3 py-2.5 border border-outline-variant rounded-md hover:bg-surface-bright"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">{h.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{h.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
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

const NOTIFICATIONS = [
  {
    icon: "mail",
    filled: true,
    color: "text-primary",
    title: "Document Request: Medical Aid",
    body: "Please upload the latest medical certificate from the base hospital.",
    meta: "2 hours ago · Officer J. Okello",
  },
  {
    icon: "info",
    filled: false,
    color: "text-secondary",
    title: "System Update: Portal Maintenance",
    body: "The portal will be offline for security patching on Sunday at 0200hrs.",
    meta: "Yesterday",
  },
  {
    icon: "check_circle",
    filled: true,
    color: "text-primary",
    title: "Verification Successful",
    body: "Step 1 of your Educational Support request has been approved.",
    meta: "3 days ago",
  },
];

const HISTORY = [
  { label: "Educational Bursary · Term 2", amount: "1,200,000 UGX" },
  { label: "Medical Reimbursement", amount: "850,000 UGX" },
  { label: "Emergency Food Pack", amount: "400,000 UGX" },
];