import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "Institutional User Manual | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "Step-by-step institutional manual covering authentication, request workflow, reporting and security protocols.",
      },
    ],
  }),
  component: ManualPage,
});

const SECTIONS = [
  {
    id: "auth",
    icon: "lock",
    title: "Authentication & Access",
    body: "Use your institutional Service Number or National ID with a strong password. The portal enforces role-based access control (RBAC) so Family, Officer and Admin users see only the data permitted to their role. Forgotten passwords must be reset through your assigned welfare officer.",
  },
  {
    id: "request",
    icon: "support_agent",
    title: "Submitting a Support Request",
    body: "From the Family Dashboard, choose New Support Request. Complete the four-step form: request type, family details, supporting documents, and review. Urgent and Emergency requests are routed to the duty officer within one hour.",
  },
  {
    id: "tracking",
    icon: "inventory_2",
    title: "Tracking Aid & Disbursals",
    body: "The Aid Ledger lists every disbursal with filters for region and aid type. Export to PDF or CSV for record-keeping. Each disbursal entry is signed off by both the regional officer and the welfare administrator.",
  },
  {
    id: "reports",
    icon: "analytics",
    title: "Generating Reports",
    body: "Officers and administrators can generate ad-hoc and scheduled reports through the Reporting Tools page. Reports respect the same RBAC scope and never include identifying data beyond the requester's permission level.",
  },
  {
    id: "security",
    icon: "shield",
    title: "Security Protocols",
    body: "All traffic is TLS-encrypted, all writes are audited, and database access is restricted via row-level security. Suspicious activity is logged and reviewed by the security operations center. Do not share credentials under any circumstance.",
  },
];

function ManualPage() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const [showTutorial, setShowTutorial] = useState(false);
  const section = SECTIONS.find((s) => s.id === active)!;

  return (
    <AppShell
      title="Institutional User Manual"
      subtitle="Authoritative documentation for using the UPDF Family Welfare Portal."
      actions={
        <button
          onClick={() => setShowTutorial(true)}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-md text-sm font-semibold hover:bg-primary-container"
        >
          <Icon name="play_circle" className="text-[18px]" />
          Start Tutorial
        </button>
      }
    >
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <nav className="bg-card border border-outline-variant rounded-lg p-2 space-y-1 sticky top-20">
            {SECTIONS.map((s) => {
              const isActive = s.id === active;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={
                    "w-full flex items-center gap-3 p-3 rounded-md text-left text-sm transition-colors " +
                    (isActive
                      ? "bg-primary text-on-primary font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container")
                  }
                >
                  <Icon name={s.icon} fill={isActive} className="text-[20px]" />
                  {s.title}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="col-span-12 lg:col-span-9 bg-card border border-outline-variant rounded-lg p-6 md:p-10">
          <p className="text-xs uppercase tracking-widest text-secondary font-semibold mb-2">
            Section · {SECTIONS.findIndex((s) => s.id === active) + 1} of {SECTIONS.length}
          </p>
          <h2 className="text-3xl font-bold text-primary tracking-tight mb-4">
            {section.title}
          </h2>
          <p className="text-on-surface-variant leading-relaxed mb-6">
            {section.body}
          </p>

          <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5 mb-6">
            <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
              <Icon name="task_alt" className="text-[18px]" />
              Best Practice Checklist
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li className="flex gap-2">
                <Icon name="check" className="text-primary text-[18px] mt-0.5" />
                Verify all uploaded documents are legible and current.
              </li>
              <li className="flex gap-2">
                <Icon name="check" className="text-primary text-[18px] mt-0.5" />
                Use the institutional email address on file for all correspondence.
              </li>
              <li className="flex gap-2">
                <Icon name="check" className="text-primary text-[18px] mt-0.5" />
                Report any suspicious access attempt to the security desk immediately.
              </li>
            </ul>
          </div>

          <div className="flex justify-between border-t border-outline-variant pt-5">
            <button
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === active);
                if (idx > 0) setActive(SECTIONS[idx - 1].id);
              }}
              className="px-4 py-2.5 text-sm font-medium border border-outline-variant rounded-md hover:bg-surface-container"
            >
              Previous
            </button>
            <button
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === active);
                if (idx < SECTIONS.length - 1) setActive(SECTIONS[idx + 1].id);
              }}
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container flex items-center gap-2"
            >
              Next Section
              <Icon name="arrow_forward" className="text-[18px]" />
            </button>
          </div>
        </section>
      </div>

      {showTutorial && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTutorial(false)}
        >
          <div
            className="bg-card rounded-lg max-w-md p-6 border border-outline-variant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-md bg-primary text-on-primary flex items-center justify-center mb-3">
              <Icon name="auto_awesome" fill className="text-[24px]" />
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">
              Welcome to UPDF Welfare Portal
            </h3>
            <p className="text-sm text-on-surface-variant mb-5">
              This guided tour will walk you through the key screens. You can
              re-launch it any time from the User Manual.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTutorial(false)}
                className="px-4 py-2.5 text-sm font-medium border border-outline-variant rounded-md hover:bg-surface-container"
              >
                Maybe later
              </button>
              <button
                onClick={() => setShowTutorial(false)}
                className="px-5 py-2.5 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container"
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}