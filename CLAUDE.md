# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

There are no tests configured.

## Environment

Copy `.env.local` and set:

```
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_MODEL=<model-id-loaded-in-lm-studio>
WHATSAPP_VERIFY_TOKEN=riskradar_verify_2024
```

LM Studio must be running locally with a model loaded for resume parsing.

## Architecture

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui

### Product: RiskRadar - Channel-Native Recruitment Agent

A candidate commitment risk scoring engine for IT staffing agencies. Scores candidates on 6 dimensions (communication, interview readiness, compensation, notice period, relocation, docs), tracks pipeline stages, and surfaces dropout risk before it happens.

### Core modules (lib/)

- `lib/scoring.ts` — NORMALIZE_INTAKE + SCORE_RISK engine (ported from n8n workflow). Processes candidate intake → enrichment → risk scoring. Outputs candidate_risk_score (0-100), risk_band, hard_stop_flags, reason_codes, next_action.
- `lib/store.ts` — MongoDB-backed data store (5 collections: candidate_master, review_queue, stage_updates, messages, behavioral_profiles). Requires MONGODB_URI in .env.local.
- `lib/behavioral-profiler.ts` — Analyzes WhatsApp message patterns between recruiter and candidate. Detects hedging, counter-offers, ghosting, sentiment trajectory. Outputs behavioral_risk_adjustment (-20 to +30) and behavioral_signals.
- `lib/resume-parser.ts` — LLM-based resume field extraction via LM Studio. Extracts name, phone, role, skills, compensation, notice period from resume text.
- `lib/seed.ts` — 8 demo candidates with realistic Indian IT staffing data (various risk levels).
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/candidates` | GET/POST | List candidates (with filters) / create from intake |
| `/api/candidates/[id]` | GET/PATCH | Single candidate with stage history / update |
| `/api/review-queue` | GET | Open review queue items |
| `/api/review-queue/[id]` | PATCH | Resolve a queue item |
| `/api/analytics` | GET | Band counts, stage funnel, recent activity |
| `/api/seed` | POST | Seed demo data |
| `/api/whatsapp/webhook` | GET/POST | WhatsApp Business API webhook (verification + message handling) |
| `/api/candidates/[id]/messages` | GET/POST | Conversation history / add message + re-profile |
| `/api/candidates/[id]/profile` | GET/POST | Behavioral profile / force re-analyze |
| `/api/analyze` | POST | Legacy ambiguity analyzer (LM Studio) |

### WhatsApp webhook flow

1. Recruiter forwards resume text to WhatsApp number
2. Webhook receives message → detects if resume or command
3. Resume text → `resume-parser.ts` extracts fields via LLM → `scoring.ts` scores risk
4. Response sent: risk band, score, blockers, recommended action
5. Candidate added to pipeline, review queue if flagged

Supports commands: "status" (candidate status check), "pipeline" (summary), resume text (auto-parsed)

### UI components

- `Pipeline.tsx` — Full-width kanban across 7 stages (Intake → Joined) with 30s auto-refresh
- `CandidateCard.tsx` — Compact card with risk border, badge, comm lag, hike indicators
- `CandidateDetail.tsx` — Slide-out drawer with risk score arcs, blockers, signals, snapshot, stage history
- `RiskBadge.tsx` — Risk band badge with muted professional colors
- `QuickIntake.tsx` — "New Candidate" button that simulates WhatsApp text intake
- `SeedButton.tsx` — Loads demo data
- `AnalyzePanel.tsx` — Legacy ambiguity analyzer (kept for reference)

### Risk scoring dimensions

| Dimension | Weight | Thresholds |
|---|---|---|
| Communication | 20% | 6h/24h/48h response lag |
| Interview readiness | 15% | yes/no/maybe |
| Compensation | 20% | 30%/50%/100% hike |
| Notice/joining | 20% | 60/90 day notice, buyout |
| Relocation | 15% | willingness vs work mode |
| Documentation | 10% | resume received? |

### Color system

- Base: #0F1117 (deep slate), Surface: #1A1D27, Border: #2A2D3A
- Risk bands: Low=#34D399, Moderate=#FBBF24, Elevated=#FB923C, High=#F87171
- Accent/interactive: #7C6AF7 (electric indigo)

### Adding shadcn components

```bash
npx shadcn add <component>
```
