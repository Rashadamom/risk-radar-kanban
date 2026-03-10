"use client"

import * as React from "react"

export function QuickIntake() {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return

    setLoading(true)
    setResult(null)

    try {
      // Simulate WhatsApp-style text intake
      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: [{
            changes: [{
              value: {
                messages: [{ from: "demo_recruiter", type: "text", text: { body: text } }],
              },
            }],
          }],
        }),
      })
      const data = await res.json()
      const msg = data.results?.[0]?.message || "Processed"
      setResult(msg)
      setText("")
      // Reload after a moment to update pipeline
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setResult(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-[#7C6AF7] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#6B5CE6]"
      >
        + New Candidate
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-[#2A2D3A] bg-[#0F1117] p-6" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#E8EAEF]">Forward Resume / Text</h2>
          <button onClick={() => setOpen(false)} className="text-[#5A5F72] hover:text-[#E8EAEF]">&times;</button>
        </div>

        <p className="mb-3 text-xs text-[#5A5F72]">
          Paste a resume or candidate details. The agent will extract fields, score risk, and add to pipeline.
          This simulates the WhatsApp &quot;forward resume&quot; flow.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste resume text or candidate details here..."
            className="mb-3 h-48 w-full resize-none rounded-lg border border-[#2A2D3A] bg-[#1A1D27] px-3 py-2 text-sm text-[#E8EAEF] placeholder:text-[#5A5F72] focus:border-[#7C6AF7] focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="rounded-md bg-[#7C6AF7] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#6B5CE6] disabled:opacity-50"
            >
              {loading ? "Processing..." : "Process & Score"}
            </button>
            {result && (
              <pre className="max-h-32 flex-1 overflow-auto rounded bg-[#1A1D27] p-2 text-[10px] text-[#8B90A0] whitespace-pre-wrap">
                {result}
              </pre>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
