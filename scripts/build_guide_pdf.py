from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle)

OUT = "docs/UPDF-Family-Welfare-Guide.pdf"

styles = getSampleStyleSheet()
h1 = ParagraphStyle('h1', parent=styles['Heading1'], textColor=colors.HexColor('#0f3460'), spaceAfter=10)
h2 = ParagraphStyle('h2', parent=styles['Heading2'], textColor=colors.HexColor('#16213e'), spaceBefore=14)
body = ParagraphStyle('body', parent=styles['BodyText'], fontSize=10.5, leading=15, spaceAfter=6)
code = ParagraphStyle('code', parent=styles['Code'], fontSize=9, leading=12,
                      backColor=colors.HexColor('#f3f4f6'), borderPadding=6, leftIndent=4)
small = ParagraphStyle('small', parent=body, fontSize=9, textColor=colors.grey)

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=2*cm, rightMargin=2*cm,
                        topMargin=2*cm, bottomMargin=2*cm)
flow = []

def P(t, s=body): flow.append(Paragraph(t, s))
def C(t):
    safe = t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('\n','<br/>')
    flow.append(Paragraph(safe, code))
    flow.append(Spacer(1, 6))

P("UPDF Family Welfare Portal", h1)
P("Architecture, installation and operations guide", small)
Spacer(1, 6)

P("1. Overview", h2)
P("A welfare support portal for Uganda People's Defence Force families. "
  "Family members submit support requests with documents; officers and admins triage, "
  "approve and record aid disbursements in the ledger. Built with TanStack Start "
  "(React 19 + Vite 7), Tailwind v4, shadcn/ui and Lovable Cloud (Supabase) for "
  "authentication, database, storage and server functions.")

P("2. Roles & access control", h2)
data = [["Role", "Capabilities"],
        ["family", "Create and view own support requests; upload documents to own folder."],
        ["officer", "View all profiles, requests and documents; update request status."],
        ["admin", "Everything officers can do, plus grant/revoke roles and view audit log."]]
t = Table(data, colWidths=[3*cm, 13*cm])
t.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0), colors.HexColor('#0f3460')),
    ('TEXTCOLOR',(0,0),(-1,0), colors.white),
    ('FONTNAME',(0,0),(-1,0), 'Helvetica-Bold'),
    ('GRID',(0,0),(-1,-1), 0.25, colors.grey),
    ('VALIGN',(0,0),(-1,-1), 'TOP'),
    ('FONTSIZE',(0,0),(-1,-1), 9.5),
    ('LEFTPADDING',(0,0),(-1,-1), 6),
    ('RIGHTPADDING',(0,0),(-1,-1), 6),
    ('TOPPADDING',(0,0),(-1,-1), 5),
    ('BOTTOMPADDING',(0,0),(-1,-1), 5),
]))
flow.append(t); flow.append(Spacer(1, 10))

P("Every public table has Row-Level Security enabled. Privilege checks go through "
  "the SECURITY DEFINER function <b>has_role(user, role)</b>. A restrictive RLS "
  "rule blocks any user from inserting or updating their own row in <b>user_roles</b>, "
  "so self-elevation is impossible even if another policy is misconfigured.")

P("3. Data model", h2)
P("• <b>profiles</b> – full_name, service_number, linked to auth user.<br/>"
  "• <b>user_roles</b> – role assignments (enum: family / officer / admin).<br/>"
  "• <b>support_requests</b> – title, type, urgency, status, details.<br/>"
  "• <b>request_documents</b> – uploaded files stored in the support-documents bucket.<br/>"
  "• <b>aid_ledger</b> – recipient, region, aid type, amount, status, disbursed_at.<br/>"
  "• <b>role_change_audit</b> – append-only via SECURITY DEFINER trigger.")

P("4. Run locally", h2)
P("Install <b>Bun</b> 1.1+ (or Node 20 + npm) and Git, then:")
C("git clone <your-repo-url>\n"
  "cd <repo>\n"
  "bun install\n"
  "cp .env.example .env   # then edit values\n"
  "bun run dev            # http://localhost:8080")

P("Environment variables (.env at repo root):", body)
C("VITE_SUPABASE_URL=https://<project>.supabase.co\n"
  "VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>\n"
  "VITE_SUPABASE_PROJECT_ID=<project id>\n"
  "\n"
  "# Server-only — never commit or expose in client code\n"
  "SUPABASE_URL=https://<project>.supabase.co\n"
  "SUPABASE_PUBLISHABLE_KEY=<publishable key>\n"
  "SUPABASE_SERVICE_ROLE_KEY=<service role key>")

P("The publishable/anon key is safe in the browser. The service role key bypasses "
  "all RLS — keep it server-side only. On Lovable Cloud it is injected automatically; "
  "for local dev paste it from your Supabase project's API settings.")

P("5. Push to GitHub", h2)
P("Inside Lovable: top-right <b>+</b> menu → <b>GitHub</b> → <b>Connect project</b>, "
  "authorise the Lovable GitHub App, choose an account or organisation, then click "
  "<b>Create Repository</b>. Sync is two-way — edits in Lovable push automatically, "
  "and pushes to GitHub appear back in Lovable.")
P("Clone the new repo locally to develop in your own editor:")
C("git clone git@github.com:<you>/<repo>.git\ncd <repo>\nbun install\nbun run dev")

P("6. Deploy", h2)
P("• <b>Lovable</b> – click <b>Publish</b> in the top-right; configure a custom domain in project settings.<br/>"
  "• <b>Cloudflare Workers / Pages</b> – TanStack Start targets edge runtimes:")
C("bun run build\n# deploy .output/ with wrangler, Cloudflare Pages, etc.")
P("Set the same environment variables on the host. Database migrations live in "
  "<b>supabase/migrations/</b> and can be applied with <b>supabase db push</b>.")

P("7. Project layout", h2)
C("src/\n"
  "  routes/            file-based routes (TanStack Router)\n"
  "    _authenticated/  protected subtree (auto-gated)\n"
  "    api/             server route handlers (webhooks, public APIs)\n"
  "  components/        shared UI + shadcn\n"
  "  hooks/             use-auth, etc.\n"
  "  integrations/\n"
  "    supabase/        auto-generated clients (do NOT edit)\n"
  "  lib/               shared utilities, *.functions.ts server functions\n"
  "supabase/migrations/ SQL migrations\n"
  "docs/                this PDF")

P("Server logic lives in <b>*.functions.ts</b> via createServerFn. Webhooks and "
  "public APIs go under <b>src/routes/api/public/</b>. Never import "
  "<b>client.server.ts</b> at module scope from client-reachable files.")

P("8. Security checklist", h2)
P("• RLS enabled on every public table.<br/>"
  "• Restrictive policy blocks self privilege escalation on user_roles.<br/>"
  "• role_change_audit is append-only via SECURITY DEFINER trigger; restrictive policies block direct writes.<br/>"
  "• support-documents bucket is private and scoped by auth.uid() folder, including UPDATE.<br/>"
  "• Service role key is never shipped to the browser.<br/>"
  "• Authenticated routes live under src/routes/_authenticated/ and are gated by the managed layout.")

P("9. Support", h2)
P("For questions about Lovable hosting, GitHub sync or Cloud, see "
  "<b>docs.lovable.dev</b>. For Supabase-specific questions see "
  "<b>supabase.com/docs</b>.")

doc.build(flow)
print("wrote", OUT)
