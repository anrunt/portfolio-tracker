"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/server/better-auth/client";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (session) {
    router.replace("/dashboard");
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return <LoginForm />;
}
