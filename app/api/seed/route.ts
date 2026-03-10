import { NextResponse } from "next/server"
import { seedDemoData } from "@/lib/seed"

export async function POST() {
  const result = await seedDemoData()
  return NextResponse.json({ message: `Seeded ${result.seeded} demo candidates` })
}
