"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Catch browser autofill — Chrome doesn't fire onChange on autofill, so we
  // poll the DOM value for a few seconds until it has content.
  useEffect(() => {
    if (email) return;
    let ticks = 0;
    const interval = setInterval(() => {
      const v = inputRef.current?.value ?? "";
      if (v) {
        setEmail(v);
        clearInterval(interval);
      } else if (++ticks >= 50) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [email]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submitEmail = String(formData.get("email") ?? "").trim();
    if (!submitEmail) return;

    setStatus("loading");
    setError(null);
    setSubmittedEmail(submitEmail);

    try {
      const supabase = createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: submitEmail,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (authError) {
        console.error("Supabase auth error:", authError);
        setStatus("error");
        setError(authError.message);
        return;
      }

      setStatus("sent");
    } catch (err) {
      console.error("Sign-in request failed:", err);
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't reach the sign-in service. Check your connection.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--color-brand)]" />
        <h2 className="mt-4 text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          We sent a magic link to <strong>{submittedEmail}</strong>. Click it to
          sign in.
        </p>
        <p className="mt-4 text-xs text-[var(--color-muted-soft)]">
          Didn&apos;t arrive within 30 seconds? Check spam, or{" "}
          <button
            type="button"
            className="underline text-[var(--color-brand)]"
            onClick={() => {
              setStatus("idle");
              setSubmittedEmail("");
              setEmail("");
            }}
          >
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  const canSubmit = email.trim().length > 0 && status !== "loading";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          ref={inputRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={status === "loading"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => {
            const v = inputRef.current?.value ?? "";
            if (v !== email) setEmail(v);
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!canSubmit}
        className="w-full"
      >
        <Mail className="h-4 w-4" />
        {status === "loading" ? "Sending…" : "Send magic link"}
      </Button>

      <p className="text-xs text-[var(--color-muted-soft)] text-center">
        By continuing you agree to our terms. We&apos;ll only email you about
        your account.
      </p>
    </form>
  );
}
