/**
 * Verifies that system_admin sessions cannot approve, reject, or disburse
 * aid via direct PostgREST calls. system_admin holds oversight-only access;
 * all write paths to support_requests.status changes and aid_ledger inserts
 * must be rejected by RLS even when the UI is bypassed.
 *
 * Requires a pre-provisioned system_admin user. Skips when credentials
 * are missing — set:
 *
 *   SYSADMIN_EMAIL=evepetraamongi@gmail.com
 *   SYSADMIN_PASSWORD=Test@2026
 *   bun tests/security/system_admin_writes_blocked.test.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const SYSADMIN_EMAIL = process.env.SYSADMIN_EMAIL;
const SYSADMIN_PASSWORD = process.env.SYSADMIN_PASSWORD;

if (!URL || !KEY) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
if (!SYSADMIN_EMAIL || !SYSADMIN_PASSWORD) {
  console.log(
    "⚠ Skipping system_admin write-block tests — set SYSADMIN_EMAIL and SYSADMIN_PASSWORD to run.",
  );
  process.exit(0);
}

const failures: string[] = [];
const passes: string[] = [];
function expect(name: string, cond: boolean, detail = "") {
  (cond ? passes : failures).push(name + (detail ? ` — ${detail}` : ""));
  console.log((cond ? "✓" : "✗") + " " + name + (detail ? `\n    ${detail}` : ""));
}

async function run() {
  console.log("Running system_admin write-block tests against", URL);
  const client = createClient(URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInErr } = await client.auth.signInWithPassword({
    email: SYSADMIN_EMAIL!,
    password: SYSADMIN_PASSWORD!,
  });
  if (signInErr || !session.user) throw new Error("Could not sign in as system_admin: " + signInErr?.message);

  // Sanity: caller really holds system_admin
  const { data: roles } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  const roleList = (roles ?? []).map((r) => r.role);
  expect(
    "test account holds system_admin role",
    roleList.includes("system_admin"),
    `roles=${JSON.stringify(roleList)}`,
  );
  expect(
    "test account does NOT hold officer/admin role",
    !roleList.includes("officer") && !roleList.includes("admin"),
    `roles=${JSON.stringify(roleList)}`,
  );

  // Grab any existing request to attempt status updates on
  const { data: reqs } = await client.from("support_requests").select("id, status").limit(1);
  const targetReq = reqs?.[0];

  // 1. APPROVE — system_admin must be blocked
  if (targetReq) {
    const { data: updated, error } = await client
      .from("support_requests")
      .update({ status: "approved", amount_approved: 1 })
      .eq("id", targetReq.id)
      .select();
    expect(
      "system_admin cannot APPROVE support_requests via REST",
      !!error || (updated?.length ?? 0) === 0,
      error?.message ?? `updated_rows=${updated?.length ?? 0}`,
    );
  } else {
    console.log("ℹ no support_requests available to attempt approve/reject against");
  }

  // 2. REJECT — system_admin must be blocked
  if (targetReq) {
    const { data: updated, error } = await client
      .from("support_requests")
      .update({ status: "rejected", decision_reason: "bypass attempt" })
      .eq("id", targetReq.id)
      .select();
    expect(
      "system_admin cannot REJECT support_requests via REST",
      !!error || (updated?.length ?? 0) === 0,
      error?.message ?? `updated_rows=${updated?.length ?? 0}`,
    );
  }

  // 3. DISBURSE — system_admin must be blocked from inserting into aid_ledger
  {
    const { error } = await client.from("aid_ledger").insert({
      recipient_user_id: session.user.id,
      recipient_name: "Bypass Attempt",
      region: "Central",
      aid_type: "Financial",
      amount: 1,
      status: "disbursed",
      disbursed_at: new Date().toISOString(),
      reason: "RLS bypass attempt — must fail",
    });
    expect("system_admin cannot INSERT aid_ledger (disburse) via REST", !!error, error?.message);
  }

  // 4. UPDATE existing ledger row — system_admin must be blocked
  const { data: ledgerRow } = await client.from("aid_ledger").select("id").limit(1);
  if (ledgerRow?.[0]) {
    const { data: updated, error } = await client
      .from("aid_ledger")
      .update({ status: "disbursed", reason: "bypass" })
      .eq("id", ledgerRow[0].id)
      .select();
    expect(
      "system_admin cannot UPDATE aid_ledger via REST",
      !!error || (updated?.length ?? 0) === 0,
      error?.message ?? `updated_rows=${updated?.length ?? 0}`,
    );
  }

  // 5. DIRECT INSERT into aid_ledger_audit must fail (trigger-only table)
  {
    const { error } = await client.from("aid_ledger_audit").insert({
      ledger_id: "00000000-0000-0000-0000-000000000000",
      action: "insert",
      new_status: "disbursed",
      amount: 1,
      reason: "tamper",
    });
    expect(
      "no client can INSERT directly into aid_ledger_audit",
      !!error,
      error?.message,
    );
  }

  console.log(`\n${passes.length} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error("FAILURES:\n - " + failures.join("\n - "));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});