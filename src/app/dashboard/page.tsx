import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await getSession()

  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Welcome {session.user.name}</h1>
    </div>
  );
}
