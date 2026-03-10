import { NextResponse } from "next/server"
import { getReviewQueue } from "@/lib/store"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const filters = {
    risk_band: url.searchParams.get("risk_band") || undefined,
    recruiter_id: url.searchParams.get("recruiter_id") || undefined,
    resolved: url.searchParams.get("resolved") === "true" ? true
      : url.searchParams.get("resolved") === "false" ? false
      : undefined,
  }
  return NextResponse.json(await getReviewQueue(filters))
}
