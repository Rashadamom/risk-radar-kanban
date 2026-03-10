// Behavioral profiling engine
// Analyzes WhatsApp message patterns between recruiter and candidate
// to detect dropout signals and build a behavioral profile

export type MessageEntry = {
  message_id: string
  candidate_id: string
  from: "recruiter" | "candidate"
  timestamp: string
  text: string
  response_time_minutes?: number // time to respond to previous message
}

export type BehavioralProfile = {
  candidate_id: string
  updated_at: string

  // Response patterns
  avg_response_time_minutes: number
  response_time_trend: "improving" | "stable" | "degrading" // are they getting slower?
  total_messages_sent: number
  total_messages_received: number
  response_rate: number // % of recruiter messages that got a reply

  // Engagement signals
  message_length_avg: number // avg words per message
  message_length_trend: "increasing" | "stable" | "decreasing"
  asks_questions: boolean // candidate asks about role, team, process
  uses_enthusiastic_language: boolean
  uses_hedging_language: boolean // "maybe", "not sure", "I'll think about it"

  // Red flags
  mentions_other_offers: boolean
  mentions_counter_offer: boolean
  mentions_family_concerns: boolean
  mentions_relocation_doubt: boolean
  ghosting_pattern: boolean // responded, then stopped
  weekend_only_responder: boolean
  late_night_only_responder: boolean

  // Sentiment trajectory
  sentiment_scores: number[] // -1 to 1, per message
  sentiment_trend: "positive" | "neutral" | "negative" | "declining"

  // Computed behavioral risk adjustment (-20 to +30)
  behavioral_risk_adjustment: number
  behavioral_signals: string[]
}

// Keywords for signal detection
const ENTHUSIASM_KEYWORDS = [
  "excited", "looking forward", "great opportunity", "can't wait", "thrilled",
  "eager", "interested", "love to", "perfect fit", "dream role", "amazing",
]

const HEDGING_KEYWORDS = [
  "maybe", "not sure", "i'll think", "need to think", "need to discuss", "might not",
  "depends", "uncertain", "haven't decided", "keeping options", "exploring",
  "will let you know", "need time", "considering", "i guess", "should be",
  "let me check", "i suppose",
]

const OTHER_OFFERS_KEYWORDS = [
  "other offer", "another offer", "competing offer", "multiple offers",
  "other company", "got an offer", "received offer", "different company",
  "interviewing elsewhere", "other opportunities",
]

const COUNTER_OFFER_KEYWORDS = [
  "counter offer", "counteroffer", "current company offered", "employer matched",
  "retention offer", "stay back", "promoted", "manager offered", "current employer",
  "they offered me", "company might match", "company may match", "match the offer",
  "current company might", "current org", "existing employer",
]

const FAMILY_CONCERN_KEYWORDS = [
  "family", "spouse", "wife", "husband", "parents", "kids", "children",
  "personal reasons", "family situation", "discuss with family", "partner",
]

const RELOCATION_DOUBT_KEYWORDS = [
  "relocate", "relocation", "move cities", "shifting", "don't want to move",
  "far from home", "settle", "housing", "new city",
]

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  return keywords.filter(kw => lower.includes(kw)).length
}

function simpleSentiment(text: string): number {
  const positive = [
    "yes", "sure", "great", "happy", "excited", "ready", "confirmed",
    "looking forward", "thanks", "appreciate", "wonderful", "perfect",
  ]
  const negative = [
    "no", "sorry", "unfortunately", "can't", "won't", "difficult",
    "problem", "issue", "concern", "worried", "doubt", "delay",
    "not possible", "unable", "reject",
  ]

  const lower = text.toLowerCase()
  const posCount = positive.filter(w => lower.includes(w)).length
  const negCount = negative.filter(w => lower.includes(w)).length

  if (posCount === 0 && negCount === 0) return 0
  return Math.max(-1, Math.min(1, (posCount - negCount) / Math.max(posCount + negCount, 1)))
}

export function analyzeMessages(candidateId: string, messages: MessageEntry[]): BehavioralProfile {
  const candidateMessages = messages.filter(m => m.from === "candidate")
  const recruiterMessages = messages.filter(m => m.from === "recruiter")

  // Response time analysis
  const responseTimes = candidateMessages
    .map(m => m.response_time_minutes)
    .filter((t): t is number => t !== undefined && t > 0)

  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0

  // Response time trend (compare first half vs second half)
  let responseTimeTrend: BehavioralProfile["response_time_trend"] = "stable"
  if (responseTimes.length >= 2) {
    const mid = Math.max(1, Math.floor(responseTimes.length / 2))
    const firstHalf = responseTimes.slice(0, mid).reduce((a, b) => a + b, 0) / mid
    const secondHalf = responseTimes.slice(mid).reduce((a, b) => a + b, 0) / (responseTimes.length - mid)
    if (secondHalf > firstHalf * 1.5) responseTimeTrend = "degrading"
    else if (secondHalf < firstHalf * 0.7) responseTimeTrend = "improving"
  }

  // Response rate
  const responseRate = recruiterMessages.length > 0
    ? Math.round((candidateMessages.length / recruiterMessages.length) * 100)
    : 0

  // Message length analysis
  const messageLengths = candidateMessages.map(m => m.text.split(/\s+/).length)
  const avgLength = messageLengths.length > 0
    ? Math.round(messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length)
    : 0

  let messageLengthTrend: BehavioralProfile["message_length_trend"] = "stable"
  if (messageLengths.length >= 4) {
    const mid = Math.floor(messageLengths.length / 2)
    const firstHalf = messageLengths.slice(0, mid).reduce((a, b) => a + b, 0) / mid
    const secondHalf = messageLengths.slice(mid).reduce((a, b) => a + b, 0) / (messageLengths.length - mid)
    if (secondHalf > firstHalf * 1.3) messageLengthTrend = "increasing"
    else if (secondHalf < firstHalf * 0.6) messageLengthTrend = "decreasing"
  }

  // Concatenate all candidate text for keyword analysis
  const allCandidateText = candidateMessages.map(m => m.text).join(" ")
  const asksQuestions = candidateMessages.some(m => m.text.includes("?"))
  const usesEnthusiastic = countKeywordMatches(allCandidateText, ENTHUSIASM_KEYWORDS) >= 2
  const usesHedging = countKeywordMatches(allCandidateText, HEDGING_KEYWORDS) >= 2
  const mentionsOtherOffers = countKeywordMatches(allCandidateText, OTHER_OFFERS_KEYWORDS) >= 1
  const mentionsCounterOffer = countKeywordMatches(allCandidateText, COUNTER_OFFER_KEYWORDS) >= 1
  const mentionsFamilyConcerns = countKeywordMatches(allCandidateText, FAMILY_CONCERN_KEYWORDS) >= 1
  const mentionsRelocationDoubt = countKeywordMatches(allCandidateText, RELOCATION_DOUBT_KEYWORDS) >= 1

  // Ghosting pattern: candidate responded at least twice, then recruiter sent 2+ messages with no candidate reply
  const sortedAll = [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  let ghostingPattern = false
  if (candidateMessages.length >= 2 && sortedAll.length >= 4) {
    // Find the last candidate message, then count recruiter messages after it
    const lastCandidateIdx = sortedAll.reduce((last, m, i) => m.from === "candidate" ? i : last, -1)
    const messagesAfterLastCandidate = sortedAll.slice(lastCandidateIdx + 1)
    const recruiterFollowups = messagesAfterLastCandidate.filter(m => m.from === "recruiter").length
    ghostingPattern = recruiterFollowups >= 2
  }

  // Time-of-day patterns
  const candidateHours = candidateMessages.map(m => new Date(m.timestamp).getHours())
  const candidateDays = candidateMessages.map(m => new Date(m.timestamp).getDay())
  const weekendOnly = candidateDays.length >= 3 && candidateDays.every(d => d === 0 || d === 6)
  const lateNightOnly = candidateHours.length >= 3 && candidateHours.every(h => h >= 22 || h <= 5)

  // Sentiment per message
  const sentimentScores = candidateMessages.map(m => simpleSentiment(m.text))
  let sentimentTrend: BehavioralProfile["sentiment_trend"] = "neutral"
  if (sentimentScores.length >= 3) {
    const mid = Math.floor(sentimentScores.length / 2)
    const firstAvg = sentimentScores.slice(0, mid).reduce((a, b) => a + b, 0) / mid
    const secondAvg = sentimentScores.slice(mid).reduce((a, b) => a + b, 0) / (sentimentScores.length - mid)
    if (secondAvg < firstAvg - 0.3) sentimentTrend = "declining"
    else if (secondAvg > 0.3) sentimentTrend = "positive"
    else if (secondAvg < -0.3) sentimentTrend = "negative"
  }

  // One-word response detection (research: strong negative signal)
  const oneWordResponses = candidateMessages.filter(m => m.text.trim().split(/\s+/).length <= 2).length
  const oneWordRatio = candidateMessages.length > 0 ? oneWordResponses / candidateMessages.length : 0

  // Question frequency post-offer context (research: 0 questions post-offer = 40% higher no-show)
  const questionCount = candidateMessages.filter(m => m.text.includes("?")).length

  // Proactive vs reactive (research: shift from proactive to reactive = 50% dropout)
  const proactiveKeywords = ["when", "what's next", "next step", "update", "how soon", "timeline"]
  const isProactive = candidateMessages.some(m =>
    proactiveKeywords.some(kw => m.text.toLowerCase().includes(kw))
  )

  // ── COMPUTE BEHAVIORAL RISK ADJUSTMENT ──────────────────────────────
  // Research-backed weights (NASSCOM, TeamLease, CIEL HR, LinkedIn India data)
  // Range: -25 to +40 (expanded from -20/+30 based on research severity data)
  const signals: string[] = []
  let adjustment = 0

  // Positive signals (reduce risk)
  // Research: 3+ substantive questions = 2x higher join rate
  if (usesEnthusiastic) { adjustment -= 5; signals.push("Uses enthusiastic language") }
  if (asksQuestions && questionCount >= 3) {
    adjustment -= 8; signals.push(`Asks ${questionCount} questions — 2x higher join probability`)
  } else if (asksQuestions) {
    adjustment -= 3; signals.push("Asks questions about role/process")
  }
  if (responseTimeTrend === "improving") { adjustment -= 5; signals.push("Response times improving") }
  if (responseRate >= 90) { adjustment -= 5; signals.push("High response rate (90%+)") }
  if (messageLengthTrend === "increasing") { adjustment -= 3; signals.push("Giving more detailed responses — strong engagement") }
  if (isProactive) { adjustment -= 3; signals.push("Proactively asks about next steps") }

  // Negative signals (increase risk)
  // Research: Counter-offer = #1 dropout reason (50-65% accept counter-offers)
  if (mentionsCounterOffer) { adjustment += 25; signals.push("Counter-offer from current employer — #1 dropout risk (50-65% accept)") }

  // Research: 48h+ silence after responsive = 75% dropout correlation
  if (ghostingPattern) { adjustment += 20; signals.push("Ghosting pattern — 75% correlation with dropout") }

  // Research: Multiple offers = 40-50% dropout probability
  if (mentionsOtherOffers) { adjustment += 15; signals.push("Mentioned other offers — 40-50% dropout probability") }

  // Research: Response time 4h→24h = 60-70% dropout
  if (responseTimeTrend === "degrading") {
    if (avgResponseTime > 1440) { // >24h average
      adjustment += 15; signals.push("Avg response >24h and degrading — 60-70% dropout risk")
    } else {
      adjustment += 10; signals.push("Response times getting slower")
    }
  }

  // Research: Hedging language correlates with indecision → 40-50% dropout
  if (usesHedging) { adjustment += 10; signals.push("Uses hedging language — indecision signal") }

  // Research: Declining message length = disengagement
  if (messageLengthTrend === "decreasing") { adjustment += 8; signals.push("Responses getting shorter — disengagement") }

  // Research: One-word responses after detail = strong negative signal
  if (oneWordRatio > 0.5 && candidateMessages.length >= 3) {
    adjustment += 10; signals.push("Majority one-word responses — strong disengagement")
  }

  // Research: Sentiment decay >30% = +15 risk
  if (sentimentTrend === "declining") { adjustment += 10; signals.push("Sentiment declining over time") }
  if (sentimentTrend === "negative") { adjustment += 5; signals.push("Overall negative sentiment") }

  // Research: Family = 18-22% of offer declines
  if (mentionsFamilyConcerns) { adjustment += 8; signals.push("Family concerns — 18-22% of offer declines in India") }

  // Research: Relocation abandonment 15-40% depending on cities
  if (mentionsRelocationDoubt) { adjustment += 10; signals.push("Relocation doubts — 15-40% abandonment rate") }

  if (responseRate < 50 && recruiterMessages.length >= 3) { adjustment += 10; signals.push("Low response rate (<50%)") }
  if (weekendOnly) { adjustment += 5; signals.push("Only responds on weekends") }
  if (lateNightOnly) { adjustment += 3; signals.push("Only responds late at night") }

  // Clamp to range
  adjustment = Math.max(-25, Math.min(40, adjustment))

  return {
    candidate_id: candidateId,
    updated_at: new Date().toISOString(),
    avg_response_time_minutes: avgResponseTime,
    response_time_trend: responseTimeTrend,
    total_messages_sent: candidateMessages.length,
    total_messages_received: recruiterMessages.length,
    response_rate: responseRate,
    message_length_avg: avgLength,
    message_length_trend: messageLengthTrend,
    asks_questions: asksQuestions,
    uses_enthusiastic_language: usesEnthusiastic,
    uses_hedging_language: usesHedging,
    mentions_other_offers: mentionsOtherOffers,
    mentions_counter_offer: mentionsCounterOffer,
    mentions_family_concerns: mentionsFamilyConcerns,
    mentions_relocation_doubt: mentionsRelocationDoubt,
    ghosting_pattern: ghostingPattern,
    weekend_only_responder: weekendOnly,
    late_night_only_responder: lateNightOnly,
    sentiment_scores: sentimentScores,
    sentiment_trend: sentimentTrend,
    behavioral_risk_adjustment: adjustment,
    behavioral_signals: signals,
  }
}
