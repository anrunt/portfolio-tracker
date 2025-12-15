import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/session";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
