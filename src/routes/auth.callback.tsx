import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

// Alias for the common Supabase PKCE callback path
// (`/auth/callback?code=...`). Some email templates / OAuth flows target
// this URL by convention. We forward query + hash to `/email-verified`,
// which performs `exchangeCodeForSession` and renders the success UI.
export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Signing you in…" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AuthCallback() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    window.location.replace(`/email-verified${search}${hash}`);
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
      Signing you in…
    </div>
  );
}
