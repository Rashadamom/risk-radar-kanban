// AI-Assisted Hiring Workflow Engine
// Manages the end-to-end hiring process with AI assistance at every stage:
// Resume screening → Interview prep → Interview scheduling → Feedback collection → Offer management

export type HiringStage =
  | "resume_screening"
  | "interview_prep"
  | "interview_scheduled"
  | "interview_in_progress"
  | "feedback_pending"
  | "evaluation"
  | "offer_preparation"
  | "offer_sent"
  | "offer_negotiation"
  | "offer_accepted"
  | "onboarding"

export type InterviewRound = {
  round_id: string
  round_number: number
  round_type: "technical" | "system_design" | "behavioral" | "culture_fit" | "hr" | "coding" | "managerial"
  interviewer_name: string
  interviewer_email: string
  scheduled_at: string | null
  completed_at: string | null
  status: "pending" | "scheduled" | "completed" | "cancelled" | "no_show"
  ai_generated_questions: string[]
  feedback: InterviewFeedback | null
}

export type InterviewFeedback = {
  overall_rating: 1 | 2 | 3 | 4 | 5
  technical_score: number  // 0-10
  communication_score: number // 0-10
  culture_fit_score: number // 0-10
  strengths: string[]
  concerns: string[]
  recommendation: "strong_hire" | "hire" | "lean_hire" | "lean_no" | "no_hire"
  notes: string
  submitted_at: string
}

export type CandidatePrep = {
  company_brief: string
  role_summary: string
  key_skills_to_demonstrate: string[]
  likely_questions: string[]
  tips: string[]
  practice_problems: string[]
}

export type HiringWorkflow = {
  workflow_id: string
  candidate_id: string
  candidate_name: string
  role: string
  recruiter_id: string
  current_stage: HiringStage
  rounds: InterviewRound[]
  candidate_prep: CandidatePrep | null
  resume_screening: ResumeScreening | null
  offer_details: OfferDetails | null
  timeline: WorkflowEvent[]
  created_at: string
  updated_at: string
}

export type ResumeScreening = {
  match_score: number // 0-100
  matching_skills: string[]
  missing_skills: string[]
  experience_match: "overqualified" | "match" | "stretch" | "underqualified"
  red_flags: string[]
  recommendation: "proceed" | "review" | "reject"
  summary: string
}

export type OfferDetails = {
  base_salary: number
  variable_pay: number
  total_ctc: number
  joining_bonus: number
  notice_buyout: boolean
  work_mode: string
  joining_date: string
  status: "draft" | "sent" | "negotiating" | "accepted" | "declined"
}

export type WorkflowEvent = {
  event: string
  timestamp: string
  actor: string // recruiter, candidate, system, interviewer
  details: string
}

// Generate AI-powered interview questions based on role and resume
export function generateInterviewQuestions(
  roundType: InterviewRound["round_type"],
  role: string,
  skillStack: string,
  experience: string,
): string[] {
  const skills = skillStack.split(",").map(s => s.trim())

  const questionBank: Record<string, (skills: string[], exp: string) => string[]> = {
    technical: (skills, exp) => [
      `Explain the architecture of a recent ${skills[0]} project you worked on.`,
      `How would you handle high availability in a ${skills[0]} application?`,
      `What's the difference between ${skills[0]} and ${skills[1] || "alternatives"} for this use case?`,
      `Describe a production incident you resolved. Walk me through your debugging process.`,
      `How do you approach code reviews? What do you look for?`,
    ],
    system_design: (skills) => [
      `Design a scalable notification system that sends 1M messages/day.`,
      `How would you design a real-time dashboard for monitoring ${skills[0]} services?`,
      `Design a URL shortener that handles 10K requests/second.`,
      `Walk me through how you'd architect a multi-tenant SaaS application.`,
      `How would you migrate a monolith to microservices? What's your sequencing strategy?`,
    ],
    behavioral: () => [
      `Tell me about a time you disagreed with your manager. How did you handle it?`,
      `Describe a project that failed. What did you learn?`,
      `How do you prioritize when everything is urgent?`,
      `Tell me about a time you had to learn a new technology quickly under pressure.`,
      `How do you handle giving feedback to a peer who isn't performing well?`,
    ],
    culture_fit: () => [
      `What kind of work environment do you thrive in?`,
      `How do you handle ambiguity in requirements?`,
      `What's your ideal balance between working independently vs. collaborating?`,
      `What motivates you beyond compensation?`,
      `How do you stay current with technology trends?`,
    ],
    hr: () => [
      `What are your salary expectations and how did you arrive at that number?`,
      `What's your notice period, and is buyout possible?`,
      `Are you open to the work location and mode we discussed?`,
      `Do you have any other offers you're currently considering?`,
      `What would make you decline this offer if we extended one?`,
    ],
    coding: (skills) => [
      `Implement a function that finds the longest substring without repeating characters.`,
      `Write a ${skills[0]} function to merge two sorted arrays efficiently.`,
      `Build a simple rate limiter that allows N requests per minute.`,
      `Implement a cache with LRU eviction policy.`,
      `Write a function to detect cycles in a linked list. Explain the time/space complexity.`,
    ],
    managerial: () => [
      `How do you set goals and track progress for your team?`,
      `Describe how you've handled underperformance in your team.`,
      `How do you balance technical debt with feature delivery?`,
      `Tell me about a time you had to make a difficult trade-off decision.`,
      `How do you build trust with a new team?`,
    ],
  }

  const generator = questionBank[roundType] || questionBank.behavioral
  return generator(skills, experience)
}

// Generate candidate preparation kit
export function generateCandidatePrep(
  role: string,
  companyName: string,
  skillStack: string,
  roundTypes: InterviewRound["round_type"][],
): CandidatePrep {
  const skills = skillStack.split(",").map(s => s.trim())

  const tips: string[] = [
    "Research the company's recent product launches and tech blog posts.",
    "Prepare 2-3 questions to ask the interviewer about team and culture.",
    "Have a quiet, well-lit space with stable internet for video rounds.",
    "Keep your resume open and be ready to walk through any project in detail.",
  ]

  if (roundTypes.includes("system_design")) {
    tips.push("Practice drawing system architecture diagrams. Use a whiteboard tool.")
    tips.push("Always clarify requirements and constraints before designing.")
  }
  if (roundTypes.includes("coding")) {
    tips.push("Think out loud during coding. Explain your approach before writing code.")
    tips.push("Start with brute force, then optimize. Mention time/space complexity.")
  }
  if (roundTypes.includes("behavioral")) {
    tips.push("Use the STAR method (Situation, Task, Action, Result) for behavioral questions.")
    tips.push("Prepare 5-6 stories that showcase leadership, problem-solving, and teamwork.")
  }

  const likelyQuestions: string[] = []
  for (const rt of roundTypes) {
    likelyQuestions.push(...generateInterviewQuestions(rt, role, skillStack, "").slice(0, 2))
  }

  return {
    company_brief: `You're interviewing for ${role} at ${companyName}. Focus on demonstrating expertise in ${skills.slice(0, 3).join(", ")}.`,
    role_summary: `${role} — Key skills: ${skillStack}`,
    key_skills_to_demonstrate: skills.slice(0, 5),
    likely_questions: likelyQuestions,
    tips,
    practice_problems: roundTypes.includes("coding") ? [
      "LeetCode medium: Two Sum, Merge Intervals, LRU Cache",
      "System Design: Design a chat application, Design a rate limiter",
    ] : [],
  }
}

// Screen resume against job requirements
export function screenResume(
  candidateSkills: string,
  requiredSkills: string,
  experience: string,
  minExperience: number,
): ResumeScreening {
  const candidateSkillList = candidateSkills.toLowerCase().split(",").map(s => s.trim())
  const requiredSkillList = requiredSkills.toLowerCase().split(",").map(s => s.trim())

  const matching = requiredSkillList.filter(s => candidateSkillList.some(cs => cs.includes(s) || s.includes(cs)))
  const missing = requiredSkillList.filter(s => !candidateSkillList.some(cs => cs.includes(s) || s.includes(cs)))

  const matchScore = requiredSkillList.length > 0
    ? Math.round((matching.length / requiredSkillList.length) * 100)
    : 50

  const expYears = parseInt(experience) || 0
  let experienceMatch: ResumeScreening["experience_match"] = "match"
  if (expYears > minExperience * 1.5) experienceMatch = "overqualified"
  else if (expYears < minExperience * 0.7) experienceMatch = "underqualified"
  else if (expYears < minExperience) experienceMatch = "stretch"

  const redFlags: string[] = []
  if (matchScore < 40) redFlags.push("Less than 40% skill match")
  if (experienceMatch === "underqualified") redFlags.push("Below minimum experience requirement")
  if (missing.length > requiredSkillList.length * 0.5) redFlags.push("Missing majority of required skills")

  let recommendation: ResumeScreening["recommendation"] = "proceed"
  if (matchScore < 40 || experienceMatch === "underqualified") recommendation = "reject"
  else if (matchScore < 60 || missing.length > 2) recommendation = "review"

  return {
    match_score: matchScore,
    matching_skills: matching,
    missing_skills: missing,
    experience_match: experienceMatch,
    red_flags: redFlags,
    recommendation,
    summary: `${matchScore}% skill match. ${matching.length}/${requiredSkillList.length} required skills present. ${experienceMatch} on experience. ${redFlags.length > 0 ? "Red flags: " + redFlags.join("; ") : "No red flags."}`,
  }
}

// Determine next step in the workflow based on current state
export function getNextAction(workflow: HiringWorkflow): {
  action: string
  target: "recruiter" | "candidate" | "interviewer" | "system"
  message: string
  urgent: boolean
} {
  const { current_stage, rounds } = workflow

  switch (current_stage) {
    case "resume_screening":
      return {
        action: "screen_resume",
        target: "system",
        message: "AI is screening the resume against job requirements.",
        urgent: false,
      }

    case "interview_prep":
      return {
        action: "send_prep_kit",
        target: "candidate",
        message: `Send interview preparation kit to ${workflow.candidate_name} via WhatsApp.`,
        urgent: false,
      }

    case "interview_scheduled": {
      const nextRound = rounds.find(r => r.status === "scheduled")
      if (nextRound) {
        const scheduledDate = new Date(nextRound.scheduled_at!)
        const hoursUntil = (scheduledDate.getTime() - Date.now()) / 3600000
        if (hoursUntil < 24 && hoursUntil > 0) {
          return {
            action: "send_reminder",
            target: "candidate",
            message: `Interview reminder: ${nextRound.round_type} round tomorrow with ${nextRound.interviewer_name}.`,
            urgent: true,
          }
        }
      }
      return {
        action: "await_interview",
        target: "system",
        message: "Interview scheduled. Monitoring for changes.",
        urgent: false,
      }
    }

    case "feedback_pending": {
      const pendingRound = rounds.find(r => r.status === "completed" && !r.feedback)
      if (pendingRound) {
        const completedAt = new Date(pendingRound.completed_at!)
        const hoursSince = (Date.now() - completedAt.getTime()) / 3600000
        return {
          action: "chase_feedback",
          target: "interviewer",
          message: `Request feedback from ${pendingRound.interviewer_name} for ${pendingRound.round_type} round (${Math.round(hoursSince)}h since interview).`,
          urgent: hoursSince > 24,
        }
      }
      return { action: "await_feedback", target: "system", message: "Waiting for interview feedback.", urgent: false }
    }

    case "evaluation":
      return {
        action: "compile_evaluation",
        target: "recruiter",
        message: "All rounds complete. Review compiled feedback and make hire/no-hire decision.",
        urgent: true,
      }

    case "offer_preparation":
      return {
        action: "prepare_offer",
        target: "recruiter",
        message: "Draft offer letter based on interview performance and candidate expectations.",
        urgent: true,
      }

    case "offer_sent":
      return {
        action: "follow_up_offer",
        target: "candidate",
        message: `Follow up on offer sent to ${workflow.candidate_name}. Check for counter-offer signals.`,
        urgent: true,
      }

    case "offer_negotiation":
      return {
        action: "handle_negotiation",
        target: "recruiter",
        message: "Candidate is negotiating. Assess flexibility on comp, joining date, or work mode.",
        urgent: true,
      }

    case "offer_accepted":
      return {
        action: "start_onboarding",
        target: "system",
        message: "Offer accepted! Initiate onboarding workflow — background verification, docs collection.",
        urgent: false,
      }

    default:
      return { action: "monitor", target: "system", message: "Workflow in progress.", urgent: false }
  }
}

// Compile all interview feedback into a hire/no-hire recommendation
export function compileEvaluation(rounds: InterviewRound[]): {
  overall_recommendation: "strong_hire" | "hire" | "lean_hire" | "lean_no" | "no_hire"
  avg_technical: number
  avg_communication: number
  avg_culture_fit: number
  combined_strengths: string[]
  combined_concerns: string[]
  summary: string
} {
  const completedRounds = rounds.filter(r => r.feedback)
  if (completedRounds.length === 0) {
    return {
      overall_recommendation: "lean_no",
      avg_technical: 0, avg_communication: 0, avg_culture_fit: 0,
      combined_strengths: [], combined_concerns: ["No feedback received"],
      summary: "Cannot evaluate — no interview feedback submitted.",
    }
  }

  const feedbacks = completedRounds.map(r => r.feedback!)

  const avgTech = feedbacks.reduce((s, f) => s + f.technical_score, 0) / feedbacks.length
  const avgComm = feedbacks.reduce((s, f) => s + f.communication_score, 0) / feedbacks.length
  const avgCulture = feedbacks.reduce((s, f) => s + f.culture_fit_score, 0) / feedbacks.length

  const recScores = { strong_hire: 5, hire: 4, lean_hire: 3, lean_no: 2, no_hire: 1 }
  const avgRec = feedbacks.reduce((s, f) => s + recScores[f.recommendation], 0) / feedbacks.length

  let overall: "strong_hire" | "hire" | "lean_hire" | "lean_no" | "no_hire"
  if (avgRec >= 4.5) overall = "strong_hire"
  else if (avgRec >= 3.5) overall = "hire"
  else if (avgRec >= 2.5) overall = "lean_hire"
  else if (avgRec >= 1.5) overall = "lean_no"
  else overall = "no_hire"

  // If any interviewer said no_hire, flag it
  if (feedbacks.some(f => f.recommendation === "no_hire")) {
    if (overall === "hire" || overall === "strong_hire") overall = "lean_hire"
  }

  const allStrengths = [...new Set(feedbacks.flatMap(f => f.strengths))]
  const allConcerns = [...new Set(feedbacks.flatMap(f => f.concerns))]

  return {
    overall_recommendation: overall,
    avg_technical: Math.round(avgTech * 10) / 10,
    avg_communication: Math.round(avgComm * 10) / 10,
    avg_culture_fit: Math.round(avgCulture * 10) / 10,
    combined_strengths: allStrengths,
    combined_concerns: allConcerns,
    summary: `${completedRounds.length} rounds completed. Technical: ${avgTech.toFixed(1)}/10, Communication: ${avgComm.toFixed(1)}/10, Culture: ${avgCulture.toFixed(1)}/10. Recommendation: ${overall.replace(/_/g, " ").toUpperCase()}.`,
  }
}
