"use client"

export function Footer() {
  return (
    <footer className="footer-background py-6 text-center text-sm text-background">
      <p>© {new Date().getFullYear()} Portfolio Tracker. All rights reserved.</p>
    </footer>
  )
}