import { NextResponse } from "next/server"
import { getBehavioralProfile, getMessages, upsertBehavioralProfile } from "@/lib/store"
import { analyzeMessages } from "@/lib/behavioral-profiler"

// GET /api/candidates/[id]/profile — get behavioral profile
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getBehavioralProfile(id)
  if (!profile) return NextResponse.json({ error: "No behavioral profile yet. Add messages first." }, { status: 404 })
  return NextResponse.json(profile)
}

// POST /api/candidates/[id]/profile — force re-analyze from all messages
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const messages = await getMessages(id)
  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages to analyze" }, { status: 400 })
  }
  const profile = analyzeMessages(id, messages)
  await upsertBehavioralProfile(profile)
  return NextResponse.json(profile)
}
