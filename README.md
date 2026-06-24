# UPDF Family Welfare Portal


[Github Link: ](https://github.com/evepetra/updffamilywelfare.git)

A welfare support portal for Uganda People's Defence Force families: support
requests, document uploads, aid ledger, role-based admin tooling.

Built with **TanStack Start** (React 19 + Vite 7), **Tailwind CSS v4**,
**shadcn/ui**, and **Lovable Cloud** (Supabase) for auth, database, storage
and server functions.

---

## 1. Run locally

### Prerequisites
- **Bun** ≥ 1.1 (or Node 20 + npm) — https://bun.sh
- Git

### Steps
```bash
git clone <your-repo-url>
cd <repo-folder>
bun install          # or: npm install
cp .env.example .env # then fill in values (see below)
bun run dev          # http://localhost:8080
```

### Environment variables
Create `.env` at the project root:
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SUPABASE_PROJECT_ID=<project-id>

# Server-only (do NOT prefix with VITE_)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```
The publishable/anon key is safe in the browser. The **service role key is
secret** — never commit it and never expose it in client code. On Lovable
Cloud it is injected automatically; for local dev you must paste it yourself
from your Supabase project's API settings.

---

## 2. Push to GitHub

From inside Lovable:
1. Top-right **+** menu → **GitHub** → **Connect project**
2. Authorise the Lovable GitHub App
3. Pick the account/organisation and click **Create Repository**

Sync is two-way: edits in Lovable push to GitHub, and pushes to GitHub appear
in Lovable. To work locally afterwards:
```bash
git clone git@github.com:<you>/<repo>.git
cd <repo>
bun install
bun run dev
```

---

## 3. Database & migrations

Schema changes live in `supabase/migrations/*.sql` and run automatically when
merged. Locally you can apply them with the Supabase CLI:
```bash
supabase db push
```

Key tables: `profiles`, `user_roles`, `support_requests`, `request_documents`,
`aid_ledger`, `role_change_audit`. All have Row-Level Security enabled.

Roles: `family` (default), `officer`, `admin`. The `has_role()` SECURITY
DEFINER function is used in every policy that checks privilege. Users cannot
grant themselves a role (restrictive RLS).

---

## 4. Deploy

- **Lovable** — click **Publish** (top-right). Custom domain configurable.
- **Cloudflare Workers / Pages** — TanStack Start targets edge runtimes:
  ```bash
  bun run build
  # deploy the .output/ directory with your preferred host
  ```
- Set the same env vars on your hosting provider.

---

## 5. Project layout
```
src/
  routes/            file-based routes (TanStack Router)
    _authenticated/  protected subtree (auto-gated)
    api/             server route handlers (webhooks, public APIs)
  components/        shared UI + shadcn
  hooks/             use-auth, etc.
  integrations/
    supabase/        auto-generated clients (do NOT edit)
  lib/               shared utilities, server functions
supabase/migrations/ SQL migrations
```

Server logic goes in `*.functions.ts` via `createServerFn`. Webhooks/public
APIs go in `src/routes/api/public/*`. Never import `client.server.ts` at
module scope from client-reachable files.

---

## 6. Security posture

- RLS on every public table.
- Role-change audit log written via SECURITY DEFINER trigger; tampering blocked by restrictive policies.
- Storage bucket `support-documents` is private; each user can only read/write/update files under their own `auth.uid()` folder.
- Officers/admins can read all support files; only admins can change roles.

---

## 7. Companion PDF

A printable architecture & install guide is generated at
`docs/UPDF-Family-Welfare-Guide.pdf` — regenerate with:
```bash
python3 scripts/build_guide_pdf.py
```
