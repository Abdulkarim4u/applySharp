"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in browser console + Vercel server logs so we can diagnose.
    console.error("Profile page crashed:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-red-900">
              Profile couldn&apos;t load
            </h1>
            <p className="mt-1 text-sm text-red-800">
              {error.message || "Something went wrong while loading your profile."}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-red-700 font-mono">
                ref: {error.digest}
              </p>
            )}
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={reset}>
                Try again
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/app">Back to statements</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
