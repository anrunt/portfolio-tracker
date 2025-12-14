"use client";
import { authClient } from "@/server/better-auth/client";

export default function Login() {
  const {data: session, isPending} = authClient.useSession();
  
  if (isPending) {
    return <p>Loading...</p>
  }

  return (
    <>
      <h1>Login page</h1>
      {session ? (
        <button
          className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          onClick={async () => {
            await authClient.signOut();
            window.location.href = "/";
          }}
        >
          Sign out
        </button>
      ) : (
        <button
          className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          onClick={async () => {
            await authClient.signIn.social({
              provider: "github",
              callbackURL: "/dashboard",
            });
          }}
        >
          Sign in with github
        </button>
      )}
    </>
  );
}
