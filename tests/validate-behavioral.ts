// Behavioral profiler validation — simulates WhatsApp conversations and checks detection

const BASE_URL = "http://localhost:3000"

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts)
  return res.json()
}

async function postMessage(candidateId: string, from: "recruiter" | "candidate", text: string, timestamp: string, responseTimeMinutes?: number) {
  return fetchJson(`${BASE_URL}/api/candidates/${candidateId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, text, timestamp, response_time_minutes: responseTimeMinutes }),
  })
}

function daysAgo(days: number, hours = 10): string {
  const d = new Date(Date.now() - days * 86400000)
  d.setHours(hours, 0, 0, 0)
  return d.toISOString()
}

async function main() {
  // Get candidates
  const candidates = await fetchJson(`${BASE_URL}/api/candidates`)
  const aditya = candidates.find((c: any) => c.candidate_name.includes("Aditya"))
  const priya = candidates.find((c: any) => c.candidate_name.includes("Priya"))
  const rahul = candidates.find((c: any) => c.candidate_name.includes("Rahul"))

  if (!aditya || !priya || !rahul) {
    console.error("Missing test candidates. Run seed first.")
    process.exit(1)
  }

  console.log("\n========== BEHAVIORAL PROFILER VALIDATION ==========\n")

  // === CANDIDATE A: Aditya — Should detect HIGH behavioral risk ===
  console.log("--- Candidate A: Aditya (expect HIGH behavioral risk) ---")
  const aid = aditya.candidate_id

  // Day 1: Recruiter intro, candidate responds enthusiastically in 30 min
  await postMessage(aid, "recruiter", "Hi Aditya, I have an exciting Senior Java Developer opportunity at a top product company in Bangalore. Would you be interested?", daysAgo(14, 10))
  await postMessage(aid, "candidate", "Hi! Yes, I'm very excited about this opportunity! I've been looking forward to working with a product company. Can you share more details about the role and team?", daysAgo(14, 10.5), 30)

  // Day 3: Interview details, responds in 2h
  await postMessage(aid, "recruiter", "Great! The interview is scheduled for next Monday at 2 PM. It'll be a system design round followed by a coding challenge. Are you available?", daysAgo(12, 10))
  await postMessage(aid, "candidate", "Sure, I should be available. Let me check my calendar and confirm.", daysAgo(12, 12), 120)

  // Day 7: Post-interview follow-up, takes 24h
  await postMessage(aid, "recruiter", "Hi Aditya, how did the interview go? The panel said you did well. We'd like to move forward with an offer.", daysAgo(8, 10))
  await postMessage(aid, "candidate", "It was okay I guess. I need to think about it. My current company might match the offer.", daysAgo(7, 10), 1440)

  // Day 10: Offer sent, candidate goes silent
  await postMessage(aid, "recruiter", "Here's the formal offer letter — 32 LPA, hybrid work mode in Bangalore. Let us know your decision.", daysAgo(5, 10))
  // Day 12: Follow up
  await postMessage(aid, "recruiter", "Hi Aditya, just checking in. Have you had a chance to review the offer?", daysAgo(3, 10))
  // Day 14: Another follow up
  await postMessage(aid, "recruiter", "Aditya, we need your response by end of week. Please let us know either way.", daysAgo(1, 10))

  const profileA = await fetchJson(`${BASE_URL}/api/candidates/${aid}/profile`)
  console.log("Profile:", JSON.stringify(profileA, null, 2))
  console.log("\nChecks:")
  check("Ghosting detected", profileA.ghosting_pattern === true)
  check("Counter-offer mentioned", profileA.mentions_counter_offer === true)
  check("Response time degrading", profileA.response_time_trend === "degrading")
  check("Behavioral risk adjustment > 10", profileA.behavioral_risk_adjustment >= 10)
  check("Hedging language detected", profileA.uses_hedging_language === true)

  // === CANDIDATE B: Priya — Should detect LOW behavioral risk ===
  console.log("\n--- Candidate B: Priya (expect LOW behavioral risk) ---")
  const bid = priya.candidate_id

  await postMessage(bid, "recruiter", "Hi Priya, we have a React Frontend Lead position in Pune. Interested?", daysAgo(14, 10))
  await postMessage(bid, "candidate", "Hi! Yes, I'm thrilled! I've been looking for exactly this kind of role. What's the tech stack?", daysAgo(14, 10.25), 15)

  await postMessage(bid, "recruiter", "React 18, TypeScript, Next.js, Tailwind. The team is 8 people, product-focused.", daysAgo(13, 10))
  await postMessage(bid, "candidate", "That's perfect! I've been working with exactly this stack. Can't wait to learn more. When can we schedule the interview? Also, what's the team culture like?", daysAgo(13, 10.5), 30)

  await postMessage(bid, "recruiter", "Interview is Thursday at 3 PM. You'll meet the engineering lead.", daysAgo(11, 10))
  await postMessage(bid, "candidate", "Confirmed! Looking forward to it. I've been reading about the company and I'm really excited about the product vision.", daysAgo(11, 10.3), 20)

  await postMessage(bid, "recruiter", "You did great in the interview! We're extending an offer — 20 LPA.", daysAgo(7, 10))
  await postMessage(bid, "candidate", "This is amazing news! I'm excited to accept! When do I start? I can serve my 30-day notice starting Monday.", daysAgo(7, 10.2), 10)

  await postMessage(bid, "recruiter", "Welcome aboard! Start date is April 15. HR will send the joining kit.", daysAgo(5, 10))
  await postMessage(bid, "candidate", "Thank you so much! I'm looking forward to joining the team. Please let me know if there's anything I should prepare beforehand.", daysAgo(5, 10.15), 10)

  const profileB = await fetchJson(`${BASE_URL}/api/candidates/${bid}/profile`)
  console.log("Profile:", JSON.stringify(profileB, null, 2))
  console.log("\nChecks:")
  check("Enthusiastic language", profileB.uses_enthusiastic_language === true)
  check("Asks questions", profileB.asks_questions === true)
  check("Response rate >= 100%", profileB.response_rate >= 100)
  check("Behavioral risk adjustment negative", profileB.behavioral_risk_adjustment < 0)
  check("No ghosting", profileB.ghosting_pattern === false)
  check("Sentiment positive or neutral", profileB.sentiment_trend !== "declining" && profileB.sentiment_trend !== "negative")

  // === CANDIDATE C: Rahul — Should detect MODERATE (hedging) ===
  console.log("\n--- Candidate C: Rahul (expect MODERATE — hedging signals) ---")
  const cid = rahul.candidate_id

  await postMessage(cid, "recruiter", "Hi Rahul, DevOps Engineer position in Gurgaon. AWS, Terraform, K8s. Interested?", daysAgo(14, 10))
  await postMessage(cid, "candidate", "Hi, I'll think about it. Need to discuss with my family first about the relocation.", daysAgo(14, 14), 240)

  await postMessage(cid, "recruiter", "Sure, take your time. The role is office-based in Gurgaon, 5 days a week.", daysAgo(12, 10))
  await postMessage(cid, "candidate", "I'm not sure about relocating from Noida. My wife's job is here. Also, I'm exploring other opportunities as well.", daysAgo(12, 16), 360)

  await postMessage(cid, "recruiter", "Understood. The comp is 25 LPA. Would that help with the relocation?", daysAgo(10, 10))
  await postMessage(cid, "candidate", "Maybe. I haven't decided yet. Let me discuss with family this weekend.", daysAgo(10, 15), 300)

  await postMessage(cid, "recruiter", "Any update from your end?", daysAgo(7, 10))
  await postMessage(cid, "candidate", "Not yet, depends on a few things. I might not be able to relocate.", daysAgo(7, 18), 480)

  await postMessage(cid, "recruiter", "We'd need a decision by end of month. Can you confirm your interest?", daysAgo(3, 10))
  await postMessage(cid, "candidate", "I'll let you know. Still keeping my options open.", daysAgo(3, 16), 360)

  const profileC = await fetchJson(`${BASE_URL}/api/candidates/${cid}/profile`)
  console.log("Profile:", JSON.stringify(profileC, null, 2))
  console.log("\nChecks:")
  check("Hedging language", profileC.uses_hedging_language === true)
  check("Family concerns", profileC.mentions_family_concerns === true)
  check("Relocation doubt", profileC.mentions_relocation_doubt === true)
  check("Behavioral risk adjustment > 5", profileC.behavioral_risk_adjustment >= 5)
  check("Not enthusiastic", profileC.uses_enthusiastic_language === false)

  console.log("\n========== DONE ==========\n")
}

function check(label: string, pass: boolean) {
  console.log(`  ${pass ? "PASS" : "FAIL"}: ${label}`)
}

main().catch(console.error)
