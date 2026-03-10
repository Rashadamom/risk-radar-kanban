"use client"

import * as React from "react"

const STAGES = ["Intake", "Screening", "Interview Scheduled", "Interview Done", "Offer Extended", "Offer Accepted", "Joined"]

export function CandidateIntakeForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const get = (k: string) => fd.get(k)?.toString().trim() || ""

    const intake = {
      candidate_name: get("candidate_name"),
      phone: get("phone"),
      email: get("email"),
      recruiter_id: get("recruiter_id") || "rec_001",
      recruiter_name: get("recruiter_name"),
      client_id: get("client_id"),
      source: get("source") || "manual_entry",
      role: get("role"),
      skill_stack: get("skill_stack"),
      total_experience: get("total_experience"),
      current_location: get("current_location"),
      current_compensation: Number(get("current_compensation")) || 0,
      expected_compensation: Number(get("expected_compensation")) || 0,
      notice_period_days: Number(get("notice_period_days")) || 30,
      buyout_possible: get("buyout_possible") || "unknown",
      earliest_joining_date: get("earliest_joining_date") || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      job_location: get("job_location"),
      work_mode: get("work_mode") || "hybrid",
      relocation_willingness: get("relocation_willingness") || "maybe",
      resume_received: get("resume_received") || "no",
      available_for_interview_soon: get("available_for_interview_soon") || "maybe",
      last_response_timestamp: new Date().toISOString(),
      notes: get("notes"),
      current_stage: get("current_stage") || "Intake",
    }

    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-8" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-[#2A2D3A] bg-[#0F1117] p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#E8EAEF]">Add Candidate</h2>
          <button onClick={onClose} className="text-[#5A5F72] hover:text-[#E8EAEF] text-lg">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic Info */}
          <Section title="Basic Info">
            <Row>
              <Field label="Full Name *" name="candidate_name" required placeholder="Aditya Kumar" />
              <Field label="Phone *" name="phone" required placeholder="+919876543210" />
            </Row>
            <Row>
              <Field label="Email" name="email" type="email" placeholder="aditya@gmail.com" />
              <Field label="Role *" name="role" required placeholder="Senior Java Developer" />
            </Row>
            <Field label="Skills *" name="skill_stack" required placeholder="Java, Spring Boot, Microservices, AWS" />
            <Row>
              <Field label="Experience" name="total_experience" placeholder="5 years" />
              <Field label="Current Location *" name="current_location" required placeholder="Hyderabad" />
            </Row>
          </Section>

          {/* Compensation */}
          <Section title="Compensation">
            <Row>
              <Field label="Current CTC (annual)" name="current_compensation" type="number" placeholder="1800000" />
              <Field label="Expected CTC (annual)" name="expected_compensation" type="number" placeholder="2400000" />
            </Row>
          </Section>

          {/* Notice & Joining */}
          <Section title="Notice & Joining">
            <Row>
              <Field label="Notice Period (days)" name="notice_period_days" type="number" placeholder="60" />
              <Select label="Buyout Possible" name="buyout_possible" options={["unknown", "yes", "no"]} />
            </Row>
            <Row>
              <Field label="Earliest Joining Date" name="earliest_joining_date" type="date" />
              <Select label="Interview Available" name="available_for_interview_soon" options={["yes", "maybe", "no"]} />
            </Row>
          </Section>

          {/* Job Details */}
          <Section title="Job & Location">
            <Row>
              <Field label="Job Location *" name="job_location" required placeholder="Bangalore" />
              <Select label="Work Mode" name="work_mode" options={["hybrid", "office", "remote"]} />
            </Row>
            <Row>
              <Select label="Relocation Willingness" name="relocation_willingness" options={["yes", "maybe", "no"]} />
              <Select label="Resume Received" name="resume_received" options={["yes", "no"]} />
            </Row>
          </Section>

          {/* Recruiter & Pipeline */}
          <Section title="Pipeline">
            <Row>
              <Field label="Recruiter Name" name="recruiter_name" placeholder="Ananya Desai" />
              <Field label="Recruiter ID" name="recruiter_id" placeholder="rec_001" />
            </Row>
            <Row>
              <Field label="Client / Company" name="client_id" placeholder="TechCorp" />
              <Select label="Current Stage" name="current_stage" options={STAGES} />
            </Row>
            <Row>
              <Select label="Source" name="source" options={["manual_entry", "whatsapp", "linkedin", "naukri", "referral", "job_board"]} />
              <div />
            </Row>
          </Section>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#5A5F72]">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-lg border border-[#2A2D3A] bg-[#1A1D27] px-3 py-2 text-sm text-[#E8EAEF] placeholder:text-[#5A5F72] focus:border-[#7C6AF7] focus:outline-none"
              placeholder="Any additional context..."
            />
          </div>

          {/* Submit */}
          {error && <p className="text-xs text-[#F87171]">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#7C6AF7] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6B5CE6] disabled:opacity-50"
            >
              {loading ? "Scoring..." : "Add & Score Candidate"}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-[#5A5F72] hover:text-[#E8EAEF]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#5A5F72]">{title}</h3>
      <div className="space-y-3 rounded-lg border border-[#2A2D3A] bg-[#1A1D27] p-4">
        {children}
      </div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}

function Field({ label, name, type = "text", required, placeholder }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#5A5F72]">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-[#2A2D3A] bg-[#0F1117] px-3 py-1.5 text-sm text-[#E8EAEF] placeholder:text-[#3A3D4A] focus:border-[#7C6AF7] focus:outline-none"
      />
    </div>
  )
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#5A5F72]">{label}</label>
      <select
        name={name}
        className="w-full rounded-md border border-[#2A2D3A] bg-[#0F1117] px-3 py-1.5 text-sm text-[#E8EAEF] focus:border-[#7C6AF7] focus:outline-none"
      >
        {options.map(o => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </div>
  )
}
