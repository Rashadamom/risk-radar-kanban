import { NextResponse } from "next/server"

export const runtime = "nodejs"

// ---------- helpers ----------
function clampInt(n: any, min: number, max: number, fallback: number) {
  const x = Number(n)
  if (!Number.isFinite(x)) return fallback
  return Math.max(min, Math.min(max, Math.round(x)))
}

function normalizeEnum(val: any, allowed: string[], fallback: string) {
  const s = String(val ?? "").toLowerCase()
  return allowed.includes(s) ? s : fallback
}

function normalizeOutput(out: any) {
  const ambiguityScore = clampInt(out?.ambiguityScore, 0, 100, 75)
  const riskLevel = normalizeEnum(out?.riskLevel, ["low", "medium", "high"], "medium")

  const riskFlagsRaw = Array.isArray(out?.riskFlags) ? out.riskFlags : []
  const riskFlags = riskFlagsRaw.slice(0, 3).map((x: any) => ({
    severity: normalizeEnum(x?.severity, ["low", "medium", "high"], "medium"),
    title: String(x?.title ?? "Unspecified risk").slice(0, 120),
  }))

  const qsRaw = Array.isArray(out?.clarifyingQuestions) ? out.clarifyingQuestions : []
  const clarifyingQuestions = qsRaw.slice(0, 3).map((q: any) => String(q).slice(0, 180))

  const rewrite =
    String(out?.rewrite ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 120) // ~120 words max
      .join(" ")
      .trim() || "Provide explicit performance, security, and scope definitions."

  return { ambiguityScore, riskLevel, riskFlags, clarifyingQuestions, rewrite }
}

async function readAsJson(res: Response) {
  const text = await res.text()
  try {
    return { ok: res.ok, status: res.status, text, json: JSON.parse(text) }
  } catch {
    return { ok: res.ok, status: res.status, text, json: null as any }
  }
}

// ---------- LM Studio structured output schema ----------
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "risk_ambiguity_output",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["ambiguityScore", "riskLevel", "riskFlags", "clarifyingQuestions", "rewrite"],
      properties: {
        ambiguityScore: { type: "integer", minimum: 0, maximum: 100 },
        riskLevel: { type: "string", enum: ["low", "medium", "high"] },
        riskFlags: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["severity", "title"],
            properties: {
              severity: { type: "string", enum: ["low", "medium", "high"] },
              title: { type: "string", minLength: 1, maxLength: 120 },
            },
          },
        },
        clarifyingQuestions: {
          type: "array",
          maxItems: 3,
          items: { type: "string", minLength: 1, maxLength: 180 },
        },
        rewrite: { type: "string", minLength: 1, maxLength: 900 },
      },
    },
  },
} as const

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const BASE_URL = process.env.LMSTUDIO_BASE_URL
    const MODEL = process.env.LMSTUDIO_MODEL

    if (!BASE_URL || !MODEL) {
      return NextResponse.json({
        ambiguityScore: 80,
        riskLevel: "high",
        riskFlags: [{ severity: "high", title: "Missing env vars (LMSTUDIO_BASE_URL / LMSTUDIO_MODEL)" }],
        clarifyingQuestions: ["Check .env.local and restart dev server."],
        rewrite: "Environment variables not loaded.",
        debug: { requestId, BASE_URL, MODEL },
      })
    }

    const body = await req.json()
    const text = body?.text

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }

    const systemPrompt = `
You are an AI Operational Risk & Ambiguity Engine.

You MUST be skeptical. If the input contains vague terms or missing constraints, you MUST assign a high ambiguityScore and add riskFlags + clarifyingQuestions.

Scoring rubric (deterministic):
- Start at 0.
- +20 for each vague term without measurable definition (e.g., fast, secure, quickly, robust, easy, best).
- +20 if success metrics/thresholds are missing (latency ms, error rate, timeouts, SLA).
- +20 if scope/user segments are undefined ("all users" without device, locale, accessibility).
- +20 if security/compliance standard is undefined (PCI DSS, OWASP ASVS, SOC2, HIPAA, etc.).
- +10 if failure handling is underspecified (what is failure, retry, user messaging, logging).
Cap at 100.

riskLevel mapping:
0-30 low, 31-70 medium, 71-100 high.

Hard limits:
- riskFlags: max 3
- clarifyingQuestions: max 2 (short, <= 12 words each)
- rewrite: max 35 words
Always output COMPLETE JSON. If space is limited, shorten text; never leave JSON incomplete.

Output must be ONLY the JSON object (no markdown, no code fences, no commentary).
`.trim()

    // 1) Try with schema
    const payloadWithSchema = {
      model: MODEL,
      temperature: 0,
      top_p: 0.9,
      max_tokens: 250,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    }

    let lmRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadWithSchema),
    })

    let lm = await readAsJson(lmRes)

    // 2) If server rejects response_format, retry without it
    if (!lm.ok) {
      console.log(`[analyze ${requestId}] LM non-OK with json_schema: ${lm.status}`)
      console.log(`[analyze ${requestId}] LM body (first 800): ${lm.text.slice(0, 800)}`)

      const payloadNoSchema = {
        model: MODEL,
        temperature: 0,
        top_p: 0.9,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }

      lmRes = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadNoSchema),
      })

      lm = await readAsJson(lmRes)
    }

    console.log(`[analyze ${requestId}] LM status: ${lm.status}`)
    console.log(`[analyze ${requestId}] LM body (first 800): ${lm.text.slice(0, 800)}`)

    // Pull output from parsed OR content (LM Studio varies)
    const message = lm.json?.choices?.[0]?.message
    const raw = (message as any)?.parsed ?? (message as any)?.content

    if (!lm.ok || raw == null) {
      return NextResponse.json({
        ambiguityScore: 80,
        riskLevel: "high",
        riskFlags: [{ severity: "high", title: "LM Studio request failed" }],
        clarifyingQuestions: ["Check dev logs for LM error details."],
        rewrite: "LM Studio did not return a usable completion.",
        debug: {
          requestId,
          lmStatus: lm.status,
          lmBodyFirst800: lm.text.slice(0, 800),
          hasMessage: !!message,
        },
      })
    }

    // Parse raw
    let parsed: any
    try {
      if (typeof raw === "object" && raw !== null) {
        parsed = raw
      } else {
        const s = String(raw).trim()
        const start = s.indexOf("{")
        const end = s.lastIndexOf("}")
        if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found in output")
        parsed = JSON.parse(s.slice(start, end + 1))
      }
    } catch (e: any) {
      return NextResponse.json({
        ambiguityScore: 75,
        riskLevel: "medium",
        riskFlags: [{ severity: "medium", title: "Model returned non-JSON content" }],
        clarifyingQuestions: ["Add measurable constraints and retry."],
        rewrite: "Provide explicit performance, security, and scope definitions.",
        debug: {
          requestId,
          rawType: typeof raw,
          rawFirst800: String(raw ?? "").slice(0, 800),
          parseError: e?.message || String(e),
        },
      })
    }

    const out = normalizeOutput(parsed)

    const looksTooSafe =
      out.ambiguityScore <= 5 ||
      (out.riskLevel === "low" && (out.riskFlags.length === 0 || out.clarifyingQuestions.length === 0))

    if (looksTooSafe) {
      return NextResponse.json({
        ambiguityScore: 75,
        riskLevel: "high",
        riskFlags: [
          { severity: "high", title: "Vague terms without measurable definitions" },
          { severity: "high", title: "Missing thresholds/acceptance criteria" },
          { severity: "medium", title: "Scope and edge cases not specified" },
        ],
        clarifyingQuestions: [
          "What measurable thresholds define success (e.g., latency, SLA, error rate)?",
          "What standards/policies apply (security, privacy, compliance)?",
          "What is the exact scope (users, platforms, locales, accessibility, failure modes)?",
        ],
        rewrite:
          "Rewrite with measurable targets, defined scope, failure behavior, and applicable standards. Include concrete thresholds (latency/SLA), explicit error handling, and constraints for supported users/platforms/locales.",
      })
    }

    return NextResponse.json(out)
  } catch (err: any) {
    console.error(`[analyze] fatal error:`, err?.message || err)
    return NextResponse.json({
      ambiguityScore: 80,
      riskLevel: "high",
      riskFlags: [{ severity: "high", title: "Backend execution error" }],
      clarifyingQuestions: ["Check dev server terminal logs."],
      rewrite: "System encountered processing issue.",
      debug: { error: err?.message || String(err) },
    })
  } finally {
    clearTimeout(timeout)
  }
}