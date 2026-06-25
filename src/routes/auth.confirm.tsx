import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

// Alias for Supabase's default email-confirmation template, which targets
// `{{ .SiteURL }}/auth/confirm?token_hash=...&type=...`. We forward the
// query + hash to our canonical /email-verified handler so token exchange
// happens in one place. This prevents the GoTrue endpoint from returning a
// raw JSON `{}` response when the redirect target doesn't exist.
export const Route = createFileRoute("/auth/confirm")({
  component: AuthConfirm,
  head: () => ({
    meta: [
      { title: "Confirming…" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function AuthConfirm() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    window.location.replace(`/email-verified${search}${hash}`);
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
      Confirming your email…
    </div>
  );
}
