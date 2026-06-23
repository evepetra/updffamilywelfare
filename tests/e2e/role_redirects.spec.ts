/**
 * End-to-end role redirect & badge tests.
 *
 * Run: bunx playwright test tests/e2e/role_redirects.spec.ts
 *
 * Required env vars (accounts must be pre-seeded in public.user_roles):
 *   E2E_BASE_URL (default http://localhost:8080)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *   E2E_OFFICER_EMAIL / E2E_OFFICER_PASSWORD
 *   E2E_FAMILY_EMAIL / E2E_FAMILY_PASSWORD
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";

type Case = {
  name: string;
  email: string | undefined;
  password: string | undefined;
  destPath: string;
  badge: RegExp;
};

const cases: Case[] = [
  {
    name: "admin → /admin-console with Admin badge",
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    destPath: "/admin-console",
    badge: /admin/i,
  },
  {
    name: "officer → /admin with Soldier badge",
    email: process.env.E2E_OFFICER_EMAIL,
    password: process.env.E2E_OFFICER_PASSWORD,
    destPath: "/admin",
    badge: /soldier|officer/i,
  },
  {
    name: "family → /dashboard with Family badge",
    email: process.env.E2E_FAMILY_EMAIL,
    password: process.env.E2E_FAMILY_PASSWORD,
    destPath: "/dashboard",
    badge: /family/i,
  },
];

for (const c of cases) {
  test(c.name, async ({ page }) => {
    test.skip(!c.email || !c.password, `Missing creds for ${c.name}`);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder(/name@updf/i).fill(c.email!);
    await page.getByPlaceholder(/password|••/i).fill(c.password!).catch(async () => {
      await page.locator('input[type="password"]').fill(c.password!);
    });
    await page.getByRole("button", { name: /sign in|login|secure/i }).first().click();
    await page.waitForURL(new RegExp(c.destPath.replace("/", "\\/") + "$"), { timeout: 15_000 });
    expect(page.url()).toContain(c.destPath);
    // Role badge rendered above page title by AppShell
    await expect(page.getByText(c.badge).first()).toBeVisible({ timeout: 10_000 });
  });
}
