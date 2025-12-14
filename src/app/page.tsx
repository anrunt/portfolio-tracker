import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Hello world</h1>
      <div className="flex gap-2">
        <Link href="/login">Login</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>
      
    </>
  );
}