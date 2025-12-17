"use client"

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
      <p>© {new Date().getFullYear()} Portfolio Tracker. All rights reserved.</p>
    </footer>
  )
}