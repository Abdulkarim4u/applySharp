import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally instead of a network round-trip to
  // Supabase Auth. Middleware already refreshed the session, so this is just
  // a fast re-check. Saves ~100-200ms per navigation vs getUser().
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) redirect("/login");
  const userEmail = (claims.email as string | undefined) ?? "";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface)]">
      <header className="border-b border-[var(--color-border)] bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo href="/app" />
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link
                href="/app"
                className="px-3 py-1.5 rounded-md text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              >
                Statements
              </Link>
            </nav>
          </div>
          <UserMenu email={userEmail} />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
