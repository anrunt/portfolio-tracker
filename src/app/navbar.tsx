"use client";

import Link from "next/link";
import { authClient } from "@/server/better-auth/client";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = authClient.useSession();

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold">
          Portfolio Tracker
        </Link>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user?.name || session.user?.email}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await authClient.signOut();
                  window.location.href = "/";
                }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
