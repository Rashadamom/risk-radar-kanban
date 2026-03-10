"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

type RiskFlag = { severity: "low" | "medium" | "high"; title: string }

type AnalyzeResult = {
  ambiguityScore: number
  riskLevel: "low" | "medium" | "high"
  riskFlags: RiskFlag[]
  clarifyingQuestions: string[]
  rewrite: string
}

type Props = {
  initialText?: string
  onMoveToNeedsClarification?: () => void
}

function riskBadgeVariant(level: AnalyzeResult["riskLevel"]) {
  if (level === "high") return "destructive"
  if (level === "medium") return "secondary"
  return "outline"
}

export function AnalyzePanel({ initialText = "", onMoveToNeedsClarification }: Props) {
  const [text, setText] = React.useState(initialText)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<AnalyzeResult | null>(null)

  async function analyzeTicket() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(`HTTP ${res.status}: ${msg.slice(0, 200)}`)
      }

      const data = (await res.json()) as AnalyzeResult
      setResult(data)

      if (data.riskLevel !== "low") {
        onMoveToNeedsClarification?.()
      }
    } catch (e: any) {
      setError(e?.message || "Analyze failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Analyze</CardTitle>
          <Badge variant="outline">LM Studio</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a ticket/PRD/circular and get ambiguity + risk in structured output.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your requirement here…"
          className="min-h-[140px]"
        />

        <div className="flex items-center gap-2">
          <Button onClick={analyzeTicket} disabled={loading || !text.trim()}>
            {loading ? "Analyzing…" : "Analyze"}
          </Button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>

        {result ? (
          <div className="space-y-4">
            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-3xl font-semibold">
  {result.ambiguityScore}
  <span className="text-sm text-muted-foreground ml-2">/100 Ambiguity</span>
</div>
              <Badge variant={riskBadgeVariant(result.riskLevel)}>{result.riskLevel.toUpperCase()}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Flags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.riskFlags?.length ? (
                    result.riskFlags.map((f, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <Badge variant="outline">{f.severity}</Badge>
                        <div className="text-sm">{f.title}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No flags.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clarifying Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.clarifyingQuestions?.length ? (
                    <ul className="list-disc pl-5 text-sm space-y-2">
                      {result.clarifyingQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground">No questions.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rewrite</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[120px]">
                  <p className="text-sm leading-relaxed">{result.rewrite}</p>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}