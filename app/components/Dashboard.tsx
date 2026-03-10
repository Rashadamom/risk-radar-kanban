"use client"

import * as React from "react"
import { Pipeline } from "./Pipeline"
import { AlertsPanel } from "./AlertsPanel"
import { SeedButton } from "./SeedButton"
import { CandidateIntakeForm } from "./CandidateIntakeForm"

type Tab = "pipeline" | "alerts"

export function Dashboard() {
  const [tab, setTab] = React.useState<Tab>("pipeline")
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null)
  const [showIntakeForm, setShowIntakeForm] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#0A0C12" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1E2130", background: "linear-gradient(90deg, #0A0C12 0%, #0E1018 100%)" }}>
        <div className="flex items-center gap-4">
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "#F0F2F8" }}>
            Risk<span style={{ color: "#8B7FF7" }}>Radar</span>
          </h1>
          <span style={{
            background: "linear-gradient(90deg, rgba(139,127,247,0.15), rgba(139,127,247,0.05))",
            border: "1px solid rgba(139,127,247,0.3)",
            borderRadius: 20,
            padding: "3px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "#A89FF8",
            letterSpacing: "0.02em"
          }}>
            Candidate Commitment Intelligence
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIntakeForm(true)}
            style={{
              background: "linear-gradient(135deg, #8B7FF7, #6C5CE7)",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              letterSpacing: "0.01em"
            }}
          >
            + New Candidate
          </button>
          <SeedButton />
          <div style={{
            width: 34, height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #8B7FF7, #6C5CE7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff"
          }}>
            AD
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1E2130", padding: "0 24px", display: "flex", gap: 8 }}>
        <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")}>
          Pipeline
        </TabButton>
        <TabButton active={tab === "alerts"} onClick={() => setTab("alerts")}>
          Alerts
        </TabButton>
      </div>

      {/* Intake Form Modal */}
      {showIntakeForm && (
        <CandidateIntakeForm
          onClose={() => setShowIntakeForm(false)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}

      {/* Content */}
      <main className="flex-1 px-6 py-5">
        {tab === "pipeline" && <Pipeline key={refreshKey} />}
        {tab === "alerts" && (
          <div className="mx-auto max-w-3xl">
            <AlertsPanel onSelectCandidate={(id) => {
              setSelectedCandidateId(id)
              setTab("pipeline")
            }} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1E2130", padding: "10px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4A5068" }}>
          <span>RiskRadar v0.1 — Channel-native recruitment risk engine</span>
          <div style={{ display: "flex", gap: 20 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", display: "inline-block" }} />
              MongoDB Atlas connected
            </span>
            <span>Auto-refresh: 30s</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 20px",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        color: active ? "#F0F2F8" : "#5A6080",
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #8B7FF7" : "2px solid transparent",
        cursor: "pointer",
        transition: "all 0.15s",
        letterSpacing: "0.01em"
      }}
    >
      {children}
    </button>
  )
}
