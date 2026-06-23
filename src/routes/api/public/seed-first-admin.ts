import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "evepetraamongi@gmail.com";
const ADMIN_PASSWORD = "Test@2026";
const ADMIN_FULL_NAME = "Eve Petra Amongi";

/**
 * One-shot seed endpoint. Provisions the FIRST administrator only — if any
 * admin already exists in `public.user_roles`, the route refuses. Safe to
 * leave deployed: it self-disables once the directorate has an admin.
 */
export const Route = createFileRoute("/api/public/seed-first-admin")({
  server: {
    handlers: {
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});

async function handle() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const existing = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (existing.error) {
    return json({ ok: false, reason: existing.error.message }, 500);
  }
  if ((existing.count ?? 0) > 0) {
    return json({ ok: false, reason: "An administrator already exists." }, 409);
  }

  // Either create the auth user, or reuse one that already exists (the
  // trigger only inserts a 'family' role for non-admin signups — we still
  // need to grant 'admin' below).
  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_FULL_NAME,
      admin_created: true,
      signup_role: "admin",
    },
  });
  if (created.error) {
    // If the user already exists, fetch their id.
    const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = list.data?.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
    if (!match) {
      return json({ ok: false, reason: created.error.message }, 500);
    }
    userId = match.id;
  } else {
    userId = created.data.user?.id ?? null;
  }
  if (!userId) return json({ ok: false, reason: "No user id returned" }, 500);

  // Ensure an admin role row exists (the trigger may have inserted only
  // 'family' if metadata was missing; upsert idempotently).
  const grant = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (grant.error) {
    return json({ ok: false, reason: grant.error.message }, 500);
  }

  return json({ ok: true, userId, email: ADMIN_EMAIL });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}