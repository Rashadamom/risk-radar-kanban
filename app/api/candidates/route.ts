import { NextResponse } from "next/server"
import { getCandidates, upsertCandidate, upsertReviewQueue, appendStageUpdate, createReviewFromCandidate, createIntakeStageUpdate } from "@/lib/store"
import { processCandidate, type CandidateIntake } from "@/lib/scoring"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const filters = {
    stage: url.searchParams.get("stage") || undefined,
    risk_band: url.searchParams.get("risk_band") || undefined,
    recruiter_id: url.searchParams.get("recruiter_id") || undefined,
  }
  return NextResponse.json(await getCandidates(filters))
}

export async function POST(req: Request) {
  try {
    const intake: CandidateIntake = await req.json()
    const scored = processCandidate(intake)
    await upsertCandidate(scored)
    await appendStageUpdate(createIntakeStageUpdate(scored))
    if (scored.review_required) {
      await upsertReviewQueue(createReviewFromCandidate(scored))
    }
    return NextResponse.json(scored, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
