import { NextResponse } from "next/server"
import { getAnalyticsSummary } from "@/lib/store"

export async function GET() {
  return NextResponse.json(await getAnalyticsSummary())
}
