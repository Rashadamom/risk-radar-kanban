// Resume parsing via LLM (LM Studio or Claude API)
// Extracts structured candidate fields from resume text

import type { CandidateIntake } from "./scoring"

const EXTRACTION_PROMPT = `You are a resume parsing engine for an IT staffing firm in India.

Extract the following fields from the resume text provided. Return ONLY a JSON object with these fields:

{
  "candidate_name": "Full name",
  "phone": "Phone number with country code",
  "email": "Email address or empty string",
  "role": "Most recent job title or target role",
  "skill_stack": "Comma-separated key technical skills (max 8)",
  "total_experience": "Total years of experience (e.g. '5 years')",
  "current_location": "Current city",
  "current_compensation": 0,
  "expected_compensation": 0,
  "notice_period_days": 0,
  "work_mode": "unknown"
}

Rules:
- If a field cannot be determined from the resume, use empty string for text fields and 0 for numbers.
- For compensation, extract numbers in LPA (lakhs per annum) if mentioned, convert to annual number. If "8 LPA", return 800000.
- For notice_period_days, common Indian values: 30, 60, 90. Default to 0 if not mentioned.
- Do NOT guess or hallucinate values that aren't in the resume.
- Output ONLY the JSON object. No markdown, no explanation.`

export type ParsedResume = {
  candidate_name: string
  phone: string
  email: string
  role: string
  skill_stack: string
  total_experience: string
  current_location: string
  current_compensation: number
  expected_compensation: number
  notice_period_days: number
  work_mode: string
}

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  const baseUrl = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1"
  const model = process.env.LMSTUDIO_MODEL || "default"

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: resumeText },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ""

  // Extract JSON from response
  const start = content.indexOf("{")
  const end = content.lastIndexOf("}")
  if (start === -1 || end === -1) {
    throw new Error("No JSON found in LLM response")
  }

  const parsed = JSON.parse(content.slice(start, end + 1))

  return {
    candidate_name: String(parsed.candidate_name || ""),
    phone: String(parsed.phone || ""),
    email: String(parsed.email || ""),
    role: String(parsed.role || ""),
    skill_stack: String(parsed.skill_stack || ""),
    total_experience: String(parsed.total_experience || ""),
    current_location: String(parsed.current_location || ""),
    current_compensation: Number(parsed.current_compensation || 0),
    expected_compensation: Number(parsed.expected_compensation || 0),
    notice_period_days: Number(parsed.notice_period_days || 0),
    work_mode: String(parsed.work_mode || "unknown"),
  }
}

export function resumeToIntake(
  parsed: ParsedResume,
  recruiter: { recruiter_id: string; recruiter_name?: string },
  overrides?: Partial<CandidateIntake>,
): CandidateIntake {
  return {
    candidate_name: parsed.candidate_name,
    phone: parsed.phone,
    email: parsed.email,
    recruiter_id: recruiter.recruiter_id,
    recruiter_name: recruiter.recruiter_name,
    role: parsed.role,
    skill_stack: parsed.skill_stack,
    total_experience: parsed.total_experience,
    current_location: parsed.current_location,
    current_compensation: parsed.current_compensation,
    expected_compensation: parsed.expected_compensation,
    notice_period_days: parsed.notice_period_days,
    job_location: parsed.current_location, // default to current, recruiter can override
    work_mode: parsed.work_mode,
    earliest_joining_date: new Date(Date.now() + parsed.notice_period_days * 86400000).toISOString(),
    resume_received: "yes",
    last_response_timestamp: new Date().toISOString(),
    source: "whatsapp",
    ...overrides,
  }
}
