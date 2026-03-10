// MongoDB store for candidates, review queue, stage updates, messages, behavioral profiles
// Collections: candidate_master, review_queue, stage_updates, messages, behavioral_profiles

import { MongoClient, type Db, type Collection } from "mongodb"
import type { ScoredCandidate } from "./scoring"
import type { MessageEntry, BehavioralProfile } from "./behavioral-profiler"

// Connection singleton
let client: MongoClient | null = null
let db: Db | null = null

async function getDb(): Promise<Db> {
  if (db) return db
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI not set in .env.local")
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(process.env.MONGODB_DB || "riskradar")
  return db
}

function candidates(): Promise<Collection<ScoredCandidate>> {
  return getDb().then(d => d.collection<ScoredCandidate>("candidate_master"))
}

function reviewQueue(): Promise<Collection<ReviewQueueItem>> {
  return getDb().then(d => d.collection<ReviewQueueItem>("review_queue"))
}

function stageUpdates(): Promise<Collection<StageUpdate>> {
  return getDb().then(d => d.collection<StageUpdate>("stage_updates"))
}

// Candidates
export async function getCandidates(filters?: {
  stage?: string
  risk_band?: string
  recruiter_id?: string
}): Promise<ScoredCandidate[]> {
  const col = await candidates()
  const query: Record<string, string> = {}
  if (filters?.stage) query.current_stage = filters.stage
  if (filters?.risk_band) query.risk_band = filters.risk_band
  if (filters?.recruiter_id) query.recruiter_id = filters.recruiter_id
  return col.find(query).toArray() as Promise<ScoredCandidate[]>
}

export async function getCandidate(id: string): Promise<ScoredCandidate | null> {
  const col = await candidates()
  return col.findOne({ candidate_id: id }) as Promise<ScoredCandidate | null>
}

export async function upsertCandidate(candidate: ScoredCandidate): Promise<ScoredCandidate> {
  const col = await candidates()
  await col.updateOne(
    { candidate_id: candidate.candidate_id },
    { $set: { ...candidate, updated_at: new Date().toISOString() } },
    { upsert: true },
  )
  return candidate
}

export async function updateCandidate(id: string, updates: Partial<ScoredCandidate>): Promise<ScoredCandidate | null> {
  const col = await candidates()
  const result = await col.findOneAndUpdate(
    { candidate_id: id },
    { $set: { ...updates, updated_at: new Date().toISOString() } },
    { returnDocument: "after" },
  )
  return result as ScoredCandidate | null
}

// Review Queue
export type ReviewQueueItem = {
  review_id: string
  candidate_id: string
  candidate_name: string
  role: string
  recruiter_id: string
  assigned_to: string
  risk_band: string
  candidate_risk_score: number
  process_risk_score: number
  hard_stop_flags: string[]
  reason_codes: string[]
  next_action: string
  current_stage: string
  created_at: string
  resolved_at: string | null
  resolution_status: string
  resolution_notes: string
}

export async function getReviewQueue(filters?: {
  risk_band?: string
  recruiter_id?: string
  resolved?: boolean
}): Promise<ReviewQueueItem[]> {
  const col = await reviewQueue()
  const query: Record<string, any> = {}
  if (filters?.risk_band) query.risk_band = filters.risk_band
  if (filters?.recruiter_id) query.recruiter_id = filters.recruiter_id
  if (filters?.resolved === false) query.resolved_at = null
  if (filters?.resolved === true) query.resolved_at = { $ne: null }
  return col.find(query).sort({ candidate_risk_score: -1 }).toArray() as Promise<ReviewQueueItem[]>
}

export async function upsertReviewQueue(item: ReviewQueueItem): Promise<ReviewQueueItem> {
  const col = await reviewQueue()
  await col.updateOne(
    { candidate_id: item.candidate_id, resolved_at: null },
    { $set: item },
    { upsert: true },
  )
  return item
}

export async function resolveReviewItem(reviewId: string, resolution: {
  resolution_status: string
  resolution_notes: string
}): Promise<ReviewQueueItem | null> {
  const col = await reviewQueue()
  const result = await col.findOneAndUpdate(
    { review_id: reviewId },
    { $set: { ...resolution, resolved_at: new Date().toISOString() } },
    { returnDocument: "after" },
  )
  return result as ReviewQueueItem | null
}

// Stage Updates (audit trail)
export type StageUpdate = {
  event_id: string
  candidate_id: string
  candidate_name: string
  role: string
  recruiter_id: string
  from_stage: string
  to_stage: string
  triggered_by: string
  event_timestamp: string
  candidate_risk_score: number
  risk_band: string
  notes: string
}

export async function getStageUpdates(candidateId?: string): Promise<StageUpdate[]> {
  const col = await stageUpdates()
  const query = candidateId ? { candidate_id: candidateId } : {}
  return col.find(query).sort({ event_timestamp: -1 }).toArray() as Promise<StageUpdate[]>
}

export async function appendStageUpdate(update: StageUpdate): Promise<StageUpdate> {
  const col = await stageUpdates()
  await col.insertOne(update as any)
  return update
}

// Create review queue item from scored candidate
export function createReviewFromCandidate(candidate: ScoredCandidate): ReviewQueueItem {
  return {
    review_id: `rev_${candidate.candidate_id}_${Date.now()}`,
    candidate_id: candidate.candidate_id,
    candidate_name: candidate.candidate_name,
    role: candidate.role,
    recruiter_id: candidate.recruiter_id,
    assigned_to: candidate.recruiter_id,
    risk_band: candidate.risk_band,
    candidate_risk_score: candidate.candidate_risk_score,
    process_risk_score: candidate.process_risk_score,
    hard_stop_flags: candidate.hard_stop_flags,
    reason_codes: candidate.reason_codes,
    next_action: candidate.next_action,
    current_stage: candidate.current_stage,
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolution_status: "pending",
    resolution_notes: "",
  }
}

// Create stage update from scored candidate
export function createIntakeStageUpdate(candidate: ScoredCandidate): StageUpdate {
  return {
    event_id: `${candidate.candidate_id}_intake_${Date.now()}`,
    candidate_id: candidate.candidate_id,
    candidate_name: candidate.candidate_name,
    role: candidate.role,
    recruiter_id: candidate.recruiter_id,
    from_stage: "new",
    to_stage: "Intake",
    triggered_by: candidate.source === "whatsapp" ? "whatsapp_agent" : "workflow",
    event_timestamp: new Date().toISOString(),
    candidate_risk_score: candidate.candidate_risk_score,
    risk_band: candidate.risk_band,
    notes: "Candidate intake created",
  }
}

// Messages (WhatsApp conversation history)
function messagesCol(): Promise<Collection<MessageEntry>> {
  return getDb().then(d => d.collection<MessageEntry>("messages"))
}

function profilesCol(): Promise<Collection<BehavioralProfile>> {
  return getDb().then(d => d.collection<BehavioralProfile>("behavioral_profiles"))
}

export async function appendMessage(entry: MessageEntry): Promise<MessageEntry> {
  const col = await messagesCol()
  await col.insertOne(entry as any)
  return entry
}

export async function getMessages(candidateId: string): Promise<MessageEntry[]> {
  const col = await messagesCol()
  return col.find({ candidate_id: candidateId }).sort({ timestamp: 1 }).toArray() as Promise<MessageEntry[]>
}

export async function upsertBehavioralProfile(profile: BehavioralProfile): Promise<BehavioralProfile> {
  const col = await profilesCol()
  await col.updateOne(
    { candidate_id: profile.candidate_id },
    { $set: profile },
    { upsert: true },
  )
  return profile
}

export async function getBehavioralProfile(candidateId: string): Promise<BehavioralProfile | null> {
  const col = await profilesCol()
  return col.findOne({ candidate_id: candidateId }) as Promise<BehavioralProfile | null>
}

// Analytics summary
export async function getAnalyticsSummary() {
  const [allCandidates, allUpdates] = await Promise.all([
    getCandidates(),
    getStageUpdates(),
  ])

  const bandCounts = { Low: 0, Moderate: 0, Elevated: 0, High: 0 }
  const stageCounts: Record<string, number> = {}
  const STAGES = ["Intake", "Screening", "Interview Scheduled", "Interview Done", "Offer Extended", "Offer Accepted", "Joined"]
  STAGES.forEach(s => stageCounts[s] = 0)

  for (const c of allCandidates) {
    if (c.risk_band in bandCounts) bandCounts[c.risk_band as keyof typeof bandCounts]++
    if (c.current_stage in stageCounts) stageCounts[c.current_stage]++
    else stageCounts[c.current_stage] = (stageCounts[c.current_stage] || 0) + 1
  }

  return {
    total_candidates: allCandidates.length,
    band_counts: bandCounts,
    stage_counts: stageCounts,
    recent_updates: allUpdates.slice(0, 20),
    avg_risk_score: allCandidates.length > 0
      ? Math.round(allCandidates.reduce((sum, c) => sum + c.candidate_risk_score, 0) / allCandidates.length)
      : 0,
  }
}
