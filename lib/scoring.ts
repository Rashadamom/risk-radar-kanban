// Candidate commitment risk scoring engine
// Ported from n8n NORMALIZE_INTAKE + SCORE_RISK nodes

export type CandidateIntake = {
  candidate_id?: string
  candidate_name: string
  phone: string
  email?: string
  recruiter_id: string
  recruiter_name?: string
  client_id?: string
  source?: string
  role: string
  skill_stack: string
  total_experience?: string
  current_location: string
  current_compensation: number | string
  expected_compensation: number | string
  notice_period_days: number | string
  buyout_possible?: string
  earliest_joining_date: string
  job_location: string
  work_mode: string
  relocation_willingness?: string
  resume_received?: string
  available_for_interview_soon?: string
  last_response_timestamp?: string
  notes?: string
  current_stage?: string
}

export type ScoredCandidate = {
  candidate_id: string
  created_at: string
  updated_at: string
  candidate_name: string
  phone: string
  email: string
  recruiter_id: string
  recruiter_name: string
  client_id: string
  source: string
  role: string
  skill_stack: string
  total_experience: string
  current_location: string
  current_compensation: number
  expected_compensation: number
  hike_percent: number | null
  notice_period_days: number
  buyout_possible: string
  earliest_joining_date: string
  job_location: string
  work_mode: string
  relocation_willingness: string
  resume_received: string
  available_for_interview_soon: string
  last_response_timestamp: string
  comm_lag_hours: number
  notes: string
  current_stage: string
  docs_status: string
  submission_status: string
  interview_status: string
  offer_status: string
  join_status: string
  candidate_risk_score: number
  process_risk_score: number
  risk_band: "Low" | "Moderate" | "Elevated" | "High"
  hard_stop_flags: string[]
  reason_codes: string[]
  next_action: string
  review_required: boolean
  override_status: string
  override_reason: string
}

function parseDate(val: any): string {
  if (!val || val === "") return new Date().toISOString()
  const s = String(val).trim()
  // Handle Excel date serials
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const days = parseFloat(s)
    const excelEpoch = new Date(1899, 11, 30)
    const ms = Math.round((days - Math.floor(days)) * 86400000)
    return new Date(excelEpoch.getTime() + Math.floor(days) * 86400000 + ms).toISOString()
  }
  const parsed = new Date(s)
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

const REQUIRED_FIELDS: (keyof CandidateIntake)[] = [
  "candidate_name", "phone", "recruiter_id", "role", "skill_stack",
  "current_location", "current_compensation", "expected_compensation",
  "notice_period_days", "earliest_joining_date", "job_location",
  "work_mode", "resume_received", "last_response_timestamp",
]

export function normalizeIntake(row: CandidateIntake) {
  const last_response_timestamp = parseDate(row.last_response_timestamp)
  const earliest_joining_date = parseDate(row.earliest_joining_date)
  const created_at = new Date().toISOString()

  const comm_lag_hours = Math.max(0, Math.round(
    (Date.now() - new Date(last_response_timestamp).getTime()) / 3600000
  ))

  const missing_fields = REQUIRED_FIELDS.filter((field) => {
    const value = row[field]
    return value === undefined || value === null || value === ""
  })

  const currentComp = Number(row.current_compensation || 0)
  const expectedComp = Number(row.expected_compensation || 0)
  const hikePercent = currentComp > 0
    ? Math.round(((expectedComp - currentComp) / currentComp) * 100)
    : null

  const phoneDigits = String(row.phone || "").replace(/\D/g, "")
  const candidate_id = row.candidate_id && String(row.candidate_id).trim() !== ""
    ? row.candidate_id
    : `cand_${phoneDigits.slice(-10) || "unknown"}_${Date.now()}`

  const resumeVal = String(row.resume_received || "").toLowerCase().trim()
  const docs_status = (resumeVal === "yes" || resumeVal === "true")
    ? "resume_received" : "resume_missing"

  return {
    candidate_id,
    created_at,
    updated_at: created_at,
    candidate_name: row.candidate_name || "",
    phone: row.phone || "",
    email: row.email || "",
    recruiter_id: row.recruiter_id || "",
    recruiter_name: row.recruiter_name || "",
    client_id: row.client_id || "default_it_staffing",
    source: row.source || "whatsapp",
    role: row.role || "",
    skill_stack: row.skill_stack || "",
    total_experience: row.total_experience || "",
    current_location: row.current_location || "",
    current_compensation: currentComp,
    expected_compensation: expectedComp,
    hike_percent: hikePercent,
    notice_period_days: Number(row.notice_period_days || 0),
    buyout_possible: row.buyout_possible || "unknown",
    earliest_joining_date,
    job_location: row.job_location || "",
    work_mode: row.work_mode || "",
    relocation_willingness: row.relocation_willingness || "maybe",
    resume_received: resumeVal || "no",
    available_for_interview_soon: row.available_for_interview_soon || "maybe",
    last_response_timestamp,
    comm_lag_hours,
    notes: row.notes || "",
    current_stage: row.current_stage || "Intake",
    docs_status,
    submission_status: "not_submitted",
    interview_status: "not_scheduled",
    offer_status: "not_started",
    join_status: "not_joined",
    validation_passed: missing_fields.length === 0,
    missing_fields,
  }
}

function weighted(severity: number, weight: number): number {
  return Math.round((severity / 4) * weight)
}

export function scoreRisk(r: ReturnType<typeof normalizeIntake>): ScoredCandidate {
  const reasons: string[] = []
  const hardStops: string[] = []

  let communication = 0
  let interview = 0
  let compensation = 0
  let noticeJoining = 0
  let relocation = 0
  let docs = 0

  // ── COMMUNICATION RELIABILITY (20%) ──────────────────────────────────
  // 48h+ silence is the #1 predictor of ghosting in Indian IT staffing.
  // Candidates juggling multiple offers often go silent while deciding.
  if (r.comm_lag_hours > 96) {
    communication = 4
    reasons.push("Candidate silent for 4+ days — high ghost risk")
    hardStops.push("extended_silence_96h")
  } else if (r.comm_lag_hours > 48) {
    communication = 3
    reasons.push("Candidate response delayed over 48 hours")
  } else if (r.comm_lag_hours > 24) {
    communication = 2
    reasons.push("Candidate response delayed over 24 hours")
  } else if (r.comm_lag_hours <= 6) {
    communication = 0 // Quick responder — positive signal
  }

  // ── INTERVIEW READINESS (15%) ────────────────────────────────────────
  const interviewSoon = String(r.available_for_interview_soon || "").toLowerCase()
  if (interviewSoon === "no") {
    interview = 3
    reasons.push("Candidate not available for interview soon")
  } else if (interviewSoon === "maybe") {
    interview = 1
    reasons.push("Interview availability is uncertain")
  }

  // ── COMPENSATION VOLATILITY (20%) ────────────────────────────────────
  // In Indian IT, 20-30% hike is standard for job change. Above 50% signals
  // either desperate hiring or candidate will keep shopping for better offers.
  // Counter-offer risk increases with hike %. At 50%+, current employer will
  // almost certainly counter-offer (they can match 20-30% cheaper than losing).
  const hike = Number(r.hike_percent || 0)
  const noticeDays = r.notice_period_days

  if (hike >= 100) {
    compensation = 4
    reasons.push("Candidate asking for ~100% hike — extreme counter-offer risk")
    hardStops.push("100_percent_hike")
  } else if (hike >= 50) {
    compensation = 3
    reasons.push("Candidate asking for 50%+ hike — likely to receive counter-offer")
    if (noticeDays >= 60) {
      hardStops.push("high_hike_long_notice")
      reasons.push("High hike + long notice = extended window for counter-offer")
    }
  } else if (hike >= 30) {
    compensation = 2
    reasons.push("Candidate asking for 30%+ hike")
  } else if (hike < 0) {
    // Candidate willing to take a pay cut — unusual, investigate
    compensation = 1
    reasons.push("Candidate willing to take pay cut — verify motivation")
  }

  // ── NOTICE PERIOD & JOINING FEASIBILITY (20%) ───────────────────────
  // Longer notice = more time for counter-offers, second thoughts, competing offers.
  // 90-day notice in India is common for senior roles but is the #2 dropout risk.
  // Each week of notice period is a week the candidate might change their mind.
  if (noticeDays >= 90) {
    noticeJoining = 3
    reasons.push("Notice period is 90+ days — 3 months of dropout window")
  } else if (noticeDays >= 60) {
    noticeJoining = 2
    reasons.push("Notice period is 60+ days")
  }

  const buyout = String(r.buyout_possible || "").toLowerCase()
  if (buyout === "unknown") {
    noticeJoining = Math.max(noticeJoining, 2)
    reasons.push("Buyout possibility is unclear")
  } else if (buyout === "no" && noticeDays >= 60) {
    noticeJoining = Math.max(noticeJoining, 3)
    reasons.push("Long notice period and no buyout option")
  } else if (buyout === "yes" && noticeDays >= 60) {
    // Buyout available mitigates risk slightly — don't reduce below current level
    reasons.push("Buyout possible — reduces notice period risk")
  }

  // Joining date proximity: if joining date is far out, more risk accumulates
  const daysToJoin = Math.max(0, Math.round(
    (new Date(r.earliest_joining_date).getTime() - Date.now()) / 86400000
  ))
  if (daysToJoin > 90) {
    noticeJoining = Math.max(noticeJoining, 2)
    reasons.push(`Joining date is ${daysToJoin} days away — long pipeline risk`)
  }

  // ── RELOCATION READINESS (15%) ──────────────────────────────────────
  // Relocation is a family decision in India. "Maybe" is effectively "no" 60% of the time.
  // Office/hybrid roles requiring city change are the highest dropout for relocation.
  const relocationWillingness = String(r.relocation_willingness || "").toLowerCase()
  const workMode = String(r.work_mode || "").toLowerCase()
  const sameCity = r.current_location.toLowerCase().trim() === r.job_location.toLowerCase().trim()

  if (!sameCity && workMode !== "remote") {
    if (relocationWillingness === "maybe") {
      relocation = 3
      reasons.push("Relocation required but willingness unclear — high dropout risk")
      hardStops.push("relocation_undecided")
    } else if (relocationWillingness === "no") {
      relocation = 4
      reasons.push("Relocation required but candidate unwilling")
      hardStops.push("relocation_refused")
    }
  } else if (relocationWillingness === "maybe" && !sameCity) {
    relocation = 2
    reasons.push("Different city, relocation willingness unclear")
    hardStops.push("relocation_undecided")
  }
  // Same city or remote — no relocation risk

  // ── DOCUMENTATION (10%) ─────────────────────────────────────────────
  if (r.docs_status !== "resume_received") {
    docs = 2
    reasons.push("Resume not yet received")
  }

  // ── COMPOUND RISK SIGNALS ───────────────────────────────────────────
  // Certain combinations are worse than the sum of their parts
  let compoundBonus = 0

  // Silent + high hike = probably negotiating elsewhere
  if (r.comm_lag_hours > 48 && hike >= 50) {
    compoundBonus += 5
    reasons.push("Silent + high hike = likely shopping offers")
  }

  // Long notice + not interview ready = may not be serious
  if (noticeDays >= 60 && interviewSoon === "no") {
    compoundBonus += 3
    reasons.push("Long notice + not interview ready = low commitment signal")
  }

  // High hike + relocation undecided = will likely drop
  if (hike >= 50 && relocationWillingness === "maybe") {
    compoundBonus += 5
    reasons.push("High hike + relocation undecided = strong dropout risk")
  }

  // ── PROCESS-INDUCED DROPOUT RISK ────────────────────────────────────
  // These score recruiter/process side failures that cause candidate dropout.
  // In Indian IT staffing: slow feedback, too many rounds, and poor communication
  // from the recruiter side cause 20-30% of dropouts.
  let recruiterFollowup = 0
  let processDelay = 0
  let roleMismatch = 0
  let candidateFatigue = 0

  // Stage-based process risk: the longer a candidate sits in a stage, the higher the risk
  const stage = r.current_stage.toLowerCase()
  if (stage === "screening" && r.comm_lag_hours > 48) {
    processDelay = 2
    reasons.push("Candidate stuck in Screening with no recent contact")
  }
  if (stage === "interview done" && r.comm_lag_hours > 24) {
    processDelay = 3
    reasons.push("Post-interview feedback delay — candidate losing interest")
  }

  // Late-stage candidates need faster engagement
  if ((stage === "offer extended" || stage === "offer accepted") && r.comm_lag_hours > 24) {
    recruiterFollowup = 3
    reasons.push("Offer-stage candidate going silent — urgent follow-up needed")
  }

  const candidateRisk = Math.min(100,
    weighted(communication, 20) +
    weighted(interview, 15) +
    weighted(compensation, 20) +
    weighted(noticeJoining, 20) +
    weighted(relocation, 15) +
    weighted(docs, 10) +
    compoundBonus
  )

  const processRisk =
    weighted(recruiterFollowup, 25) +
    weighted(processDelay, 30) +
    weighted(roleMismatch, 25) +
    weighted(candidateFatigue, 20)

  let riskBand: ScoredCandidate["risk_band"] = "Low"
  if (candidateRisk >= 55) riskBand = "High"
  else if (candidateRisk >= 35) riskBand = "Elevated"
  else if (candidateRisk >= 15) riskBand = "Moderate"

  const reviewRequired = candidateRisk >= 35 || hardStops.length > 0

  let nextAction = "Proceed"
  if (riskBand === "Moderate") nextAction = "Proceed and monitor — check in within 24h"
  if (riskBand === "Elevated") nextAction = "Manual recruiter review before next costly step"
  if (riskBand === "High") nextAction = "Hold pipeline — escalate to senior recruiter"
  if (hardStops.length > 0) nextAction = `BLOCKER: ${hardStops[0].replace(/_/g, " ")} — manual review required`

  return {
    candidate_id: r.candidate_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    candidate_name: r.candidate_name,
    phone: r.phone,
    email: r.email,
    recruiter_id: r.recruiter_id,
    recruiter_name: r.recruiter_name,
    client_id: r.client_id,
    source: r.source,
    role: r.role,
    skill_stack: r.skill_stack,
    total_experience: r.total_experience,
    current_location: r.current_location,
    current_compensation: r.current_compensation,
    expected_compensation: r.expected_compensation,
    hike_percent: r.hike_percent,
    notice_period_days: r.notice_period_days,
    buyout_possible: r.buyout_possible,
    earliest_joining_date: r.earliest_joining_date,
    job_location: r.job_location,
    work_mode: r.work_mode,
    relocation_willingness: r.relocation_willingness,
    resume_received: r.resume_received,
    available_for_interview_soon: r.available_for_interview_soon,
    last_response_timestamp: r.last_response_timestamp,
    comm_lag_hours: r.comm_lag_hours,
    notes: r.notes,
    current_stage: r.current_stage,
    docs_status: r.docs_status,
    submission_status: r.submission_status,
    interview_status: r.interview_status,
    offer_status: r.offer_status,
    join_status: r.join_status,
    candidate_risk_score: candidateRisk,
    process_risk_score: processRisk,
    risk_band: riskBand,
    hard_stop_flags: hardStops,
    reason_codes: reasons.slice(0, 5),
    next_action: nextAction,
    review_required: reviewRequired,
    override_status: "not_reviewed",
    override_reason: "",
  }
}

export function processCandidate(intake: CandidateIntake): ScoredCandidate {
  const normalized = normalizeIntake(intake)
  if (!normalized.validation_passed) {
    throw new Error(`Missing required fields: ${normalized.missing_fields.join(", ")}`)
  }
  return scoreRisk(normalized)
}
