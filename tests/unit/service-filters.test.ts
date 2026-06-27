/**
 * Unit tests for UPDF Service filtering, sorting and CSV export used by the
 * Admin Console and Welfare Officer dashboards.
 *
 * Run with:   bun tests/unit/service-filters.test.ts
 *
 * Exit code is non-zero on any failure, so CI / pre-merge gates can hook in.
 */
import {
  filterAndSortMembers,
  filterDisbursalsByService,
  filterRequestsByService,
  buildMembersCsv,
  buildDisbursementsCsv,
  csvEscape,
} from "../../src/lib/admin/service-filters";

let pass = 0;
let fail = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log("✓ " + name);
  } catch (e) {
    fail++;
    console.error("✗ " + name + "\n   " + (e as Error).message);
  }
}
function eq<T>(a: T, b: T, msg = "") {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb)
    throw new Error(`${msg || "not equal"}\n   got:      ${sa}\n   expected: ${sb}`);
}
function truthy(v: unknown, msg = "expected truthy") {
  if (!v) throw new Error(msg);
}

// ----- fixtures -------------------------------------------------------------
const members = [
  { id: "u1", email: "a@updf", full_name: "Alpha One",  service_number: "RA/100001", service: "Air Force",    roles: ["soldier"],         created_at: "2026-01-01T00:00:00Z" },
  { id: "u2", email: "b@updf", full_name: "Bravo Two",  service_number: "RA/100002", service: "Land Force",   roles: ["family"],          created_at: "2026-02-01T00:00:00Z" },
  { id: "u3", email: "c@updf", full_name: "Charlie Tre", service_number: "RA/100003", service: "Air Force",    roles: ["soldier","family"], created_at: "2026-03-01T00:00:00Z" },
  { id: "u4", email: "d@updf", full_name: "Delta Four", service_number: "CIV/HQ-12", service: null,           roles: ["officer"],         created_at: "2026-04-01T00:00:00Z" },
  { id: "u5", email: "e@updf", full_name: "Echo Five",  service_number: "RO/40005",  service: "SFC",          roles: ["soldier"],         created_at: "2026-05-01T00:00:00Z" },
];
const serviceMap = new Map<string, string | null>(
  members.map((m) => [m.id, m.service]),
);

// ----- member filter + sort -------------------------------------------------
test("Admin Console: filter members by UPDF Service", () => {
  const r = filterAndSortMembers(members, { serviceFilter: "Air Force" });
  eq(r.map((u) => u.id), ["u3", "u1"], "Air Force members, default sort desc by created_at");
});
test("Admin Console: free-text search matches UPDF service value", () => {
  const r = filterAndSortMembers(members, { search: "land force" });
  eq(r.map((u) => u.id), ["u2"]);
});
test("Admin Console: sort members by UPDF Service ascending", () => {
  const r = filterAndSortMembers(members, { sortBy: "service", sortDir: "asc" });
  // null service sorts as empty string, so u4 first
  eq(r.map((u) => u.service), ["", "Air Force", "Air Force", "Land Force", "SFC"]);
});
test("Admin Console: sort members by UPDF Service descending", () => {
  const r = filterAndSortMembers(members, { sortBy: "service", sortDir: "desc" });
  eq(r.map((u) => u.service), ["SFC", "Land Force", "Air Force", "Air Force", ""]);
});
test("Admin Console: 'all' service filter returns every member", () => {
  const r = filterAndSortMembers(members, { serviceFilter: "all" });
  eq(r.length, members.length);
});

// ----- pending disbursals (admin console) -----------------------------------
const pending = [
  { id: "d1", recipient_user_id: "u1", user_id: "u1", amount: 100, status: "approved", created_at: "2026-06-01" },
  { id: "d2", recipient_user_id: "u2", user_id: "u2", amount: 200, status: "approved", created_at: "2026-06-02" },
  { id: "d3", recipient_user_id: "u3", user_id: "u3", amount: 300, status: "approved", created_at: "2026-06-03" },
];
test("Pending Disbursals: filter by UPDF Service", () => {
  const r = filterDisbursalsByService(pending, serviceMap, "Air Force");
  eq(r.map((d) => d.id), ["d1", "d3"]);
});
test("Pending Disbursals: 'all' returns every row", () => {
  const r = filterDisbursalsByService(pending, serviceMap, "all");
  eq(r.length, 3);
});

// ----- disbursed aid report (welfare officer console) -----------------------
const ledger = [
  { id: "l1", recipient_user_id: "u1", status: "disbursed", amount: 500, disbursed_at: "2026-06-10T00:00:00Z", created_at: "2026-06-10T00:00:00Z" },
  { id: "l2", recipient_user_id: "u2", status: "disbursed", amount: 700, disbursed_at: "2026-06-11T00:00:00Z", created_at: "2026-06-11T00:00:00Z" },
  { id: "l3", recipient_user_id: "u5", status: "disbursed", amount: 900, disbursed_at: "2026-06-12T00:00:00Z", created_at: "2026-06-12T00:00:00Z" },
];
test("Disbursed Aid: filter ledger by UPDF Service", () => {
  const r = filterDisbursalsByService(ledger, serviceMap, "SFC");
  eq(r.map((l) => l.id), ["l3"]);
});

// ----- request queue --------------------------------------------------------
const requests = [
  { id: "r1", user_id: "u1", title: "Tuition aid",     status: "pending" },
  { id: "r2", user_id: "u2", title: "Medical support", status: "approved" },
  { id: "r3", user_id: "u5", title: "Funeral grant",   status: "pending" },
];
test("Welfare Officer Queue: filter requests by UPDF Service", () => {
  const r = filterRequestsByService(requests, serviceMap, "Air Force");
  eq(r.map((x) => x.id), ["r1"]);
});

// ----- CSV export -----------------------------------------------------------
test("CSV escape handles commas, quotes and newlines", () => {
  eq(csvEscape(`a, b`), `"a, b"`);
  eq(csvEscape(`he said "hi"`), `"he said ""hi"""`);
  eq(csvEscape(`line1\nline2`), `"line1\nline2"`);
  eq(csvEscape(null), "");
});
test("Members CSV: header includes updf_service and rows carry the value", () => {
  const csv = buildMembersCsv(members);
  const lines = csv.split("\n");
  truthy(lines[0].includes("updf_service"), "header must include updf_service column");
  // u1 row
  const u1Line = lines.find((l) => l.startsWith("u1,"));
  truthy(u1Line && u1Line.includes("Air Force"), "u1 row must contain Air Force");
  const u4Line = lines.find((l) => l.startsWith("u4,"));
  truthy(u4Line && u4Line.split(",")[4] === "", "u4 (no service) must emit empty updf_service cell");
});
test("Disbursements CSV: header includes updf_service and rows carry the value", () => {
  const csv = buildDisbursementsCsv([
    {
      id: "l1",
      date: "2026-06-10",
      recipient_name: "Alpha One",
      region: "Central",
      service: "Air Force",
      aid_type: "tuition",
      payout_method: "mobile_money",
      payout_provider: "MTN",
      payout_account_name: "Alpha One",
      payout_account_number: "256700000001",
      amount: 500,
      status: "disbursed",
    },
  ]);
  const lines = csv.split("\n");
  truthy(lines[0].includes("updf_service"), "header must include updf_service column");
  truthy(lines[1].includes("Air Force"), "data row must carry UPDF Service");
  truthy(lines[1].includes("256700000001"), "data row must carry deposit account number");
});

// ----- summary --------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);