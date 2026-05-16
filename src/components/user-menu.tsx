"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { LogOut, UserRound } from "lucide-react";

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <span className="hidden md:inline text-sm text-[var(--color-muted)] truncate max-w-[180px]">
        {email}
      </span>
      <Button
        asChild
        variant="ghost"
        size="sm"
        title="Your CV and profile"
      >
        <Link href="/app/profile">
          <UserRound className="h-4 w-4" />
          <span className="hidden sm:inline">Profile</span>
        </Link>
      </Button>
      <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
