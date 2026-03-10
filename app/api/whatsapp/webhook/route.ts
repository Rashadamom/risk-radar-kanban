import { NextResponse } from "next/server"
import { parseResume, resumeToIntake } from "@/lib/resume-parser"
import { processCandidate } from "@/lib/scoring"

// Send a WhatsApp text message via Cloud API
async function sendWhatsApp(to: string, text: string) {
  const token = process.env.WHATSAPP_API_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) {
    console.warn("[whatsapp] WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — message not sent")
    return
  }
  const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error("[whatsapp] send failed:", err)
  }
}
import {
  upsertCandidate,
  upsertReviewQueue,
  appendStageUpdate,
  createReviewFromCandidate,
  createIntakeStageUpdate,
  getCandidates,
  updateCandidate as updateCandidateStore,
  appendMessage,
  getMessages,
  upsertBehavioralProfile,
} from "@/lib/store"
import { analyzeMessages } from "@/lib/behavioral-profiler"

// WhatsApp Business API webhook verification (GET)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "riskradar_verify_2024"

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// WhatsApp Business API webhook messages (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages?.length) {
      return NextResponse.json({ status: "ok" })
    }

    const results = []

    for (const message of messages) {
      const from = message.from
      const type = message.type

      if (type === "text") {
        const text = message.text?.body || ""
        const result = await handleTextMessage(from, text)
        results.push(result)
        // Actually send the reply back on WhatsApp
        if (result.message) {
          await sendWhatsApp(from, result.message)
        }
      } else if (type === "document" || type === "image") {
        results.push({
          action: "media_received",
          from,
          note: "Resume media received. In production, this triggers download + OCR + parsing pipeline.",
        })
        await sendWhatsApp(from, "Resume received! Processing... I'll score commitment risk and reply shortly.")
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (e: any) {
    console.error("[whatsapp webhook] error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function handleTextMessage(from: string, text: string) {
  const lower = text.toLowerCase().trim()

  if (lower === "status" || lower === "my status" || lower.startsWith("status ")) {
    return handleStatusQuery(from)
  }

  if (lower === "pipeline" || lower === "summary") {
    return handlePipelineSummary(from)
  }

  if (isLikelyResume(text)) {
    return handleResumeIntake(from, text)
  }

  return handleCandidateResponse(from, text)
}

function isLikelyResume(text: string): boolean {
  const resumeKeywords = ["experience", "education", "skills", "resume", "objective", "summary", "employment", "qualification"]
  const lower = text.toLowerCase()
  const matchCount = resumeKeywords.filter(kw => lower.includes(kw)).length
  return text.length > 200 && matchCount >= 2
}

async function handleResumeIntake(from: string, resumeText: string) {
  try {
    const parsed = await parseResume(resumeText)
    const intake = resumeToIntake(parsed, {
      recruiter_id: `rec_wa_${from.slice(-10)}`,
      recruiter_name: `WhatsApp ${from}`,
    })
    const scored = processCandidate(intake)
    await upsertCandidate(scored)
    await appendStageUpdate(createIntakeStageUpdate(scored))
    if (scored.review_required) {
      await upsertReviewQueue(createReviewFromCandidate(scored))
    }

    return {
      action: "resume_processed",
      candidate_id: scored.candidate_id,
      reply_to: from,
      message: [
        `*RiskRadar: New Candidate Scored*`,
        ``,
        `Name: ${scored.candidate_name}`,
        `Role: ${scored.role}`,
        `Risk Score: ${scored.candidate_risk_score}/100 [${scored.risk_band}]`,
        scored.hard_stop_flags.length > 0 ? `Blockers: ${scored.hard_stop_flags.join(", ")}` : `Blockers: None`,
        `Hike: ${scored.hike_percent ?? 0}%`,
        `Notice: ${scored.notice_period_days} days`,
        ``,
        `Action: ${scored.next_action}`,
        ``,
        `Pipeline entry created. Track on dashboard.`,
      ].join("\n"),
    }
  } catch (e: any) {
    return {
      action: "parse_failed",
      reply_to: from,
      message: `Could not parse resume: ${e.message}. Please forward a clearer resume or enter details manually.`,
    }
  }
}

async function handleStatusQuery(from: string) {
  const candidates = await getCandidates()
  const match = candidates.find(c =>
    c.phone.replace(/\D/g, "").endsWith(from.replace(/\D/g, "").slice(-10))
  )

  if (match) {
    return {
      action: "status_reply",
      reply_to: from,
      message: [
        `*Your Application Status*`,
        ``,
        `Role: ${match.role}`,
        `Stage: ${match.current_stage}`,
        `Next: ${match.next_action}`,
        ``,
        `Reply with any questions.`,
      ].join("\n"),
    }
  }

  return {
    action: "status_not_found",
    reply_to: from,
    message: "No active application found for your number. Contact your recruiter for details.",
  }
}

async function handlePipelineSummary(from: string) {
  const candidates = await getCandidates()
  const stages: Record<string, number> = {}
  const bands = { Low: 0, Moderate: 0, Elevated: 0, High: 0 }

  for (const c of candidates) {
    stages[c.current_stage] = (stages[c.current_stage] || 0) + 1
    if (c.risk_band in bands) bands[c.risk_band as keyof typeof bands]++
  }

  const stageLines = Object.entries(stages).map(([s, n]) => `  ${s}: ${n}`)
  const highRisk = candidates.filter(c => c.risk_band === "High" || c.risk_band === "Elevated")

  return {
    action: "pipeline_summary",
    reply_to: from,
    message: [
      `*Pipeline Summary*`,
      `Total: ${candidates.length} candidates`,
      ``,
      `*By Stage:*`,
      ...stageLines,
      ``,
      `*Risk Distribution:*`,
      `  Low: ${bands.Low} | Moderate: ${bands.Moderate}`,
      `  Elevated: ${bands.Elevated} | High: ${bands.High}`,
      ``,
      highRisk.length > 0
        ? `*Needs Attention:*\n${highRisk.map(c => `  ${c.candidate_name} (${c.risk_band}, ${c.candidate_risk_score})`).join("\n")}`
        : "All candidates in safe zone.",
    ].join("\n"),
  }
}

async function handleCandidateResponse(from: string, text: string) {
  const candidates = await getCandidates()
  const match = candidates.find(c =>
    c.phone.replace(/\D/g, "").endsWith(from.replace(/\D/g, "").slice(-10))
  )

  if (match) {
    // Calculate response time from last recruiter message
    const existingMessages = await getMessages(match.candidate_id)
    const lastRecruiterMsg = [...existingMessages].reverse().find(m => m.from === "recruiter")
    const responseTimeMinutes = lastRecruiterMsg
      ? Math.round((Date.now() - new Date(lastRecruiterMsg.timestamp).getTime()) / 60000)
      : undefined

    // Store the message
    await appendMessage({
      message_id: `msg_${match.candidate_id}_${Date.now()}`,
      candidate_id: match.candidate_id,
      from: "candidate",
      timestamp: new Date().toISOString(),
      text,
      response_time_minutes: responseTimeMinutes,
    })

    // Re-analyze behavioral profile
    const allMessages = await getMessages(match.candidate_id)
    const profile = analyzeMessages(match.candidate_id, allMessages)
    await upsertBehavioralProfile(profile)

    // Update comm lag
    await updateCandidateStore(match.candidate_id, {
      last_response_timestamp: new Date().toISOString(),
      comm_lag_hours: 0,
    })

    // Build response with behavioral insight
    const signals = profile.behavioral_signals.length > 0
      ? `\nBehavioral signals: ${profile.behavioral_signals.slice(0, 2).join(", ")}`
      : ""

    return {
      action: "comm_updated",
      candidate_id: match.candidate_id,
      behavioral_risk_adjustment: profile.behavioral_risk_adjustment,
      reply_to: from,
      message: `Thanks for your response! Your recruiter has been notified.`,
      recruiter_alert: profile.behavioral_risk_adjustment >= 10
        ? `*Alert for ${match.candidate_name}*: Behavioral risk adjustment +${profile.behavioral_risk_adjustment}${signals}`
        : null,
    }
  }

  return {
    action: "unknown_sender",
    reply_to: from,
    message: "Welcome to RiskRadar. Forward a resume to get started, or ask your recruiter to add you.",
  }
}
