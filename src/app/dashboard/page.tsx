import { getSession } from "@/server/better-auth/session";

export default async function Dashboard() {
  const session = await getSession()

  if (!session) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h1>Welcome {session.user.name}</h1>
    </div>
  );
}
