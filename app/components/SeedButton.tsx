"use client"

import * as React from "react"

export function SeedButton() {
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)

  async function seed() {
    setLoading(true)
    try {
      await fetch("/api/seed", { method: "POST" })
      setDone(true)
      // Reload to show pipeline
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  if (done) return null

  return (
    <button
      onClick={seed}
      disabled={loading}
      className="rounded-md border border-[#2A2D3A] bg-[#1A1D27] px-3 py-1.5 text-xs font-medium text-[#8B90A0] transition-colors hover:bg-[#22252F] hover:text-[#E8EAEF] disabled:opacity-50"
    >
      {loading ? "Seeding..." : "Load Demo Data"}
    </button>
  )
}
