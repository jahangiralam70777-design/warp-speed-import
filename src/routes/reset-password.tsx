import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { KeyRound, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  PasswordInput,
  NeonButton,
  FieldLabel,
  StrengthMeter,
  Requirements,
} from "@/components/auth/AuthPrimitives";
import { updatePassword } from "@/lib/auth-client";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Create New Password · CA Aspire BD" },
      { name: "description", content: "Set a new password and secure your CA Aspire BD account." },
      { property: "og:title", content: "Create New Password · CA Aspire BD" },
      {
        property: "og:description",
        content: "Strong password requirements with real-time strength feedback.",
      },
    ],
  }),
});

type Phase = "checking" | "ready" | "invalid";

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const navigate = useNavigate();
  const match = pw.length > 0 && pw === pw2;
  const handled = useRef(false);

  // ---------------------------------------------------------------------------
  // Recovery URL handling — supports ALL Supabase email-link formats:
  //   1. PKCE flow: ?code=<auth_code>          → exchangeCodeForSession
  //   2. OTP flow:  ?token_hash=<hash>&type=recovery → verifyOtp
  //   3. Implicit:  #access_token=...&type=recovery  → auto-detected by supabase-js
  //   4. PASSWORD_RECOVERY auth event           → already signed in for recovery
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (handled.current) return;
    handled.current = true;

    let cancelled = false;

    const showInvalid = (msg: string) => {
      if (cancelled) return;
      console.warn("[reset-password] recovery link invalid:", msg);
      setErrorMsg(msg);
      setPhase("invalid");
    };

    const markReady = () => {
      if (cancelled) return;
      console.log("[reset-password] recovery session ready");
      setPhase("ready");
    };

    // Listen for the PASSWORD_RECOVERY event — fires when supabase-js
    // auto-detects a recovery token in the URL (implicit or PKCE).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[reset-password] auth event:", event, !!session);
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        markReady();
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash || "";
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const errParam = url.searchParams.get("error") || url.searchParams.get("error_description");

        if (errParam) {
          showInvalid(decodeURIComponent(errParam));
          return;
        }

        // 1) PKCE flow — exchange ?code= for a session.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) return showInvalid(error.message);
          // Clean the URL so a refresh won't try to re-exchange a used code.
          window.history.replaceState({}, "", window.location.pathname);
          markReady();
          return;
        }

        // 2) Token-hash OTP flow.
        if (tokenHash && (type === "recovery" || !type)) {
          const { error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (error) return showInvalid(error.message);
          window.history.replaceState({}, "", window.location.pathname);
          markReady();
          return;
        }

        // 3) Implicit flow — supabase-js with detectSessionInUrl auto-parses
        //    the hash. Just check whether a session is now present.
        if (hash.includes("access_token") || hash.includes("type=recovery")) {
          // Give supabase-js a tick to detect & persist the hash session.
          await new Promise((r) => setTimeout(r, 250));
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            window.history.replaceState({}, "", window.location.pathname);
            markReady();
            return;
          }
        }

        // 4) Already in a recovery session (page reload after success).
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          markReady();
          return;
        }

        // Nothing usable in the URL — wait briefly for PASSWORD_RECOVERY event,
        // then fail.
        setTimeout(() => {
          if (!cancelled && phase === "checking") {
            showInvalid(
              "This password reset link is invalid or has expired. Please request a new one.",
            );
          }
        }, 1500);
      } catch (err) {
        showInvalid((err as Error).message || "Could not process recovery link.");
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (!match) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await updatePassword(pw);
      // Sign the recovery session out so the user explicitly re-authenticates
      // with the new password.
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      toast.success("Password updated. Please sign in with your new password.");
      navigate({ to: "/login", replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? "Could not update password";
      console.error("[reset-password] updatePassword failed:", err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (phase === "checking") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--neon-purple)]" />
          <p className="mt-4 text-sm text-muted-foreground">Verifying recovery link…</p>
        </div>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.4)]">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-center font-display text-2xl font-bold tracking-tight">
          Reset link unavailable
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {errorMsg ||
            "This password reset link is invalid or has expired. Please request a new one."}
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/forgot-password" })}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-blue)] py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_var(--neon-purple)] hover:opacity-90"
          >
            Request new reset link
          </button>
          <Link
            to="/login"
            className="block text-center text-xs font-semibold text-[var(--neon-blue)] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--neon-purple)] to-[var(--neon-blue)] text-white shadow-[0_0_30px_var(--neon-purple)]">
        <KeyRound className="h-6 w-6" />
      </div>
      <h2 className="text-center font-display text-3xl font-bold tracking-tight">
        Create new password
      </h2>
      <p className="mt-1.5 text-center text-sm text-muted-foreground">
        Choose a strong password to re-secure your account.
      </p>

      <form className="mt-7 space-y-4" onSubmit={onSubmit}>
        <div>
          <FieldLabel htmlFor="reset-password-new">New password</FieldLabel>
          <PasswordInput
            id="reset-password-new"
            name="new-password"
            autoComplete="new-password"
            value={pw}
            onChange={setPw}
          />
          <StrengthMeter value={pw} />
        </div>
        <div>
          <FieldLabel htmlFor="reset-password-confirm">Confirm password</FieldLabel>
          <PasswordInput
            id="reset-password-confirm"
            name="confirm-password"
            autoComplete="new-password"
            value={pw2}
            onChange={setPw2}
          />
          {pw2.length > 0 && (
            <p
              id="reset-password-match"
              aria-live="polite"
              className={`mt-1 text-[11px] ${match ? "text-emerald-400" : "text-rose-400"}`}
            >
              {match ? "Passwords match." : "Passwords do not match."}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-[var(--neon-purple)]" /> Security checklist
          </div>
          <Requirements value={pw} />
        </div>

        <NeonButton type="submit" disabled={loading || !match || pw.length < 8}>
          {loading ? "Updating…" : "Reset password"}
        </NeonButton>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Remembered it?{" "}
        <Link to="/login" className="font-semibold text-[var(--neon-blue)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
