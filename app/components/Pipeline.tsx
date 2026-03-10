"use client"

import * as React from "react"
import { CandidateCard } from "./CandidateCard"
import { CandidateDetail } from "./CandidateDetail"
import type { ScoredCandidate } from "@/lib/scoring"

const STAGES = [
  "Intake",
  "Screening",
  "Interview Scheduled",
  "Interview Done",
  "Offer Extended",
  "Offer Accepted",
  "Joined",
]

const STAGE_COLORS: Record<string, string> = {
  "Intake": "#7C6AF7",
  "Screening": "#38BDF8",
  "Interview Scheduled": "#FBBF24",
  "Interview Done": "#FB923C",
  "Offer Extended": "#F87171",
  "Offer Accepted": "#34D399",
  "Joined": "#22C55E",
}

type Analytics = {
  total_candidates: number
  band_counts: { Low: number; Moderate: number; Elevated: number; High: number }
  avg_risk_score: number
}

export function Pipeline() {
  const [candidates, setCandidates] = React.useState<ScoredCandidate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [reviewCount, setReviewCount] = React.useState(0)
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null)

  const loadData = React.useCallback(() => {
    Promise.all([
      fetch("/api/candidates").then(r => r.json()),
      fetch("/api/review-queue?resolved=false").then(r => r.json()),
      fetch("/api/analytics").then(r => r.json()),
    ]).then(([cands, queue, stats]) => {
      setCandidates(cands)
      setReviewCount(Array.isArray(queue) ? queue.length : 0)
      setAnalytics(stats)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  React.useEffect(() => { loadData() }, [loadData])

  // Refresh every 30s
  React.useEffect(() => {
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const grouped = React.useMemo(() => {
    const map: Record<string, ScoredCandidate[]> = {}
    STAGES.forEach(s => map[s] = [])
    for (const c of candidates) {
      if (map[c.current_stage]) map[c.current_stage].push(c)
      else map[c.current_stage] = [c]
    }
    // Sort each column by risk score descending (highest risk on top)
    for (const stage of STAGES) {
      map[stage].sort((a, b) => b.candidate_risk_score - a.candidate_risk_score)
    }
    return map
  }, [candidates])

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton stats */}
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 w-40 animate-pulse rounded-lg bg-[#1A1D27]" />
          ))}
        </div>
        {/* Skeleton columns */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(s => (
            <div key={s} className="w-60 flex-shrink-0 animate-pulse rounded-lg bg-[#1A1D27] p-4">
              <div className="mb-3 h-5 w-24 rounded bg-[#2A2D3A]" />
              <div className="space-y-2">
                <div className="h-20 rounded bg-[#2A2D3A]" />
                <div className="h-20 rounded bg-[#2A2D3A]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Compute drop-off between stages
  const dropOffs: Record<string, string> = {}
  for (let i = 1; i < STAGES.length; i++) {
    const prev = (grouped[STAGES[i - 1]] || []).length
    const curr = (grouped[STAGES[i]] || []).length
    if (prev > 0 && curr < prev) {
      const pct = Math.round(((prev - curr) / prev) * 100)
      dropOffs[STAGES[i]] = `-${pct}%`
    }
  }

  return (
    <>
      {/* Stats bar */}
      {analytics && (
        <div className="mb-4 flex items-stretch gap-3 overflow-x-auto">
          <StatCard label="Total Pipeline" value={analytics.total_candidates} />
          <StatCard label="Avg Risk" value={analytics.avg_risk_score} suffix="/100"
            color={analytics.avg_risk_score >= 45 ? "#F87171" : analytics.avg_risk_score >= 25 ? "#FBBF24" : "#34D399"} />
          <RiskDistBar counts={analytics.band_counts} total={analytics.total_candidates} />
          {reviewCount > 0 && (
            <div style={{ borderRadius: 10, borderLeft: "3px solid #FBBF24", background: "#1A1508", padding: "10px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#78350F", marginBottom: 2 }}>Needs Attention</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#FBBF24", lineHeight: 1.1 }}>{reviewCount}</p>
            </div>
          )}
        </div>
      )}

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage, idx) => {
          const cards = grouped[stage] || []
          const stageColor = STAGE_COLORS[stage] || "#8B90A0"
          const highRiskCount = cards.filter(c => c.risk_band === "High" || c.risk_band === "Elevated").length

          return (
            <div key={stage} className="w-60 flex-shrink-0 rounded-xl" style={{ border: "1px solid #1E2130", background: "#0E1018" }}>
              {/* Column header */}
              <div className="px-3 py-3" style={{ borderBottom: "1px solid #1E2130" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageColor, boxShadow: `0 0 6px ${stageColor}60` }} />
                    <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C8CCE0" }}>{stage}</h3>
                  </div>
                  <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#1A1E2E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#C8CCE0", padding: "0 6px" }}>
                    {cards.length}
                  </span>
                </div>
                {dropOffs[stage] && (
                  <p style={{ marginTop: 4, fontSize: 10, color: "#F87171", fontWeight: 600 }}>{dropOffs[stage]} from {STAGES[idx - 1]}</p>
                )}
                {highRiskCount > 0 && (
                  <p style={{ marginTop: 2, fontSize: 10, color: "#FB923C", fontWeight: 500 }}>{highRiskCount} at risk</p>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2 p-2" style={{ minHeight: 80 }}>
                {cards.map(c => (
                  <CandidateCard key={c.candidate_id} candidate={c} onClick={() => setSelectedId(c.candidate_id)} />
                ))}
                {cards.length === 0 && stage === "Joined" && (
                  <div className="flex flex-col items-center gap-1 py-6">
                    <span className="text-2xl">&#10003;</span>
                    <p className="text-[10px] text-[#34D399]">Placements land here</p>
                  </div>
                )}
                {cards.length === 0 && stage !== "Joined" && (
                  <p className="py-6 text-center text-[10px] text-[#5A5F72]">No candidates</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail drawer */}
      {selectedId && (
        <CandidateDetail candidateId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  )
}

function StatCard({ label, value, suffix, color }: {
  label: string; value: number; suffix?: string; color?: string
}) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid #1E2130", background: "#0E1018", padding: "10px 16px" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A6080", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: color || "#F0F2F8", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {value}{suffix && <span style={{ fontSize: 12, fontWeight: 500, color: "#5A6080" }}>{suffix}</span>}
      </p>
    </div>
  )
}

function RiskDistBar({ counts, total }: {
  counts: { Low: number; Moderate: number; Elevated: number; High: number }
  total: number
}) {
  if (total === 0) return null
  const segments = [
    { label: "Low", count: counts.Low, color: "#34D399" },
    { label: "Mod", count: counts.Moderate, color: "#FBBF24" },
    { label: "Elev", count: counts.Elevated, color: "#FB923C" },
    { label: "High", count: counts.High, color: "#F87171" },
  ]

  return (
    <div style={{ flex: 1, minWidth: 200, borderRadius: 10, border: "1px solid #1E2130", background: "#0E1018", padding: "10px 16px" }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5A6080", marginBottom: 6 }}>Risk Distribution</p>
      <div style={{ display: "flex", height: 18, width: "100%", overflow: "hidden", borderRadius: 9, background: "#080A10" }}>
        {segments.map(s => s.count > 0 && (
          <div
            key={s.label}
            style={{
              width: `${(s.count / total) * 100}%`,
              backgroundColor: s.color,
              minWidth: s.count > 0 ? 24 : 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#000",
            }}
          >
            {s.count}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
        {segments.map(s => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            <span style={{ color: "#8890A8", fontWeight: 500 }}>{s.label} <strong style={{ color: "#C8CCE0" }}>{s.count}</strong></span>
          </span>
        ))}
      </div>
    </div>
  )
}
