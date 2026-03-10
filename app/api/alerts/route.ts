import { NextResponse } from "next/server"
import { getCandidates, getBehavioralProfile } from "@/lib/store"
import { scanForAlerts, generateDigest, type Alert } from "@/lib/proactive-engine"
import type { BehavioralProfile } from "@/lib/behavioral-profiler"

export async function GET() {
  const candidates = await getCandidates()

  // Load behavioral profiles for all candidates
  const profiles = new Map<string, BehavioralProfile>()
  for (const c of candidates) {
    const profile = await getBehavioralProfile(c.candidate_id)
    if (profile) profiles.set(c.candidate_id, profile)
  }

  const alerts = scanForAlerts(candidates, profiles)
  const digest = generateDigest(candidates, alerts)

  return NextResponse.json({
    alerts,
    digest,
    summary: {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === "critical").length,
      urgent: alerts.filter(a => a.severity === "urgent").length,
      warning: alerts.filter(a => a.severity === "warning").length,
      info: alerts.filter(a => a.severity === "info").length,
    },
  })
}
