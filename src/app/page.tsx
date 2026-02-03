import Link from "next/link";
import { Navbar } from "@/app/navbar";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/better-auth/session";
import { Suspense } from "react";
import { Footer } from "./footer";
import { Loader2 } from "lucide-react";

export async function AuthButton() {
  const session = await getSession();

  return (
    <>
      {session ? (
        <Button variant="outline" size="lg" className="min-w-[140px]" asChild>
          <Link href="/dashboard">View Dashboard</Link>
        </Button>
      ) : (
        <Button size="lg" className="min-w-[140px]" asChild>
          <Link href="/login">Get Started</Link>
        </Button>
      )}
    </>
  );
}

export default async function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-3xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Track Your Portfolio
            <span className="text-primary"> Effortlessly</span>
          </h1>
          <p className="mb-10 text-lg text-muted-foreground sm:text-xl">
            Monitor your investments, track performance, and make informed
            decisions with our powerful portfolio tracking tools.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Suspense
              fallback={
                <Button size="lg" disabled className="min-w-[140px]">
                  Loading
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              }
            >
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </main>

      <Suspense>
        <Footer/>
      </Suspense>
    </div>
  );
}