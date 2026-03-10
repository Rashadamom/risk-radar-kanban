import { NextResponse } from "next/server"
import {
  generateInterviewQuestions,
  generateCandidatePrep,
  screenResume,
  getNextAction,
  compileEvaluation,
  type HiringWorkflow,
  type InterviewRound,
} from "@/lib/hiring-workflow"
import { getCandidate } from "@/lib/store"

// POST /api/hiring — Create or manage a hiring workflow action
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case "screen_resume": {
        const { candidate_skills, required_skills, experience, min_experience } = body
        const screening = screenResume(candidate_skills, required_skills, experience, min_experience || 3)
        return NextResponse.json(screening)
      }

      case "generate_questions": {
        const { round_type, role, skill_stack, experience } = body
        const questions = generateInterviewQuestions(round_type, role, skill_stack, experience || "")
        return NextResponse.json({ round_type, questions })
      }

      case "generate_prep": {
        const { role, company_name, skill_stack, round_types } = body
        const prep = generateCandidatePrep(role, company_name || "the company", skill_stack, round_types || ["technical", "behavioral"])
        return NextResponse.json(prep)
      }

      case "evaluate": {
        const { rounds } = body as { rounds: InterviewRound[] }
        const evaluation = compileEvaluation(rounds)
        return NextResponse.json(evaluation)
      }

      case "next_step": {
        const { workflow } = body as { workflow: HiringWorkflow }
        const nextAction = getNextAction(workflow)
        return NextResponse.json(nextAction)
      }

      case "full_workflow": {
        // Create a complete hiring workflow for a candidate
        const { candidate_id, required_skills, round_types, company_name } = body
        const candidate = await getCandidate(candidate_id)
        if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 })

        // Step 1: Screen resume
        const screening = screenResume(
          candidate.skill_stack,
          required_skills || candidate.skill_stack,
          candidate.total_experience,
          3,
        )

        // Step 2: Generate interview rounds
        const roundTypeList: InterviewRound["round_type"][] = round_types || ["technical", "behavioral", "hr"]
        const rounds: InterviewRound[] = roundTypeList.map((rt: InterviewRound["round_type"], i: number) => ({
          round_id: `round_${candidate.candidate_id}_${i + 1}`,
          round_number: i + 1,
          round_type: rt,
          interviewer_name: "",
          interviewer_email: "",
          scheduled_at: null,
          completed_at: null,
          status: "pending" as const,
          ai_generated_questions: generateInterviewQuestions(rt, candidate.role, candidate.skill_stack, candidate.total_experience),
          feedback: null,
        }))

        // Step 3: Generate candidate prep
        const prep = generateCandidatePrep(
          candidate.role,
          company_name || "the company",
          candidate.skill_stack,
          roundTypeList,
        )

        const workflow: HiringWorkflow = {
          workflow_id: `wf_${candidate.candidate_id}_${Date.now()}`,
          candidate_id: candidate.candidate_id,
          candidate_name: candidate.candidate_name,
          role: candidate.role,
          recruiter_id: candidate.recruiter_id,
          current_stage: screening.recommendation === "reject" ? "resume_screening" : "interview_prep",
          rounds,
          candidate_prep: prep,
          resume_screening: screening,
          offer_details: null,
          timeline: [
            {
              event: "Workflow created",
              timestamp: new Date().toISOString(),
              actor: "system",
              details: `Resume screening: ${screening.recommendation}. ${screening.summary}`,
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        return NextResponse.json(workflow, { status: 201 })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
