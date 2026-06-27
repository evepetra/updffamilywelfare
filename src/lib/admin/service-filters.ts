/**
 * Pure, framework-free helpers powering UPDF Service filtering, sorting,
 * and CSV export in the Admin Console and Welfare Officer dashboards.
 *
 * Kept side-effect free so they can be unit-tested without a DOM, network,
 * or React tree.
 */

export const UPDF_SERVICES = [
  "Air Force",
  "SFC",
  "Land Force",
  "Reserve Force",
] as const;
export type UpdfService = (typeof UPDF_SERVICES)[number];
export type ServiceFilter = "all" | UpdfService;

export type MemberLike = {
  id: string;
  email: string | null;
  full_name: string | null;
  service_number: string | null;
  service: string | null;
  roles?: string[] | null;
  created_at: string;
};

export type DisbursalLike = {
  id: string;
  recipient_user_id?: string | null;
  user_id?: string | null;
  amount?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  disbursed_at?: string | null;
};

export type RequestLike = {
  id: string;
  user_id: string;
  title?: string | null;
  request_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

/** Filter + sort members by UPDF Service, free-text search, and a sort column. */
export function filterAndSortMembers(
  users: MemberLike[],
  opts: {
    search?: string;
    serviceFilter?: ServiceFilter;
    sortBy?: "created_at" | "service" | "full_name";
    sortDir?: "asc" | "desc";
  } = {},
): MemberLike[] {
  const {
    search = "",
    serviceFilter = "all",
    sortBy = "created_at",
    sortDir = "desc",
  } = opts;
  const q = search.trim().toLowerCase();
  const matched = users.filter((u) => {
    if (serviceFilter !== "all" && (u.service ?? "") !== serviceFilter)
      return false;
    if (!q) return true;
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.service_number ?? "").toLowerCase().includes(q) ||
      (u.service ?? "").toLowerCase().includes(q)
    );
  });
  const dir = sortDir === "asc" ? 1 : -1;
  return [...matched].sort((a, b) => {
    if (sortBy === "service")
      return (a.service ?? "").localeCompare(b.service ?? "") * dir;
    if (sortBy === "full_name")
      return (a.full_name ?? "").localeCompare(b.full_name ?? "") * dir;
    return (a.created_at < b.created_at ? 1 : -1) * dir;
  });
}

/** Filter ledger/disbursal rows by UPDF Service using a user→service map. */
export function filterDisbursalsByService<T extends DisbursalLike>(
  rows: T[],
  serviceByUserId: Map<string, string | null>,
  serviceFilter: ServiceFilter,
): T[] {
  if (serviceFilter === "all") return rows;
  return rows.filter((r) => {
    const uid = r.recipient_user_id ?? r.user_id ?? "";
    return (serviceByUserId.get(uid) ?? "") === serviceFilter;
  });
}

/** Filter support-request rows by UPDF Service using a user→service map. */
export function filterRequestsByService<T extends RequestLike>(
  rows: T[],
  serviceByUserId: Map<string, string | null>,
  serviceFilter: ServiceFilter,
): T[] {
  if (serviceFilter === "all") return rows;
  return rows.filter(
    (r) => (serviceByUserId.get(r.user_id) ?? "") === serviceFilter,
  );
}

/** CSV escape (RFC 4180-ish). */
export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize rows + header to a CSV string. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const out = [header.map(csvEscape).join(",")];
  for (const r of rows) out.push(r.map(csvEscape).join(","));
  return out.join("\n");
}

/** Build the Admin Console member-export rows. UPDF Service is a first-class column. */
export function buildMembersCsv(users: MemberLike[]): string {
  const header = [
    "id",
    "full_name",
    "email",
    "service_number",
    "updf_service",
    "roles",
    "created_at",
  ];
  const rows = users.map((u) => [
    u.id,
    u.full_name ?? "",
    u.email ?? "",
    u.service_number ?? "",
    u.service ?? "",
    (u.roles ?? []).join("|"),
    u.created_at,
  ]);
  return toCsv(header, rows);
}

export type DisbursementCsvRow = {
  id: string;
  date: string;
  recipient_name?: string | null;
  region?: string | null;
  service?: string | null;
  aid_type?: string | null;
  payout_method?: string | null;
  payout_provider?: string | null;
  payout_account_name?: string | null;
  payout_account_number?: string | null;
  amount?: number | string | null;
  status?: string | null;
};

/** Build the Welfare Officer "Disbursed Aid" export. UPDF Service is a first-class column. */
export function buildDisbursementsCsv(rows: DisbursementCsvRow[]): string {
  const header = [
    "id",
    "date",
    "recipient_name",
    "region",
    "updf_service",
    "aid_type",
    "deposit_method",
    "deposit_provider",
    "deposit_account_name",
    "deposit_account_number",
    "amount",
    "status",
  ];
  const body = rows.map((r) => [
    r.id,
    r.date,
    r.recipient_name ?? "",
    r.region ?? "",
    r.service ?? "",
    r.aid_type ?? "",
    r.payout_method ?? "",
    r.payout_provider ?? "",
    r.payout_account_name ?? "",
    r.payout_account_number ?? "",
    r.amount ?? "",
    r.status ?? "",
  ]);
  return toCsv(header, body);
}

/** Trigger a browser download of CSV text. Browser-only — guard before use. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}