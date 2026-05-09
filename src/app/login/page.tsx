import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in — ApplySharp",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              Continue with email
            </h1>
            <p className="mt-2 text-[var(--color-muted)]">
              First time or returning, the same magic link gets you in. No
              password to remember.
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
