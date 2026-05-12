# PRD: Clinical Trial AI Platform

**Status**: Draft  
**Date**: 2026-05-09  
**Workspace**: /Users/ashwinmanohar/Documents/zyvelor/cliantha  
**Client / Beachhead Customer**: Cliantha (existing paying relationship)

---

## Problem Statement

Clinical trial teams — study managers, coordinators, trial designers, and CROs — spend the majority of their time on manual, error-prone document work that has no AI assistance today. Three compounding problems:

1. **Protocol creation is slow and fragile.** A trial designer starts from a blank Word document or copies a prior protocol and edits it by hand. Writing eligibility criteria, visit schedules, statistical sections, and safety assessments takes 4-6 weeks for a standard bioequivalence study and 3-6 months for a Phase 2/3 trial. 60% of protocols receive at least one costly amendment after approval — most caused by internal inconsistencies in the eligibility criteria or Schedule of Events.

2. **Operational planning is transcription work.** After the protocol exists, someone manually reads it and rebuilds its contents into a spreadsheet: task list, role assignments, visit schedule, deadlines. This is hours of high-skilled time spent on work that adds zero scientific value. Errors here cause protocol deviations.

3. **Patient matching and outcome prediction don't exist as software.** Coordinators match patients against eligibility criteria by reading a printed list of criteria and comparing it against paper charts — hours per patient across hundreds of candidates. And nobody can tell a sponsor before enrollment closes whether a given patient will drop out. Dropout costs sponsors $50,000–$100,000 per trial day. No commercial product addresses this.

The intelligence layer that clinical trials need — reading and generating unstructured documents, reasoning about patient eligibility, predicting patient outcomes — does not exist as a product.

---

## Solution

A B2B API platform with four sequentially released modules that together cover the full lifecycle of a clinical trial from protocol design to patient outcome prediction. Each module's output feeds the next. The platform is an enhancement layer, not a CTMS replacement — it integrates into existing workflows at CROs and research site networks.

**Module 1 — Protocol Creation**: A trial designer inputs the key parameters of their study (drug, reference product, regulatory submission targets, design type, population). The platform drafts the full protocol — eligibility criteria, Schedule of Events, statistical section, safety sections, boilerplate — conforming to ICH E6(R3) and ICH M11 CeSHarP structured format. The designer reviews, edits, and finalizes.

**Module 2 — Protocol Intelligence**: Given any protocol document (uploaded PDF/DOCX or finalized from Module 1), the platform extracts structured operational output — task list, role assignments, visit schedule, and a recruitment risk score that flags which eligibility criteria are most likely to cause enrollment failure.

**Module 3 — Patient Matching**: Given a patient's medical record (FHIR R4) and the structured protocol criteria, the platform evaluates eligibility criterion by criterion and returns a verdict with natural-language rationale the coordinator can read and audit.

**Module 4 — Patient Simulation**: Given a patient's characteristics, the platform predicts trial completion likelihood and ranks the risk factors most likely to drive dropout.

---

## User Stories

### Protocol Creation (Module 1)

1. As a trial designer, I want to enter the drug name, reference product, regulatory submission targets, study design type, and population parameters into a structured form, so that I have a starting point without facing a blank document.
2. As a trial designer, I want the platform to draft a complete set of inclusion and exclusion criteria based on the drug class, indication, and regulatory precedents, so that I'm not copying from prior protocols manually.
3. As a trial designer, I want each suggested eligibility criterion to show its basis (derived from IB safety data, regulatory standard, or prior study precedent), so that I can distinguish well-grounded criteria from generated ones and audit them before finalizing.
4. As a trial designer, I want each suggested eligibility criterion scored for recruitment complexity before I commit to it, so that I understand which criteria will make enrollment difficult before the protocol is approved.
5. As a trial designer, I want the platform to draft a Schedule of Events that cross-references every endpoint, safety monitoring requirement, and eligibility criterion requiring a test, so that procedure-visit mismatches — the most common source of protocol amendments — are caught before submission.
6. As a trial designer, I want the platform to draft the statistical section including sample size calculation with standard BE parameters (80-125% bioequivalence range, 90% CI, 80% power) pre-populated for crossover study designs, so that the biostatistician reviews rather than drafts from scratch.
7. As a trial designer, I want boilerplate sections (Ethics, Data Handling, Financing, Quality Control) pre-populated per the applicable jurisdiction (EMA, FDA, MHRA, Health Canada), so that regulatory language doesn't need to be authored each time.
8. As a trial designer, I want to edit individual sections, accept or reject individual criteria, and adjust the Schedule of Events in the platform before finalizing, so that the draft is my document, not a locked output.
9. As a trial designer, I want the finalized protocol exported in ICH M11 CeSHarP structured format, so that the output is machine-readable and regulator-ready, not just a Word document.
10. As a trial designer, I want internal consistency checked before finalization — specifically that every eligibility criterion requiring a lab test maps to a corresponding assessment in the Schedule of Events — so that the most common source of protocol amendments is caught automatically.
11. As a trial designer, I want to generate a protocol amendment by describing what changed, so that the platform updates the affected sections and re-checks internal consistency rather than me doing it manually.

### Protocol Intelligence (Module 2)

12. As a study manager, I want to upload any protocol PDF or DOCX and receive a structured JSON output without writing any code, so that I can start operational planning immediately.
13. As a study manager, I want the extracted output to include a complete task list with role assignments (coordinator, PI, sponsor monitor, IRB) and due dates relative to enrollment or visit, so that the operational plan is generated automatically from the protocol.
14. As a study manager, I want the extracted output to include a visit schedule with procedures per visit, so that the Schedule of Events is machine-readable and usable in downstream scheduling systems.
15. As a study manager, I want a recruitment risk score (0-10) for the overall trial and for each individual eligibility criterion, so that I know which criteria to watch before enrollment opens.
16. As a coordinator, I want every extracted eligibility criterion to include a citation — the page number and a quote fragment from the source document — so that I can verify the extraction and hallucinated criteria surface as citations that don't exist.
17. As a developer integrating the platform, I want an async job-based API (submit → poll status → retrieve result) with webhook delivery on completion, so that I can integrate without blocking on long-running extraction jobs.
18. As a developer, I want the webhook to retry on delivery failure with exponential backoff and for the result to persist for polling fallback, so that my integration doesn't lose results due to transient failures.
19. As a developer, I want structured error responses for every failure mode (parse failed, LLM refused, LLM empty, partial extraction), so that my integration can handle failures gracefully rather than silently receiving bad output.
20. As a coordinator, I want partial extractions flagged explicitly with which sections were not found, so that I know when to manually verify rather than trusting a complete-looking output that is actually incomplete.

### Patient Matching (Module 3)

21. As a coordinator, I want to submit a patient's FHIR R4 record alongside a protocol ID and receive an eligibility verdict per criterion, so that patient screening doesn't require manual chart review against a printed criteria list.
22. As a coordinator, I want each criterion-level verdict to include a natural-language rationale, so that I can read why a patient was flagged as ineligible and verify the reasoning.
23. As a coordinator, I want patients to be flagged as `insufficient_data` when their record doesn't contain enough information to evaluate a criterion, so that I know which data gaps to resolve rather than receiving a false ineligible verdict.
24. As a study manager, I want to batch-submit multiple patient records against the same protocol, so that screening dozens of candidates doesn't require one submission at a time.
25. As a trials company integrating the platform, I want the matching endpoint to work as a white-label API, so that I can surface eligibility results in my own system without exposing the underlying platform to my clients.

### Patient Simulation (Module 4)

26. As a sponsor, I want to input a patient's characteristics (age, comorbidities, prior medications, demographics, biomarkers) and receive a predicted trial completion likelihood, so that I can prioritize enrollment of patients who are more likely to complete the trial.
27. As a sponsor, I want the dropout risk factors ranked by contribution to the predicted risk, so that I understand what drives the risk for each individual patient.
28. As a sponsor, I want historical cohort comparables included in the prediction output, so that I can contextualize the model's confidence.
29. As a CRO, I want the simulation module gated behind a public accuracy benchmark (>70% on held-out TrialBench data), so that I know the prediction is validated before I make enrollment decisions based on it.

### Platform / General

30. As a developer, I want per-seat pricing tiers and per-trial pricing tiers available, so that my organization can choose the model that matches how we use the platform.
31. As a CRO administrator, I want usage logs per trial and per user, so that I can understand what's being processed and manage costs.
32. As a regulatory affairs professional, I want the platform's output to reference the ICH E6(R3) section it satisfies for each extracted or generated field, so that I can map outputs to regulatory requirements during audit.

---

## Implementation Decisions

### Architecture

- Four sequentially shipped modules; Module 1 and 2 ship together (they share the same protocol JSON schema — Module 1 writes it, Module 2 reads it from uploaded documents).
- B2B REST API with async job pattern throughout: `POST` to submit → `GET /status` to poll → `GET /result` to retrieve. Webhook registration for push delivery.
- Output schema is shared across Module 1 (creation) and Module 2 (extraction). The same JSON structure is the input to Module 3.

### Protocol JSON Schema (shared, Module 1 + 2 output / Module 3 input)

The schema captures: protocol metadata (id, extracted_at, study info), structured criteria (inclusion/exclusion each with id, text, complexity_score 0-10, complexity_flags, source_citation), visit schedule (name, day, procedures), task list (task_id, description, assigned_role, due, visit_ref), roster template (role, required_count, qualifications), and recruitment_risk (score, top_risk_criteria, rationale).

### Module 1 — Protocol Creation

- Input: structured parameters (drug name, reference product, regulatory submission targets, design type, population parameters, special pharmacological considerations).
- LLM generates draft protocol using `claude-sonnet-4-6` with structured output / tool_use.
- Each generated criterion tagged with basis: `standard_phase_indication`, `ib_safety_derived`, `designer_input`. Untaggable criteria flagged for review.
- Internal consistency check: every criterion requiring a test must map to a SoE assessment at Screening. Mismatches surfaced before finalization.
- Output conforms to ICH M11 CeSHarP structured electronic protocol standard (Step 4, November 2025).
- API: `POST /v1/protocol/create` → `GET /v1/protocol/{job_id}/draft` → `PATCH /v1/protocol/{job_id}/draft` → `POST /v1/protocol/{job_id}/finalize`.

### Module 2 — Protocol Intelligence

- PDF parsing: PyMuPDF or pdfplumber for digital PDFs; Tesseract or AWS Textract OCR for scanned protocols. Chunk by section headers, not page count (protocols are 42-400+ pages).
- LLM extraction: `claude-sonnet-4-6` with structured output. Every extracted criterion includes `source_citation` (page + quote fragment).
- Complexity scoring: each criterion scored 0-10 on negation complexity, lab threshold requirements, time-window constraints, and subjective assessments. Aggregated to trial-level recruitment_risk score.
- Hallucination guard: source_citation is required; extracted criteria without a traceable citation are flagged `confidence: low`.
- Error taxonomy: `parse_failed`, `llm_refused`, `llm_empty` (retry once then error), `partial` (return with `extraction_status: partial`).
- Webhook delivery: 3 retries with exponential backoff. Result persists for polling fallback indefinitely (or per retention policy).
- API: `POST /v1/protocol/extract` → `GET /v1/protocol/{job_id}/status` → `GET /v1/protocol/{job_id}/result` → `POST /v1/protocol/{job_id}/webhook`.

### Module 3 — Patient Matching

- Input: `protocol_id` (references Module 2 structured criteria) + patient FHIR R4 resource.
- Verdict per criterion: `eligible | ineligible | insufficient_data` with natural-language rationale.
- Requires HIPAA BAA with any customer handling patient data. Not shipped until contractual compliance layer exists.
- Stack additions: vector store for protocol criteria, FHIR R4 client library.
- API: `POST /v1/match` → `GET /v1/match/{job_id}/result`.

### Module 4 — Patient Simulation

- Training: TrialBench public dataset first (23 tasks including patient dropout rate prediction) for research validation. CRO data partnerships for production accuracy.
- Gate: 70% accuracy on held-out TrialBench data required before commercial release. Accuracy published externally.
- Input: patient characteristics (age, comorbidities, prior medications, demographics, biomarkers).
- Output: completion likelihood (0-100%), dropout risk factors ranked by contribution, historical cohort comparables.

### Pricing

- Per-seat: $500-2,000/month. Per-trial: $2,000-5,000/trial. Not per-protocol-processed (too thin).

### Pre-Build Validation (Week 0)

Run Claude API extraction prompt directly against the 5 real protocol PDFs in `activity-docs/` before writing any production code. Validate JSON output quality with Cliantha before the Module 2 build begins.

---

## Testing Decisions

**What makes a good test here**: Tests should validate observable outputs given specific inputs — not LLM prompt internals, not parsing library internals. Test the contract: given this PDF / these parameters, does the output conform to the schema? Are required fields present? Are error responses returned for known bad inputs?

**Modules to test:**

- **Module 2 extraction pipeline**: Given a set of known protocol PDFs (the 5 real `activity-docs/` files), assert that the output schema is valid, criteria are present and non-empty, and source citations reference real pages. These serve as integration tests with the real Claude API.
- **Complexity scoring**: Given a criterion text with known characteristics (e.g., explicit negation, explicit lab threshold), assert the correct `complexity_flags` are returned and the score is above a threshold. Can be tested in isolation.
- **Internal consistency checker (Module 1)**: Given a protocol draft where a criterion requires a lab test not present in the Schedule of Events, assert that the system flags the inconsistency before finalization.
- **Error handling**: Given a malformed PDF or an intentionally unparseable document, assert the correct error response structure is returned.
- **Webhook delivery**: Given a registered webhook and a completed job, assert the callback is invoked with the correct payload. Test retry behavior against a failing endpoint.

**Not tested by automated tests** (manual / human review): Hallucination quality, clinical accuracy of generated eligibility criteria, clinical accuracy of recruitment risk rationale. These require domain expert review.

---

## Out of Scope

- CTMS replacement — this platform never handles data storage, compliance forms, or trial management workflows. It is an enhancement layer.
- Direct hospital or pharma sponsor sales motion in the first year.
- FDA SaMD (Software as Medical Device) classification — Module 4 is positioned as "decision support only" until clinical validation data exists.
- 21 CFR Part 11 formal validation documentation — required before enterprise CRO sales, deferred until Module 1/2 have paying customers.
- Developer sandbox / API documentation portal — deferred until second customer.
- CTMS webhook push (pushing extracted output into Medidata/Veeva automatically) — valuable but not required for Module 1/2 pilot.
- Epic App Market or any direct EHR marketplace listing — deferred until clinical validation data exists.
- Consumer play of any kind.

---

## Next Steps (not yet expanded)

1. **Pre-build validation** — Run Claude API extraction against the 5 real `activity-docs/` PDFs. Validate output with Cliantha before writing any production code.

2. **Module 1 UX decision** — Decide the interface for protocol creation: structured form, conversational chat, or document editor. This shapes the entire Module 1 build.

3. **Module 2 build** — PDF parsing pipeline, extraction prompt, API endpoints, webhook delivery, error handling, complexity scoring.

4. **Module 1 build** — Protocol creation from structured inputs, internal consistency checker, ICH M11 output format.

5. **TrialBench research track** — Download dataset, run dropout prediction experiments in parallel with Module 1/2 build. Target 65%+ accuracy before Module 4 design begins.

6. **Cliantha pilot** — Module 1/2 live with Cliantha. Collect measurable time-saving data. Use as the sales case for the second customer.

7. **Module 3** — After two paying customers. HIPAA BAA in place, FHIR R4 integration.

8. **Module 4** — After TrialBench validation and data partnerships. Gated at 70% accuracy.

---

## Further Notes

- **ICH M11 CeSHarP** (Step 4, November 2025) is now the regulatory standard for structured electronic protocols. Designing Module 1 output to conform to M11 makes output directly submittable to regulators — a meaningful competitive advantage over Word-document-based tools.
- **Cliantha's protocols are bioequivalence studies** (healthy volunteers, crossover design, PK endpoints). This is a narrower and more templated protocol type than Phase 2/3 novel drug trials. Module 1 should handle BE studies first — the input surface is well-defined and the output is largely predictable — then expand to Phase 2/3.
- **The real PDFs in `activity-docs/`** are actual Cliantha protocol documents (Gabapentin, Olaparib, Empagliflozin, and two others). They are the ground truth for extraction quality validation in the pre-build step.
- **Competitive note**: Risklick is the closest Module 2 competitor (protocol extraction). Dyania Health and BEKHealth compete in Module 3 space. Nobody has shipped Module 4 commercially. Our differentiation is the full pipeline.
