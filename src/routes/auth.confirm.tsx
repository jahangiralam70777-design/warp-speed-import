import { createFileRoute } from "@tanstack/react-router";

// Alias for Supabase's default email-confirmation template, which targets
// `{{ .SiteURL }}/auth/confirm?token_hash=...&type=...`. We forward the
// query + hash to our canonical /email-verified handler so token exchange
// happens in one place. This prevents the GoTrue endpoint from returning a
// raw JSON `{}` response when the redirect target doesn't exist.
export const Route = createFileRoute("/auth/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = new URL("/email-verified", url.origin);
        target.search = url.search;
        target.hash = url.hash;
        console.info("[auth-confirm] forwarding verification callback", {
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
  component: AuthConfirm,
  head: () => ({
    meta: [
      { title: "Confirming…" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AuthConfirm() {
  if (typeof window !== "undefined") {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    window.location.replace(`/email-verified${search}${hash}`);
  }
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
      Confirming your email…
    </div>
  );
}
