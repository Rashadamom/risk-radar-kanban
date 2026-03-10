// Scoring engine validation — 15 diverse candidate profiles
import { processCandidate, normalizeIntake, scoreRisk } from "../lib/scoring"
import type { CandidateIntake } from "../lib/scoring"

// Helper: create a timestamp N hours ago
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString()
}

// Base template — a "perfect" candidate with all green signals
function base(overrides: Partial<CandidateIntake> = {}): CandidateIntake {
  return {
    candidate_name: "Test Candidate",
    phone: "9876543210",
    recruiter_id: "rec_001",
    role: "Software Engineer",
    skill_stack: "React, Node.js",
    current_location: "Bangalore",
    current_compensation: 1200000,
    expected_compensation: 1440000, // 20% hike — under 30% threshold
    notice_period_days: 30,
    buyout_possible: "yes",
    earliest_joining_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    job_location: "Bangalore",
    work_mode: "hybrid",
    relocation_willingness: "yes",
    resume_received: "yes",
    available_for_interview_soon: "yes",
    last_response_timestamp: hoursAgo(2), // responded 2h ago
    ...overrides,
  }
}

type TestCase = {
  name: string
  intake: CandidateIntake
  expectBand: string     // expected risk_band
  expectMinScore?: number
  expectMaxScore?: number
  notes: string
}

const tests: TestCase[] = [
  // 1. Perfect candidate
  {
    name: "Perfect candidate",
    intake: base({ candidate_name: "Perfect Priya" }),
    expectBand: "Low",
    notes: "All green signals, 20% hike, 30d notice, resume in, responsive",
  },
  // 2. Worst case
  {
    name: "Worst case nightmare",
    intake: base({
      candidate_name: "Nightmare Nikhil",
      current_compensation: 1000000,
      expected_compensation: 2000000,    // 100% hike → hard stop
      notice_period_days: 90,
      buyout_possible: "no",
      resume_received: "no",
      available_for_interview_soon: "no",
      relocation_willingness: "maybe",   // undecided → hard stop
      last_response_timestamp: hoursAgo(96),
    }),
    expectBand: "High",
    notes: "Everything bad: 100% hike, 90d notice, no buyout, 96h silent, no resume, relocation undecided",
  },
  // 3. Just communication risk
  {
    name: "Silent responder only",
    intake: base({
      candidate_name: "Silent Sanjay",
      last_response_timestamp: hoursAgo(72),
      relocation_willingness: "yes",
    }),
    expectBand: "Moderate",
    notes: "72h comm lag (severity=3, weighted=15), everything else fine",
  },
  // 4. Just compensation risk
  {
    name: "High hike only",
    intake: base({
      candidate_name: "Greedy Gaurav",
      current_compensation: 1000000,
      expected_compensation: 1800000, // 80% hike
    }),
    expectBand: "Elevated",
    notes: "80% hike (severity=3, weighted=15), everything else fine. Expect Moderate or Elevated.",
  },
  // 5. 90 day notice, no buyout, everything else fine
  {
    name: "Long notice no buyout",
    intake: base({
      candidate_name: "Stuck Suresh",
      notice_period_days: 90,
      buyout_possible: "no",
      relocation_willingness: "yes",
    }),
    expectBand: "Moderate",
    notes: "90d notice + no buyout → noticeJoining=3 (weighted=15). Should be Moderate.",
  },
  // 6. Remote role, relocation_willingness=no → should NOT flag
  {
    name: "Remote role no relocation",
    intake: base({
      candidate_name: "Remote Rekha",
      work_mode: "remote",
      relocation_willingness: "no",
      current_location: "Jaipur",
      job_location: "Mumbai",
    }),
    expectBand: "Low",
    notes: "Remote role — relocation=no should NOT flag. No mismatch.",
  },
  // 7. Office role, relocation=no, different city
  {
    name: "Office role relocation mismatch",
    intake: base({
      candidate_name: "Stubborn Swati",
      work_mode: "office",
      relocation_willingness: "no",
      current_location: "Delhi",
      job_location: "Chennai",
    }),
    expectBand: "Moderate",
    notes: "Office role + no relocation + different city → relocation severity=3 (weighted=11). Should be Moderate.",
  },
  // 8. Fresh grad
  {
    name: "Fresh grad eager",
    intake: base({
      candidate_name: "Fresher Farah",
      current_compensation: 0,
      expected_compensation: 500000,
      notice_period_days: 0,
      total_experience: "0",
      available_for_interview_soon: "yes",
    }),
    expectBand: "Low",
    notes: "Low comp, zero notice, eager, resume in. hike_percent=null (0 current). Should be Low.",
  },
  // 9. Senior architect with 100% hike
  {
    name: "Senior 100% hike ask",
    intake: base({
      candidate_name: "Architect Arvind",
      current_compensation: 3000000,
      expected_compensation: 6000000,
      total_experience: "15",
      notice_period_days: 90,
      relocation_willingness: "yes",
    }),
    expectBand: "High",
    notes: "100% hike → hard stop + severity=4 (weighted=20). Plus 90d notice → severity=3 (weighted=15). Score=35 minimum.",
  },
  // 10. Boundary values: exactly 24h, exactly 30% hike, exactly 60 days
  {
    name: "Boundary thresholds",
    intake: base({
      candidate_name: "Boundary Bhanu",
      last_response_timestamp: hoursAgo(24.5), // just over 24h
      current_compensation: 1000000,
      expected_compensation: 1300000, // exactly 30%
      notice_period_days: 60,
      buyout_possible: "yes",
      relocation_willingness: "yes",
    }),
    expectBand: "Moderate",
    notes: "At thresholds: comm=2(10), comp=2(10), notice=2(10). Total=30 → Moderate.",
  },
  // 11. Missing resume only
  {
    name: "Missing resume only",
    intake: base({
      candidate_name: "No-Resume Nisha",
      resume_received: "no",
      relocation_willingness: "yes",
    }),
    expectBand: "Low",
    notes: "Resume missing → docs=2 (weighted=5). Only 5 points. Should be Low.",
  },
  // 12. Buyout=yes with 90d notice vs buyout=no
  {
    name: "90d notice WITH buyout",
    intake: base({
      candidate_name: "Buyout Bala",
      notice_period_days: 90,
      buyout_possible: "yes",
      relocation_willingness: "yes",
    }),
    expectBand: "Moderate",
    notes: "90d notice (severity=3, weighted=15) but buyout=yes so no additional penalty. Compare with #5.",
  },
  // 13. All maybe answers
  {
    name: "All maybes",
    intake: base({
      candidate_name: "Maybe Meera",
      buyout_possible: "maybe",
      relocation_willingness: "maybe",
      available_for_interview_soon: "maybe",
      last_response_timestamp: hoursAgo(25), // slightly over 24h
    }),
    expectBand: "Moderate",
    notes: "Maybes accumulate: interview=1(4), relocation=2(8)+hard_stop, comm=2(10), buyout=unknown→notice=2(10). Should push Moderate+.",
  },
  // 14. Quick responder, high hike
  {
    name: "Quick but expensive",
    intake: base({
      candidate_name: "Quick Qasim",
      last_response_timestamp: hoursAgo(1),
      current_compensation: 1000000,
      expected_compensation: 1600000, // 60% hike
      notice_period_days: 15,
      relocation_willingness: "yes",
    }),
    expectBand: "Moderate",
    notes: "Great comm (0), but 60% hike (severity=3, weighted=15). Mixed signals.",
  },
  // 15. Slow responder, low hike
  {
    name: "Slow but cheap",
    intake: base({
      candidate_name: "Slow Shyam",
      last_response_timestamp: hoursAgo(50),
      current_compensation: 1000000,
      expected_compensation: 1100000, // 10% hike
      notice_period_days: 15,
      relocation_willingness: "yes",
    }),
    expectBand: "Moderate",
    notes: "50h comm lag (severity=3, weighted=15), but low hike. Mixed signals.",
  },
]

// --- Run all tests ---
console.log("\n=== SCORING ENGINE VALIDATION ===\n")

type Result = {
  name: string
  score: number
  band: string
  hardStops: string
  keySignals: string
  expected: string
  pass: boolean
  issue?: string
}

const results: Result[] = []
const issues: string[] = []

for (const t of tests) {
  try {
    // Use normalizeIntake + scoreRisk directly to bypass validation for edge cases
    const normalized = normalizeIntake(t.intake)
    const scored = scoreRisk(normalized)

    const pass = scored.risk_band === t.expectBand
    const hardStops = scored.hard_stop_flags.length > 0 ? scored.hard_stop_flags.join(", ") : "none"
    const keySignals = scored.reason_codes.slice(0, 3).join("; ")

    const result: Result = {
      name: t.name,
      score: scored.candidate_risk_score,
      band: scored.risk_band,
      hardStops,
      keySignals,
      expected: t.expectBand,
      pass,
    }

    if (!pass) {
      const msg = `[${t.name}] Expected ${t.expectBand}, got ${scored.risk_band} (score=${scored.candidate_risk_score}). ${t.notes}`
      result.issue = msg
      issues.push(msg)
    }

    results.push(result)
  } catch (err: any) {
    results.push({
      name: t.name,
      score: -1,
      band: "ERROR",
      hardStops: "",
      keySignals: err.message,
      expected: t.expectBand,
      pass: false,
      issue: err.message,
    })
    issues.push(`[${t.name}] ERROR: ${err.message}`)
  }
}

// --- Print table ---
const nameW = 30
const scoreW = 6
const bandW = 10
const hardW = 40
const signalW = 60
const expectW = 10
const passW = 6

function pad(s: string, w: number) { return s.padEnd(w).slice(0, w) }

const header = [
  pad("Name", nameW),
  pad("Score", scoreW),
  pad("Band", bandW),
  pad("Hard Stops", hardW),
  pad("Key Signals", signalW),
  pad("Expected", expectW),
  pad("P/F", passW),
].join(" | ")

const sep = header.replace(/[^|]/g, "-")

console.log(header)
console.log(sep)

for (const r of results) {
  const row = [
    pad(r.name, nameW),
    pad(String(r.score), scoreW),
    pad(r.band, bandW),
    pad(r.hardStops, hardW),
    pad(r.keySignals, signalW),
    pad(r.expected, expectW),
    pad(r.pass ? "PASS" : "FAIL", passW),
  ].join(" | ")
  console.log(row)
}

console.log("")
console.log(`Total: ${results.length} tests, ${results.filter(r => r.pass).length} PASS, ${results.filter(r => !r.pass).length} FAIL`)

if (issues.length > 0) {
  console.log("\n=== ISSUES FOUND ===\n")
  for (const issue of issues) {
    console.log(`  - ${issue}`)
  }
}

console.log("\n=== DETAILED BREAKDOWN ===\n")
for (const t of tests) {
  const normalized = normalizeIntake(t.intake)
  const scored = scoreRisk(normalized)
  console.log(`${t.name}: score=${scored.candidate_risk_score}, band=${scored.risk_band}, hike=${normalized.hike_percent}%, comm_lag=${normalized.comm_lag_hours}h, notice=${normalized.notice_period_days}d, buyout=${normalized.buyout_possible}, reloc=${normalized.relocation_willingness}, resume=${normalized.resume_received}, interview=${normalized.available_for_interview_soon}`)
  console.log(`  reasons: ${scored.reason_codes.join("; ")}`)
  console.log(`  hard_stops: ${scored.hard_stop_flags.join(", ") || "none"}`)
  console.log("")
}
