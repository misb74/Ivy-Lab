---
name: artifacts
description: Structured JSON artifact schemas for Ivy's frontend rendering. Use when producing HR analysis output — skills analysis, skills gap, automation assessment, career ladder/path, workforce plan, job analysis, role design, task decomposition, org design, bias/fairness audit, labor market trends, skill deep dives, onboarding plans, or any "tell me about / explain / what is X" workforce topic. Covers insight cards, functional outlooks, AI impact triangulation, decision transparency, and upskill/reskill transitions.
---

# Output Formats — Structured Artifacts

## CRITICAL: Always Generate Cards Inline

ALWAYS generate `<artifact>` blocks with your analysis. Every response that involves HR analysis, workforce data, skills, automation, or insights MUST include an `<artifact>` block so the card renders automatically inline with your text.

**Response format:**
1. Write your narrative analysis in plain text (2-4 paragraphs)
2. Then emit the structured artifact in `<artifact>` tags — this renders as a rich card immediately

Do NOT respond with text only. The card is not optional — it is the primary deliverable. The text provides context; the card provides the data.

Use the schemas below. Wrap artifacts in `<artifact>` tags.

## Artifact Types

### skill_analysis
For **role-to-role comparisons** (skills gap, transition, upskill queries), ALWAYS populate `sourceRole` and `targetRole`. For single-role analysis, use `role` only.
```json
<artifact>{
  "type": "skill_analysis",
  "title": "Skills Gap Analysis: [Source Role] → [Target Role]",
  "sourceRole": "[Source/Current Role]",
  "targetRole": "[Target Role]",
  "role": "[Target Role]",
  "matchScore": 85,
  "skills": [
    {"name": "Python", "level": 90, "category": "Technical", "importance": 95, "trending": true, "demandGrowth": 11}
  ],
  "skillGaps": [
    {"skill": "Cloud Architecture", "current": 40, "required": 80, "gap": 40, "priority": "high"}
  ],
  "recommendations": [
    {"title": "Develop Cloud Skills", "description": "Focus on AWS/Azure certifications", "priority": "high"}
  ],
  "dataSource": "O*NET + Lightcast"
}</artifact>
```
- `sourceRole` / `targetRole`: Used for comparison headline ("X% skills gap from A to B"). Omit for single-role analysis.
- `demandGrowth`: Real YoY demand growth % from `skills_trending` or `lightcast_trending_skills`. The card uses this for the Trend column — without it, trend shows "stable" for all skills.

### automation_assessment
Use for automation potential analysis, AI readiness assessment, task automation scoring. CRITICAL: You MUST emit this artifact with REAL data from your tool calls. Every task you analyzed must appear in `tasks` with its actual `automationScore` (0-100), `timeAllocation` (%), and `recommendation` ("automate"/"augment"/"human"). Include `breakdown` (automatable/augmentable/humanEssential percentages), `riskFactors`, and `recommendations`. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "automation_assessment",
  "title": "Senior Financial Analyst — Automation Assessment",
  "role": "Senior Financial Analyst",
  "overallScore": 56,
  "tasks": [
    {"name": "Data processing & recording", "automationScore": 85, "timeAllocation": 20, "category": "Data", "recommendation": "automate", "description": "Routine data ingestion, cleaning, validation"},
    {"name": "Report generation", "automationScore": 80, "timeAllocation": 15, "category": "Reporting", "recommendation": "automate"},
    {"name": "Financial modeling", "automationScore": 55, "timeAllocation": 20, "category": "Analysis", "recommendation": "augment"},
    {"name": "Client relationship management", "automationScore": 12, "timeAllocation": 15, "category": "Strategic", "recommendation": "human"}
  ],
  "breakdown": {"automatable": 25, "augmentable": 45, "humanEssential": 30},
  "riskFactors": [
    {"factor": "Routine Tasks", "severity": "high", "description": "35% of tasks are highly repetitive and ripe for automation"},
    {"factor": "Client Dependency", "severity": "low", "description": "Senior roles require trust-building that resists automation"}
  ],
  "recommendations": [
    {"title": "Automate data pipeline", "description": "Automate 60-80% of data collection, cleaning, reconciliation", "priority": "critical"},
    {"title": "Deploy AI research assistant", "description": "AI-powered market intelligence gathering to free 5+ hrs/week", "priority": "high"},
    {"title": "Upskill in AI/ML literacy", "description": "Financial modeling with AI-powered scenario generation", "priority": "medium"}
  ],
  "postAiTimeAllocation": [
    {"name": "Routine Tasks", "value": 8},
    {"name": "Strategic Work", "value": 35},
    {"name": "Mixed Tasks", "value": 30},
    {"name": "Creative Work", "value": 27}
  ],
  "skillsEvolution": [
    {"name": "Financial Modeling", "today": 70, "postAi": 90},
    {"name": "AI/ML Literacy", "today": 15, "postAi": 80},
    {"name": "Data Interpretation", "today": 65, "postAi": 85},
    {"name": "Scenario Analysis", "today": 40, "postAi": 75},
    {"name": "Stakeholder Communication", "today": 55, "postAi": 70},
    {"name": "Prompt Engineering", "today": 5, "postAi": 65}
  ],
  "dataSource": "WORKBank + O*NET + Anthropic Economic Index"
}</artifact>
```

### career_ladder
Use for career progression mapping, career path analysis, promotion readiness. CRITICAL: You MUST emit this artifact with REAL data. Every career step must appear in `steps` with actual salary data, skill requirements, and feasibility scores. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "career_ladder",
  "title": "Career Path: HR Coordinator to CHRO",
  "currentRole": "HR Coordinator",
  "targetRole": "CHRO",
  "overallFeasibility": 65,
  "totalTimeEstimate": "12-15 years",
  "steps": [
    {"title": "HR Coordinator", "level": "Entry", "isCurrent": true, "salary": {"min": 45000, "max": 60000, "median": 52000}, "skills": [{"name": "HRIS Administration", "required": true, "current": 80}, {"name": "Employee Relations", "required": true, "current": 60}]},
    {"title": "HR Business Partner", "level": "Mid", "salary": {"min": 75000, "max": 100000, "median": 87000}, "skills": [{"name": "Strategic Workforce Planning", "required": true, "current": 30}]}
  ],
  "recommendations": [
    {"title": "Build strategic planning skills", "description": "Transition from operational to strategic HR work", "priority": "high"}
  ],
  "dataSource": "O*NET + BLS"
}</artifact>
```

### workforce_plan
Use for workforce supply/demand analysis, talent gap analysis, workforce planning. CRITICAL: You MUST emit this artifact with REAL data from tool calls. Populate `summary`, `gapAnalysis` (with actual skill gaps and severity), `demandTrend`, and `recommendations`. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "workforce_plan",
  "title": "Workforce Analysis: Data Science Function",
  "role": "Data Scientist",
  "summary": {"totalDemand": 50000, "totalSupply": 35000, "gap": 15000, "avgSalary": 125000},
  "demandTrend": [{"period": "Q1 2025", "value": 45000}, {"period": "Q2 2025", "value": 48000}],
  "gapAnalysis": [
    {"skill": "ML Engineering", "demand": 1000, "supply": 600, "gap": 400, "severity": "high"},
    {"skill": "MLOps", "demand": 800, "supply": 300, "gap": 500, "severity": "critical"}
  ],
  "recommendations": [
    {"title": "Invest in MLOps training", "description": "Critical 500-person gap in MLOps skills — build internal pipeline", "priority": "critical"}
  ],
  "dataSource": "Lightcast + BLS"
}</artifact>
```

### job_analysis
Use ONLY for single job/JD analysis. For comparing multiple JDs or overlap/duplication analysis, use `role_design` instead. CRITICAL: You MUST emit this artifact with REAL data. Populate `skills`, `responsibilities`, and `qualifications` arrays from tool results. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "job_analysis",
  "jobTitle": "[Title]",
  "company": "[Company]",
  "location": "[Location]",
  "salaryRange": {"min": 150000, "max": 200000},
  "skills": [
    {"name": "Product Strategy", "importance": 95, "category": "Core", "isRequired": true}
  ],
  "qualifications": [
    {"type": "education", "description": "BS in CS or related", "required": true}
  ],
  "dataSource": "O*NET + Lightcast"
}</artifact>
```

### role_design
Use for ALL overlap analysis, duplication analysis, JD comparison, role consolidation, RACI matrices. Type MUST be `"role_design"`. CRITICAL: You MUST populate the `roles` and `overlaps` arrays with REAL data from your analysis. Every role you analyzed must appear in `roles` with its actual tasks. Every pair of roles with shared work must appear in `overlaps` with a real percentage. If the user asks for a RACI matrix, include `raciMatrix` in the artifact — each entry needs `task` (string), `responsible` (string[]), `accountable` (string), `consulted` (string[]), `informed` (string[]). Do NOT leave arrays empty. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "role_design",
  "title": "HR Function Overlap Analysis",
  "roles": [
    {"title": "HR Director", "tasks": [
      {"name": "Strategic workforce planning", "timeAllocation": 25, "category": "Strategic"},
      {"name": "Monthly headcount reports", "timeAllocation": 10, "category": "Reporting"},
      {"name": "Vendor contract management", "timeAllocation": 15, "category": "Operations"}
    ]},
    {"title": "Senior HRBP", "tasks": [
      {"name": "Employee relations case management", "timeAllocation": 30, "category": "Core"},
      {"name": "Weekly ER case reports", "timeAllocation": 10, "category": "Reporting"},
      {"name": "Vendor relationship management", "timeAllocation": 10, "category": "Operations"}
    ]}
  ],
  "overlaps": [
    {"role1": "HR Director", "role2": "Senior HRBP", "overlapPercentage": 35, "sharedTasks": ["Vendor management", "Headcount reporting"], "conflictingTasks": ["Policy escalation ownership"]},
    {"role1": "HR Director", "role2": "HR Solutions Manager", "overlapPercentage": 25, "sharedTasks": ["Weekly metrics reporting"]}
  ],
  "recommendations": [
    {"title": "Consolidate reporting ownership", "description": "Assign all headcount reports to HR Administrator as single source of truth", "priority": "critical"},
    {"title": "Clarify vendor thresholds", "description": "Director owns $50K+, Sr HRBP owns strategic partnerships, HRBP owns operational vendors", "priority": "high"}
  ],
  "consolidationOpportunities": [
    {"roles": ["HR Director", "HR Solutions Manager"], "savingsEstimate": 15, "reason": "Duplicate weekly metrics reporting"}
  ],
  "raciMatrix": [
    {"task": "Weekly headcount reports", "responsible": ["HR Administrator"], "accountable": "HR Director", "consulted": ["Sr HRBP"], "informed": ["HR Solutions Manager"]},
    {"task": "Vendor contract management", "responsible": ["Sr HRBP"], "accountable": "HR Director", "consulted": ["HR Solutions Manager"], "informed": []}
  ],
  "dataSource": "Job Description Analysis"
}</artifact>
```

### task_decomposition
Use for breaking down a role into granular tasks with AI automation potential, ROI projections, and transition planning. Populate tasks from O*NET (`role_decompose` or `task_decomposition` tools), automation scores from WORKBank (`automation_assess`, `human_edge`), and salary data from BLS. All field names use **snake_case**. The type guard requires: `type`, `role` (string), `summary.total_tasks` (number), and `tasks` (array). CRITICAL: You MUST emit this artifact with REAL data from tool calls. Every task must appear in the `tasks` array. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "task_decomposition",
  "role": "Human Resources Business Partner",
  "occupation_code": "11-3121.00",
  "occupation_title": "Human Resources Managers",
  "description": "Plan, direct, and coordinate human resource activities.",
  "summary": {
    "total_tasks": 12,
    "automatable": 3,
    "augmentable": 5,
    "human_essential": 4,
    "automation_exposure_pct": 56,
    "displacement_risk": "moderate"
  },
  "tasks": [
    {
      "statement": "Analyze workforce metrics and generate KPI reports",
      "importance": 75,
      "category": "automate",
      "ai_capability": 0.85,
      "worker_desire": 0.70,
      "time_allocation_pct": 8,
      "human_edge_factors": ["strategic_interpretation"]
    },
    {
      "statement": "Coach managers on employee relations issues",
      "importance": 90,
      "category": "human_essential",
      "ai_capability": 0.15,
      "worker_desire": 0.10,
      "time_allocation_pct": 15,
      "human_edge_factors": ["emotional_intelligence", "trust_building", "conflict_resolution"]
    },
    {
      "statement": "Design compensation recommendations using market data",
      "importance": 80,
      "category": "augment",
      "ai_capability": 0.65,
      "worker_desire": 0.50,
      "time_allocation_pct": 7,
      "human_edge_factors": ["business_judgment", "stakeholder_negotiation"]
    }
  ],
  "market_context": {
    "median_salary": 130000,
    "demand_level": "high",
    "current_postings": 4200,
    "trending_skills": ["People Analytics", "AI Literacy", "Change Management"]
  },
  "roi_estimate": {
    "headcount": 10,
    "avg_salary": 130000,
    "automatable_time_pct": 25,
    "annual_savings_potential": 325000,
    "reskilling_investment": 85000,
    "net_benefit_3yr": 890000,
    "payback_months": 4
  },
  "transition_plan": {
    "phase_1_quick_wins": ["Automate KPI report generation", "Deploy AI-powered policy FAQ chatbot"],
    "phase_2_augmentation": ["AI-assisted compensation benchmarking", "Predictive attrition dashboards"],
    "phase_3_strategic": ["AI-augmented workforce planning scenarios"],
    "maintain_human": ["Manager coaching", "Employee relations investigations", "Change leadership"]
  },
  "skills_impact": {
    "declining_skills": ["Manual report building", "Data entry", "Policy lookup"],
    "growing_skills": ["AI literacy", "Prompt engineering", "People analytics", "Strategic consulting"],
    "critical_human_skills": ["Emotional intelligence", "Stakeholder management", "Conflict resolution", "Ethical judgment"]
  },
  "data_sources": ["O*NET 28.0", "WORKBank Automation Assessment", "BLS OES 2024"]
}</artifact>
```
**Task field rules:**
- `category` must be one of: `"automate"`, `"augment"`, `"human_essential"`
- `ai_capability` and `worker_desire` are 0.0–1.0 floats (displayed as percentages)
- `time_allocation_pct` values across all tasks should sum to ~100
- `human_edge_factors` use snake_case strings (e.g. `"emotional_intelligence"`, `"trust_building"`)
- `displacement_risk` must be one of: `"low"`, `"moderate"`, `"high"`, `"very_high"`

### agent_task_architecture
Use for breaking down an SOP, workflow, or process into discrete agent tasks grouped by agent type. The agent identifies which tasks are analysis, routing, or execution, assigns automation tiers (qualitative, not numeric), and maps human decision gates. CRITICAL: Each task must have clear inputs, outputs, tools, and human gate (or null if fully automated). The summary must accurately reflect counts.
```json
<artifact>{
  "type": "agent_task_architecture",
  "process_name": "Equipment Ordering",
  "source": "SOP",
  "description": "End-to-end equipment ordering with validation, routing, and fulfillment",
  "agents": [
    {
      "name": "Validation Agent",
      "responsibility": "Runs all checks in parallel, flags blockers, summarizes readiness",
      "tasks": [0, 1, 2, 3, 4]
    },
    {
      "name": "Orchestration Agent",
      "responsibility": "Routes based on conditional logic, manages approver queues, escalates",
      "tasks": [5, 6, 7, 8]
    },
    {
      "name": "Fulfillment Agent",
      "responsibility": "Places orders, tracks deliveries, confirms receipt",
      "tasks": [9, 10, 11]
    }
  ],
  "tasks": [
    {
      "name": "Validate Request Completeness",
      "agent_index": 0,
      "category": "analysis",
      "automation_tier": "fully_automatable",
      "tools_needed": ["Form validator", "Data validation"],
      "human_gate": { "role": "Manager", "action": "corrects form if invalid" },
      "inputs": ["Service portal submission"],
      "outputs": ["Validation pass/fail + missing fields list"]
    },
    {
      "name": "Check Employee Eligibility",
      "agent_index": 0,
      "category": "analysis",
      "automation_tier": "mostly_automatable",
      "tools_needed": ["HRIS connector"],
      "human_gate": { "role": "HR", "action": "approves non-standard employee types" },
      "inputs": ["Employee name, start date, location"],
      "outputs": ["Employee status confirmed or ineligible flagged"]
    },
    {
      "name": "Route to Manager Approval",
      "agent_index": 1,
      "category": "routing",
      "automation_tier": "fully_automatable",
      "tools_needed": ["HRIS connector", "Workflow engine", "Email agent"],
      "human_gate": { "role": "Manager", "action": "approves or rejects" },
      "inputs": ["Completed request + validation results"],
      "outputs": ["Approval request sent, ticket status updated"]
    },
    {
      "name": "Track & Notify on Delivery",
      "agent_index": 2,
      "category": "execution",
      "automation_tier": "fully_automatable",
      "tools_needed": ["Supplier tracking API", "Email agent"],
      "human_gate": null,
      "inputs": ["PO number, supplier, expected delivery date"],
      "outputs": ["Shipment tracking + IT preparation triggered"]
    }
  ],
  "summary": {
    "total_tasks": 12,
    "agent_count": 3,
    "human_gates": 10,
    "by_tier": {
      "fully_automatable": 5,
      "mostly_automatable": 3,
      "human_assisted": 3,
      "human_led": 1
    },
    "by_category": {
      "analysis": 5,
      "routing": 4,
      "execution": 3
    }
  },
  "data_sources": ["SOP Document"]
}</artifact>
```
**Field rules:**
- `automation_tier` must be one of: `"fully_automatable"`, `"mostly_automatable"`, `"human_assisted"`, `"human_led"` — qualitative labels, not numeric scores
- `category` must be one of: `"analysis"`, `"routing"`, `"execution"`
- `agents[].tasks` contains indices into the `tasks` array
- `tasks[].agent_index` references the `agents` array
- `human_gate` is `null` when no human decision point exists (e.g., fully automated notification tasks)
- `summary.human_gates` must equal the count of tasks where `human_gate` is not null
- All tasks must appear in exactly one agent's `tasks` array

### decision_transparency
Use for audit/bias analysis, hiring fairness assessment, decision transparency. CRITICAL: You MUST emit this artifact with REAL data. Populate `biasAnalysis` (with `factors`, `proxy_variables`, `four_fifths` if applicable), `auditTrail`, and `recommendations`. Do NOT put findings only in the text — the card renders from the artifact data.
```json
<artifact>{
  "type": "decision_transparency",
  "title": "[Decision Title]",
  "criteria": [
    {"name": "[Criterion]", "weight": 0.3, "score": 85, "explanation": "..."}
  ],
  "recommendation": "...",
  "alternatives": ["..."],
  "dataSource": "Ivy Analysis"
}</artifact>
```

### onboarding_plan

Generate a personalised 30/60/90 day onboarding plan. Extract person data from CV/resume, org chart, or user description. Structure as 3 phases with 2+ weeks per phase. Include meetings with key stakeholders. Use `onboarding_plan_generator` and `org_chart_parser` MCP tools when available.

```json
<artifact>{
  "type": "onboarding_plan",
  "title": "30/60/90 Day Onboarding Plan for [Name]",
  "newHire": {
    "name": "string",
    "role": "string",
    "department": "string",
    "startDate": "YYYY-MM-DD or Month YYYY"
  },
  "manager": {
    "name": "string",
    "role": "string",
    "email": "string or null"
  },
  "overview": {
    "totalWeeks": 12,
    "totalMeetings": "number",
    "totalMilestones": "number",
    "keyObjectives": ["string", "string", "string", "string"]
  },
  "phases": [
    {
      "name": "First 30 Days",
      "theme": "Learn & Integrate",
      "weeks": [
        {
          "weekNumber": 1,
          "focus": "Short description of this week's focus",
          "activities": [
            {
              "title": "Activity name",
              "description": "What to do and why",
              "category": "orientation|technical|relationship|compliance|project|development",
              "owner": "Person responsible"
            }
          ],
          "meetings": [
            {
              "attendee": "Person's full name",
              "role": "Their job title",
              "purpose": "Why this meeting matters",
              "suggestedAgenda": ["Agenda item 1", "Agenda item 2"],
              "duration": 30,
              "email": "email or null"
            }
          ],
          "milestones": [
            {
              "title": "Milestone name",
              "description": "What success looks like",
              "category": "compliance|technical|relationship|project"
            }
          ]
        }
      ]
    }
  ],
  "skillDevelopment": {
    "required": [
      {"name": "Skill name", "currentLevel": 0, "targetLevel": 80, "priority": "high|medium|low"}
    ],
    "trainingResources": [
      {"title": "Resource name", "type": "course|documentation|mentoring|workshop|self-study", "description": "What it covers", "duration": "Estimated time"}
    ]
  },
  "dataSource": "Source of data used"
}</artifact>
```

### org_design
```json
<artifact>{
  "type": "org_design",
  "title": "Organization Design: [Unit]",
  "currentStructure": {
    "name": "VP Engineering",
    "role": "executive",
    "children": [
      {"name": "Dir Backend", "role": "director", "children": [{"name": "Team Lead A", "role": "manager", "children": []}]}
    ]
  },
  "proposedStructure": {
    "name": "VP Engineering",
    "role": "executive",
    "children": []
  },
  "metrics": {"spans_of_control": 5.2, "total_levels": 4, "headcount": 150, "proposed_headcount": 145},
  "recommendations": [
    {"title": "Flatten management layers", "description": "Remove one director layer to improve communication speed", "priority": "high"}
  ],
  "dataSource": "Org Analysis"
}</artifact>
```

### skills_genome
```json
<artifact>{
  "type": "skills_genome",
  "title": "Skills Genome: [Role]",
  "role": "Senior Data Engineer",
  "skills": [
    {"name": "Python", "proficiency": 90, "category": "Technical", "trending": true, "demand_growth": 15}
  ],
  "clusters": [
    {"name": "Core Engineering", "skills": ["Python", "SQL", "Spark"]}
  ],
  "recommendations": [
    {"title": "Develop MLOps skills", "description": "Growing demand for ML pipeline automation", "priority": "high"}
  ],
  "dataSource": "Lightcast + O*NET"
}</artifact>
```

### scenario_comparison
```json
<artifact>{
  "type": "scenario_comparison",
  "title": "Scenario Analysis: [Topic]",
  "scenarios": [
    {"name": "Hire Externally", "description": "Full external hiring campaign", "metrics": {"cost": 500000, "time_months": 6, "risk": "medium"}, "investment": 500000, "timeline": "6 months", "risk_level": "medium"}
  ],
  "winner": "Build Internal Talent",
  "criteria": [{"name": "Cost", "weight": 0.3}, {"name": "Time to Impact", "weight": 0.3}, {"name": "Risk", "weight": 0.2}, {"name": "Sustainability", "weight": 0.2}],
  "dataSource": "Scenario Modeling"
}</artifact>
```

### decision_record
Use for finance-transformation recommendations that synthesize multiple simulation scenarios into one canonical recommendation. Prefer calling the deterministic `wrs_decision_record` tool and emitting its artifact verbatim. Do not invent this card from prose when the simulation trust contract is weak.
```json
<artifact>{
  "type": "decision_record",
  "id": "decision-123abc",
  "title": "Finance Transformation Decision Record",
  "decision_type": "finance_transformation",
  "status": "recommended",
  "context": {
    "org_name": "Example Corp",
    "function_name": "Finance",
    "time_horizon_months": 18,
    "headcount": 120,
    "simulation_id": "sim-123"
  },
  "recommendation": {
    "winner": "Finance Copilot Rollout",
    "summary": "Best overall: Finance Copilot Rollout across 4 criteria",
    "why_this_wins": [
      "Finance Copilot Rollout is the highest-scoring viable option at 0.82."
    ],
    "why_not_others": [
      {"option": "Aggressive Automation", "reason": "Rejected because max role resistance exceeds the viability threshold."}
    ],
    "top_flip_drivers": [
      "If resistance-risk weight rises to 33%, the recommendation flips from Finance Copilot Rollout to Do Nothing (counterfactual).",
      "If the resistance viability threshold moves from 75% to 65%, no scenario remains viable."
    ]
  },
  "options": [
    {"name": "Finance Copilot Rollout", "rank": 1, "overall_score": 0.82, "viable": true, "key_metrics": {"net_annual_savings": 1800000, "tasks_automated_pct": 42, "max_resistance_probability": 58, "total_projected_fte": 96}}
  ],
  "assumptions": [
    {"statement": "Baseline headcount and role mix are verified from HRIS extracts.", "source": "verified", "impact": "high"}
  ],
  "trust_contract": {
    "decision_grade": "decision_grade",
    "data_quality_status": {"status": "real", "confidence": 91, "sources": [{"name": "Scenario A", "status": "real", "used_in": "decision_record"}], "notes": ["All compared scenarios carry real-data passports."], "computed_at": "2026-04-23T12:00:00.000Z"},
    "input_credibility": {"status": "verified", "headcount_source": "workday_extract", "role_fte_source": "workday_extract", "requires_confirmation": false, "warnings": []},
    "blocking_issues": [],
    "export_policy": "normal"
  },
  "monitors": {"attached": false, "ids": []},
  "review_hook": {"outcome_review_status": "not_built_yet"},
  "dataQualityStatus": {"status": "real", "confidence": 91, "sources": [{"name": "Scenario A", "status": "real", "used_in": "decision_record"}], "notes": ["All compared scenarios carry real-data passports."], "computed_at": "2026-04-23T12:00:00.000Z"},
  "dataSource": "WRS decision record synthesizer + deterministic scenario comparator"
}</artifact>
```

### swarm_result
```json
<artifact>{
  "type": "swarm_result",
  "title": "Swarm Analysis: [Objective]",
  "swarm_name": "Workforce Transformation Analysis",
  "objective": "Analyze engineering workforce for AI transformation readiness",
  "agents": [
    {"name": "skills_analyst", "task": "Assess current skill levels", "status": "completed", "duration_ms": 15000, "result_summary": "85% have Python, 20% have ML skills"}
  ],
  "total_duration_ms": 45000,
  "synthesized_result": "The engineering team shows strong foundational skills but significant ML/AI gaps...",
  "dataSource": "Multi-Agent Analysis"
}</artifact>
```

### knowledge_graph
```json
<artifact>{
  "type": "knowledge_graph",
  "title": "Knowledge Graph: [Scope]",
  "nodes": [
    {"id": "1", "name": "Data Engineering", "type": "department", "properties": {"headcount": 45}},
    {"id": "2", "name": "Python", "type": "skill", "properties": {"category": "technical"}}
  ],
  "edges": [
    {"source": "1", "target": "2", "type": "requires"}
  ],
  "summary": "45 entities, 78 relationships mapped across engineering org",
  "dataSource": "Knowledge Graph"
}</artifact>
```

### market_pulse
```json
<artifact>{
  "type": "market_pulse",
  "title": "Market Pulse: [Scope]",
  "monitors": [
    {"name": "Data Engineer Salary - SF", "type": "salary", "value": 185000, "delta_pct": 3.2, "trend": [170000, 175000, 180000, 185000], "alerts": []}
  ],
  "summary": "3 monitors active, 1 alert triggered for skills demand spike",
  "dataSource": "Market Monitoring"
}</artifact>
```

### connector_status
```json
<artifact>{
  "type": "connector_status",
  "title": "System Connector Status",
  "connectors": [
    {"name": "Greenhouse ATS", "type": "ats", "status": "connected", "last_sync": "2026-02-28T10:30:00Z", "records_synced": 1250, "health": "healthy"},
    {"name": "BambooHR", "type": "hris", "status": "connected", "last_sync": "2026-02-28T09:15:00Z", "records_synced": 5200, "health": "healthy"},
    {"name": "Salesforce CRM", "type": "crm", "status": "connected", "last_sync": "2026-02-27T18:00:00Z", "records_synced": 8400, "health": "healthy"},
    {"name": "Personio HRIS", "type": "hris", "status": "error", "last_sync": "2026-02-25T14:00:00Z", "records_synced": 3100, "health": "degraded"}
  ],
  "summary": "4 connectors registered, 3 healthy, 1 needs attention",
  "dataSource": "Connector Status"
}</artifact>
```

### predictive_forecast
```json
<artifact>{
  "type": "predictive_forecast",
  "title": "Forecast: [Subject]",
  "subject": "Data Engineer Demand — US Market",
  "forecast_periods": [
    {"period": "Q1 2026", "predicted_value": 52000, "confidence_low": 48000, "confidence_high": 56000}
  ],
  "factors": [
    {"name": "AI adoption rate", "impact": "high", "direction": "up"},
    {"name": "Remote work trend", "impact": "medium", "direction": "up"}
  ],
  "methodology": "Linear regression with exponential smoothing on 24 months of Lightcast data, Monte Carlo confidence intervals (1000 iterations)",
  "dataSource": "Lightcast + BLS + Predictive Model"
}</artifact>
```

### talent_marketplace
```json
<artifact>{
  "type": "talent_marketplace",
  "title": "Talent Marketplace: [Role]",
  "role": "Senior ML Engineer",
  "matches": [
    {
      "name": "Jane Smith",
      "current_role": "Senior Data Engineer",
      "match_score": 78,
      "mobility_score": 82,
      "skills": [{"name": "Python", "level": 90, "required": 85}, {"name": "TensorFlow", "level": 40, "required": 80}],
      "development_phases": [{"phase": "Foundation", "duration": "3 months", "skills": ["TensorFlow basics", "ML theory"]}]
    }
  ],
  "bench_strength": {"ready_now": 2, "ready_6mo": 5, "ready_12mo": 8},
  "dataSource": "Internal Talent Analysis"
}</artifact>
```

### functional_outlook
Use for function-level AI impact triangulation analysis (e.g., "AI impact on HR", "AI impact on Finance"). **ALWAYS use the `triangulate_functional_outlook` tool** to generate the scored data — never manually construct metrics from raw data tools. The tool handles all scale normalization correctly.

**Workflow:**
1. Use `triangulate_autocomplete` (or `onet_search_occupations`) to find relevant O*NET SOC codes for the function
2. Call `triangulate_functional_outlook` with `function_name` and `occupation_codes[]`
3. The tool returns all scored fields EXCEPT `triangulation_summary` and `strategic_implications`
4. Write the `triangulation_summary` (HTML) and `strategic_implications` (3-5 items) based on the scored data
5. Emit the complete artifact

**CRITICAL — Scale Reference (do NOT manually recalculate):**
- `observed_exposure`: Tiny fractions (e.g., 0.0018 = 0.18% of Claude conversations). Most occupations < 1%.
- `onet_task_importance`: 0-100 scale (not 1-5).
- `avg_task_penetration`: Percentage with 2 decimal places (e.g., 0.39 = 0.39%, NOT 39%).
- `workbank`: Human Agency Scale 1-7 (1=Full Automation, 7=Fully Human). Tiers: Cat 1-3 High, Cat 4-5 Augmentation, Cat 6-7 Human-Essential.
- `unemployment`: BLS CPS rates (e.g., 4.9%).

**Data vectors (auto-detected — only vectors with data appear):**
- `aioe` — Felten AIOE theoretical exposure (only ~35 occupations in dataset)
- `observed` — Anthropic Economic Index empirical AI usage from real Claude conversations
- `workbank` — Stanford WORKBank automation potential (Human Agency Scale 1-7)
- `onet` — O*NET task importance scores (0-100)
- `unemployment` — BLS CPS unemployment rates

The card auto-detects which vectors have data and renders only those polygons on the radar chart, columns in the occupation table, and source descriptions in the explainer.

```json
<artifact>{
  "type": "functional_outlook",
  "title": "AI Impact Triangulation: Human Resources",
  "function_name": "Human Resources",
  "overall_impact_score": 2.9,
  "displacement_risk": "low",
  "avg_task_penetration": 2.47,
  "capability_usage_gap": 58,
  "unemployment_signal": {"weighted_rate": 3.4, "national_rate": 4.4, "trend": "increasing", "summary": "..."},
  "occupations": [
    {"title": "Human Resources Managers (11-3121.00)", "observed_exposure": 0.0018, "onet_task_importance": 69, "most_impacted_task": "Provide current and prospective employees with information about policies...", "risk_level": "low", "unemployment_rate": 4.9, "unemployment_trend": "increasing", "unemployment_yoy_change": 1.7},
    {"title": "Human Resources Specialists (13-1071.00)", "observed_exposure": 0.0049, "onet_task_importance": 76.9, "most_impacted_task": "Review employment applications and match applicants with job requirements", "risk_level": "low", "unemployment_rate": 2.5, "unemployment_trend": "stable"}
  ],
  "task_penetration": [
    {"task": "Develop and organize training manuals...", "penetration_pct": 6.32},
    {"task": "Process and review employment applications...", "penetration_pct": 3.38},
    {"task": "Answer questions regarding eligibility, salaries, benefits", "penetration_pct": 2.07}
  ],
  "automation_tiers": [
    {"tier": "high", "label": "High Automation Potential (WORKBank Cat 1-3)", "percentage": 66, "task_count": 29, "example_tasks": ["Provide employees with information about policies...", "Administer compensation and benefits systems"]},
    {"tier": "medium", "label": "Augmentation Zone (WORKBank Cat 4-5)", "percentage": 32, "task_count": 14, "example_tasks": ["Analyze employment-related data", "Process personnel documentation"]},
    {"tier": "low", "label": "Human-Essential (WORKBank Cat 6-7)", "percentage": 2, "task_count": 1, "example_tasks": ["Review and evaluate applicant qualifications"]}
  ],
  "radar_dimensions": [
    {"category": "Recruitment & Selection", "onet": 70, "observed": 4.36, "workbank": 56, "unemployment": 17},
    {"category": "Compensation & Benefits", "onet": 74, "observed": 3.21, "workbank": 59, "unemployment": 17},
    {"category": "Training & Development", "onet": 70, "observed": 3.27, "workbank": 62, "unemployment": 17}
  ],
  "strategic_implications": [
    {"title": "Significant capability-usage gap presents strategic window", "description": "The 58-point gap between predicted AI capability and actual usage indicates HR leaders have time to plan AI integration strategically.", "priority": "critical"},
    {"title": "Management adoption gap despite high task importance", "description": "HR Managers show 0.18% AEI usage yet carry 69/100 task importance — untapped augmentation potential.", "priority": "high"},
    {"title": "Rising management unemployment independent of AI", "description": "Management-tier roles at 4.9% unemployment (+1.7pts YoY) suggests organizational flattening, not AI displacement.", "priority": "high"}
  ],
  "triangulation_summary": "The HR function shows <strong>minimal AI disruption</strong> with an overall impact of <strong>2.9/10</strong>...",
  "data_sources": "AEI: Anthropic Economic Index | O*NET: O*NET 30.2 | BLS: Bureau of Labor Statistics | WORKBank: Stanford SALT-NLP"
}</artifact>
```
**Population rules:**
- **ALWAYS call `triangulate_functional_outlook` first.** Copy all returned fields directly into the artifact. Do NOT recalculate or re-scale any values.
- Write `triangulation_summary` (HTML with `<strong>` and `<em>` tags) and `strategic_implications` (3-5 items, each grounded in the scored data).
- The tool returns `data_sources` — use it as-is.
- If the tool returns `unemployment_signal`, include it. If absent, omit the field.
- `occupations`: Use all returned occupations. Aim for 5-8 by providing enough SOC codes.
- `task_penetration`: Use all returned tasks (tool returns top 12).
- `automation_tiers`: Use exactly as returned (3 tiers, correct WORKBank Cat 1-3/4-5/6-7 labels).
- `radar_dimensions`: Use exactly as returned. The tool handles vector fallbacks.

### skill_deep_dive
Use for single-skill exploration queries like "tell me about Python", "what is deductive reasoning?", "skill deep dive on Kubernetes", "explore data engineering". Do NOT use for role-to-role comparisons (use `skill_analysis`) or role-centric genome maps (use `skills_genome`).

**MCP Tool Flow (5 Waves):**
1. `lightcast_search_skills(query)` → canonical skill ID, name, category, description
2. Parallel: `skills_adjacent(skill_name, limit: 12)`, `lightcast_trending_skills(skill)`, `onet_search_occupations(keyword)`, `lightcast_demand_forecast(skill)`
3. For top 3-5 SOC codes: `onet_get_occupation_details(soc_code)`, `bls_occupation_wages(soc_code)`
4. **Empirical AI Exposure (parallel, per top 3 SOC codes):**
   - `workbank_occupation_automation(soc_code)` → per-task AI capability scores, displacement risk, task categorization
   - `aei_job_exposure(soc_code)` → empirical AI exposure from real Claude usage
   - `aei_task_penetration(soc_code)` → per-task AI penetration rates
   - `aioe_occupation_exposure(soc_code)` → Felten exposure score (0-1) across 7 AI categories
   - `jobhop_transition_probability(occupation_title)` → career transitions ranked by probability (uses O*NET title, JobHop fuzzy-matches to ESCO)
5. **Human Edge Deep-Dive (parallel, selective):**
   - `workbank_human_edge(task_statement)` for top 2-3 most important O*NET tasks → 6-dimension human advantage scoring
   - `aei_task_collaboration(task)` → human-AI collaboration patterns (directive, feedback loop, etc.)

**Graceful degradation:** If WORKBank/AEI/Felten return no data for a SOC code, redistribute weights to whichever sources respond. If all miss, fall back to Claude inference and omit `empirical_sources`. If JobHop returns no match (fuzzy match fails), omit `career_transitions` entirely. `data_sources` array must only list sources that actually returned data.

```json
<artifact>{
  "type": "skill_deep_dive",
  "skill_name": "Python",
  "skill_id": "KS120076FGP5WGWYMP0F",
  "title": "Skill Deep Dive: Python",
  "skill_dna": {
    "domain": "Information Technology",
    "category": "Programming Languages",
    "skill_type": "Hard Skill",
    "criticality": 92,
    "scarcity": 25,
    "transferability": 88,
    "expertise_levels": [
      {"level": "Novice", "description": "Basic syntax, simple scripts", "time_to_reach": "0-6 months"},
      {"level": "Intermediate", "description": "OOP, libraries, testing", "time_to_reach": "6-18 months"},
      {"level": "Advanced", "description": "Architecture, performance optimization", "time_to_reach": "18-36 months"},
      {"level": "Expert", "description": "Framework design, language internals", "time_to_reach": "3-5 years"}
    ],
    "related_skills": [
      {"name": "JavaScript", "relevance": 82, "relationship": "complementary"},
      {"name": "SQL", "relevance": 78, "relationship": "foundational"},
      {"name": "Machine Learning", "relevance": 75, "relationship": "amplifying"}
    ]
  },
  "cognitive_work": {
    "description": "General-purpose programming language used for web development, data science, automation, and AI/ML.",
    "bloom_taxonomy_level": "Create",
    "cognitive_complexity_score": 72,
    "work_patterns": [
      {"name": "Algorithm Design", "frequency": "daily", "cognitive_load": "high"},
      {"name": "Data Transformation", "frequency": "daily", "cognitive_load": "medium"}
    ],
    "occupations": [
      {"title": "Software Developers", "soc_code": "15-1252.00", "importance": 85, "employment": 1847900, "median_salary": 132270}
    ],
    "tasks": [
      {"statement": "Develop software applications using Python frameworks", "importance": 88}
    ]
  },
  "ai_disruption": {
    "automation_exposure": 45,
    "risk_level": "moderate",
    "timeline": "3-5 years",
    "dimensions": [
      {"name": "Data Processing", "score": 75},
      {"name": "Decision Making", "score": 35},
      {"name": "Creative Problem Solving", "score": 20},
      {"name": "Interpersonal Interaction", "score": 5},
      {"name": "Physical Execution", "score": 0}
    ],
    "human_ai_model": "AI augments code generation; humans drive architecture and requirements",
    "evolution_trajectory": [
      {"horizon": "Now", "description": "AI assists with code completion and boilerplate"},
      {"horizon": "1-2 years", "description": "AI generates full modules from specs"},
      {"horizon": "3-5 years", "description": "AI handles routine dev; humans focus on architecture"},
      {"horizon": "5+ years", "description": "AI designs subsystems; humans shift to oversight"}
    ],
    "human_edge_skills": ["System architecture", "Stakeholder communication", "Novel problem framing"],
    "adjacent_opportunities": [
      {"skill": "Prompt Engineering", "growth_rate": 245, "relevance": "Directing AI assistants"},
      {"skill": "MLOps", "growth_rate": 67, "relevance": "Deploying ML pipelines"}
    ],
    "empirical_sources": {
      "workbank_score": 3.2,
      "aei_exposure": 0.62,
      "felten_aioe": 0.71,
      "aei_penetration_rate": 0.45,
      "concordance": "high"
    }
  },
  "strategic_network": {
    "network_position": "hub",
    "centrality_score": 9.2,
    "strategic_trajectory": {"current": 92, "future": 85, "trend": "stable"},
    "value_multipliers": [
      {"skill": "Machine Learning", "multiplier": 1.45, "description": "Python + ML creates 45% more market value"}
    ],
    "bottleneck_risk": {"level": "low", "scenario": "Abundant supply", "mitigation": "N/A"},
    "demand_metrics": {
      "current_postings": 185000,
      "growth_rate": 11,
      "median_salary": 132270,
      "top_employers": ["Google", "Amazon", "Meta", "Microsoft"]
    },
    "career_transitions": {
      "top_destinations": [
        {"occupation": "Data Scientist", "probability": 0.18, "median_tenure_months": 28},
        {"occupation": "Machine Learning Engineer", "probability": 0.14, "median_tenure_months": 24},
        {"occupation": "DevOps Engineer", "probability": 0.11, "median_tenure_months": 32},
        {"occupation": "Technical Lead", "probability": 0.09, "median_tenure_months": 36},
        {"occupation": "Solutions Architect", "probability": 0.07, "median_tenure_months": 42}
      ],
      "data_source": "JobHop (391K+ resumes)"
    }
  },
  "data_sources": ["Lightcast Skills API", "O*NET 30.2", "BLS OES 2025", "WORKBank", "Anthropic Economic Index", "Felten AIOE", "JobHop"]
}</artifact>
```

**Population rules:**

**Skill DNA tab (grounded from Wave 1-3 data):**
- `skill_dna.criticality`: `(demand_norm * 0.4) + (avg_onet_importance * 0.4) + (occ_breadth_norm * 0.2)`. Scale 0-100.
- `skill_dna.scarcity`: `(demand_level * 0.4) + (inverse_employment * 0.3) + (growth_rate * 0.3)`. Scale 0-100.
- `skill_dna.transferability`: `(occ_breadth * 0.5) + (adjacent_domain_diversity * 0.5)`. Scale 0-100. O*NET SOC count + adjacent skills domain spread.
- `skill_dna.expertise_levels`: Claude-synthesized. Inform `time_to_reach` from `jobhop_occupation_tenure` if available.

**Cognitive Work tab (grounded from Wave 3-4 data):**
- `cognitive_work.bloom_taxonomy_level`: WORKBank `human_agency_scale` + O*NET tasks. Scale 5 + complex tasks → Create/Evaluate; Scale 3-4 → Analyze/Apply; Scale 1-2 → Remember/Understand.
- `cognitive_work.cognitive_complexity_score`: WORKBank — `100 - (avg_ai_capability_score / 5 * 100)`. Higher human-essential ratio = higher complexity.
- `cognitive_work.work_patterns` cognitive_load: WORKBank `ai_capability_score` per task. Low AI capability (<2) = "high" load; medium (2-3.5) = "medium"; high (>3.5) = "low".

**AI Disruption tab (grounded from Wave 4-5 data):**
- `ai_disruption.automation_exposure`: Weighted composite from empirical sources — `(workbank_norm * 0.4) + (aei * 0.35) + (felten * 0.25)`, weighted avg across top SOCs. Graceful: use whatever sources return data, redistribute weights.
- `ai_disruption.risk_level`: Derived from grounded `automation_exposure`. <30 = "low", 30-60 = "moderate", >60 = "high".
- `ai_disruption.dimensions`: Map WORKBank task breakdown (high_automation/augmentation/human_essential) to each axis, calibrate with Felten 7-category scores. Must include 5 dimensions. Scores 0-100.
- `ai_disruption.human_ai_model`: AEI `aei_task_collaboration` patterns. Template from dominant pattern: "directive" → "AI follows human direction", "feedback_loop" → "Iterative human-AI refinement", etc.
- `ai_disruption.human_edge_skills`: WORKBank `workbank_human_edge` — extract `key_human_advantages` from top tasks, deduplicate, rank by frequency.
- `ai_disruption.evolution_trajectory`: Claude-synthesized narrative but grounded in AEI `aei_task_autonomy` current autonomy levels and `aei_task_penetration` rates.
- `ai_disruption.empirical_sources` (optional): Only present when at least one empirical source returned data.
  - `workbank_score`: 0-5 scale, overall automation potential from WORKBank
  - `aei_exposure`: 0-1 scale, empirical AI exposure from AEI
  - `felten_aioe`: 0-1 scale, patent-based AI exposure from Felten AIOE
  - `aei_penetration_rate`: 0-1 scale, task penetration from AEI
  - `concordance`: "high" (all sources within 15%), "moderate" (within 30%), "low" (>30% disagreement)

**Strategic Network tab (grounded from Wave 2-4 data):**
- `strategic_network.network_position`: `skills_adjacent` count + domain spread. >8 adjacent across 3+ domains = "hub"; 3-8 linking 2 domains = "bridge"; <3 = "specialist"/"peripheral".
- `strategic_network.centrality_score`: `skills_adjacent` count. Normalize: 12 adjacent = 10, 1 = 1.
- `strategic_network.value_multipliers`: `skills_adjacent` relevance + `lightcast_trending` growth. High relevance (>80) + high growth (>15%) = 1.3-1.5x multiplier.
- `strategic_network.bottleneck_risk`: Derived from grounded `scarcity` + `criticality`. High scarcity + high criticality = high bottleneck.
- `strategic_network.demand_metrics`: Use real data from `lightcast_demand_forecast` and `bls_occupation_wages`.
- `strategic_network.career_transitions` (optional): Only present when JobHop returns data.
  - `top_destinations`: Array of top 5 career destinations with `occupation`, `probability` (0-1), `median_tenure_months`.
  - `data_source`: Always "JobHop (391K+ resumes)".

**General:**
- `data_sources`: List ALL MCP data sources that actually returned data. Must include empirical sources when used (e.g., "WORKBank", "Anthropic Economic Index", "Felten AIOE", "JobHop").

### insight (Generic Insight Card)
Use `insight` when the analysis doesn't fit any of the 20 card types above. The `sections` array lets you compose any layout from building blocks. Prefer specific card types when they match. Use `insight` for everything else: policy analysis, pros/cons, compensation equity, benchmarking studies, ad-hoc research, etc.

**Section kinds:** `metrics`, `table`, `list`, `callout`, `recommendations`, `chart`, `timeline`, `comparison`, `simulation`, `prose`

```json
<artifact>{
  "type": "insight",
  "title": "Compensation Equity Analysis",
  "pillLabel": "COMP EQUITY",
  "subtitle": "Gender and ethnicity pay gap analysis across engineering departments",
  "dataSources": "BLS + Internal HRIS",
  "sections": [
    {
      "kind": "metrics",
      "items": [
        {"label": "Overall Pay Gap", "value": "8.2%", "color": "red", "delta": {"value": "↓2.1% YoY", "direction": "down", "sentiment": "positive"}},
        {"label": "Employees Analyzed", "value": "1,247", "color": "blue"},
        {"label": "Departments", "value": 12, "color": "purple"},
        {"label": "Equity Score", "value": "74%", "color": "amber", "variant": "ring"}
      ]
    },
    {
      "kind": "callout",
      "title": "Key Finding",
      "description": "The <strong>8.2% overall pay gap</strong> is concentrated in senior IC roles (L6+).",
      "variant": "ivy-narrative",
      "icon": "💡"
    },
    {
      "kind": "chart",
      "chartType": "bar",
      "title": "Pay Gap by Department",
      "data": [
        {"department": "Backend", "gap": 9.1},
        {"department": "Frontend", "gap": 5.3}
      ],
      "xKey": "department",
      "yKeys": ["gap"]
    },
    {
      "kind": "table",
      "headers": ["Level", "Male Median", "Female Median", "Gap", "Headcount"],
      "rows": [
        ["L4 (Junior)", "$95,000", "$93,500", "1.6%", "342"],
        ["L5 (Mid)", "$125,000", "$122,000", "2.4%", "418"]
      ],
      "highlightColumn": 3
    },
    {
      "kind": "recommendations",
      "items": [
        {"title": "Audit L6+ promotions", "description": "Review last 2 years of L5→L6 promotions for demographic disparities.", "priority": "critical"},
        {"title": "Implement band transparency", "description": "Publish salary bands internally.", "priority": "high"}
      ]
    },
    {
      "kind": "timeline",
      "nodes": [
        {"label": "Audit", "status": "completed"},
        {"label": "Band Review", "status": "active"},
        {"label": "Adjustments", "status": "upcoming"}
      ]
    },
    {
      "kind": "comparison",
      "columns": [
        {"heading": "Option A: Targeted Adjustments", "items": ["Fix L6+ gaps only", "Cost: ~$850K", "Timeline: 3 months"], "recommended": true},
        {"heading": "Option B: Full Re-benchmarking", "items": ["Re-benchmark all levels", "Cost: ~$2.1M", "Timeline: 6 months"]}
      ]
    },
    {
      "kind": "prose",
      "heading": "Methodology",
      "body": "This analysis uses <strong>Blinder-Oaxaca decomposition</strong> to separate the explained portion of the pay gap from the unexplained residual."
    }
  ]
}</artifact>
```

**Section kind reference:**

| kind | Purpose | Key fields |
|------|---------|------------|
| `metrics` | Row of MetricCards | `title?`, `items[]` with `label`, `value`, `color?`, `delta?`, `variant?` |
| `table` | Styled data table | `title?`, `headers[]`, `rows[][]`, `highlightColumn?` (0-indexed) |
| `list` | Bulleted/numbered/checklist | `items[]` with `text`, `priority?`, `checked?`; `style?` = bullet/numbered/checklist |
| `callout` | InsightCallout box | `title`, `description` (HTML), `variant?` (info/success/warning/danger/ivy-narrative), `icon?` (emoji) |
| `recommendations` | Priority-tagged recs | `title?`, `items[]` with `title`, `description`, `priority` (critical/high/medium/low) |
| `chart` | Recharts visualization | `chartType` (bar/pie/line/area), `data[]`, `xKey`, `yKeys[]`, `title?` |
| `timeline` | Phase progression | `nodes[]` with `label`, `status` (completed/active/upcoming) |
| `comparison` | Side-by-side columns | `columns[]` with `heading`, `items[]`, `recommended?` |
| `simulation` | Interactive what-if modeler | `variables[]`, `outcomes[]` (with formula), `scenarios[]`; `title?`, `subtitle?` |
| `prose` | Formatted text block | `heading?`, `body` (HTML string) |

### transition_roadmap
Use for sequenced transition plans with phases, readiness/resistance scoring, and go/no-go decision gates. Produced by WorkVine transition planning tools. The type guard requires: `type` === `"transition_roadmap"` and `phases` (array). Each phase should have a `name`; `readiness` and `resistance` are 0.0–1.0 floats (auto-percent-formatted). Provide either `duration_months` or both `start_month`/`end_month` per phase.
```json
<artifact>{
  "type": "transition_roadmap",
  "title": "Finance Function — 18-Month Agent Transition",
  "subtitle": "Sequenced rollout with go/no-go gates",
  "total_duration_months": 18,
  "total_cost": 1250000,
  "employees_affected": 120,
  "phases": [
    {
      "name": "Phase 1: Foundation",
      "start_month": 0,
      "end_month": 6,
      "duration_months": 6,
      "priority_score": 0.92,
      "roi": 1.4,
      "readiness": 0.75,
      "resistance": 0.35,
      "financial_impact": 400000,
      "actions": ["Deploy AP automation agent", "Train 15 FP&A analysts on AI copilots", "Establish oversight committee"],
      "risk_hotspots": ["Legacy ERP integration", "Data quality gaps in vendor master"]
    },
    {
      "name": "Phase 2: Scale",
      "start_month": 6,
      "end_month": 12,
      "duration_months": 6,
      "priority_score": 0.78,
      "readiness": 0.60,
      "resistance": 0.50,
      "financial_impact": 550000,
      "actions": ["Expand to month-end close", "Hybrid analyst redesign"]
    }
  ],
  "decision_gates": [
    {"phase": "Phase 1", "gate": "AP agent accuracy ≥98% for 60 days", "status": "watch"},
    {"phase": "Phase 2", "gate": "Resistance score <0.5 before scaling", "status": "go"}
  ],
  "dataSource": "WorkVine Transition Planner"
}</artifact>
```
- `decision_gates[].status` must be one of: `"go"`, `"no_go"`, `"watch"` (anything else renders as "pending").
- `priority_score` and `roi` are unbounded numeric scores used for ranking phases.

### capability_timeline
Use for tracking task-level AI capability progression over time with automation thresholds. Produced by agent capability maturation models. The type guard requires: `type` === `"capability_timeline"` and `tasks` (array). Each task needs a `task` string and either an explicit `points[]` array (preferred) or snapshot fields (`t0`/`t6`/`t12`/`t18`/`t24`). Capability values may be 0–1 floats or 0–100 percentages — the card normalizes both.
```json
<artifact>{
  "type": "capability_timeline",
  "title": "FP&A Analyst — Task Automation Horizon",
  "role": "FP&A Analyst",
  "horizon_months": 18,
  "threshold": 0.70,
  "tasks": [
    {
      "task": "Variance commentary drafting",
      "complexity_type": "narrative_synthesis",
      "threshold": 0.70,
      "points": [
        {"month": 0, "capability": 0.45},
        {"month": 6, "capability": 0.62},
        {"month": 12, "capability": 0.78},
        {"month": 18, "capability": 0.86}
      ]
    },
    {
      "task": "Scenario modeling",
      "threshold": 0.75,
      "t0": 0.30, "t6": 0.42, "t12": 0.55, "t18": 0.68
    },
    {
      "task": "Board deck assembly",
      "threshold": 0.70,
      "current_capability": 0.55,
      "projected_capability": 0.80
    }
  ],
  "summary": {
    "tasks_crossing_threshold": 2,
    "automatable_now": 0,
    "automatable_within_horizon": 2
  },
  "dataSource": "Agent Capability Maturation Model"
}</artifact>
```
- `threshold` at the artifact level is the default; each task can override. Values can be 0–1 or 0–100.
- `points[]` is preferred over `t0`/`t6`/`t12`/`t18`/`t24` when you have irregular timestamps.

### workforce_redesign
Use for before/after FTE allocation with human/agent/hybrid task splits and financial impact. The type guard requires: `type` === `"workforce_redesign"` and `roles` (array). Every role MUST have `role`, `current_fte`, and `projected_fte` (numbers). `agent_task_pct`/`hybrid_task_pct`/`human_task_pct` are 0–1 floats or 0–100 percents — the card normalizes both and they should sum to ~100%.
```json
<artifact>{
  "type": "workforce_redesign",
  "title": "Finance Function — Human-Agent Rebalance",
  "subtitle": "18-month projected FTE shifts with agent augmentation",
  "time_horizon_months": 18,
  "roles": [
    {
      "role": "AP Specialist",
      "current_fte": 12,
      "projected_fte": 4,
      "agent_task_pct": 0.70,
      "hybrid_task_pct": 0.20,
      "human_task_pct": 0.10,
      "note": "Exception handling and vendor dispute resolution remain human"
    },
    {
      "role": "FP&A Analyst",
      "current_fte": 8,
      "projected_fte": 8,
      "agent_task_pct": 0.30,
      "hybrid_task_pct": 0.50,
      "human_task_pct": 0.20
    },
    {
      "role": "Controller",
      "current_fte": 3,
      "projected_fte": 3,
      "agent_task_pct": 0.15,
      "hybrid_task_pct": 0.35,
      "human_task_pct": 0.50
    }
  ],
  "financial": {
    "labor_savings": 920000,
    "agent_cost": 180000,
    "reskilling_cost": 120000,
    "net_annual_impact": 620000,
    "payback_months": 7
  },
  "highlights": ["8 FTE freed for higher-value strategic work", "7-month payback on agent investment"],
  "risk_indicators": ["Controller role resistance — sponsor engagement required", "Upskilling bandwidth constrained in Q3"],
  "dataSource": "Workforce Redesign Simulation"
}</artifact>
```
- `financial.net_annual_impact`, if omitted, is computed as `labor_savings - agent_cost - reskilling_cost`.
- `highlights` and `risk_indicators` are plain string arrays rendered as callouts.

### workforce_simulation_workbench
Produced by the `wrs_run` tool (agent-workforce-sim). DO NOT hand-author — always call `wrs_run` and emit its returned artifact verbatim. The type guard requires: `type` === `"workforce_simulation_workbench"`, `simulation_id`, and `baseline_summary`. This is the workbench for end-to-end workforce redesign simulation with cost calibration, constraint policy, explainability, and per-role action plans. Sample is illustrative — the real tool returns the full shape.
```json
<artifact>{
  "type": "workforce_simulation_workbench",
  "title": "Finance Function — Agent Integration Run #3",
  "simulation_id": "sim_01J5...",
  "scenario_id": "scn_01J5...",
  "run_id": "run_01J5...",
  "scenario_name": "Aggressive 18-Month Rollout",
  "active_preset": "aggressive",
  "assumptions": {
    "time_horizon_months": 18,
    "agent_cost_per_task_monthly": 150,
    "reskilling_cost_per_person": 8000,
    "severance_months": 3,
    "agent_assignment_threshold_pct": 70,
    "hybrid_assignment_threshold_pct": 40,
    "resistance_alert_threshold_pct": 60
  },
  "constraints": {
    "max_fte_reduction_pct": 30,
    "min_human_task_pct": 20
  },
  "baseline_summary": {
    "total_current_fte": 23,
    "total_projected_fte": 15,
    "net_annual_savings": 620000,
    "total_agent_cost": 180000,
    "total_reskilling_cost": 120000,
    "tasks_automated_pct": 42,
    "tasks_augmented_pct": 38,
    "tasks_human_pct": 20,
    "avg_resistance_probability": 0.45,
    "high_risk_roles": 2
  },
  "role_snapshots": [
    {
      "role_id": "role_ap_specialist",
      "role": "AP Specialist",
      "current_fte": 12,
      "projected_fte": 4,
      "agent_task_pct": 70,
      "hybrid_task_pct": 20,
      "human_task_pct": 10,
      "resistance_probability": 0.55
    }
  ],
  "dataSource": "WorkVine Simulation Engine"
}</artifact>
```
- **This artifact type is produced by `wrs_run`** — never construct by hand. The tool returns many additional optional fields (`executive_brief`, `task_reallocation`, `resistance_analysis`, `skills_impact`, `cost_calibration`, `constraint_policy`, `data_quality`, `mini_app_spec`, `task_automation_map`, `explain_my_answer`) that the card renders conditionally.

### agent_spec
Produced by agent-builder's `buildAgentSpecArtifact` (via `agent_spec_build_artifact` or auto-emitted after spec composition). Uses the same `sections[]` pattern as the generic `insight` card — the agent_spec card is a thin wrapper that re-uses `GenericInsightCard`. The type guard requires: `type` === `"agent_spec"`, `title` (string), and `sections` (array). Do NOT hand-author — always call the agent-builder tool.
```json
<artifact>{
  "type": "agent_spec",
  "title": "AP Exception Handler Agent",
  "pillLabel": "AGENT BUILDER",
  "subtitle": "v1 · claude-sonnet-4 · 8 tasks · 5 tools · 4 guardrails",
  "dataSources": "WorkVine Simulation",
  "sections": [
    {
      "kind": "metrics",
      "items": [
        {"label": "Agent Tasks", "value": 6, "color": "green", "delta": {"value": "2 hybrid", "direction": "up", "sentiment": "neutral"}},
        {"label": "MCP Tools", "value": 5, "color": "blue"},
        {"label": "Guardrails", "value": 4, "color": "green"},
        {"label": "Automation Coverage", "value": "78%", "color": "green"}
      ]
    },
    {"kind": "callout", "title": "Agent Purpose", "description": "Handles AP vendor exceptions by triaging, gathering context, and routing to humans when judgment is required.", "variant": "ivy-narrative", "icon": "🤖"},
    {
      "kind": "table",
      "title": "Agent Tasks (8)",
      "headers": ["#", "Task", "Source Role", "Assignment", "AI Score"],
      "rows": [["1", "Match invoice to PO", "AP Specialist", "AGENT", "92%"]],
      "highlightColumn": 3
    },
    {
      "kind": "list",
      "title": "MCP Tools (5)",
      "style": "bullet",
      "items": [{"text": "**erp_invoice_search** (agent-erp) — lookup invoices by vendor", "priority": "high"}]
    },
    {
      "kind": "recommendations",
      "title": "Next Steps",
      "items": [
        {"text": "Run `agent_spec_compose` to generate a deployable agent configuration", "priority": "critical"},
        {"text": "Review guardrails and customize escalation logic before deploying to production", "priority": "high"}
      ]
    }
  ]
}</artifact>
```
- Rendered by `AgentSpecCard`, which maps to `GenericInsightCard` — all `insight` section kinds (metrics/callout/table/list/recommendations/chart/timeline/comparison/prose) are available.
- **Always produced by the agent-builder pipeline** (`agent_spec_build_artifact`, etc.) — never hand-author. Emit the tool's output verbatim.

## Artifact Population Rules — MANDATORY

### General Rules (All Artifacts)
1. **Tool Results Only**: Populate ALL numeric fields, scores, salary ranges, skill levels, and trend data from MCP tool results. NEVER generate these from training knowledge. If a tool doesn't return data for a required field, write "Data not available — [tool name] returned no results" rather than estimating.
2. **Cite Sources Per Field**: The `dataSource` field must list the specific tools and data year used (e.g., "BLS 2024 + O*NET 28.0", not just "Ivy Analysis").
3. **Timestamps on Time-Sensitive Data**: All compensation, employment volume, and trend data must include the data period. Flag data older than 12 months as "⚠ Data may be stale."
4. **No Hallucination — Hard Rule**: If a tool returns sparse data (<3 data points for a required array), you MUST:
   - Disclose the limitation in the artifact text
   - Include only the data you actually have — thin but real is better than rich but invented
   - Suggest follow-up actions to fill gaps
5. **Minimum Array Sizes**: Unless the analysis genuinely found fewer items:
   - `skills` arrays: minimum 5 items
   - `recommendations` arrays: minimum 3 items
   - `tasks` arrays: minimum 4 items
   - `overlaps` arrays: every analyzed role pair must appear
   - `steps` arrays (career_ladder): minimum 3 progression steps
6. **Cross-Reference Requirement**: For critical recommendations (hiring decisions, compensation changes, restructuring), cite at least 2 independent data sources.

### Per-Artifact-Type Sourcing Rules

#### skill_analysis
- All skills MUST come from `skills_extract`, `skills_match`, O*NET, or Lightcast
- `level` (0-100) must map to O*NET proficiency scales or Lightcast confidence scores
- `importance` must come from O*NET importance ratings
- `trending` must come from `skills_trending` or `lightcast_trending_skills`
- `demandGrowth` must come from `skills_trending` or `lightcast_trending_skills` — this populates the Trend column in the card. Without it all trends show "0% stable"
- For role-to-role comparisons (gap, transition, upskill): ALWAYS set `sourceRole` and `targetRole` — the card headline changes from "Your team" to "X% skills gap from A to B"
- Include at least 1 skill gap with specific current vs. required scores
- Include at least 3 recommendations with actionable steps (not generic "improve X" — specify courses, certs, timeframes)

#### automation_assessment
- All `automationScore` values MUST come from `workbank_occupation_automation` or `automation_assess`
- `aei_penetration_rate` values MUST come from `aei_task_penetration` tool when available
- When available, show both WORKBank capability and AEI actual usage side-by-side
- If WORKBank has no data for the exact occupation, state this and use the closest O*NET match — disclose the proxy
- `timeAllocation` percentages must sum to 100% or explicitly note which tasks are excluded
- `breakdown` must be calculable from the task-level scores — show your math
- Include specific automation tools/vendors in risk factor descriptions
- When using `human_edge` tool, include the WORKBank human advantage score
- **ALWAYS include `postAiTimeAllocation`** — role-specific projected time allocation after AI adoption. Categories should reflect the actual work of THIS role (e.g., "Compliance Review" for a compliance officer, "Client Advisory" for a wealth manager). Values are percentages that sum to 100. Without this, the card falls back to a generic formula that looks identical across roles.
- **ALWAYS include `skillsEvolution`** — role-specific skills with today vs post-AI importance scores (0-100). Use skills relevant to THIS specific role and industry (e.g., "Regulatory Fluency" for pharma marketing, "Financial Modeling" for financial analysts). 5-7 skills. Without this, the card shows the same generic 6 skills for every role.
- **Enrich every task** with these fields when data is available (the detail panel renders them all):
  - `aeiPenetrationRate` (0-100) — empirical AI usage from `aei_task_penetration`. Shows the gap between automation capability and actual AI adoption.
  - `estimatedHoursFreed` — calculated as `(timeAllocation / 100) × 40 × (automationScore / 100)`, rounded to 1 decimal
  - `keySkills` — 3-5 skills with impact: `"replaced"` (AI handles), `"elevated"` (more important with AI), `"new"` (must learn). Source from O*NET task-skill mappings.
  - `humanEdge` — 2-3 specific reasons human judgment is needed for THIS task. From `human_edge` tool. Be specific, not generic.
  - `aiTools` — 2-4 specific AI tools or methods (e.g., "NLP document extraction", "Predictive analytics platforms"). Never generic "AI".
  - `transitionTimeline` — realistic implementation estimate (e.g., "3-6 months")
  - `transitionDifficulty` — `"low"` / `"medium"` / `"high"` based on organizational change required
  - `workflow` — `today`: 2-4 current steps, `withAi`: 2-4 AI-augmented steps. Show concrete difference.
  - `confidenceLevel` — `"high"` (WORKBank + AEI), `"medium"` (WORKBank only), `"low"` (keyword-based)
  - `confidenceReason` — brief data source attribution

#### career_ladder
- All `salary` data MUST come from `bls_occupation_wages` or `compensation_benchmark` — include BLS occupation code and data year
- All `skills` in each step must come from `onet_get_occupation_details` for that role
- `overallFeasibility` must be explained with reasoning
- `totalTimeEstimate` must be justified by typical tenure data or career transition research
- LOW priority: optionally call `lightcast_demand_forecast` per step to add demand context (posting volume, demand level) to each career stage

#### workforce_plan
- `totalDemand` and `totalSupply` MUST come from `workforce_demand` and `workforce_supply` tools
- Enrich `summary.totalDemand` with `lightcast_demand_forecast` for current posting volume and demand level
- `demandTrend` must span at least 3 time periods with real data
- `gapAnalysis` severity: gap >20% of demand = "critical", 10-20% = "high", 5-10% = "medium", <5% = "low"
- `avgSalary` must come from BLS with occupation code cited
- When available, populate `scenarios` with backend-supplied scenario data; `industryAttritionRate` from BLS/Lightcast; `recruitingCostPerHead` from compensation tools

#### job_analysis
- `salaryRange` MUST come from BLS, Adzuna, or Lightcast — not estimated
- `skills` must come from `jd_analyze` or `skills_extract` run on the actual JD text
- `qualifications` must be extracted from the JD, not generated from stereotypes
- `marketInsights`: Use `lightcast_demand_forecast` for `demandLevel` and `growthRate`. No Lightcast salary tool exists — use BLS/Adzuna for `averageSalary`. All fields are optional — show "N/A" when data is unavailable
- `skills[].demandGrowth` (optional): populate from `lightcast_trending_skills` `growth_rate` field when available

#### role_design
- **MANDATORY**: ALL roles in `roles[]` must have actual tasks from the analyzed JDs
- **MANDATORY**: ALL overlaps in `overlaps[]` must have real percentages from task-level comparison
- **MANDATORY**: Do NOT leave `roles[]` or `overlaps[]` empty
- `consolidationOpportunities` savings estimates must show calculation basis

#### task_decomposition
- Tasks MUST come from O*NET (`role_decompose` or `task_decomposition` tool) — not fabricated
- `market_context.trending_skills` MUST come from `lightcast_trending_skills` — not fabricated. Also populate `skills_impact.demand_growth` as `Record<string, number>` from Lightcast `growth_rate` per skill
- `ai_capability` scores (0.0–1.0) MUST come from `automation_assess` or `workbank_occupation_automation`
- `category` must be one of `"automate"`, `"augment"`, `"human_essential"` — derived from ai_capability thresholds (>0.7 = automate, 0.3–0.7 = augment, <0.3 = human_essential)
- `time_allocation_pct` values should sum to ~100 across all tasks
- `roi_estimate` salary data must come from BLS — cite occupation code
- `market_context.median_salary` must come from `compensation_benchmark` or `bls_occupation_wages`
- `human_edge_factors` must come from `human_edge` (WORKBank) tool results
- When AEI data is available, include `aei_penetration_rate`, `aei_ai_autonomy`, and `aei_time_savings_pct` on each task
- `data_sources` is a string array (plural, snake_case) — NOT `dataSource`
- All field names use **snake_case** — the frontend type guard will reject camelCase

#### org_design
- `currentStructure` and `proposedStructure` MUST reflect actual organizational data
- `metrics.spans_of_control` must be calculated as average direct reports per manager
- `recommendations` must cite specific structural inefficiencies found

#### skills_genome
- All skills MUST come from `skills_extract`, `skills_match`, or Lightcast/O*NET tools
- `proficiency` scores must map to tool-reported levels
- `trending` flag must come from `skills_trending` results
- `demand_growth` percentage MUST come from `lightcast_trending_skills` `growth_rate` field — not fabricated

#### scenario_comparison
- All scenario metrics must be calculated from tool results or user-provided data
- `winner` determination must be explainable from the weighted criteria scores
- `investment` figures must be sourced or estimated with transparent methodology

#### swarm_result
- All agent results must come from actual tool executions
- `duration_ms` must reflect real execution times
- `synthesized_result` must cite specific findings from individual agent results

#### knowledge_graph
- All nodes and edges must come from `kg_visualize` or `kg_query` tool results
- Do not fabricate entity relationships
- `summary` must accurately reflect the node/edge counts returned

#### market_pulse
- All monitor values and deltas must come from `monitor_check` or `monitor_list` tool results
- `trend` arrays must contain real historical snapshot values
- `alerts` must reflect actual threshold violations

#### connector_status
- All connector statuses must come from `connector_list` tool results
- `health` status must reflect actual connectivity test results
- `records_synced` must match the sync engine's reported count

#### predictive_forecast
- `predicted_value` must come from `predict_salary_trend`, `predict_skills_demand`, or `predict_headcount`
- Use `lightcast_demand_forecast` historical demand as input alongside BLS trends for demand-based forecasts
- Confidence intervals must come from Monte Carlo simulation results
- `factors` must cite specific variables used in the predictive model
- `methodology` must accurately describe the statistical methods used

#### talent_marketplace
- All match scores must come from `talent_match_internal` using weighted cosine similarity
- `mobility_score` must come from `talent_mobility_score` with the 40/20/20/20 weighting
- `development_phases` must come from `talent_development_plan` tool
- `bench_strength` categories must come from `talent_bench_strength` analysis

### Insight Card Construction Rules

When building `insight` artifacts:
1. **Minimum 3 sections** — prefer 4-6 sections.
2. **Section selection decision tree**:
   - Have 3+ quantifiable KPIs? → Start with `metrics`
   - Have a single critical finding? → Use `callout` with `variant: "ivy-narrative"`
   - Comparing 2+ options? → Use `comparison`
   - Have tabular data? → Use `table`
   - Have time-series data? → Use `chart` (line/area) or `timeline`
   - Have actionable next steps? → End with `recommendations`
   - Need to explain methodology? → Use `prose` as final section
3. **Every `metrics` item must cite its source**
4. **Every `table` must have real data** — minimum 3 rows
5. **Every `chart` must use tool-sourced data** — if data is sparse, use a `table` instead
6. **`recommendations` must be specific and actionable** — not "Improve skills" but "Complete AWS Solutions Architect certification within 6 months (estimated 80 hours, $300 exam fee)"

### Multi-Artifact Guidance

For complex analyses that span multiple domains, produce MULTIPLE artifacts:
- **Career transition query** → `skill_analysis` + `career_ladder` + `automation_assessment`
- **Competitor hiring query** → `job_analysis` (per company) + `insight` (comparative summary)
- **Workforce planning query** → `workforce_plan` + `skill_analysis` + `insight` (strategic recs)
- **SWP meeting transcript** → Single `insight` artifact following the SWP template (see swp-analysis skill)
- **Role redesign query** → `role_design` + `task_decomposition` + `automation_assessment`

When producing multiple artifacts, introduce each with a brief sentence explaining what it shows and how it connects to the others.

### Thin Data Protocol

When tools return insufficient data:
1. **Disclose immediately** — note limited statistical significance
2. **Show what you have** — include actual data points, even if few
3. **Suggest remediation** — recommend specific follow-up queries
4. **Adjust confidence language** — use "suggests" and "indicates" rather than "shows" and "confirms" when working with <5 data points
5. **Never pad arrays with training data** — if `skills_extract` returns 3 skills, output 3 skills
