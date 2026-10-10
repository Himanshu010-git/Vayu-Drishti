1. Problem, Users, and Core Journey
VayuDrishti (built on top of the PRD's "DustWatch" spec) solves fragmented urban dust-pollution reporting: complaints are scattered, inspectors can't tell which locations are chronic hotspots, and evidence is rarely connected across time. The system turns individual photo reports into structured, evidence-backed investigation dossiers.

Users: Residents (submit reports), Environmental Reviewers (approve/reject inspections), Administrators (optional for MVP).

Journey in one line: Resident submits photo + GPS → AI analyses image → backend scores priority → Strands Agent builds dossier → human reviewer decides → case tracked to resolution.

2. MVP vs Optional
✅ Must-Have
Report submission → S3 image storage → Vision AI analysis (validated JSON) → Nearby report linking → Deterministic priority score → Strands Agent dossier → Reviewer approve/reject → Case status tracking → Map view → Audit log

🔷 Optional (skip for hackathon)
Real JWT auth, Admin panel, CloudWatch wiring, duplicate image detection — all post-MVP.

3. Architecture Summary
React (Vite) + Leaflet
        ↓ REST
FastAPI (Python) — BackgroundTasks for async jobs
    ├── DynamoDB  (4 tables: DustReports, IncidentCases, ReviewDecisions, AuditEvents)
    ├── S3        (private photos + signed URLs)
    ├── Vision AI (Bedrock Claude Haiku → mock fallback)
    ├── Strands Agent (5 read-only tools → structured dossier)
    └── Open-Meteo (free weather API, no key → mock fallback)
4. Key Design Decisions
Decision	Rationale
LocalStack from Day 1	Surfaces AWS issues early without burning real credits
Mock vision_service first	Keeps you unblocked if Bedrock access isn't approved
Bounding-box Scan for geo-queries	DynamoDB has no native geo; this works fine at demo scale
FastAPI BackgroundTasks	Avoids SQS complexity; report returns in <1s, analysis runs async
VISION_PROVIDER env flag	Single flag switches Bedrock ↔ OpenAI ↔ mock
Plain Python tools before Strands wire-up	Validate logic first, SDK wrapper is the last step
5. DynamoDB Tables (Quick Reference)
4 tables: DustReports (PK: report_id), IncidentCases (PK: case_id), ReviewDecisions (PK: decision_id), AuditEvents (PK+SK: event_id + timestamp) — with GSIs for case-based lookups and reviewer queues.

6. Prerequisites Checklist
Before writing any code:

 AWS account + IAM creds with DynamoDB + S3 + Bedrock permissions
 Bedrock model access requested in your region (can take hours — do this now)
 OR OpenAI API key as fallback
 LocalStack installed (pip install localstack or Docker) for local dev
7. Biggest Risks & Mitigations
Risk	Mitigation
AWS access not ready	LocalStack (identical API, local Docker)
Bedrock not approved	VISION_PROVIDER=mock env flag, hardcoded valid response
DynamoDB geo-queries	Bounding-box Scan — document as known limitation
Strands SDK complexity	Implement tools as plain functions first, Strands wrapper last
Vision model returns bad JSON	try/except → set analysis_failed, never block report creation
8. What to Implement First
In this exact order:

config.py — env vars, LocalStack toggle
infrastructure/create_tables.py — create all 4 DynamoDB tables + GSIs
models/report.py — Pydantic models for DustReportCreate + VisualAnalysis
services/s3_service.py — upload + signed URL
services/dynamodb_service.py — create/get/update report
services/vision_service.py — mock only for now
routers/reports.py — POST /reports + GET /reports/{id}
main.py — wire everything up
Test with curl — full POST → S3 → DynamoDB → background analysis cycle
Frontend SubmitReportPage.tsx — form + Leaflet picker