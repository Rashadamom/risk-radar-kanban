import { NextResponse } from "next/server"
import { getCandidate, updateCandidate, getStageUpdates } from "@/lib/store"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidate(id)
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const stage_history = await getStageUpdates(id)
  return NextResponse.json({ ...candidate, stage_history })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const updates = await req.json()
  const updated = await updateCandidate(id, updates)
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(updated)
}
