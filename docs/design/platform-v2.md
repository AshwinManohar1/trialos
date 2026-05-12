# Design: Clinical Trial AI Platform

Status: DRAFT
Date: 2026-05-09
Workspace: /Users/ashwinmanohar/Documents/zyvelor/cliantha

---

## Problem Statement

Clinical trials fail at alarming rates: 80% don't recruit required patient cohorts on
time, 44% miss recruitment goals entirely. The core problem is not a shortage of tools —
CTMS platforms (Medidata, Veeva) handle data storage and compliance. The problem is
that every step requiring intelligence is done manually:

1. **Protocol creation**: Trial designers start from blank Word documents or prior
   protocol templates. Eligibility criteria are written by hand, often by committee,
   with no feedback on which criteria will make recruitment impossible until months
   later when enrollment stalls.

2. **Protocol execution**: After creation, someone manually reads the protocol and
   builds a task list in a spreadsheet. Role assignments, visit schedules, deadlines —
   all transcribed by hand. Error-prone. Hours of work per trial.

3. **Patient matching**: Coordinators compare patient charts against eligibility
   criteria one by one, manually. Hundreds of candidates, hours per patient, no
   systematic rationale captured.

4. **Patient outcome prediction**: Nobody can tell a sponsor before enrollment closes
   whether a given patient is likely to drop out. Dropout is a $50K-$100K/day problem.
   No commercial solution exists.

The intelligence layer — which requires reading and generating unstructured documents,
reasoning about patient eligibility, and predicting outcomes — does not exist as a
product. This platform is that layer.

---

## Demand Evidence

- Existing paying order from Cliantha (a trials company) for protocol → task list →
  roster management. Real money. Real relationship. Real pain.
- Research: 42% reduction in screening time with LLM-based patient matching
  (Jin et al. 2024). LLMs save 165–1,329 hours of reviewing time vs manual evaluation.
- Eligibility criteria complexity is directly correlated with trial termination
  (Reinisch et al. 2024). Protocol creation assistance is not just convenience —
  it prevents failed trials.
- Market: eClinical solutions growing from $10.55B (2025) to $36.42B (2035) at 13%
  CAGR. Trial volume increasing — making automation more urgent, not less.
- No commercial solution for patient dropout simulation exists. All current approaches
  are in academic R&D (Corbaux et al. 2024).

---

## Target User

**Primary buyer**: CROs (Contract Research Organizations) and independent research
site networks. Not eClinical vendors (Medidata/Veeva don't buy from startups).
Not pharma sponsors directly (long procurement cycles).

**Beachhead**: Cliantha. Existing trust, existing order, existing pain.

**Who inside the buyer**: Trial designers and study managers who feel the pain of
manual protocol work. They don't need to replace their CTMS — they need an AI layer
that makes them faster and reduces trial failures.

---

## Constraints

- Cannot compete with CTMS infrastructure (Medidata, Veeva) — enhancement only
- Patient data requires HIPAA BAA — comes in Module 3, not Module 1 or 2
- Simulation (Module 4) requires historical outcome data — TrialBench for research
  validation, CRO data partnerships for production accuracy
- Regulatory: FDA 21 CFR Part 11 applies to any system touching trial documentation.
  ICH E6(R3) GCP guidelines. These must be understood but not block Module 1/2.

---

## Competitive Landscape

| Competitor | What they do | Our gap |
|------------|-------------|---------|
| Risklick Protocol AI | Protocol development time reduction | They stop at drafting. We go through execution, matching, and simulation. |
| Phases (YC 2025) | Trial oversight and execution | Similar vision, unclear positioning. Watch closely. |
| Dyania Health | Patient matching from EHRs | Needs hospital partnerships. We start with CROs. |
| BEKHealth | EHR-based patient identification | Accuracy-focused. We differentiate on full pipeline. |
| AIwithCare | Mass General Brigham spinout | Institutional; slow to market. |

**Our differentiation**: Full pipeline. Protocol creation → operational execution plan
→ patient matching → dropout prediction. Competitors own one slice. We own the
workflow from trial design to last patient out.

---

## Architecture

The platform is a B2B API with four sequentially shipped modules. Each module's
output feeds the next. The same API surface built for Module 1 becomes the foundation
for Modules 2, 3, and 4.

```
Trial Designer
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│  Module 1: Protocol Creation                            │
│  Input: therapeutic area, phase, endpoints, constraints │
│  Output: draft protocol (criteria, visits, roles)       │
└────────────────────────┬────────────────────────────────┘
                         │ protocol document (PDF/DOCX)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Module 2: Protocol Intelligence                        │
│  Input: protocol document                               │
│  Output: task list, visit schedule, recruitment risk    │
└────────────────────────┬────────────────────────────────┘
                         │ structured criteria
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Module 3: Patient Matching                             │
│  Input: patient record (FHIR R4), structured criteria   │
│  Output: eligibility verdict, criterion-level rationale │
└────────────────────────┬────────────────────────────────┘
                         │ enrolled patients
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Module 4: Patient Simulation                           │
│  Input: patient characteristics                         │
│  Output: completion likelihood, dropout risk factors    │
└─────────────────────────────────────────────────────────┘
```

---

## Module 1 — Protocol Creation

**When**: Ship first, alongside Module 2.

**Input**: Structured trial parameters provided by the designer:
- Therapeutic area (e.g., Type 2 Diabetes)
- Trial phase (Phase 1 / 2 / 3 / 4)
- Primary and secondary endpoints
- Intervention type (drug, device, behavioral)
- Target population description
- Any known constraints (geography, prior treatments, comorbidities)

**What the LLM does**:
- Drafts inclusion and exclusion criteria appropriate to the therapeutic area and phase
- Scores each draft criterion for recruitment complexity before the designer commits
- Suggests visit schedule with standard procedures for the indicated phase
- Generates role assignments and staffing template
- Flags criteria that historically correlate with enrollment failure (negation
  complexity, lab thresholds, narrow time windows)

**Output**: A structured protocol draft in the same JSON schema as Module 2, so it
can flow directly into Module 2 for operational planning. The designer can edit,
accept, or reject individual criteria before finalizing.

**Hallucination guard**: Each suggested criterion is tagged with its basis:
`"source": "standard_phase2_oncology"` or `"source": "designer_input"`. Criteria
without a traceable basis are flagged for designer review before the protocol is saved.

**API surface**:
```
POST /v1/protocol/create
  Body: { "therapeutic_area": "string", "phase": "1|2|3|4", "endpoints": [...],
          "constraints": [...] }
  Returns: { "job_id": "string" }

GET /v1/protocol/{job_id}/draft
  Returns: full protocol JSON schema (same as Module 2 output)

PATCH /v1/protocol/{job_id}/draft
  Body: partial protocol JSON (designer edits)
  Returns: updated draft

POST /v1/protocol/{job_id}/finalize
  Locks the draft and triggers Module 2 processing
```

---

## Module 2 — Protocol Intelligence

**When**: Ship first, alongside Module 1.

**Input**: Trial protocol document (PDF or DOCX) — either finalized from Module 1
or uploaded by the user.

**PDF parsing**:
- Digital PDFs: PyMuPDF or pdfplumber for text extraction
- Scanned/image PDFs: OCR fallback via Tesseract or AWS Textract
- Protocols can reach 100-400 pages; chunk by section headers, not page count

**LLM extraction** (claude-sonnet-4-6 with structured output / tool_use):
- Study title, phase, therapeutic area, sponsor
- Primary and secondary endpoints
- Inclusion criteria (each tagged with criterion type + complexity score)
- Exclusion criteria (same)
- Visit schedule (visit name, timing, required procedures per visit)
- Required study roles

**Output schema (JSON)**:
```json
{
  "protocol_id": "string",
  "extracted_at": "ISO8601",
  "study": { "title": "string", "phase": "string", "therapeutic_area": "string" },
  "criteria": {
    "inclusion": [{
      "id": "I1",
      "text": "string",
      "complexity_score": 0,
      "complexity_flags": ["negation", "lab_threshold", "prior_treatment"],
      "source_citation": { "page": 12, "quote_fragment": "string" }
    }],
    "exclusion": [{ "id": "E1", "text": "string", "complexity_score": 0,
                    "complexity_flags": [], "source_citation": { "page": 14, "quote_fragment": "string" } }]
  },
  "visits": [{ "name": "string", "day": 0, "procedures": ["string"] }],
  "task_list": [{
    "task_id": "string",
    "description": "string",
    "assigned_role": "coordinator|PI|sponsor|IRB",
    "due": "relative_to_enrollment|fixed_date",
    "visit_ref": "string|null"
  }],
  "roster_template": [{ "role": "string", "required_count": 0, "qualifications": "string" }],
  "recruitment_risk": {
    "score": 0,
    "top_risk_criteria": ["I3", "E7"],
    "rationale": "string"
  }
}
```

**Hallucination guard**: Every extracted criterion includes `source_citation` (page
number + quote fragment from the source PDF). Hallucinated criteria have no traceable
citation — coordinators can spot them by checking the citation against the document.

**Complexity scoring**: Each criterion scored 0-10 on:
- Negation complexity ("no prior use of X within 6 months" → hard to verify)
- Lab threshold requirements (specific numeric values needing lab records)
- Time-window constraints (prior treatment within N months)
- Subjective assessments ("clinically significant" without definition)

Aggregated to trial-level `recruitment_risk.score`. Basis: Reinisch et al. 2024.

**Error handling**:
- Unparseable PDF → `{ "error": "parse_failed", "reason": "string" }`
- LLM extraction confidence below threshold → field flagged `"confidence": "low"`
- Partial extraction → return what was extracted with `"extraction_status": "partial"`
- Claude content refusal → `{ "error": "llm_refused", "reason": "string" }`, log and
  alert; do not silently return empty output
- Empty Claude response → retry once; if still empty, return `"error": "llm_empty"`

**API surface**:
```
POST /v1/protocol/extract
  Body: { "file_url": "string" } or multipart file upload
  Returns: { "job_id": "string" }

GET /v1/protocol/{job_id}/status
  Returns: { "status": "pending|processing|complete|failed", "result_url": "string" }

GET /v1/protocol/{job_id}/result
  Returns: full JSON schema above

POST /v1/protocol/{job_id}/webhook
  Register a callback URL for async completion notification
  Webhook delivery: retry 3x with exponential backoff; result persists for poll fallback
```

---

## Module 3 — Patient Matching

**When**: After Module 1/2 have 2 paying customers in production.

**Input**:
- Structured protocol criteria (from Module 2 output)
- Patient record (FHIR R4 format)

**What it does**:
- Evaluates the patient against each inclusion and exclusion criterion individually
- Returns a verdict per criterion: `eligible | ineligible | insufficient_data`
- Provides a natural-language rationale for each verdict the coordinator can read
- Aggregates to a trial-level eligibility decision

**Requires**:
- HIPAA BAA with any customer handling patient data
- FHIR R4 client for EHR integration
- Vector store for protocol criteria (semantic search for matching)

**API surface**:
```
POST /v1/match
  Body: { "protocol_id": "string", "patient": { ...FHIR R4 patient resource... } }
  Returns: { "job_id": "string" }

GET /v1/match/{job_id}/result
  Returns: {
    "overall": "eligible|ineligible|insufficient_data",
    "criteria": [{ "criterion_id": "I1", "verdict": "eligible", "rationale": "string" }]
  }
```

**Gate for Module 4**: 30%+ reduction in manual screening time measurable in
coordinator hours per pilot site.

---

## Module 4 — Patient Simulation

**When**: After data partnerships + TrialBench validation.

**Input**: Patient characteristic profile (age, comorbidities, prior medications,
demographics, relevant biomarkers).

**Output**:
- Predicted trial completion likelihood (0-100%)
- Dropout risk factors ranked by contribution
- Historical cohort comparables from training data

**Training path**:
1. TrialBench (public, multi-modal AI-ready dataset, 23 tasks including patient
   dropout rate prediction) — used first for research validation before CRO data
2. CRO data partnerships — production accuracy

**Gate**: Do not sell this module until dropout prediction accuracy exceeds 70%
on held-out TrialBench data. Publish the number.

**Moat**: A single prevented dropout at $50K/trial-day makes the ROI calculation
trivial. This is the module nobody has shipped commercially.

---

## Pricing

| Model | Amount | Rationale |
|-------|--------|-----------|
| Per-seat | $500–$2,000/month | CROs with 5-20 study managers; predictable ARR |
| Per-trial | $2,000–$5,000/trial | Aligns incentives; sponsor pays per trial they run |

Do NOT price per-protocol-processed. $200-500/protocol → ~$2K/year per customer.
Per-seat/per-trial → $6K-$60K ARR per customer.

At $3K/trial and 50 trials/year per CRO customer: $150K ARR per customer.
At 400,000 active trials globally: the ceiling is enormous.

---

## Distribution

B2B API first. No direct-to-hospital or direct-to-pharma sales initially.

- **Module 1/2**: REST API + webhook. Trial company embeds in their workflow.
- **Module 3**: White-label API. Trial software vendors embed; they handle the
  hospital relationship.
- **Module 4**: Enterprise deal with CRO or pharma sponsor. Requires data sharing
  agreement. Annual contract tied to trial volume.

No consumer play. No Epic App Market until clinical validation data exists.

---

## Build Sequence

### Pre-Build (Week 0 — Before any production code)
Run Claude API extraction prompt directly against the 5 real protocol PDFs in
`activity-docs/`. Validate: does the JSON output match what Cliantha would find
useful? Show to Cliantha before writing production code.

### Module 1 + 2 (Weeks 1–8)
- Week 1-2: PDF parser + OCR fallback + Claude extraction prompt
- Week 3-4: API endpoints, webhook delivery, error handling
- Week 5-6: Complexity scoring, recruitment_risk, protocol creation endpoint
- Week 7-8: Pilot with Cliantha, iterate on schema

### TrialBench Research (Weeks 1–12, parallel)
- Download TrialBench dataset
- Run dropout prediction experiments
- Target: 65%+ accuracy on held-out data as a demo-able result
- This becomes the concrete Module 4 accuracy claim before investor conversations

### Module 3 (After 2 paying customers)
- FHIR R4 integration
- Patient-criterion matching with rationale
- HIPAA BAA required

### Module 4 (After TrialBench validation + data partnerships)
- Dropout prediction model
- Gate: 70% accuracy on held-out data before commercial release

---

## Success Criteria

- **Module 1/2**: Cliantha goes live within 8 weeks. Second B2B customer signs
  within 3 months of shipping.
- **Module 3**: 30%+ reduction in manual screening time for pilot site.
- **Module 4**: Dropout prediction accuracy > 70% on held-out historical data
  before selling to any sponsor.

---

## Open Questions

1. Does Cliantha want to help design the protocol creation flow (Module 1)?
   Their input on what parameters they start from will shape the UX.
2. What EHR format does Cliantha's clients use? FHIR compliance level determines
   Module 3 integration complexity.
3. Does Cliantha have historical trial outcome data they'd share for Module 4?
   This is the critical unlock for production simulation accuracy.
4. Regulatory posture for Module 4: FDA SaMD classification or "decision support
   only"? Determines what clinical validation is required before selling.

---

## Dependencies

- Claude API (claude-sonnet-4-6) — extraction, creation, matching reasoning
- PyMuPDF or pdfplumber — PDF text extraction
- Tesseract or AWS Textract — OCR fallback for scanned protocols
- FHIR R4 client — EHR integration (Module 3+)
- TrialBench dataset — dropout prediction research (Module 4)
- HIPAA BAA — required before any patient data flows (Module 3+)
- Legal: HIPAA BAA with customers; FDA 21 CFR Part 11 awareness (Module 3+)
