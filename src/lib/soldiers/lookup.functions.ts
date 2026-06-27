import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Auto-fetch limited soldier profile fields by service number for use in
// the family-member aid request flow. Authenticated callers only.
// Returns null when no match is found.
export const lookupSoldierByServiceNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        serviceNumber: z
          .string()
          .trim()
          .min(3)
          .max(64)
          .transform((v) => v.toUpperCase()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, rank, service, service_number, army_number")
      .or(
        `service_number.eq.${data.serviceNumber},army_number.eq.${data.serviceNumber}`,
      )
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    // Confirm this profile actually belongs to a soldier account.
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", row.id)
      .eq("role", "soldier")
      .maybeSingle();
    if (!roleRow) return { found: false as const };
    return {
      found: true as const,
      fullName: row.full_name ?? "",
      rank: row.rank ?? "",
      service: row.service ?? "",
    };
  });