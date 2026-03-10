"use client"

import * as React from "react"
import { RiskBadge, RiskBorderColor } from "./RiskBadge"
import type { ScoredCandidate } from "@/lib/scoring"

export function CandidateCard({
  candidate,
  onClick,
}: {
  candidate: ScoredCandidate
  onClick?: () => void
}) {
  const borderColor = RiskBorderColor(candidate.risk_band)
  const silentHours = candidate.comm_lag_hours
  const [showTooltip, setShowTooltip] = React.useState(false)

  // Days until joining
  const joiningDays = Math.max(0, Math.round(
    (new Date(candidate.earliest_joining_date).getTime() - Date.now()) / 86400000
  ))

  return (
    <button
      onClick={onClick}
      className="group relative w-full cursor-pointer rounded-lg border border-[#2A2D3A] bg-[#1A1D27] px-3 py-2.5 text-left transition-all hover:bg-[#22252F] hover:border-[#3A3D4A]"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      {/* Review required pulse */}
      {candidate.review_required && (
        <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      )}

      {/* Name + Role + Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#E8EAEF]">{candidate.candidate_name}</p>
          <p className="truncate text-xs text-[#8B90A0]">{candidate.role}</p>
        </div>
        <div
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <RiskBadge band={candidate.risk_band} score={candidate.candidate_risk_score} />

          {/* "Why this score" tooltip */}
          {showTooltip && candidate.reason_codes.length > 0 && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-[#2A2D3A] bg-[#13151C] p-2.5 shadow-xl">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#5A5F72]">Why this score</p>
              {candidate.reason_codes.slice(0, 3).map((code, i) => (
                <p key={i} className="text-[10px] leading-relaxed text-[#8B90A0]">
                  <span className="mr-1 text-[#F87171]">*</span>{code}
                </p>
              ))}
              {candidate.hard_stop_flags.length > 0 && (
                <div className="mt-1.5 border-t border-[#2A2D3A] pt-1.5">
                  {candidate.hard_stop_flags.map((flag, i) => (
                    <p key={i} className="text-[10px] font-medium text-[#F87171]">
                      BLOCKER: {flag.replace(/_/g, " ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-2 flex items-center gap-2 text-[10px]">
        {/* Silent hours with breath animation */}
        {silentHours > 24 && (
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
            silentHours > 72 ? "bg-[#2D1B1B] text-[#F87171]"
            : silentHours > 48 ? "bg-[#2D1F14] text-[#FB923C]"
            : "bg-[#2C2008] text-[#FBBF24]"
          }`} style={silentHours > 48 ? { animation: "breath 3s ease-in-out infinite" } : undefined}>
            {silentHours}h silent
          </span>
        )}

        {/* Hike indicator */}
        {candidate.hike_percent !== null && candidate.hike_percent > 20 && (
          <span className={`rounded px-1.5 py-0.5 font-mono font-medium ${
            candidate.hike_percent >= 100 ? "bg-[#2D1B1B] text-[#F87171]"
            : candidate.hike_percent >= 50 ? "bg-[#2D1F14] text-[#FB923C]"
            : candidate.hike_percent >= 30 ? "bg-[#2C2008] text-[#FBBF24]"
            : "text-[#5A5F72]"
          }`}>
            {candidate.hike_percent}% hike
          </span>
        )}

        {/* Notice period */}
        {candidate.notice_period_days >= 60 && (
          <span className="rounded px-1.5 py-0.5 text-[#8B90A0]">
            {candidate.notice_period_days}d notice
          </span>
        )}

        {/* Joining countdown for late-stage candidates */}
        {(candidate.current_stage === "Offer Extended" || candidate.current_stage === "Offer Accepted") && joiningDays <= 30 && (
          <span className={`rounded px-1.5 py-0.5 font-medium ${
            joiningDays <= 7 ? "bg-[#0D2420] text-[#34D399]" : "text-[#8B90A0]"
          }`}>
            {joiningDays}d to join
          </span>
        )}
      </div>

      {/* Skill tags - show on hover */}
      <div className="mt-1.5 hidden group-hover:flex flex-wrap gap-1">
        {candidate.skill_stack.split(",").slice(0, 3).map((skill, i) => (
          <span key={i} className="rounded bg-[#7C6AF7]/10 px-1.5 py-0.5 text-[9px] text-[#7C6AF7]">
            {skill.trim()}
          </span>
        ))}
      </div>
    </button>
  )
}
