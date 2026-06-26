import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/Icon";

const CANONICAL = "https://updffamilywelfare.lovable.app/support/child-care";
const TITLE = "Military Child Care Assistance & Subsidies | UPDF Welfare Portal";
const DESCRIPTION =
  "Eligibility, fee-assistance programs (MCCYN), and step-by-step application process for child care support available to UPDF and allied military families.";

export const Route = createFileRoute("/support/child-care")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Military Child Care Assistance and Subsidies",
          description: DESCRIPTION,
          author: {
            "@type": "Organization",
            name: "Uganda People's Defence Forces — Welfare Directorate",
          },
          mainEntityOfPage: CANONICAL,
        }),
      },
    ],
  }),
  component: ChildCarePage,
});

function ChildCarePage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-primary text-on-primary px-6 md:px-10 py-10 border-b border-primary-container">
        <div className="max-w-3xl mx-auto">
          <Link
            to="/support"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-on-primary/80 hover:text-on-primary mb-4"
          >
            <Icon name="arrow_back" className="text-[16px]" /> Back to support
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Military Child Care Assistance &amp; Subsidies
          </h1>
          <p className="mt-3 text-sm md:text-base text-on-primary/85 max-w-2xl">
            A guide for UPDF families on eligibility, available fee-assistance
            programs, and how to apply for child care support — including the
            Military Child Care in Your Neighborhood (MCCYN) pathway used by
            allied forces and adapted for UPDF dependents.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-10 py-10 space-y-10">
        <section aria-labelledby="overview">
          <h2 id="overview" className="text-xl font-semibold text-primary mb-3">
            Overview
          </h2>
          <p className="text-sm text-on-surface leading-relaxed">
            Military child care assistance helps active-duty, reservist, and
            deployed service members offset the cost of licensed child care when
            on-installation slots are unavailable. UPDF welfare coordinates with
            licensed providers across Uganda and partners with the MCCYN program
            model to subsidise the difference between a family's calculated
            contribution and the provider's posted weekly rate.
          </p>
        </section>

        <section aria-labelledby="eligibility">
          <h2 id="eligibility" className="text-xl font-semibold text-primary mb-3">
            Eligibility criteria
          </h2>
          <ul className="list-disc pl-5 text-sm text-on-surface space-y-2">
            <li>Sponsor is active-duty UPDF, mobilised reservist, or a surviving spouse of a service member.</li>
            <li>Child is between 6 weeks and 12 years old (up to 18 for documented special needs).</li>
            <li>Both parents (or sole parent) are working, in school, or seeking employment.</li>
            <li>Care is provided by a licensed centre or registered family child care home.</li>
            <li>Family's total monthly income falls within the published MCCYN income band for the current year.</li>
          </ul>
        </section>

        <section aria-labelledby="programs">
          <h2 id="programs" className="text-xl font-semibold text-primary mb-3">
            Programs available
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ProgramCard
              title="MCCYN Fee Assistance"
              desc="Subsidy that pays providers directly so families only contribute the calculated parent fee."
            />
            <ProgramCard
              title="Deployment Child Care"
              desc="Up to 16 hours of free care per child, per month, while a sponsor is deployed."
            />
            <ProgramCard
              title="Respite Care for Special Needs"
              desc="Additional hours for families with an enrolled Exceptional Family Member."
            />
            <ProgramCard
              title="School-Age Holiday Camps"
              desc="Discounted seats at partner camps during school breaks."
            />
          </div>
        </section>

        <section aria-labelledby="apply">
          <h2 id="apply" className="text-xl font-semibold text-primary mb-3">
            How to apply
          </h2>
          <ol className="list-decimal pl-5 text-sm text-on-surface space-y-2">
            <li>Sign in to the UPDF Welfare Portal and open <Link to="/support" className="text-secondary hover:underline">Submit Support Request</Link>.</li>
            <li>Select <strong>Child Care Assistance</strong> as the request type.</li>
            <li>Upload the sponsor's service ID, the child's birth certificate, and the provider's quoted weekly rate.</li>
            <li>Provide the most recent payslip or income declaration for both parents.</li>
            <li>Submit and track status in the <Link to="/dashboard" className="text-secondary hover:underline">family dashboard</Link>; approval typically takes 7–10 working days.</li>
          </ol>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-semibold text-primary mb-3">
            Frequently asked questions
          </h2>
          <dl className="space-y-4 text-sm text-on-surface">
            <Faq q="Can I use a provider that isn't on the UPDF list?">
              Yes, provided they hold a current licence from the Ministry of
              Gender, Labour and Social Development. Submit the licence number
              with your request and welfare staff will onboard them.
            </Faq>
            <Faq q="Does the subsidy cover before- and after-school care?">
              Yes. Hours outside the standard school day are eligible at the
              same fee-assistance rate as full-day care.
            </Faq>
            <Faq q="What happens if I'm reassigned mid-year?">
              Approved assistance transfers with the family. Update your duty
              station in the portal and welfare will reissue the provider
              authorisation.
            </Faq>
          </dl>
        </section>

        <section className="rounded-md border border-outline-variant bg-surface-container-low p-5">
          <p className="text-sm text-on-surface-variant">
            Need help with your application? Contact your welfare officer through the{" "}
            <Link to="/support" className="text-secondary hover:underline">support request form</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}

function ProgramCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-card p-4">
      <h3 className="text-sm font-semibold text-on-surface mb-1">{title}</h3>
      <p className="text-xs text-on-surface-variant leading-relaxed">{desc}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-on-surface">{q}</dt>
      <dd className="mt-1 text-on-surface-variant leading-relaxed">{children}</dd>
    </div>
  );
}