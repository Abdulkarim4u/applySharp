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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
          <UserMenu email={user.email ?? ""} />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
