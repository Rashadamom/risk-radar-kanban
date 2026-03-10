"use client"

import * as React from "react"
import { RiskBadge } from "./RiskBadge"
import type { ScoredCandidate } from "@/lib/scoring"
import type { StageUpdate } from "@/lib/store"
import type { BehavioralProfile } from "@/lib/behavioral-profiler"

type DetailData = ScoredCandidate & { stage_history?: StageUpdate[] }

export function CandidateDetail({
  candidateId,
  onClose,
}: {
  candidateId: string
  onClose: () => void
}) {
  const [data, setData] = React.useState<DetailData | null>(null)
  const [profile, setProfile] = React.useState<BehavioralProfile | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/candidates/${candidateId}`).then(r => r.json()),
      fetch(`/api/candidates/${candidateId}/profile`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([d, p]) => {
      setData(d)
      setProfile(p)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [candidateId])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50">
        <div className="h-full w-full max-w-2xl bg-[#0F1117] p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-[#1A1D27]" />
            <div className="h-32 rounded bg-[#1A1D27]" />
            <div className="h-48 rounded bg-[#1A1D27]" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const hikeColor = (data.hike_percent ?? 0) >= 50 ? "text-[#F87171]"
    : (data.hike_percent ?? 0) >= 30 ? "text-[#FB923C]"
    : "text-[#34D399]"

  const commColor = data.comm_lag_hours > 72 ? "text-[#F87171]"
    : data.comm_lag_hours > 24 ? "text-[#FBBF24]"
    : "text-[#34D399]"

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end animate-fade-in bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-[#0F1117] border-l border-[#2A2D3A] animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#2A2D3A] p-6">
          <div>
            <h2 className="text-xl font-semibold text-[#E8EAEF]">{data.candidate_name}</h2>
            <p className="text-sm text-[#8B90A0]">{data.role} | {data.current_location}</p>
            <span className="mt-1 inline-block rounded-full bg-[#7C6AF7]/20 px-2.5 py-0.5 text-xs font-medium text-[#7C6AF7]">
              {data.current_stage}
            </span>
          </div>
          <button onClick={onClose} className="text-[#5A5F72] hover:text-[#E8EAEF] text-xl">&times;</button>
        </div>

        <div className="flex-1 space-y-6 p-6">
          {/* Risk Score Hero */}
          <div className="flex items-center gap-6">
            <RiskScoreArc score={data.candidate_risk_score} band={data.risk_band} label="Candidate Risk" />
            <RiskScoreArc score={data.process_risk_score} band="Moderate" label="Process Risk" size="small" />
          </div>

          {/* Blockers */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5F72]">Blockers</h3>
            {data.hard_stop_flags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.hard_stop_flags.map((flag, i) => (
                  <span key={i} className="rounded bg-[#2D1B1B] px-2.5 py-1 text-xs font-medium text-[#F87171]">
                    {flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            ) : (
              <span className="rounded bg-[#0D2420] px-2.5 py-1 text-xs font-medium text-[#34D399]">No blockers</span>
            )}
          </div>

          {/* Risk Signals */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#5A5F72]">Risk Signals</h3>
            <div className="flex flex-wrap gap-2">
              {data.reason_codes.map((code, i) => (
                <span key={i} className="rounded bg-[#1A1D27] px-2.5 py-1 text-xs text-[#8B90A0]">{code}</span>
              ))}
            </div>
          </div>

          {/* Recommended Action */}
          <div className="rounded-lg bg-[#2C2008] px-4 py-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#78350F]">Recommended Action</p>
            <p className="text-sm font-medium text-[#FBBF24]">{data.next_action}</p>
          </div>

          {/* Candidate Snapshot */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-[#2A2D3A] bg-[#1A1D27] p-4">
            <FieldRow label="Current Comp" value={`${(data.current_compensation / 100000).toFixed(1)} LPA`} />
            <FieldRow label="Expected" value={`${(data.expected_compensation / 100000).toFixed(1)} LPA`} />
            <FieldRow label="Hike" value={`${data.hike_percent ?? 0}%`} className={hikeColor} />
            <FieldRow label="Notice" value={`${data.notice_period_days} days`} />
            <FieldRow label="Buyout" value={data.buyout_possible} />
            <FieldRow label="Joining" value={new Date(data.earliest_joining_date).toLocaleDateString()} />
            <FieldRow label="Work Mode" value={data.work_mode} />
            <FieldRow label="Relocation" value={data.relocation_willingness} />
            <FieldRow label="Resume" value={data.docs_status === "resume_received" ? "Received" : "Missing"} />
            <FieldRow label="Interview" value={data.available_for_interview_soon} />
            <FieldRow label="Comm Lag" value={`${data.comm_lag_hours}h`} className={commColor} />
            <FieldRow label="Skills" value={data.skill_stack} />
          </div>

          {/* Behavioral Profile */}
          {profile && (
            <div className="rounded-lg border border-[#2A2D3A] bg-[#1A1D27] p-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#5A5F72]">
                Behavioral Profile
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  profile.behavioral_risk_adjustment > 10 ? "bg-[#2D1B1B] text-[#F87171]"
                  : profile.behavioral_risk_adjustment > 0 ? "bg-[#2C2008] text-[#FBBF24]"
                  : profile.behavioral_risk_adjustment < 0 ? "bg-[#0D2420] text-[#34D399]"
                  : "bg-[#1A1D27] text-[#8B90A0]"
                }`}>
                  {profile.behavioral_risk_adjustment > 0 ? "+" : ""}{profile.behavioral_risk_adjustment} risk adj
                </span>
              </h3>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#5A5F72]">Avg Response</p>
                  <p className="text-sm text-[#E8EAEF] font-mono">
                    {profile.avg_response_time_minutes < 60
                      ? `${profile.avg_response_time_minutes}m`
                      : `${Math.round(profile.avg_response_time_minutes / 60)}h`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#5A5F72]">Response Rate</p>
                  <p className={`text-sm font-mono ${profile.response_rate >= 80 ? "text-[#34D399]" : profile.response_rate >= 50 ? "text-[#FBBF24]" : "text-[#F87171]"}`}>
                    {profile.response_rate}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#5A5F72]">Sentiment</p>
                  <p className={`text-sm ${
                    profile.sentiment_trend === "positive" ? "text-[#34D399]"
                    : profile.sentiment_trend === "declining" || profile.sentiment_trend === "negative" ? "text-[#F87171]"
                    : "text-[#8B90A0]"
                  }`}>
                    {profile.sentiment_trend}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-[10px]">
                <TrendPill label="Response speed" trend={profile.response_time_trend} invertColor />
                <TrendPill label="Message detail" trend={profile.message_length_trend} />
              </div>

              {/* Red flags */}
              <div className="flex flex-wrap gap-1.5">
                {profile.mentions_other_offers && <SignalChip text="Other offers mentioned" color="red" />}
                {profile.mentions_counter_offer && <SignalChip text="Counter-offer discussed" color="red" />}
                {profile.ghosting_pattern && <SignalChip text="Ghosting pattern" color="red" />}
                {profile.uses_hedging_language && <SignalChip text="Hedging language" color="amber" />}
                {profile.mentions_family_concerns && <SignalChip text="Family concerns" color="amber" />}
                {profile.mentions_relocation_doubt && <SignalChip text="Relocation doubts" color="amber" />}
                {profile.weekend_only_responder && <SignalChip text="Weekend-only responder" color="amber" />}
                {profile.uses_enthusiastic_language && <SignalChip text="Enthusiastic" color="green" />}
                {profile.asks_questions && <SignalChip text="Asks questions" color="green" />}
              </div>

              {profile.behavioral_signals.length > 0 && (
                <div className="mt-3 space-y-1">
                  {profile.behavioral_signals.map((s, i) => (
                    <p key={i} className="text-[10px] text-[#8B90A0]">- {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stage History */}
          {data.stage_history && data.stage_history.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#5A5F72]">Stage History</h3>
              <div className="space-y-0">
                {data.stage_history.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 border-l-2 border-[#2A2D3A] py-2 pl-4">
                    <div className="flex-1">
                      <p className="text-sm text-[#E8EAEF]">
                        {event.from_stage} → {event.to_stage}
                      </p>
                      <p className="text-xs text-[#5A5F72]">
                        {new Date(event.event_timestamp).toLocaleString()} | {event.triggered_by}
                      </p>
                    </div>
                    <RiskBadge band={event.risk_band as any} score={event.candidate_risk_score} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrendPill({ label, trend, invertColor }: { label: string; trend: string; invertColor?: boolean }) {
  const isGood = invertColor
    ? trend === "degrading" ? false : trend === "improving" ? true : null
    : trend === "increasing" ? true : trend === "decreasing" ? false : null
  const color = isGood === true ? "text-[#34D399]" : isGood === false ? "text-[#F87171]" : "text-[#8B90A0]"
  const arrow = isGood === true ? "^" : isGood === false ? "v" : "-"
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#5A5F72]">{label}</span>
      <span className={`font-mono font-bold ${color}`}>{arrow} {trend}</span>
    </div>
  )
}

function SignalChip({ text, color }: { text: string; color: "red" | "amber" | "green" }) {
  const styles = {
    red: "bg-[#2D1B1B] text-[#F87171]",
    amber: "bg-[#2C2008] text-[#FBBF24]",
    green: "bg-[#0D2420] text-[#34D399]",
  }
  return <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${styles[color]}`}>{text}</span>
}

function FieldRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#5A5F72]">{label}</p>
      <p className={`text-sm ${className || "text-[#E8EAEF]"}`}>{value}</p>
    </div>
  )
}

function RiskScoreArc({
  score,
  band,
  label,
  size = "large",
}: {
  score: number
  band: string
  label: string
  size?: "large" | "small"
}) {
  const radius = size === "large" ? 50 : 32
  const stroke = size === "large" ? 8 : 5
  const svgSize = (radius + stroke) * 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const bandColors: Record<string, string> = {
    Low: "#34D399", Moderate: "#FBBF24", Elevated: "#FB923C", High: "#F87171",
  }
  const color = bandColors[band] || "#FBBF24"

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          <circle cx={radius + stroke} cy={radius + stroke} r={radius}
            fill="none" stroke="#1A1D27" strokeWidth={stroke} />
          <circle cx={radius + stroke} cy={radius + stroke} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            className="animate-score-fill" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono font-bold ${size === "large" ? "text-2xl" : "text-lg"} text-[#E8EAEF] animate-count-up`}>
            {score}
          </span>
        </div>
      </div>
      <p className={`text-center ${size === "large" ? "text-xs" : "text-[10px]"} font-bold uppercase tracking-wider`}
        style={{ color }}>{band}</p>
      <p className="text-[10px] text-[#5A5F72]">{label}</p>
    </div>
  )
}
