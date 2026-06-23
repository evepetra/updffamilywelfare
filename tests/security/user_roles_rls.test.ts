/**
 * RLS / RPC security tests for public.user_roles and admin_list_users.
 *
 * Run with:   bun tests/security/user_roles_rls.test.ts
 *
 * Uses the anon (publishable) key only — no service-role secret needed.
 * Verifies:
 *   1. Anonymous client cannot SELECT or INSERT into public.user_roles.
 *   2. A freshly signed-up family user cannot grant themselves a role.
 *   3. A freshly signed-up family user cannot revoke another user's role.
 *   4. Non-admin caller of admin_list_users() is rejected.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");

const failures: string[] = [];
const passes: string[] = [];
function expect(name: string, cond: boolean, detail = "") {
  (cond ? passes : failures).push(name + (detail ? ` — ${detail}` : ""));
  console.log((cond ? "✓" : "✗") + " " + name + (detail ? `\n    ${detail}` : ""));
}

const anon = () =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function signUpFamily() {
  const client = anon();
  // NIN format enforced by the handle_new_user trigger.
  const suffix = Math.random().toString(36).slice(2, 14).toUpperCase();
  const nin = "CM" + suffix.padEnd(12, "X").slice(0, 12);
  const email = `rls-test-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;
  const password = "RlsTest!" + Math.random().toString(36).slice(2, 8);
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: "RLS Tester", nin, signup_role: "family" },
    },
  });
  if (error) throw new Error(`signUp failed: ${error.message}`);
  return { client, userId: data.user?.id ?? "", email };
}

async function run() {
  console.log("Running RLS security tests against", URL);

  // 1. anonymous SELECT / INSERT must fail
  {
    const c = anon();
    const { data: sel } = await c.from("user_roles").select("*").limit(1);
    expect("anon cannot SELECT user_roles", !sel || sel.length === 0);
    const { error: insErr } = await c
      .from("user_roles")
      .insert({ user_id: "00000000-0000-0000-0000-000000000000", role: "admin" });
    expect("anon cannot INSERT user_roles", !!insErr, insErr?.message);
  }

  // 2. signed-in family cannot self-grant admin
  const a = await signUpFamily();
  {
    const { error } = await a.client
      .from("user_roles")
      .insert({ user_id: a.userId, role: "admin" });
    expect("non-admin cannot self-grant admin", !!error, error?.message);
  }

  // 3. signed-in family cannot insert role for ANOTHER user
  const b = await signUpFamily();
  {
    const { error } = await a.client
      .from("user_roles")
      .insert({ user_id: b.userId, role: "officer" });
    expect("non-admin cannot grant roles to others", !!error, error?.message);
  }

  // 4. signed-in family cannot delete arbitrary roles
  {
    // PostgREST: .delete().select() returns the rows actually removed.
    // RLS hides denied rows, so a non-admin delete must return 0 rows.
    const { data: deleted, error } = await a.client
      .from("user_roles")
      .delete()
      .eq("user_id", b.userId)
      .select();
    expect(
      "non-admin cannot revoke another user's roles",
      !!error || (deleted?.length ?? 0) === 0,
      error?.message ?? `deleted=${deleted?.length ?? 0}`,
    );
  }

  // 5. non-admin cannot call admin_list_users
  {
    const { data, error } = await (a.client.rpc as unknown as (
      fn: string,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)("admin_list_users");
    expect(
      "admin_list_users rejects non-admin caller",
      !!error || data == null,
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