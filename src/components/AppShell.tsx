import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Family Dashboard", icon: "dashboard" },
  { to: "/admin", label: "Officer Console", icon: "shield_person" },
  { to: "/ledger", label: "Aid Ledger", icon: "inventory_2" },
  { to: "/support", label: "Support Request", icon: "support_agent" },
  { to: "/reports", label: "Reporting Tools", icon: "analytics" },
  { to: "/manual", label: "User Manual", icon: "menu_book" },
];

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();

  if (auth.loading || !auth.session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-on-surface-variant text-sm">
        Loading secure portal…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      <TopBar
        name={auth.profile?.full_name || auth.user?.email || "User"}
        serviceNumber={auth.profile?.service_number || ""}
        roleLabel={auth.isAdmin ? "Admin" : auth.isOfficer ? "Officer" : "Family"}
        onSignOut={auth.signOut}
      />
      <div className="flex-1 flex w-full">
        <aside className="hidden md:flex md:flex-col w-64 border-r border-outline-variant bg-surface-container-lowest fixed top-16 bottom-0 left-0 z-30 px-4 py-6 gap-1 overflow-y-auto">
          <p className="font-medium text-xs uppercase tracking-widest text-outline px-3 mb-2">
            Navigation
          </p>
          {NAV.filter((n) => {
            if (n.to === "/admin") return auth.isOfficer || auth.isAdmin;
            return true;
          }).map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors " +
                  (active
                    ? "bg-primary text-on-primary font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container")
                }
              >
                <Icon name={n.icon} fill={active} className="text-[20px]" />
                <span>{n.label}</span>
              </Link>
            );
          })}
          <div className="mt-auto border-t border-outline-variant pt-4">
            <Link
              to="/support"
              className="flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-3 rounded-md text-sm font-semibold hover:bg-primary-container transition-colors"
            >
              <Icon name="add" className="text-[20px]" />
              New Support Request
            </Link>
            <button
              onClick={auth.signOut}
              className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="logout" className="text-[20px]" />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-full">
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-on-surface-variant max-w-2xl">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </header>
          {children}
        </main>
      </div>

      <MobileNav pathname={pathname} />
      <SiteFooter />
    </div>
  );
}

function TopBar({
  name,
  serviceNumber,
  roleLabel,
  onSignOut,
}: {
  name: string;
  serviceNumber: string;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header className="bg-primary fixed top-0 inset-x-0 z-40 h-16 flex items-center justify-between px-4 md:px-8 border-b border-primary-container">
      <Link to="/dashboard" className="flex items-center gap-3">
        <div className="w-9 h-9 bg-on-primary flex items-center justify-center rounded-sm">
          <Icon name="shield" fill className="text-primary text-[22px]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-on-primary font-bold tracking-tight">
            UPDF Welfare Portal
          </span>
          <span className="text-on-primary/60 text-[10px] uppercase tracking-widest">
            Institutional Access
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <button
          onClick={onSignOut}
          title="Sign out"
          className="p-2 rounded-md text-on-primary/80 hover:bg-primary-container"
        >
          <Icon name="logout" className="text-[22px]" />
        </button>
        <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-on-primary/20 ml-1">
          <div className="w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-semibold text-sm">
            {initials || "U"}
          </div>
          <div className="leading-tight">
            <p className="text-on-primary text-sm font-semibold">{name}</p>
            <p className="text-on-primary/60 text-[11px]">
              {roleLabel}
              {serviceNumber ? ` · #${serviceNumber}` : ""}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const items: NavItem[] = [
    { to: "/dashboard", label: "Home", icon: "dashboard" },
    { to: "/ledger", label: "Aid", icon: "inventory_2" },
    { to: "/support", label: "Request", icon: "support_agent" },
    { to: "/reports", label: "Reports", icon: "analytics" },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-container-lowest border-t border-outline-variant h-16 flex justify-around items-center z-40">
      {items.map((n) => {
        const active = pathname === n.to || pathname.startsWith(n.to + "/");
        return (
          <Link
            key={n.to}
            to={n.to}
            className={
              "flex flex-col items-center gap-0.5 px-3 " +
              (active ? "text-primary" : "text-on-surface-variant")
            }
          >
            <Icon name={n.icon} fill={active} className="text-[22px]" />
            <span className="text-[10px] font-medium">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-surface-dim border-t border-outline-variant md:ml-64 px-4 md:px-8 py-6 flex flex-col md:flex-row justify-between gap-3 mt-auto">
      <div>
        <p className="font-semibold text-primary text-sm">
          Uganda People's Defence Forces
        </p>
        <p className="text-xs text-on-surface-variant">
          © 2026 UPDF Welfare. Secure Institutional Portal.
        </p>
      </div>
      <div className="flex gap-5 text-xs text-on-surface-variant">
        <Link className="hover:text-secondary" to="/trust">Privacy & Security</Link>
        <Link className="hover:text-secondary" to="/trust" hash="incident">Contact</Link>
      </div>
    </footer>
  );
}