import { NextResponse } from "next/server"
import { getMessages, appendMessage, getCandidate, upsertBehavioralProfile } from "@/lib/store"
import { analyzeMessages, type MessageEntry } from "@/lib/behavioral-profiler"

// GET /api/candidates/[id]/messages — fetch conversation history
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const messages = await getMessages(id)
  return NextResponse.json(messages)
}

// POST /api/candidates/[id]/messages — add a message and re-profile
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidate(id)
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })

  const body = await req.json()

  const entry: MessageEntry = {
    message_id: `msg_${id}_${Date.now()}`,
    candidate_id: id,
    from: body.from || "candidate",
    timestamp: body.timestamp || new Date().toISOString(),
    text: body.text || "",
    response_time_minutes: body.response_time_minutes,
  }

  await appendMessage(entry)

  // Re-analyze behavioral profile after each new message
  const allMessages = await getMessages(id)
  const profile = analyzeMessages(id, allMessages)
  await upsertBehavioralProfile(profile)

  return NextResponse.json({ message: entry, profile }, { status: 201 })
}
