"use client"

type RiskBand = "Low" | "Moderate" | "Elevated" | "High"

const BAND_COLORS = {
  Low:      { bg: "#0A2018", text: "#3DFFA8", border: "#0D4A2A" },
  Moderate: { bg: "#241A04", text: "#FFD166", border: "#5C430A" },
  Elevated: { bg: "#261508", text: "#FF9A3C", border: "#6B2D08" },
  High:     { bg: "#220C0C", text: "#FF6B6B", border: "#7A1515" },
} as const

export function RiskBadge({ band, score }: { band: RiskBand; score?: number }) {
  const c = BAND_COLORS[band] || BAND_COLORS.Moderate
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      borderRadius: 6,
      border: `1px solid ${c.border}`,
      background: c.bg,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: c.text,
      lineHeight: 1.6,
    }}>
      {band}
      {score !== undefined && (
        <span style={{ fontFamily: "monospace", fontSize: 10, opacity: 0.9, fontWeight: 700 }}>{score}</span>
      )}
    </span>
  )
}

export function RiskBorderColor(band: RiskBand): string {
  const colors = { Low: "#3DFFA8", Moderate: "#FFD166", Elevated: "#FF9A3C", High: "#FF6B6B" }
  return colors[band] || colors.Moderate
}
