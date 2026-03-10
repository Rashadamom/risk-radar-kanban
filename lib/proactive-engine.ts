// Proactive Risk Management Engine
// Scans all candidates and generates alerts + automated actions
// This is what makes RiskRadar "act, not assist"

import type { ScoredCandidate } from "./scoring"
import type { BehavioralProfile } from "./behavioral-profiler"

export type Alert = {
  alert_id: string
  candidate_id: string
  candidate_name: string
  type: AlertType
  severity: "info" | "warning" | "urgent" | "critical"
  title: string
  description: string
  suggested_action: string
  auto_message?: string // WhatsApp message to auto-send
  auto_target?: "candidate" | "recruiter" | "interviewer"
  created_at: string
  acknowledged: boolean
}

export type AlertType =
  | "silent_candidate"
  | "counter_offer_risk"
  | "joining_countdown"
  | "feedback_overdue"
  | "risk_score_spike"
  | "ghosting_detected"
  | "offer_stage_silence"
  | "new_high_risk"
  | "behavioral_red_flag"
  | "process_stalled"

export function scanForAlerts(
  candidates: ScoredCandidate[],
  profiles: Map<string, BehavioralProfile>,
): Alert[] {
  const alerts: Alert[] = []
  const now = Date.now()

  for (const c of candidates) {
    const profile = profiles.get(c.candidate_id)

    // ── SILENT CANDIDATE (24h/48h/96h thresholds) ─────────────────────
    if (c.comm_lag_hours > 96) {
      alerts.push({
        alert_id: `alert_silence_${c.candidate_id}`,
        candidate_id: c.candidate_id,
        candidate_name: c.candidate_name,
        type: "silent_candidate",
        severity: "critical",
        title: `${c.candidate_name} silent for ${c.comm_lag_hours}h`,
        description: `No response in ${Math.round(c.comm_lag_hours / 24)} days. 75% correlation with dropout at this point.`,
        suggested_action: "Call immediately. If no answer, send final WhatsApp. Consider pipeline hold.",
        auto_message: `Hi ${c.candidate_name.split(" ")[0]}, we haven't heard from you in a while. Are you still interested in the ${c.role} position? A quick yes/no would help us plan. No pressure either way.`,
        auto_target: "candidate",
        created_at: new Date().toISOString(),
        acknowledged: false,
      })
    } else if (c.comm_lag_hours > 48) {
      alerts.push({
        alert_id: `alert_silence_${c.candidate_id}`,
        candidate_id: c.candidate_id,
        candidate_name: c.candidate_name,
        type: "silent_candidate",
        severity: "urgent",
        title: `${c.candidate_name} silent for ${c.comm_lag_hours}h`,
        description: `No response in 2+ days. Check if candidate is juggling offers.`,
        suggested_action: "Send a gentle check-in. Ask an easy question they can reply to quickly.",
        auto_message: `Hi ${c.candidate_name.split(" ")[0]}, just checking in! How's everything going? Any questions about the ${c.role} role?`,
        auto_target: "candidate",
        created_at: new Date().toISOString(),
        acknowledged: false,
      })
    } else if (c.comm_lag_hours > 24 && (c.current_stage === "Offer Extended" || c.current_stage === "Offer Accepted")) {
      alerts.push({
        alert_id: `alert_offer_silence_${c.candidate_id}`,
        candidate_id: c.candidate_id,
        candidate_name: c.candidate_name,
        type: "offer_stage_silence",
        severity: "urgent",
        title: `Offer-stage candidate ${c.candidate_name} going silent`,
        description: `${c.comm_lag_hours}h since last response. Offer-stage silence is the highest-risk dropout window.`,
        suggested_action: "Call candidate. Check for counter-offer. Reaffirm offer value.",
        created_at: new Date().toISOString(),
        acknowledged: false,
      })
    }

    // ── COUNTER-OFFER RISK ────────────────────────────────────────────
    // Research: >3 years tenure + moderate hike = high counter-offer risk
    const hike = c.hike_percent ?? 0
    if (hike < 40 && c.notice_period_days >= 60 &&
        (c.current_stage === "Offer Extended" || c.current_stage === "Offer Accepted")) {
      alerts.push({
        alert_id: `alert_counter_${c.candidate_id}`,
        candidate_id: c.candidate_id,
        candidate_name: c.candidate_name,
        type: "counter_offer_risk",
        severity: "warning",
        title: `Counter-offer risk: ${c.candidate_name}`,
        description: `${hike}% hike with ${c.notice_period_days}d notice. Current employer has time and incentive to counter-offer. 50-65% of candidates accept counter-offers.`,
        suggested_action: "Have the 'counter-offer inoculation' conversation. Ask: 'What will you do if your current employer makes a counter-offer?' Address it before it happens.",
        auto_message: `Hi ${c.candidate_name.split(" ")[0]}, quick question — has your current team said anything about your resignation? Sometimes managers make counter-offers. Wanted to check in.`,
        auto_target: "candidate",
        created_at: new Date().toISOString(),
        acknowledged: false,
      })
    }

    // ── JOINING COUNTDOWN ─────────────────────────────────────────────
    if (c.current_stage === "Offer Accepted") {
      const daysToJoin = Math.max(0, Math.round(
        (new Date(c.earliest_joining_date).getTime() - now) / 86400000
      ))

      if (daysToJoin <= 7) {
        alerts.push({
          alert_id: `alert_join_${c.candidate_id}`,
          candidate_id: c.candidate_id,
          candidate_name: c.candidate_name,
          type: "joining_countdown",
          severity: daysToJoin <= 2 ? "critical" : "warning",
          title: `${c.candidate_name} joining in ${daysToJoin} days`,
          description: `Day-1 no-show rate is 10-20%. Increase check-in frequency.`,
          suggested_action: daysToJoin <= 2
            ? "Confirm joining logistics: time, location, documents, laptop. Get verbal confirmation TODAY."
            : "Send joining prep details. Confirm they haven't changed their mind.",
          auto_message: daysToJoin <= 2
            ? `Hi ${c.candidate_name.split(" ")[0]}! Excited to have you join in ${daysToJoin} day${daysToJoin > 1 ? "s" : ""}! Just confirming — you're all set for Day 1? Here's what to bring: [ID, offer letter copy, bank details].`
            : `Hi ${c.candidate_name.split(" ")[0]}, your joining date is ${daysToJoin} days away! Getting everything ready on our end. Any questions about the first week?`,
          auto_target: "candidate",
          created_at: new Date().toISOString(),
          acknowledged: false,
        })
      } else if (daysToJoin <= 14) {
        alerts.push({
          alert_id: `alert_join_${c.candidate_id}`,
          candidate_id: c.candidate_id,
          candidate_name: c.candidate_name,
          type: "joining_countdown",
          severity: "info",
          title: `${c.candidate_name} joining in ${daysToJoin} days`,
          description: `Notice period ending soon. Weekly check-in recommended.`,
          suggested_action: "Send a warm check-in. Share onboarding details, team intro.",
          created_at: new Date().toISOString(),
          acknowledged: false,
        })
      }
    }

    // ── NEW HIGH RISK CANDIDATE ───────────────────────────────────────
    if (c.candidate_risk_score >= 55 && c.current_stage === "Intake") {
      alerts.push({
        alert_id: `alert_highrisk_${c.candidate_id}`,
        candidate_id: c.candidate_id,
        candidate_name: c.candidate_name,
        type: "new_high_risk",
        severity: "warning",
        title: `New high-risk candidate: ${c.candidate_name} (${c.candidate_risk_score})`,
        description: `Entered pipeline with High risk band. Hard stops: ${c.hard_stop_flags.join(", ") || "none"}.`,
        suggested_action: "Review before investing interview time. Consider if candidate is viable.",
        created_at: new Date().toISOString(),
        acknowledged: false,
      })
    }

    // ── BEHAVIORAL RED FLAGS ──────────────────────────────────────────
    if (profile) {
      if (profile.ghosting_pattern) {
        alerts.push({
          alert_id: `alert_ghost_${c.candidate_id}`,
          candidate_id: c.candidate_id,
          candidate_name: c.candidate_name,
          type: "ghosting_detected",
          severity: "critical",
          title: `Ghosting detected: ${c.candidate_name}`,
          description: `Was responding, then stopped. ${profile.total_messages_received} recruiter messages sent after last candidate response. 75% correlation with dropout.`,
          suggested_action: "Escalate to phone call. If no answer in 24h, consider pipeline hold.",
          created_at: new Date().toISOString(),
          acknowledged: false,
        })
      }

      if (profile.mentions_counter_offer) {
        alerts.push({
          alert_id: `alert_counteroffer_mentioned_${c.candidate_id}`,
          candidate_id: c.candidate_id,
          candidate_name: c.candidate_name,
          type: "behavioral_red_flag",
          severity: "critical",
          title: `Counter-offer mentioned: ${c.candidate_name}`,
          description: `Candidate explicitly mentioned counter-offer or current employer matching. This is the #1 dropout reason.`,
          suggested_action: "Immediate call. Understand their decision criteria. If comp is the only factor, you may lose this one.",
          created_at: new Date().toISOString(),
          acknowledged: false,
        })
      }

      if (profile.behavioral_risk_adjustment >= 20) {
        alerts.push({
          alert_id: `alert_behavioral_${c.candidate_id}`,
          candidate_id: c.candidate_id,
          candidate_name: c.candidate_name,
          type: "behavioral_red_flag",
          severity: "urgent",
          title: `Behavioral risk spike: ${c.candidate_name} (+${profile.behavioral_risk_adjustment})`,
          description: `Signals: ${profile.behavioral_signals.slice(0, 3).join("; ")}`,
          suggested_action: "Review conversation history. Assess if candidate is still genuinely interested.",
          created_at: new Date().toISOString(),
          acknowledged: false,
        })
      }
    }

    // ── PROCESS STALLED ───────────────────────────────────────────────
    // Research: top candidates are off market in 10 days. Process delays = dropout.
    if (c.current_stage === "Interview Done" && c.comm_lag_hours > 48) {
      alerts.push({
        alert_id: `alert_stalled_${c.candidate_id}`,
        candidate_id: c.candidate_id,
        candidate_name: c.candidate_name,
        type: "process_stalled",
        severity: "warning",
        title: `Process stalled: ${c.candidate_name} (Interview Done, ${c.comm_lag_hours}h idle)`,
        description: `Interview completed but no feedback or next step for ${Math.round(c.comm_lag_hours / 24)}d. Each day of delay = 1-2% dropout increase.`,
        suggested_action: "Chase interviewer feedback immediately. Move to offer or reject within 48h.",
        created_at: new Date().toISOString(),
        acknowledged: false,
      })
    }
  }

  // Sort: critical first, then urgent, then warning, then info
  const severityOrder = { critical: 0, urgent: 1, warning: 2, info: 3 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}

// Generate weekly digest for a recruiter
export function generateDigest(
  candidates: ScoredCandidate[],
  alerts: Alert[],
): string {
  const critical = alerts.filter(a => a.severity === "critical").length
  const urgent = alerts.filter(a => a.severity === "urgent").length
  const highRisk = candidates.filter(c => c.risk_band === "High" || c.risk_band === "Elevated")
  const offerStage = candidates.filter(c => c.current_stage === "Offer Extended" || c.current_stage === "Offer Accepted")

  return [
    `*RiskRadar Weekly Digest*`,
    ``,
    `Pipeline: ${candidates.length} candidates`,
    `Alerts: ${critical} critical, ${urgent} urgent`,
    ``,
    highRisk.length > 0
      ? `*At Risk:*\n${highRisk.map(c => `  ${c.candidate_name} — ${c.risk_band} (${c.candidate_risk_score})`).join("\n")}`
      : `All candidates in safe zone.`,
    ``,
    offerStage.length > 0
      ? `*Offer Stage (watch closely):*\n${offerStage.map(c => `  ${c.candidate_name} — ${c.current_stage}, ${c.comm_lag_hours}h since last contact`).join("\n")}`
      : "",
    ``,
    critical > 0 ? `*Action needed on ${critical} critical alert${critical > 1 ? "s" : ""} — open dashboard.*` : "",
  ].filter(Boolean).join("\n")
}
