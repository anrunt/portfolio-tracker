"use client"

export function Footer() {
  return (
    <footer className="bg-[#1C2101] py-6 text-center text-sm text-[#D9E3AA]">
      <p>© {new Date().getFullYear()} Portfolio Tracker. All rights reserved.</p>
    </footer>
  )
}