import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/Icon";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust, Security & Privacy | UPDF Welfare Portal" },
      {
        name: "description",
        content:
          "How the UPDF Family Welfare Portal handles access control, data protection, retention, and privacy requests. Maintained by the UPDF Welfare Administration.",
      },
      { property: "og:title", content: "Trust, Security & Privacy | UPDF Welfare Portal" },
      {
        property: "og:description",
        content:
          "Access control, data handling, subprocessors, retention, and how to contact UPDF Welfare about security or privacy.",
      },
      { property: "og:url", content: "https://updffamilywelfare.lovable.app/trust" },
    ],
    links: [{ rel: "canonical", href: "https://updffamilywelfare.lovable.app/trust" }],
  }),
  component: TrustPage,
});

interface Section {
  id: string;
  icon: string;
  title: string;
  body: string;
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    id: "access",
    icon: "lock",
    title: "Access & Authentication",
    body: "The portal is an authenticated institutional system. Family, Officer, and Admin accounts each see only the data their role permits.",
    bullets: [
      "Sign-in with institutional service number or Google account.",
      "Roles are stored in a dedicated server-side table — they cannot be self-granted from the browser.",
      "All sensitive pages require an active session; sign-out clears the local session immediately.",
    ],
  },
  {
    id: "data",
    icon: "database",
    title: "Data We Collect",
    body: "We collect only what is needed to process welfare requests and disbursals.",
    bullets: [
      "Account: full name, service number, email.",
      "Support requests: type, urgency, description, and uploaded documents you provide.",
      "Aid ledger: recipient, region, amount, and disbursal status recorded by welfare staff.",
    ],
  },
  {
    id: "protection",
    icon: "shield",
    title: "How Data Is Protected",
    body: "Database access is governed by row-level security policies enforced on every read and write.",
    bullets: [
      "Family users can only read their own profile, requests, documents, and approved or disbursed ledger entries.",
      "Officers and admins are scoped to operational tables required for their duties; admin-only actions are separately gated.",
      "Uploaded support documents are stored in a private bucket; each file lives under the uploading user's folder.",
      "All traffic between your browser and the portal is encrypted in transit (TLS).",
    ],
  },
  {
    id: "subprocessors",
    icon: "hub",
    title: "Platform & Subprocessors",
    body: "The portal runs on the Lovable Cloud platform, which provides hosting, database, authentication, file storage, and edge compute. Lovable Cloud is a platform provider — this page is not an independent certification of any provider.",
    bullets: [
      "Hosting & edge runtime: Lovable Cloud.",
      "Database, auth, and file storage: Lovable Cloud managed services.",
      "Optional Google sign-in: authentication is brokered through Google when you choose that option.",
    ],
  },
  {
    id: "retention",
    icon: "schedule",
    title: "Retention & Deletion",
    body: "Welfare records are retained while your account is active and the case remains open. To request correction or deletion of personal data, contact the UPDF Welfare Administration using the details below. Requests are handled by welfare officers and may be subject to institutional record-keeping obligations.",
  },
  {
    id: "incident",
    icon: "report",
    title: "Security & Privacy Contact",
    body: "If you believe you have found a security issue, or you want to make a privacy request, contact the UPDF Welfare Administration through your assigned welfare officer or the institutional helpdesk. Please do not include passwords or sensitive personal data in the first message.",
  },
];

function TrustPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      <header className="bg-primary text-on-primary border-b border-primary-container">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-on-primary flex items-center justify-center rounded-sm">
              <Icon name="shield" fill className="text-primary text-[22px]" />
            </div>
            <div className="leading-tight">
              <p className="font-bold tracking-tight">UPDF Welfare Portal</p>
              <p className="text-on-primary/60 text-[10px] uppercase tracking-widest">
                Trust & Privacy
              </p>
            </div>
          </Link>
          <Link
            to="/login"
            className="text-sm bg-on-primary text-primary px-3 py-1.5 rounded-sm font-semibold hover:bg-on-primary/90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-8 py-10 md:py-14">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
            Institutional Notice
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
            Trust, Security & Privacy
          </h1>
          <p className="mt-3 text-on-surface-variant max-w-2xl">
            This page is maintained by the UPDF Welfare Administration to answer common
            security and privacy questions about the UPDF Family Welfare Portal. It describes
            controls that are currently enabled in the application and is not an independent
            certification or audit.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-md p-4 md:p-5 mb-10 text-sm text-on-surface-variant">
          <p className="font-semibold text-on-surface mb-1">Shared responsibility</p>
          <p>
            The UPDF Welfare Administration is responsible for how welfare data is collected,
            reviewed, and disbursed. The underlying platform (Lovable Cloud) provides hosting,
            database, authentication, and storage capabilities. Family members are responsible
            for safeguarding their own credentials and only submitting accurate information.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="border-l-4 border-primary bg-surface-container-lowest rounded-r-md p-5 md:p-6"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="w-9 h-9 rounded-sm bg-primary-container text-primary flex items-center justify-center shrink-0">
                  <Icon name={s.icon} fill className="text-[20px]" />
                </div>
                <h2 className="text-xl font-bold text-primary tracking-tight pt-1">
                  {s.title}
                </h2>
              </div>
              <p className="text-on-surface-variant">{s.body}</p>
              {s.bullets && (
                <ul className="mt-3 space-y-1.5 text-sm text-on-surface-variant list-disc pl-5">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-outline">
          Last reviewed by the UPDF Welfare Administration. Content on this page is editable
          project content and may be updated as portal controls evolve.
        </p>
      </main>

      <footer className="bg-surface-dim border-t border-outline-variant px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between gap-3 text-xs text-on-surface-variant">
          <p>© 2026 UPDF Welfare. Secure Institutional Portal.</p>
          <div className="flex gap-5">
            <Link className="hover:text-secondary" to="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}