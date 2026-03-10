"use client"

import * as React from "react"

type Alert = {
  alert_id: string
  candidate_id: string
  candidate_name: string
  type: string
  severity: "info" | "warning" | "urgent" | "critical"
  title: string
  description: string
  suggested_action: string
  auto_message?: string
  auto_target?: string
  created_at: string
  acknowledged: boolean
}

type AlertsData = {
  alerts: Alert[]
  digest: string
  summary: { total: number; critical: number; urgent: number; warning: number; info: number }
}

const SEVERITY_STYLES = {
  critical: { bg: "bg-[#2D1B1B]", border: "border-[#7F1D1D]", text: "text-[#F87171]", dot: "bg-[#EF4444]", label: "CRITICAL" },
  urgent: { bg: "bg-[#2D1F14]", border: "border-[#7C2D12]", text: "text-[#FB923C]", dot: "bg-[#F97316]", label: "URGENT" },
  warning: { bg: "bg-[#2C2008]", border: "border-[#78350F]", text: "text-[#FBBF24]", dot: "bg-[#FBBF24]", label: "WARNING" },
  info: { bg: "bg-[#1A1D27]", border: "border-[#2A2D3A]", text: "text-[#38BDF8]", dot: "bg-[#38BDF8]", label: "INFO" },
}

export function AlertsPanel({ onSelectCandidate }: { onSelectCandidate?: (id: string) => void }) {
  const [data, setData] = React.useState<AlertsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [expanded, setExpanded] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/alerts")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[#1A1D27]" />
        ))}
      </div>
    )
  }

  if (!data || data.alerts.length === 0) {
    return (
      <div className="rounded-lg border border-[#065F46] bg-[#0D2420] px-4 py-6 text-center">
        <p className="text-sm font-medium text-[#34D399]">All clear</p>
        <p className="mt-1 text-xs text-[#5A5F72]">No active alerts. Pipeline is healthy.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-3 rounded-lg border border-[#2A2D3A] bg-[#13151C] px-4 py-2">
        <span className="text-xs font-semibold text-[#E8EAEF]">{data.summary.total} Alerts</span>
        {data.summary.critical > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[#F87171]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse" />
            {data.summary.critical} critical
          </span>
        )}
        {data.summary.urgent > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[#FB923C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
            {data.summary.urgent} urgent
          </span>
        )}
        {data.summary.warning > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[#FBBF24]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
            {data.summary.warning} warning
          </span>
        )}
      </div>

      {/* Alert cards */}
      {data.alerts.map(alert => {
        const s = SEVERITY_STYLES[alert.severity]
        const isExpanded = expanded === alert.alert_id

        return (
          <div
            key={alert.alert_id}
            className={`rounded-lg border ${s.border} ${s.bg} transition-all`}
          >
            <button
              className="flex w-full items-start gap-3 px-4 py-3 text-left"
              onClick={() => setExpanded(isExpanded ? null : alert.alert_id)}
            >
              <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${s.dot} ${alert.severity === "critical" ? "animate-pulse" : ""}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span>
                  <span className="text-[9px] text-[#5A5F72]">{alert.type.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-[#E8EAEF]">{alert.title}</p>
                <p className="mt-0.5 text-xs text-[#8B90A0] line-clamp-1">{alert.description}</p>
              </div>
              <span className="mt-1 text-[10px] text-[#5A5F72]">{isExpanded ? "^" : "v"}</span>
            </button>

            {isExpanded && (
              <div className="border-t border-[#2A2D3A] px-4 py-3 animate-fade-in">
                <p className="text-xs text-[#8B90A0]">{alert.description}</p>

                <div className="mt-2 rounded bg-[#0F1117] px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#5A5F72]">Suggested Action</p>
                  <p className="mt-1 text-xs text-[#E8EAEF]">{alert.suggested_action}</p>
                </div>

                {alert.auto_message && (
                  <div className="mt-2 rounded bg-[#0F1117] px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[#5A5F72]">
                      Auto-message ({alert.auto_target})
                    </p>
                    <p className="mt-1 text-xs italic text-[#8B90A0]">{alert.auto_message}</p>
                  </div>
                )}

                <div className="mt-2 flex gap-2">
                  {onSelectCandidate && (
                    <button
                      onClick={() => onSelectCandidate(alert.candidate_id)}
                      className="rounded bg-[#7C6AF7] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-[#6B5CE6]"
                    >
                      View Candidate
                    </button>
                  )}
                  <button className="rounded border border-[#2A2D3A] px-3 py-1.5 text-[10px] font-medium text-[#8B90A0] hover:text-[#E8EAEF]">
                    Acknowledge
                  </button>
                  {alert.auto_message && (
                    <button className="rounded border border-[#065F46] px-3 py-1.5 text-[10px] font-medium text-[#34D399] hover:bg-[#0D2420]">
                      Send Message
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
