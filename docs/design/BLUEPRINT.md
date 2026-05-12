# Clinical Trial AI Platform — Full Blueprint

**Status**: Living Document  
**Date**: 2026-05-09  
**Client / Beachhead**: Cliantha  
**Product Name**: TBD  

This document is the complete technical and product blueprint for the platform.
It describes every module: what problem it solves, how the industry does it today
manually, exactly what inputs go in, exactly what outputs come out, how the AI
processes it, and what the API looks like. Anyone reading this should be able to
understand the full system without asking a follow-up question.

---

## Table of Contents

1. [What This Platform Is](#1-what-this-platform-is)
2. [Who Uses It](#2-who-uses-it)
3. [How a Clinical Trial Works (Context)](#3-how-a-clinical-trial-works-context)
4. [Module 1 — Protocol Creation](#4-module-1--protocol-creation)
5. [Module 2 — Protocol Intelligence](#5-module-2--protocol-intelligence)
6. [Module 3 — Patient Matching](#6-module-3--patient-matching)
7. [Module 4 — Patient Simulation](#7-module-4--patient-simulation)
8. [The Shared Protocol Schema](#8-the-shared-protocol-schema)
9. [API Architecture](#9-api-architecture)
10. [Pricing Model](#10-pricing-model)
11. [Competitive Landscape](#11-competitive-landscape)
12. [Build Sequence and Milestones](#12-build-sequence-and-milestones)
13. [Regulatory Considerations](#13-regulatory-considerations)
14. [Open Decisions](#14-open-decisions)

---

## 1. What This Platform Is

A B2B API platform that applies AI to the four most expensive, error-prone, and
time-consuming tasks in running a clinical trial:

```
TRIAL LIFECYCLE:
                    ┌──────────────────────────────────────────────────┐
                    │           What this platform does                │
                    └──────────────────────────────────────────────────┘
                           │              │             │           │
                    ┌──────▼──────┐ ┌────▼──────┐ ┌───▼─────┐ ┌──▼────────┐
                    │  Module 1   │ │ Module 2  │ │Module 3 │ │ Module 4  │
                    │  Protocol   │ │ Protocol  │ │Patient  │ │ Patient   │
                    │  Creation   │ │Intelligence│ │Matching │ │Simulation │
                    └─────────────┘ └───────────┘ └─────────┘ └───────────┘
                    Draft the       Extract ops    Match        Predict if
                    trial protocol  plan from it   patients     they'll finish
```

The platform is an **enhancement layer**. It does not replace existing CTMS software
(Medidata, Veeva). It plugs into existing workflows and adds the AI intelligence
layer those systems were never designed to provide.

Revenue model: per-seat ($500–2,000/month) or per-trial ($2,000–5,000/trial).
Target buyers: CROs and independent research site networks.

---

## 2. Who Uses It

### Primary Buyer: CROs (Contract Research Organizations)

A CRO is a company that pharma/biotech sponsors hire to run their clinical trials.
The CRO handles everything operational: recruiting sites, managing coordinators,
collecting data, ensuring regulatory compliance. Cliantha is a CRO.

CROs approve $10,000–$50,000 purchases without a procurement committee.
They feel every problem this platform solves directly in their operating costs.

### Secondary Buyer: Independent Research Site Networks

Networks of clinical research sites (hospitals, specialty clinics) that run trials
across multiple locations. Similar pain profile to CROs.

### Who Inside the Buyer

| Role | Which module | Pain we solve |
|------|-------------|---------------|
| Trial Designer / Clinical Scientist | Module 1 | Writes protocols from scratch; 4–6 weeks of document work |
| Medical Writer | Module 1 | Assembles and edits the full protocol document |
| Study Manager / Clinical Operations | Module 2 | Manually rebuilds the protocol into a spreadsheet task list |
| Recruitment Coordinator | Module 2, 3 | Matches patients against criteria by reading paper charts |
| Principal Investigator (PI) | Module 3 | Reviews eligibility decisions; currently no audit trail |
| Sponsor (pharma/biotech) | Module 4 | Loses $50K–$100K per day when patients drop out |

### Who We Do NOT Sell To (at first)
- Medidata, Veeva, or other eClinical vendors — they don't buy from startups
- Hospitals directly — long procurement cycles, IT approvals required
- Pharma sponsors directly — 6–12 month procurement, not right for early stage

---

## 3. How a Clinical Trial Works (Context)

Understanding the lifecycle makes every module's purpose clear.

### Step 1: Protocol Design
A sponsor (pharma company) decides to test a drug. They hire a CRO. The CRO's
clinical scientists write the **trial protocol** — a 40–400 page document that is
the complete rulebook for the trial. It defines:
- What the drug is and what it's supposed to do
- Who can participate (inclusion/exclusion criteria)
- What tests patients undergo and when (Schedule of Events)
- Who does what and when (roles and tasks)
- What data is collected and how (endpoints)
- How many patients are needed (sample size / statistical plan)
- What counts as success or failure

This document goes to the ethics board (IRB/IEC) and the regulatory agency
(FDA, EMA, etc.) for approval before a single patient is enrolled.

**The problem**: Writing this document takes 4–6 weeks for a BE study and
3–6 months for a Phase 2/3 trial. 60% of protocols are amended after approval
(adding weeks per amendment) due to internal inconsistencies caught too late.

### Step 2: Site Setup and Operational Planning
After the protocol is approved, the CRO's operations team reads it and manually
rebuilds its contents into spreadsheets:
- Task list (who does what, by when)
- Role assignments (how many coordinators, PIs, nurses needed)
- Visit schedule (what happens at each patient visit)

**The problem**: This is pure transcription of information already in the protocol.
Hours of high-skilled time that adds zero scientific value, with frequent errors
that cause protocol deviations.

### Step 3: Patient Recruitment
Sites identify candidate patients. Coordinators read the eligibility criteria
list and compare it against each patient's medical chart — hours per patient,
across hundreds of candidates. No systematic record of why each patient was
accepted or rejected is kept.

**The problem**: 80% of trials don't recruit required patient cohorts on time.
44% miss recruitment goals entirely. The eligibility screening step is the
primary bottleneck.

### Step 4: Patient Retention
Once enrolled, some patients drop out before completing the trial. Dropout
invalidates data, delays trials, and costs $50,000–$100,000 per trial day.
Nobody can currently predict which patients are likely to drop out before
they stop showing up.

**The problem**: No commercial tool for dropout prediction exists.
All current approaches are in academic R&D.

---

## 4. Module 1 — Protocol Creation

### The Problem It Solves

A trial designer (clinical scientist or medical writer) at a CRO currently:
1. Opens a prior protocol from a similar study and starts deleting and editing
2. Or opens a blank template (e.g., TransCelerate Common Protocol Template)
3. Spends 4–6 weeks authoring the full document, with multiple rounds of
   review from clinical, stats, regulatory, operations, safety, and legal teams
4. Submits to IRB/IEC, often with errors that require amendments later

The two sections that take the most time and cause the most errors:
- **Eligibility criteria**: must be derived from the drug's safety profile,
  regulatory precedents, and feasibility constraints — a multi-week negotiation
- **Schedule of Events**: must cross-reference every endpoint, safety requirement,
  and eligibility criterion — mismatches here are the #1 cause of amendments

### How the Manual Process Works Today (Step by Step)

**Inputs assembled before writing starts:**
1. **Investigator's Brochure (IB)** — the master reference document containing
   all nonclinical and clinical data on the drug: pharmacology, toxicology,
   PK/PD profile, prior human data, known safety findings. Every safety-based
   exclusion criterion is derived from this document.
2. **Target Product Profile (TPP)** — the commercial and regulatory target
   that frames the trial's design choices (what the drug needs to prove).
3. **Prior phase study reports** — Phase 1 data informing dose selection and
   target population.
4. **Regulatory meeting minutes** — FDA/EMA feedback on design and endpoints
   from pre-IND or Type B meetings.
5. **Disease-specific regulatory guidance** — FDA guidance documents for
   the specific indication.
6. **Feasibility data** — site capability assessments, patient pool estimates.

For **Cliantha's BE studies specifically** (generic drug bioequivalence), the
inputs are more structured and predictable:
1. Test product (the generic drug being developed)
2. Reference product (the brand drug, including country of origin)
3. Drug formulation and dose
4. Regulatory submission targets (EMA / FDA / MHRA / Health Canada)
5. Study design (2-period or 3-period crossover — driven by regulatory targets)
6. Target population (healthy volunteers, age range, BMI range, sex)
7. Any special pharmacological considerations (e.g., glucose monitoring for
   SGLT2 inhibitors, posture restrictions for certain drug classes)
8. Number of participants (or calculated from standard BE power requirements)

**Who writes what:**

| Role | What they contribute |
|------|---------------------|
| Clinical Scientist (MD/PhD) | Study design, endpoints, eligibility criteria, scientific rationale |
| Medical Writer | Full document assembly, regulatory language, internal consistency |
| Biostatistician | Sample size, statistical analysis plan, randomization |
| Regulatory Affairs | Jurisdiction-specific requirements (EMA vs FDA vs MHRA vs Health Canada) |
| Clinical Operations | Visit schedule, site feasibility |
| Pharmacovigilance / Safety MD | AE definitions, safety monitoring thresholds |

**The 16 required sections (ICH E6(R3) Appendix B):**

| Section | Contents |
|---------|---------|
| B.1 General Information | Title, protocol number, date, sponsor info, signatories |
| B.2 Background | Drug description, nonclinical findings, known risks/benefits, dosing rationale |
| B.3 Objectives | Primary/secondary objectives, estimands (ICH E9(R1)) |
| B.4 Trial Design | Design type, endpoints, blinding, randomization, Schedule of Events, stopping rules |
| B.5 Eligibility Criteria | Inclusion list, exclusion list, screening mechanisms |
| B.6 Withdrawal | When/how to discontinue, data handling for dropouts, replacement procedures |
| B.7 Treatment | Doses, schedules, permitted/prohibited medications, adherence monitoring |
| B.8 Efficacy Assessment | PK/PD parameters, timing, methods |
| B.9 Safety Assessment | AE recording, SAE reporting, follow-up procedures |
| B.10 Statistical Considerations | Sample size + power, analysis populations, missing data handling |
| B.11 Source Data Access | Audit trail and source document access requirements |
| B.12 Quality Control | Risk mitigation, monitoring approach, critical-to-quality factors (new in E6 R3) |
| B.13 Ethics | IRB/IEC requirements, informed consent, Declaration of Helsinki |
| B.14 Data Handling | eCRF, data management, record keeping |
| B.15 Financing & Insurance | Compensation, liability |
| B.16 Publication Policy | Data sharing, authorship |

For BE studies, additional mandatory sections include:
- Facilities declarations (clinical, laboratory, analytical, PK/statistics)
- Randomization and drug administration procedure
- Blood sample collection and handling procedure
- Detailed pharmacokinetic sampling schedule (time points relative to dosing)
- Blood volume calculations (total blood drawn across the study)

**How eligibility criteria are written (the 6-step manual process):**

1. **Define the target population scientifically** — Who does the drug benefit?
   For BE studies: always healthy volunteers, standard age/BMI ranges.
   For novel drug trials: derived from the mechanism of action and the IB.

2. **Map IB safety data to exclusion criteria** — Every known toxicity from
   nonclinical and prior clinical studies drives an exclusion criterion.
   Example: hepatotoxicity signal in animal studies → exclude patients with
   elevated ALT/AST at baseline.

3. **Apply regulatory precedents** — Prior protocols in the same indication,
   FDA guidance documents, EORTC/cooperative group standards provide default
   language. Many criteria are boilerplate (e.g., "adequate organ function"
   criteria are near-identical across oncology protocols).

4. **Negotiate feasibility** — Regulatory and clinical operations challenge
   overly narrow criteria. Too strict = enrollment impossible. This negotiation
   is often the longest part of protocol writing.

5. **Align with the Schedule of Events** — Every criterion that requires a test
   (lab value, ECG, imaging) must map to an assessment at the screening visit.
   Misalignment here is the most common source of protocol amendments.

6. **Site review** — Sites flag criteria that are impractical on the ground:
   tests not available, time windows too tight, threshold values inconsistent
   with local lab normal ranges.

**How the Schedule of Events is built manually:**

The Schedule of Events (SoE) is a table where:
- Rows = every required procedure (informed consent, vital signs, ECG, blood
  draws, PK samples, imaging, questionnaires, drug dispensing, AE collection)
- Columns = every trial visit (Screening, Day 1, Week 2, Month 3, End of
  Treatment, Follow-up 1, Follow-up 2, Safety Follow-up)
- Each cell indicates whether that procedure occurs at that visit

Created manually in 7 steps:
1. Start from each endpoint — it needs an assessment — put it in the table
2. Map safety monitoring from the drug's toxicity profile
3. Add PK sampling time points relative to dosing
4. Set visit windows (realistic for patients, scientifically valid)
5. Cross-check every eligibility criterion requiring a test appears at Screening
6. Feasibility review by sites (is the visit burden realistic for patients?)
7. Regulatory review (are safety monitoring frequency and time points adequate?)

Most common SoE errors:
- Procedure in body text but missing from the SoE table (or vice versa)
- PK sampling windows inconsistent with the dosing schedule
- Screening window too narrow to complete all required assessments
- Follow-up duration insufficient to capture late-onset adverse events

---

### What Our System Does

**User inputs (for a BE study like Cliantha's):**

```
Required:
  - drug_name: "Empagliflozin"
  - drug_dose: "25 mg"
  - drug_formulation: "film-coated tablet"
  - reference_product: { name: "Jardiance 25 mg", country: "EU" }
  - regulatory_targets: ["EMA", "MHRA-UK"]
  - study_design: "two-period two-treatment crossover"
  - population: { type: "healthy_volunteers", age_min: 18, age_max: 55,
                  bmi_min: 18.5, bmi_max: 30.0, sex: "male_and_female" }
  - participants: 24

Optional:
  - special_pharmacology: ["glucose_monitoring", "sglt2_inhibitor_precautions"]
  - washout_days: 4
  - housing_hours_pre_dose: 11
  - housing_hours_post_dose: 24
  - pk_timepoints: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 10, 12, 16, 24, 36, 48]
  - investigator_brochure_url: "string (PDF URL)"
```

**What the LLM generates from those inputs:**

| Protocol Section | How It's Generated |
|-----------------|-------------------|
| B.1 General Information | From input fields — drug name, sponsor, date |
| B.2 Background | From drug class knowledge + IB if uploaded |
| B.3 Objectives | Standard BE objectives (Cmax, AUCt, AUCi within 80-125%) templated per design type |
| B.4 Trial Design | From study_design input → standard crossover design description |
| B.4.6 Schedule of Events | Generated by cross-referencing: PK timepoints, BE endpoint requirements, standard safety monitoring, glucose monitoring if flagged |
| B.5 Inclusion Criteria | From population parameters + standard healthy volunteer inclusions |
| B.5 Exclusion Criteria | From drug class safety profile + special_pharmacology flags + standard exclusions |
| B.6 Withdrawal | Standard template per jurisdiction |
| B.7 Treatment | From dose, formulation, route, crossover period, washout |
| B.8 Efficacy (PK) | Standard BE assessment section |
| B.9 Safety | From special_pharmacology flags (e.g., hypoglycemia monitoring thresholds) |
| B.10 Statistical | Standard BE stats template: 90% CI, 80-125% bounds, 80% power, sample size formula |
| B.11-B.16 | Templated per jurisdiction (EMA vs MHRA vs FDA vs Health Canada) |

**Internal consistency check (automated, before finalization):**
- Every exclusion criterion requiring a lab test → must appear in SoE at Screening
- Every PK timepoint in the sampling schedule → must appear in SoE
- Every special pharmacology flag → must have corresponding safety assessment in SoE
- Errors surface as a list of inconsistencies the designer must resolve before
  the protocol can be finalized

**Output format:**
The finalized protocol is exported in two formats:
1. **ICH M11 CeSHarP structured XML/JSON** — the regulatory standard for
   machine-readable electronic protocols (Step 4, November 2025). Directly
   submittable to regulators. No other tool in the market outputs this today.
2. **Human-readable document** (DOCX/PDF) for internal review and submission

**Hallucination guard:**
Every AI-generated criterion is tagged with its basis:
- `"basis": "standard_healthy_volunteer"` — standard criterion for the population type
- `"basis": "drug_class_safety"` — derived from known drug class safety profile
- `"basis": "regulatory_precedent_EMA"` — from EMA guidance for this indication
- `"basis": "special_pharmacology"` — flagged from special_pharmacology input
- `"basis": "designer_input"` — explicitly provided by the user

Criteria without a traceable basis are flagged for mandatory designer review
before the protocol can be finalized.

---

### Module 1 API Contract

```
POST /v1/protocol/create
  Request body:
    {
      "drug_name": "string",
      "drug_dose": "string",
      "drug_formulation": "string",
      "reference_product": { "name": "string", "country": "string" },
      "regulatory_targets": ["EMA", "FDA", "MHRA", "Health Canada"],
      "study_design": "string",
      "population": { ... },
      "participants": 24,
      "special_pharmacology": ["string"],
      "investigator_brochure_url": "string (optional)"
    }
  Response:
    { "job_id": "string", "estimated_seconds": 60 }

GET /v1/protocol/{job_id}/draft
  Response: Full protocol JSON (see Section 8 — Shared Schema)

PATCH /v1/protocol/{job_id}/draft
  Request body: Partial protocol JSON with designer edits
  Response: Updated draft + re-run consistency check results

GET /v1/protocol/{job_id}/consistency-check
  Response:
    {
      "passed": false,
      "issues": [
        {
          "type": "criterion_missing_from_soe",
          "criterion_id": "E4",
          "criterion_text": "ALT/AST > 2x ULN at screening",
          "message": "This criterion requires a liver function test at screening but no LFT appears in the Schedule of Events at the Screening visit."
        }
      ]
    }

POST /v1/protocol/{job_id}/finalize
  Locks the draft, runs final consistency check (blocks if issues remain)
  Response: { "protocol_id": "string", "m11_url": "string", "docx_url": "string" }
```

---

## 5. Module 2 — Protocol Intelligence

### The Problem It Solves

After a protocol exists (created in Module 1, or uploaded as an existing PDF),
the operations team must:
1. Read the entire protocol (40–400 pages)
2. Build a task list in a spreadsheet: who does what, by when
3. Assign roles to each task
4. Rebuild the visit schedule in their CTMS
5. Identify which eligibility criteria are most likely to cause recruitment problems

All of this information is already in the protocol. The operations team is doing
pure transcription with a high error rate.

### How the Manual Process Works Today

After protocol approval, a clinical operations manager receives the protocol PDF.
They:
1. Read the entire document (often 100+ pages for a Phase 2/3 study)
2. Open a spreadsheet and start listing tasks
3. Assign each task to a role: coordinator, PI, sponsor monitor, IRB
4. Estimate deadlines (often relative to enrollment date or visit date)
5. Separately extract the visit schedule into their CTMS

This typically takes 1–2 days for a BE study and 3–5 days for a complex trial.
Errors in task lists cause protocol deviations (a serious regulatory finding).

No systematic recruitment risk assessment is done — coordinators learn which
criteria are difficult only after enrollment stalls.

### What Our System Does

**Input:**
A trial protocol document — either a finalized protocol from Module 1, or
any uploaded PDF or DOCX.

**PDF parsing pipeline:**
```
PDF/DOCX uploaded
       │
       ▼
Is it a digital PDF?
├─ Yes → PyMuPDF / pdfplumber text extraction
│        Chunk by section headers (not page count)
│        Protocols are 40–400 pages; section-based chunking
│        preserves context across pages
└─ No (scanned/image) → OCR via Tesseract (open-source)
                         or AWS Textract (higher accuracy,
                         cloud-based, costs ~$1.50/1000 pages)
```

**LLM extraction pipeline:**
The extracted text is sent to Claude (claude-sonnet-4-6) with structured output
(tool_use / JSON mode). The LLM identifies and extracts:

| Field | What it extracts |
|-------|-----------------|
| Study metadata | Title, phase, therapeutic area, sponsor, design |
| Endpoints | Primary (PK parameters for BE: Cmax, AUCt, AUCi) and secondary |
| Inclusion criteria | Each criterion as a separate object with text + complexity analysis |
| Exclusion criteria | Same as above |
| Visit schedule | Each visit: name, day number, list of procedures |
| Task list | Each operational task: description, role assignment, due date, visit reference |
| Roster template | Each required role: count needed, qualification requirements |
| Recruitment risk | Overall score + which criteria are highest risk + rationale |

**Complexity scoring for each criterion:**

Each eligibility criterion is scored 0–10 based on four factors:

```
Factor                          Score contribution   Example
─────────────────────────────────────────────────────────────────────────
Negation complexity             +3                   "No prior use of X within
                                                     6 months"
Lab threshold requirement       +3                   "Hemoglobin ≥ 10 g/dL"
Time-window constraint          +2                   "Washout of 14 days from
                                                     prior treatment"
Subjective term without         +2                   "Clinically significant
a defined threshold                                  cardiovascular disease"
─────────────────────────────────────────────────────────────────────────
Maximum score:                  10
```

The top 3 highest-scoring criteria are flagged in `recruitment_risk.top_risk_criteria`.
The overall `recruitment_risk.score` is the average of the top 3, rounded to the
nearest integer.

Scientific basis: Reinisch et al. 2024 showed that eligibility criteria complexity
is directly correlated with trial termination.

**Hallucination guard:**

Every extracted criterion includes a `source_citation`:
```json
{
  "id": "E4",
  "text": "ALT or AST > 2 times upper limit of normal",
  "complexity_score": 3,
  "complexity_flags": ["lab_threshold"],
  "source_citation": {
    "page": 18,
    "quote_fragment": "AST or ALT greater than 2 times the upper limit"
  }
}
```

The `quote_fragment` is 8–15 words copied verbatim from the source PDF.
If a criterion was hallucinated (invented by the LLM), its quote fragment
will not appear in the source document when a coordinator checks page 18.
Hallucinations surface as citations that don't exist, rather than silently
entering the task list.

**Error handling taxonomy:**

| Error type | When it occurs | Response |
|-----------|---------------|----------|
| `parse_failed` | PDF is corrupted, password-protected, or empty | `{ "error": "parse_failed", "reason": "string" }` |
| `ocr_failed` | Scanned PDF, OCR returns insufficient text | `{ "error": "ocr_failed", "reason": "string" }` |
| `llm_refused` | Claude's content policy blocks processing | `{ "error": "llm_refused", "reason": "string" }` — log and alert |
| `llm_empty` | Claude returns empty response | Retry once; if still empty → `{ "error": "llm_empty" }` |
| `partial` | Some sections not found | Return extracted sections + `"extraction_status": "partial"` + `"missing_sections": ["B.10"]` |
| `confidence_low` | Field extracted with low confidence | Field returned with `"confidence": "low"` flag |

**Webhook delivery:**
- Client registers a callback URL via `POST /v1/protocol/{job_id}/webhook`
- On job completion, platform POSTs the result to the callback URL
- Retry policy: 3 attempts with exponential backoff (30s, 90s, 270s)
- Result persists on the platform for polling fallback indefinitely
  (or per customer retention policy)
- Webhook payload includes a `X-Signature-SHA256` header for verification

---

### Module 2 API Contract

```
POST /v1/protocol/extract
  Request: multipart/form-data with file OR { "file_url": "string" }
  Response: { "job_id": "string", "estimated_seconds": 30 }

GET /v1/protocol/{job_id}/status
  Response: {
    "status": "pending | processing | complete | failed",
    "progress": "parsing | extracting | scoring | done",
    "result_url": "string (populated when complete)"
  }

GET /v1/protocol/{job_id}/result
  Response: Full protocol JSON (see Section 8 — Shared Schema)

POST /v1/protocol/{job_id}/webhook
  Request: { "url": "string", "secret": "string (for HMAC signing)" }
  Response: { "webhook_id": "string" }

DELETE /v1/protocol/{job_id}/webhook/{webhook_id}
```

---

## 6. Module 3 — Patient Matching

### The Problem It Solves

A clinical coordinator at a research site has a list of potential patients.
For each patient, they must:
1. Pull the patient's medical chart (paper or EMR)
2. Read each eligibility criterion from the printed protocol
3. Check whether the patient satisfies the criterion from their chart
4. Document the decision

This takes 1–3 hours per patient. A typical BE study might screen 60–80 patients
to enroll 24. That's 60–240 coordinator hours of screening per study — for work
that is essentially a comparison operation between two structured datasets.

80% of clinical trials fail to recruit on time. Patient screening bottleneck is
the primary cause.

### How the Manual Process Works Today

No software assists this process. The coordinator:
1. Opens the protocol PDF and navigates to the eligibility criteria section
2. Opens the patient's chart in the EMR (if electronic) or retrieves paper records
3. Goes criterion by criterion:
   - "Is patient 18-55 years old?" → check DOB in chart → Yes ✓
   - "BMI 18.5-30 kg/m²?" → check most recent weight/height → calculate → Yes ✓
   - "No active hepatitis B or C?" → check infection history → Yes ✓
   - "ALT/AST within normal limits?" → check most recent lab results → check date →
     lab is 6 months old → need new labs → reschedule patient ✗
4. Documents the result (often in a paper screening log)
5. Moves to the next patient

The coordinator makes decisions based on incomplete data (old labs), memory, and
individual interpretation of criterion wording. No rationale is recorded. No
systematic audit trail exists.

### What Our System Does

**Input:**
- `protocol_id` — references the structured criteria from Module 2
- Patient record in FHIR R4 format (the international standard for health data
  exchange that most modern EMRs support)

**FHIR R4 patient data used:**
```
Patient resource:         Age, sex, BMI (weight + height observations)
Condition resources:      Active and historical diagnoses (ICD-10 codes)
Observation resources:    Lab results with dates (CBC, LFTs, renal function, etc.)
MedicationStatement:      Current and prior medications, dose, duration
AllergyIntolerance:       Drug allergies
Procedure resources:      Prior procedures and surgeries
FamilyMemberHistory:      Relevant family history
```

**What the LLM does:**

For each eligibility criterion, the LLM receives:
1. The criterion text (from the structured protocol schema)
2. The relevant sections of the patient's FHIR record
3. Instructions to return a structured verdict with rationale

```
Criterion: "ALT or AST must not exceed 2x upper limit of normal at screening"
complexity_score: 3, flags: ["lab_threshold"]

Patient data: Observation (ALT = 28 U/L, date: 2026-04-15, lab normal range: 7-40 U/L)
              Observation (AST = 22 U/L, date: 2026-04-15, lab normal range: 10-40 U/L)

LLM verdict:
{
  "criterion_id": "E4",
  "verdict": "eligible",
  "rationale": "Patient's most recent ALT (28 U/L, 2026-04-15) and AST (22 U/L,
               2026-04-15) are both within normal range (7-40 and 10-40 U/L
               respectively). Neither exceeds 2x the upper limit of normal (80 and
               80 U/L). Lab values are 24 days old — within acceptable screening
               window.",
  "data_used": ["Observation/ALT-2026-04-15", "Observation/AST-2026-04-15"],
  "confidence": "high"
}
```

**Verdict taxonomy:**

| Verdict | Meaning |
|---------|---------|
| `eligible` | Patient satisfies this criterion based on available data |
| `ineligible` | Patient does not satisfy this criterion — cannot enroll |
| `insufficient_data` | Patient record does not contain the data needed to evaluate this criterion |

`insufficient_data` is critical: it tells the coordinator what additional data
to collect, rather than defaulting to ineligible and potentially screening out
a patient who would qualify.

**Aggregate decision:**
- If any criterion returns `ineligible` → patient is `ineligible` overall
- If all criteria return `eligible` → patient is `eligible`
- If some return `insufficient_data` but none return `ineligible` → patient
  is `pending_data` — coordinator knows exactly which data to obtain

**Audit trail:**
Every matching decision is logged with:
- The criterion text at time of evaluation (versioned)
- The patient data used
- The LLM's rationale
- The confidence level
- The coordinator's final override (if they disagree with the verdict)

This audit trail satisfies the source data requirements of ICH E6(R3) B.11
and FDA 21 CFR Part 11.

**Requirements:**
- HIPAA BAA signed with the customer before any patient data can be processed
- FHIR R4 endpoint or data import capability on the customer side
- Data never leaves the customer's jurisdiction unless explicitly agreed

---

### Module 3 API Contract

```
POST /v1/match
  Request: {
    "protocol_id": "string",
    "patient": { ...FHIR R4 Patient bundle... }
  }
  Response: { "job_id": "string" }

GET /v1/match/{job_id}/result
  Response: {
    "overall": "eligible | ineligible | pending_data | insufficient_data",
    "criteria": [
      {
        "criterion_id": "I1",
        "verdict": "eligible",
        "rationale": "string",
        "data_used": ["Observation/xyz"],
        "confidence": "high | medium | low"
      }
    ],
    "missing_data": [
      {
        "criterion_id": "E4",
        "data_needed": "Recent liver function tests (ALT, AST) within 30 days"
      }
    ]
  }

POST /v1/match/batch
  Request: {
    "protocol_id": "string",
    "patients": [ { "patient_id": "string", "fhir": { ... } } ]
  }
  Response: { "batch_job_id": "string" }

GET /v1/match/batch/{batch_job_id}/results
  Response: Array of match results, one per patient

POST /v1/match/{job_id}/override
  Coordinator overrides the system verdict
  Request: { "criterion_id": "E4", "override_verdict": "eligible",
             "override_reason": "string", "coordinator_id": "string" }
```

---

## 7. Module 4 — Patient Simulation

### The Problem It Solves

Even after a patient is correctly matched as eligible and enrolled, they may
drop out before completing the trial. Common dropout reasons:
- Adverse events (side effects that become intolerable)
- Inconvenience (too many visits, too much blood drawn)
- Personal circumstances (moved, lost interest, competing commitments)
- Disease progression (too sick to continue)
- Protocol violations (patient did something that disqualifies them)

Dropout is catastrophic:
- It invalidates data and reduces statistical power
- The sponsor must either extend enrollment (expensive and slow) or
  do a protocol amendment (adds months)
- Direct cost: $50,000–$100,000 per trial day that the trial extends

Nobody can currently predict which enrolled patients are likely to drop out.
All dropout prediction research is in academic papers (Corbaux et al. 2024).
No commercial product exists.

### What Our System Does

**Input:**
A patient's characteristic profile at the time of enrollment:
```json
{
  "demographics": {
    "age": 34,
    "sex": "female",
    "bmi": 24.5,
    "distance_from_site_km": 12,
    "employment_status": "employed_full_time"
  },
  "medical_history": {
    "comorbidities": ["hypertension"],
    "prior_medications": ["lisinopril 10mg"],
    "prior_trial_participation": 0
  },
  "trial_characteristics": {
    "protocol_id": "string",
    "total_visits": 8,
    "total_blood_volume_ml": 177,
    "housing_days_required": 2,
    "washout_periods": 1,
    "trial_duration_days": 45
  }
}
```

**Output:**
```json
{
  "completion_likelihood": 0.84,
  "dropout_risk": 0.16,
  "risk_factors": [
    {
      "factor": "distance_from_site",
      "contribution": 0.08,
      "explanation": "Patient lives 12km from site. Historical data shows
                     dropout rates 2.3x higher beyond 10km for employed patients."
    },
    {
      "factor": "blood_volume_burden",
      "contribution": 0.05,
      "explanation": "177mL total collection is in the 75th percentile for BE studies.
                     Higher blood volume burden correlates with dropout in healthy volunteers."
    }
  ],
  "cohort_comparables": {
    "similar_patients_count": 423,
    "historical_completion_rate": 0.81,
    "confidence": "medium"
  }
}
```

**Training data path:**

Phase 1 (Research, parallel to Module 1/2 build):
- **TrialBench** — a public, multi-modal AI-ready dataset with 23 clinical trial
  tasks, including patient dropout rate prediction. No data partnership required.
  Download and run experiments immediately.
- Target: 65%+ accuracy on held-out TrialBench data.
- This number becomes the accuracy claim in sales conversations and investor decks.

Phase 2 (Production, after CRO data partnerships):
- CRO historical trial outcome data (de-identified, under data sharing agreements)
- Academic datasets: MIMIC-III/IV, CTGOV outcome data
- Target: 70%+ accuracy on held-out data before commercial release.

**Commercial gate:**
Do not sell Module 4 until dropout prediction accuracy exceeds 70% on held-out
data. Publish the accuracy benchmark externally. This is the trust signal that
makes sponsors willing to act on the prediction.

**Regulatory posture:**
Position as "clinical decision support" — the output informs, it doesn't decide.
The sponsor or coordinator makes the final enrollment decision. This keeps Module 4
out of FDA SaMD (Software as Medical Device) classification until clinical
validation data exists.

---

### Module 4 API Contract

```
POST /v1/simulate
  Request: {
    "protocol_id": "string",
    "patient": {
      "demographics": { ... },
      "medical_history": { ... }
    }
  }
  Response: { "job_id": "string" }

GET /v1/simulate/{job_id}/result
  Response: {
    "completion_likelihood": 0.84,
    "dropout_risk": 0.16,
    "risk_factors": [ ... ],
    "cohort_comparables": { ... },
    "model_version": "string",
    "accuracy_benchmark": "68.3% on TrialBench held-out set (2026-04-15)"
  }

POST /v1/simulate/batch
  Request: { "protocol_id": "string", "patients": [ ... ] }
  Response: { "batch_job_id": "string" }

GET /v1/simulate/batch/{batch_job_id}/results
```

---

## 8. The Shared Protocol Schema

Modules 1 and 2 both produce the same JSON structure. Module 3 reads it.
This is the backbone of the entire platform — designing it correctly is the
most important technical decision.

```json
{
  "protocol_id": "string (UUID)",
  "source": "created | extracted",
  "extracted_at": "2026-05-09T10:00:00Z",
  "extraction_status": "complete | partial",
  "missing_sections": [],

  "study": {
    "title": "string",
    "phase": "BE | Phase 1 | Phase 2 | Phase 3 | Phase 4",
    "therapeutic_area": "string",
    "sponsor": "string",
    "design": "string",
    "regulatory_targets": ["EMA", "MHRA-UK"]
  },

  "endpoints": {
    "primary": ["Cmax", "AUCt", "AUCi"],
    "secondary": ["Tmax", "t1/2"]
  },

  "criteria": {
    "inclusion": [
      {
        "id": "I1",
        "text": "string",
        "complexity_score": 3,
        "complexity_flags": ["lab_threshold"],
        "basis": "standard_healthy_volunteer | drug_class_safety | regulatory_precedent | designer_input",
        "source_citation": {
          "page": 12,
          "quote_fragment": "string (8-15 words verbatim from source)"
        },
        "confidence": "high | medium | low"
      }
    ],
    "exclusion": [ /* same structure */ ]
  },

  "visits": [
    {
      "name": "Screening",
      "day": -7,
      "window_days": 3,
      "procedures": [
        "Informed consent",
        "Physical examination",
        "Vital signs",
        "BMI calculation",
        "Complete blood count",
        "Liver function tests (ALT, AST)",
        "Serum creatinine",
        "Fasting blood glucose",
        "12-lead ECG",
        "Urine drug screen",
        "Urine pregnancy test (females)"
      ]
    }
  ],

  "task_list": [
    {
      "task_id": "T1",
      "description": "Screen participants against inclusion/exclusion criteria",
      "assigned_role": "coordinator",
      "due": "screening_visit",
      "visit_ref": "Screening",
      "priority": "critical"
    }
  ],

  "roster_template": [
    {
      "role": "Principal Investigator",
      "required_count": 1,
      "qualifications": "MD or DO, licensed physician, GCP-trained"
    },
    {
      "role": "Clinical Research Coordinator",
      "required_count": 2,
      "qualifications": "CRC certification preferred, GCP-trained"
    }
  ],

  "recruitment_risk": {
    "score": 5,
    "top_risk_criteria": ["E3", "E7", "I4"],
    "rationale": "string explaining why these criteria are high-risk"
  },

  "consistency_check": {
    "passed": true,
    "issues": []
  }
}
```

---

## 9. API Architecture

### Design Philosophy

All four modules follow the same async job pattern. No synchronous blocking calls
for AI-intensive operations.

```
Client                          Platform
  │                               │
  ├── POST /v1/[module]/[action] ─►│  Create job, return job_id
  │   { job_id: "abc123" }        │
  │                               │  [background: parse, extract, score]
  ├── GET /v1/[module]/abc123/    │
  │       status                 ─►│  Return status: pending|processing|complete
  │   { status: "complete" }      │
  │                               │
  ├── GET /v1/[module]/abc123/    │
  │       result                 ─►│  Return full result JSON
  │                               │

OR (with webhook):

  ├── POST /v1/[module]/abc123/   │
  │       webhook                ─►│  Register callback URL
  │                               │  [job completes]
  │◄── POST https://your-url ─────│  Platform POSTs result to your URL
  │    { job_id: "abc123",        │  Retry 3x with exponential backoff
  │      result: { ... } }        │  if delivery fails
```

### Authentication

All requests require:
```
Authorization: Bearer {api_key}
```

API keys are scoped per customer. Usage is metered per job for billing.

### Rate Limits

| Tier | Concurrent jobs | Requests/minute |
|------|----------------|----------------|
| Per-seat Starter | 5 | 60 |
| Per-seat Pro | 20 | 300 |
| Per-trial Enterprise | Unlimited | Custom |

### Versioning

All endpoints are versioned under `/v1/`. Breaking changes increment to `/v2/`.
Both versions supported for 12 months after a new version ships.

### Error Response Format (all endpoints)

```json
{
  "error": {
    "code": "parse_failed | llm_refused | llm_empty | invalid_schema | auth_failed",
    "message": "Human-readable explanation",
    "request_id": "string (for support)"
  }
}
```

---

## 10. Pricing Model

### Why per-protocol pricing was rejected

$200–500 per protocol × 10 protocols/year per CRO = $2,000–5,000 ARR per customer.
Not a real business.

### Adopted: Per-seat or Per-trial

| Model | Price | When it fits |
|-------|-------|-------------|
| Per-seat | $500–2,000/month | CROs with 5–20 study managers using the platform regularly across many trials |
| Per-trial | $2,000–5,000/trial | Sponsors or CROs who want to pay only for what they use |

**Revenue examples:**
- Small CRO, 5 seats at $800/month = $48,000 ARR
- Mid-size CRO, 50 trials/year at $3,000/trial = $150,000 ARR
- Large CRO, 20 seats + volume trials = $250,000+ ARR

**At 400,000 active trials globally: the ceiling is enormous.**

---

## 11. Competitive Landscape

| Competitor | What they do | Where we win |
|-----------|-------------|-------------|
| **Risklick Protocol AI** | Protocol development time reduction (claims 35%). Swiss company. | They stop at drafting assistance. We produce the full operational plan, recruitment risk scoring, and connect to matching and simulation. Different product, different buyer conversation. |
| **Phases (YC 2025)** | Trial oversight and execution | Similar vision, unclear product definition. Watch closely. First-mover advantage matters here. |
| **Dyania Health** | Patient matching from EHRs, claims 170x faster screening | Needs hospital partnerships for EHR access. We start with CROs who already have the data. |
| **BEKHealth** | EHR-based patient identification, claims 93% accuracy | Accuracy-focused, no full pipeline. We differentiate on the full Protocol → Matching → Simulation workflow. |
| **AIwithCare** | Mass General Brigham spinout, clinical trial AI | Institutional, slow to market. Academic credibility but no commercial velocity. |
| **Medidata / Veeva** | Full CTMS platforms | We are not competitors — we are potential integration partners. They have the workflow; we add the intelligence. |

**Our unique position:**
Nobody has shipped the full pipeline: creation → intelligence → matching → simulation.
Module 4 (simulation) has zero commercial competitors. That is the moat.

---

## 12. Build Sequence and Milestones

### Pre-Build (Week 0)

**Goal**: Validate extraction quality before writing production code.

Run Claude API extraction prompt directly against the 5 real Cliantha protocol
PDFs in `activity-docs/`:
- C1B05975 (Gabapentin 400 mg)
- C1B06068 (Olaparib 150 mg — 3-period crossover, EMA + Health Canada)
- C1B06109 (Empagliflozin 25 mg — SGLT2 inhibitor, EMA + MHRA-UK)
- C1B06192 (TBD)
- C1B06557 (TBD)

Review the JSON output with Cliantha:
- Are the extracted criteria accurate and complete?
- Is the task list operationally useful?
- Is the recruitment risk scoring meaningful?
- What's missing?

**This feedback reshapes the schema before production code is written.**

### Module 2 → Module 1 (Weeks 1–8)

Build Module 2 first because:
1. It requires no user interface — pure API
2. The extraction output defines the schema Module 1 must conform to
3. Pre-build validation already tests the core LLM extraction logic

```
Week 1–2: PDF parser (pdfplumber digital + Tesseract OCR fallback)
          Claude extraction prompt with structured output
          Schema validation

Week 3–4: Async job API (submit, status, result)
          Webhook delivery with retry and exponential backoff
          Error handling for all error types

Week 5–6: Complexity scoring for each criterion
          Recruitment risk aggregation
          Source citation extraction (hallucination guard)

Week 7–8: Module 1 (protocol creation from inputs)
          Internal consistency checker
          ICH M11 output format
          Pilot with Cliantha
```

### TrialBench Research (Weeks 1–12, parallel)

Run concurrently with the Module 1/2 build. Requires no production system.

```
Week 1–2:  Download TrialBench dataset
           Explore the 23 available tasks
           Identify which tasks are most relevant to dropout prediction

Week 3–6:  Feature engineering from patient characteristics
           Baseline model (logistic regression, gradient boosting)
           Evaluate on held-out TrialBench split

Week 7–12: LLM-augmented prediction
           Iterate toward 65%+ accuracy target
           Document methodology (this becomes the investor/customer claim)
```

### Module 3 (After 2 paying customers)

Gate: Module 1/2 have 2 B2B customers in production with measurable time-saving data.

```
Month 3–4: HIPAA BAA contractual framework
           FHIR R4 client library
           Criterion-level matching prompt and verdict structure

Month 5–6: Batch matching API
           Audit trail (ICH E6(R3) B.11 compliance)
           Pilot with Cliantha for patient screening
```

### Module 4 (After TrialBench validation + data partnerships)

Gate: 70% accuracy on held-out TrialBench data + at least one CRO data partnership.

```
Month 6+:  Production training on CRO historical outcome data
           Accuracy benchmark publication
           Simulation API
           Enterprise deal structure (annual contract, data sharing agreement)
```

---

## 13. Regulatory Considerations

### What applies now (Module 1 + 2)

**ICH E6(R3) GCP** — The global standard for Good Clinical Practice. Our output
must be consistent with how ICH E6(R3) defines what a protocol must contain.
Module 1 generates content that goes into a regulatory submission.

**ICH M11 CeSHarP** — The new structured electronic protocol standard (Step 4,
November 2025). Module 1 output in M11 format is directly submittable to regulators.
This is our competitive advantage vs. Word-document-based tools.

**FDA 21 CFR Part 11** — Governs electronic records and signatures in FDA-regulated
trials. Module 2's extracted task list and Module 3's audit trail must be designed
with Part 11 in mind. Formal Part 11 validation documentation is deferred until
before the first enterprise CRO sale.

### What applies for Module 3

**HIPAA** — Any system processing identifiable patient data (PHI) requires a
Business Associate Agreement (BAA) with the customer. Module 3 cannot ship
without this contractual framework in place.

**FHIR R4** — The data format standard. Not a regulation, but de facto required
for EHR integration in modern healthcare systems.

### What applies for Module 4

**FDA SaMD (Software as a Medical Device)** — If Module 4 is positioned as
making clinical decisions (not supporting them), it may require FDA clearance.
Current posture: "clinical decision support only." The sponsor makes the final
enrollment decision; the system provides a risk score. This keeps Module 4
out of SaMD classification.

Formal SaMD classification decision deferred until after Module 4 has clinical
validation data.

---

## 14. Open Decisions

| Decision | Why it matters | Status |
|----------|---------------|--------|
| Module 1 user interface | Form vs. conversational chat vs. document editor. Shapes the entire Module 1 build. | Open |
| Protocol creation scope | Start with BE studies only (simpler, well-defined inputs) or generalize immediately to Phase 2/3 (more inputs, higher value)? | Open |
| Investigator's Brochure upload | If IB is uploaded with Module 1, LLM can derive safety exclusions directly. If not, defaults to drug class knowledge. Does Cliantha have IBs they can share? | Open |
| FHIR compliance level | Does Cliantha's clients use FHIR R4? Or do we need a CSV/HL7 v2 import as fallback for Module 3? | Open |
| Cliantha historical data | Does Cliantha have de-identified historical trial outcome data they'd share for Module 4 training? This is the critical unlock. | Open |
| Module 4 regulatory posture | FDA SaMD classification or "decision support only"? | Deferred |
| 21 CFR Part 11 formal validation | Required before enterprise CRO sale. When to start? | Deferred |
| Product name | TBD | Open |
