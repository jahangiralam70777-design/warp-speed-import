import { createFileRoute } from "@tanstack/react-router";

// Alias for the common Supabase PKCE callback path
// (`/auth/callback?code=...`). Some email templates / OAuth flows target
// this URL by convention. We forward query + hash to `/email-verified`,
// which performs `exchangeCodeForSession` and renders the success UI.
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = new URL("/email-verified", url.origin);
        target.search = url.search;
        target.hash = url.hash;
        console.info("[auth-callback] forwarding auth callback", {
          hasCode: url.searchParams.has("code"),
          hasTokenHash: url.searchParams.has("token_hash"),
          hasToken: url.searchParams.has("token"),
          type: url.searchParams.get("type"),
          hasHash: Boolean(url.hash),
          targetPath: `${target.pathname}${target.search ? "?…" : ""}${target.hash ? "#…" : ""}`,
        });
        return Response.redirect(target.toString(), 303);
      },
    },
  },
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Signing you in…" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AuthCallback() {
  if (typeof window !== "undefined") {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    window.location.replace(`/email-verified${search}${hash}`);
  }
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
      Signing you in…
    </div>
  );
}
