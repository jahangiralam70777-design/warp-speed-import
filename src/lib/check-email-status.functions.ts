import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, unauthenticated probe used by the signup form to decide whether an
 * "already registered" error should surface a ban message or the regular
 * "please sign in / reset password" message.
 *
 * Intentionally minimal — it returns only `{ banned }`. Existence info is
 * already exposed by Supabase's own signup error, so we don't widen surface.
 */
export const checkEmailBanStatus = createServerFn({ method: "POST" })
  .inputValidator((i: { email: string }) =>
    z.object({ email: z.string().trim().email().max(254) }).parse(i),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Find the auth user by paging through listUsers. Cheap enough for our scale.
      const perPage = 1000;
      const maxPages = 10;
      const needle = data.email.toLowerCase();
      let matchId: string | null = null;
      for (let page = 1; page <= maxPages; page++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: list } = await (supabaseAdmin.auth.admin as any).listUsers({
          page,
          perPage,
        });
        const users: Array<{ id: string; email?: string | null; banned_until?: string | null }> =
          list?.users ?? [];
        for (const u of users) {
          if ((u.email ?? "").toLowerCase() === needle) {
            matchId = u.id;
            // Native auth ban check
            if (u.banned_until && new Date(u.banned_until).getTime() > Date.now()) {
              return { banned: true } as const;
            }
            break;
          }
        }
        if (matchId || users.length < perPage) break;
      }
      if (!matchId) return { banned: false } as const;
      // App-level ban check
      const { data: row } = await supabaseAdmin
        .from("user_bans")
        .select("id,ban_until,status")
        .eq("user_id", matchId)
        .eq("status", "active")
        .maybeSingle();
      if (!row) return { banned: false } as const;
      if (!row.ban_until) return { banned: true } as const;
      return { banned: new Date(row.ban_until).getTime() > Date.now() } as const;
    } catch {
      return { banned: false } as const;
    }
  });
