import { NextResponse } from "next/server"
import { resolveReviewItem } from "@/lib/store"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const resolved = await resolveReviewItem(id, {
    resolution_status: body.resolution_status || "resolved",
    resolution_notes: body.resolution_notes || "",
  })
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(resolved)
}
