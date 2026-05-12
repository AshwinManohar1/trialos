# Prototype Scope & Screen Definitions

**Stack**: Next.js (frontend) + FastAPI (backend) + PostgreSQL  
**Tenant**: Single tenant (Cliantha) — `org_id` in every table for future  
**Date**: 2026-05-11  

---

## What the Prototype Is

Three AI-powered tools that work as a pipeline for new studies, or
as independent drop-in tools for existing protocols:

```
NEW STUDY FLOW:
  Enter drug details → Protocol Creation → Risk Analyzer → Screening Forecast
                            ↑ all three run on the same study workspace

DROP-IN FLOW:
  Upload existing protocol PDF → Risk Analyzer → Screening Forecast
  (skip Protocol Creation, enter at stage 2 or 3)
```

---

## Prototype Scope — What's In, What's Out

### IN for prototype

**Protocol Creation**
- User enters: drug name, dose, formulation, reference product + country,
  regulatory targets, sponsor name, number of subjects
- System looks up drug PK properties (t½, Tmax, absorption profile) from
  PubChem + published literature via Claude
- System auto-derives: PK sampling schedule, washout period, confinement
  duration, posture restriction, drug-specific safety monitoring requirements
- User uploads their protocol Word template (Cliantha's existing format)
- System fills the variable sections of the template with derived values
- Output: filled protocol as downloadable DOCX

**Protocol Risk Analyzer**
- Input: protocol PDF or DOCX (uploaded or auto-passed from Creation)
- Parses document with pdfplumber
- Claude reads the full protocol and finds:
  - Criterion ↔ Schedule of Events mismatches
  - Washout period vs. drug t½ compliance
  - Sample size vs. published drug CV
  - Regulatory guideline gaps (ICH M13A)
  - Operational conflicts (posture + procedure conflicts)
- Output: risk report grouped as Critical / Warning / Info
- Each finding shows: the issue, the affected section, the clinical basis

**Screening Efficiency Forecast**
- Input: structured protocol data (from Creation or parsed from upload)
- For each eligibility criterion: estimates screen failure probability
  based on drug class + healthy volunteer epidemiology
- Outputs:
  - Predicted screen failure rate (range, e.g. 38–45%)
  - Subjects to screen to hit enrollment target
  - Ranked list of highest-risk criteria
  - Recommended screening order (run highest-failure tests first)
  - Estimated screening cost (₹ per screen-fail × predicted fails)

### OUT for prototype (deferred)

- Subject-by-subject eligibility check (Module 3 in full product)
- Patient simulation / dropout prediction (Module 4)
- Multi-tenant / org management / team roles
- CTMS integrations
- ICH M11 CeSHarP structured output
- Audit trail / 21 CFR Part 11 compliance
- Webhook / API access for customers
- Amendment generation

---

## Data Model (simplified)

```
Study
  id, org_id, name, status (draft|active|complete)
  created_at, updated_at

DrugProfile
  study_id
  drug_name, dose, formulation, route
  reference_product, reference_country
  regulatory_targets (array)
  sponsor_name
  target_subjects

DerivedPKProperties (computed by AI, stored)
  study_id
  half_life_hours, tmax_hours, absorption_class
  pk_sampling_timepoints (JSON array)
  washout_days, confinement_hours
  posture_restriction
  safety_flags (JSON array)
  sample_size_recommended
  sample_size_basis (explanation)

ProtocolDocument
  study_id
  template_file_url (uploaded DOCX)
  filled_file_url (output DOCX)
  status (pending|processing|complete|failed)

RiskReport
  study_id, protocol_document_id
  findings (JSON array of {severity, section, issue, basis})
  generated_at

ScreeningForecast
  study_id, protocol_document_id
  predicted_failure_rate_low, predicted_failure_rate_high
  subjects_to_screen
  estimated_cost
  criteria_risks (JSON array)
  screening_order (JSON array)
  generated_at
```

---

## Screen Definitions

---

### SCREEN 0 — Dashboard (Home)

**Route**: `/`

**Purpose**: Central hub. See all studies. Start a new one. Drop in an
existing protocol.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]   Studies                          [+ New Study]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Or upload an existing protocol  [Upload PDF/DOCX]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Recent Studies                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  C1B06557   Nilotinib 200mg     ● Active    [Open]   │  │
│  │  C1B06192   Olmesartan 40/25mg  ● Complete  [Open]   │  │
│  │  C1B06109   Empagliflozin 25mg  ● Draft     [Open]   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Actions**:
- `+ New Study` → Screen 1 (new study pipeline)
- `Upload PDF/DOCX` → goes directly to Screen 4 (Risk Analyzer), skipping
  Protocol Creation. Study created with name auto-extracted from document.
- `Open` on a study → Study Workspace (Screen 3)

---

### SCREEN 1 — New Study Setup

**Route**: `/studies/new`

**Purpose**: Collect the drug inputs needed to derive the protocol.
This is the only form the user fills. Everything else is derived.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    New Study                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Study ID / Name                                            │
│  [C1B06600__________________________]                       │
│                                                             │
│  ── Test Product ─────────────────────────────────────────  │
│                                                             │
│  Drug Name           Dose          Formulation              │
│  [Nilotinib_______]  [200 mg____]  [Capsule___▾]            │
│                                                             │
│  Manufacturer                                               │
│  [Novugen Oncology Sdn. Bhd._____________________]         │
│                                                             │
│  ── Reference Product ─────────────────────────────────────  │
│                                                             │
│  Reference Drug Name             Country of Origin          │
│  [TASIGNA 200mg________________]  [Switzerland_____▾]       │
│                                                             │
│  + Add second reference product  (for 3-period studies)     │
│                                                             │
│  ── Regulatory & Study ─────────────────────────────────────  │
│                                                             │
│  Target Regulators  (select all that apply)                 │
│  [✓] EMA   [✓] FDA   [ ] MHRA   [ ] Health Canada          │
│  [ ] TGA   [ ] NPRA  [ ] Other [_______________]            │
│                                                             │
│  Number of Subjects (target enrollment)                     │
│  [30_______]   ← or [Auto-calculate from drug CV]           │
│                                                             │
│  Sponsor Name                                               │
│  [Novugen Oncology Sdn. Bhd._____________________]         │
│                                                             │
│  Sponsor Country                                            │
│  [Malaysia_______________▾]                                 │
│                                                             │
│  Any special instructions not auto-detected?  (optional)   │
│  [_____________________________________________________]    │
│                                                             │
│                         [Continue →]                        │
└─────────────────────────────────────────────────────────────┘
```

**What happens on Continue**:
- FastAPI calls Claude with the drug name
- Claude looks up PK properties from knowledge + PubChem
- Derived properties stored as `DerivedPKProperties`
- User goes to Screen 2 to review what was derived

**Validation**:
- Drug name required
- At least one regulatory target required
- Reference product required (minimum 1)

---

### SCREEN 2 — Derived Drug Properties Review

**Route**: `/studies/:id/drug-properties`

**Purpose**: Show the user what the AI derived from the drug name before
filling anything. User can edit any field. This is the transparency layer —
it proves we know pharmacokinetics, not just software.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    Nilotinib 200mg — Derived Properties       [2/4] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  We looked up Nilotinib's pharmacokinetic profile and       │
│  derived the following. Review and edit if needed.          │
│                                                             │
│  ── Pharmacokinetics ──────────────────────────────────────  │
│                                                             │
│  Half-life (t½)          17 hours    [Edit]                 │
│  Tmax                    3 hours     [Edit]                 │
│  Absorption class        Moderate, food-sensitive           │
│  Source                  Hazarika et al. 2012, FDA label    │
│                                                             │
│  ── Derived Study Parameters ──────────────────────────────  │
│                                                             │
│  Washout period          7 days   (5× t½ = 85h, rounded up)│
│  Last PK sample          72 hours (3× t½ = 51h → 72h std)  │
│  Confinement             48 hours in-house                  │
│  Ambulatory visits       36h, 48h, 72h post-dose            │
│  Posture restriction     Supine for 4 hours post-dose       │
│                                                             │
│  ── PK Sampling Schedule (auto-generated) ─────────────────  │
│                                                             │
│  Pre-dose (0h), 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5,        │
│  4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 24.0, 36.0,              │
│  48.0, 72.0 hours post-dose                                 │
│  Total: 18 samples per period                               │
│  Volume: 3 mL / sample (K2EDTA)   [Edit]                   │
│                                                             │
│  ── Drug-Class Safety Flags ───────────────────────────────  │
│                                                             │
│  ⚠️  QTc prolongation risk                                  │
│     → 12-lead ECG required at screening, 3h, 8h post-dose  │
│     → Serum K⁺ and Mg²⁺ at Period II check-in              │
│     → Defibrillator must be on-site during dosing           │
│                                                             │
│  ⚠️  Strong food effect                                     │
│     → No food 2 hours before dose, 1 hour after dose       │
│     → Standard 240 mL water with dose                       │
│                                                             │
│  ── Sample Size ───────────────────────────────────────────  │
│                                                             │
│  Intrasubject CV (published)    21.4%  (source: FDA label)  │
│  Required for 80% power, α=0.05, GMR=1.00                   │
│  Recommended subjects          26                           │
│  Your target                   30  ← includes 15% dropout  │
│  buffer                                                     │
│                                                             │
│  [Edit any field]           [Looks good → Continue →]       │
└─────────────────────────────────────────────────────────────┘
```

**Key design decision**: Every derived value shows its source. "Source: Hazarika et al. 2012, FDA label" is not decoration — it's the clinical grounding proof. Any pharmacologist reviewing this can verify the lookup.

---

### SCREEN 3 — Study Workspace

**Route**: `/studies/:id`

**Purpose**: Central hub for one study. Shows all three modules as stages.
Entry point for drop-in users (they land here after uploading an existing protocol).

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Studies   C1B06557 — Nilotinib 200mg                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  01  Protocol Creation          ✅ Complete  [View]   │  │
│  │      Filled DOCX ready for download                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  02  Protocol Risk Analyzer     ● 3 findings [View]  │  │
│  │      2 warnings · 1 critical                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  03  Screening Forecast         ✅ Ready    [View]   │  │
│  │      Screen 49–55 subjects to enroll 30              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Study Details                                              │
│  Drug: Nilotinib 200mg Capsule                              │
│  Reference: TASIGNA 200mg (Switzerland)                     │
│  Regulators: USFDA                                          │
│  Sponsor: Novugen Oncology Sdn. Bhd.                        │
│  Target subjects: 30                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### SCREEN 4 — Protocol Creation (Template Fill)

**Route**: `/studies/:id/protocol`

**Purpose**: Upload Cliantha's existing Word template. System fills the
variable sections. User downloads the filled DOCX.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Workspace   Protocol Creation                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Upload your protocol template                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │    Drag & drop your Word template here                │  │
│  │    or [Browse files]                                  │  │
│  │                                                       │  │
│  │    Accepted: .docx                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ── What gets filled automatically ───────────────────────  │
│                                                             │
│  ✓  Study title and protocol number                         │
│  ✓  Drug name, dose, formulation                           │
│  ✓  Reference product and country                          │
│  ✓  Sponsor name and address                               │
│  ✓  PK sampling schedule (18 timepoints, 3 mL each)        │
│  ✓  Blood volume calculations and compensation amounts      │
│  ✓  Washout period (7 days)                                 │
│  ✓  Confinement duration (48h in-house + 3 ambulatory)     │
│  ✓  Safety monitoring requirements (ECG, electrolytes)      │
│  ✓  Dietary restrictions (2h pre / 1h post food-free)       │
│  ✓  Posture restriction (supine 4h)                         │
│  ✓  Sample size justification (26 + 15% buffer = 30)        │
│  ✓  Regulatory guideline reference (ICH M13A)               │
│                                                             │
│  ── After upload ─────────────────────────────────────────  │
│                                                             │
│  [Generating...]                                            │
│                                                             │
│  ✓ Template parsed — 47 variable sections identified        │
│  ✓ Drug properties applied                                  │
│  ✓ PK schedule inserted                                     │
│  ✓ Safety flags applied                                     │
│  ✓ Compensation table calculated                            │
│                                                             │
│  [⬇ Download Filled Protocol DOCX]                          │
│                                                             │
│  [Run Risk Analyzer on this protocol →]                     │
└─────────────────────────────────────────────────────────────┘
```

---

### SCREEN 5 — Protocol Risk Analyzer

**Route**: `/studies/:id/risk`

**Purpose**: Show every problem found in the protocol. The primary AI
value-add. Critical findings first.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Workspace   Protocol Risk Analyzer — C1B06557            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Analyzed: C1B06557_Nilotinib_Protocol_v1.docx             │
│  Findings: 1 Critical  ·  2 Warnings  ·  3 Info            │
│                                                             │
│  ── Critical ─────────────────────────────────────────────  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ❌  Schedule of Events mismatch                     │  │
│  │                                                      │  │
│  │  Criterion E19 requires serum K⁺ and Mg²⁺ within    │  │
│  │  normal limits at check-in for Period II. However,  │  │
│  │  the Schedule of Events does not include an          │  │
│  │  electrolyte panel at the Period II check-in visit.  │  │
│  │                                                      │  │
│  │  Affected section: Section 5.2, Schedule of Events  │  │
│  │  Clinical basis: Nilotinib causes QTc prolongation  │  │
│  │  mediated by hypokalemia and hypomagnesemia.         │  │
│  │  ICH M13A Section 4.3.2 requires pre-dose safety    │  │
│  │  labs for drugs with known cardiac risk.             │  │
│  │                                                      │  │
│  │  Fix: Add serum K⁺ and Mg²⁺ to Period II check-in  │  │
│  │  visit in the Schedule of Events table.             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ── Warnings ─────────────────────────────────────────────  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⚠️  Sample size may be conservative                 │  │
│  │                                                      │  │
│  │  Protocol states 30 subjects. Published intrasubject │  │
│  │  CV for nilotinib is 21.4% (FDA label, 2023).        │  │
│  │  At 80% power and α=0.05, 22 subjects are required.  │  │
│  │  30 subjects provides 91% power — you are            │  │
│  │  over-recruiting by ~8 subjects.                     │  │
│  │                                                      │  │
│  │  If you proceed with 30: no regulatory issue.        │  │
│  │  If cost matters: 22 subjects is defensible.         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⚠️  Food restriction wording is ambiguous           │  │
│  │                                                      │  │
│  │  Section 7.3 states "subjects should avoid food      │  │
│  │  around dosing." Nilotinib has a strong food effect  │  │
│  │  (high-fat meal increases AUC by 82%). EMA requires  │  │
│  │  explicit windows: ≥2h before and ≥1h after dose.    │  │
│  │  "Around dosing" may be queried during regulatory    │  │
│  │  review.                                             │  │
│  │                                                      │  │
│  │  Fix: Replace with "No food for 2 hours before       │  │
│  │  and 1 hour after dose administration."             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ── Info ─────────────────────────────────────────────────  │
│  [3 informational findings — click to expand]              │
│                                                             │
│  [Run Screening Forecast →]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions**:
- Every finding has: issue, affected section, clinical basis (with source),
  and a concrete fix
- "Clinical basis" is the domain expertise signal — we cite ICH M13A,
  FDA labels, published studies
- Critical blocks action; warnings are advisory

---

### SCREEN 6 — Screening Efficiency Forecast

**Route**: `/studies/:id/screening`

**Purpose**: Tell the study manager how many subjects to recruit for
screening, which criteria will cause most failures, and which tests
to run first to minimize cost.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  ← Workspace   Screening Forecast — C1B06557                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ── Enrollment Prediction ────────────────────────────────  │
│                                                             │
│  Target enrollment         30 subjects                      │
│                                                             │
│  Predicted screen failure rate   38% – 45%                  │
│  ████████████████████░░░░░░░░░   38–45% of screened         │
│                                  subjects will not qualify  │
│                                                             │
│  Subjects to screen        49 – 55                          │
│  Recommended batch size    55  (conservative estimate)      │
│                                                             │
│  Estimated screening cost                                   │
│  ₹500 × 55 subjects = ₹27,500 in screening visits           │
│  + labs per subject ≈ ₹2,200 × 55 = ₹1,21,000              │
│  Predicted screen-fail cost: ₹1,48,500 total               │
│  If we screen 40 instead: risk not enrolling on time        │
│                                                             │
│  ── Criteria Risk Breakdown ──────────────────────────────  │
│                                                             │
│  Rank  Criterion    Risk    Why                             │
│  ─────────────────────────────────────────────────────────  │
│  1     QTc > 450ms  HIGH    Nilotinib is a QTc prolonger.  │
│                             ~9% of healthy males have       │
│                             borderline QTc at baseline.     │
│                                                             │
│  2     Electrolytes HIGH    K⁺ or Mg²⁺ abnormalities affect │
│        out of range        ~6% of healthy male volunteers.  │
│                                                             │
│  3     CYP3A4 use   MED     Common OTC antifungals          │
│                             (fluconazole) are CYP3A4        │
│                             inhibitors. ~4% prevalence.     │
│                                                             │
│  4     Alcohol use  MED     Self-reported exclusion.        │
│                             Underreporting common.          │
│                                                             │
│  5     BMI / weight LOW     Standard healthy volunteer      │
│                             pool is mostly compliant.       │
│                                                             │
│  ── Recommended Screening Order ──────────────────────────  │
│                                                             │
│  Run in this order to catch failures early and cheaply:     │
│                                                             │
│  1. 12-lead ECG  ← catches 9% failures, costs ₹400         │
│     Check QTc before drawing 15mL blood for labs.          │
│                                                             │
│  2. Serum electrolytes (K⁺, Mg²⁺)                          │
│     ← catches another 6%. Simple blood panel.              │
│                                                             │
│  3. Full screening labs (CBC, LFTs, renal, glucose, etc.)  │
│     ← run only after ECG + electrolytes pass.              │
│                                                             │
│  4. Medical history / medication review                     │
│     ← CYP3A4 inhibitors, alcohol use — self-reported last. │
│                                                             │
│  Estimated savings from optimized order:                    │
│  ₹18,000 – ₹24,000 in avoided full-lab costs               │
│  on subjects who fail ECG/electrolytes first               │
│                                                             │
│  ⚠️  This forecast is based on published epidemiological    │
│     data and drug-class characteristics. Actual screen      │
│     failure rates will vary by subject pool.               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Screen Flow Summary

```
Dashboard (Screen 0)
     │
     ├── [+ New Study] ──────────────────────────────────────┐
     │                                                        │
     │   Screen 1: Study Setup Form                          │
     │        ↓                                               │
     │   Screen 2: Derived Drug Properties Review            │
     │        ↓                                               │
     │   Screen 3: Study Workspace ←──────────────────────┐  │
     │        ├── Screen 4: Protocol Creation              │  │
     │        ├── Screen 5: Risk Analyzer                  │  │
     │        └── Screen 6: Screening Forecast             │  │
     │                                                     │  │
     └── [Upload existing protocol] ──────────────────────┘  │
              Study created, skip to Screen 5                  │
              with Screen 3 as the hub ───────────────────────┘
```

---

## API Endpoints (FastAPI)

```
POST   /api/studies                      Create new study
GET    /api/studies                      List studies
GET    /api/studies/:id                  Get study

POST   /api/studies/:id/drug-lookup      Lookup drug PK properties from name
PATCH  /api/studies/:id/drug-properties  Save edited derived properties

POST   /api/studies/:id/protocol/upload  Upload template DOCX
POST   /api/studies/:id/protocol/fill    Fill template with drug properties
GET    /api/studies/:id/protocol/result  Download filled DOCX

POST   /api/studies/:id/risk/analyze     Run risk analyzer on protocol
GET    /api/studies/:id/risk/report      Get risk report

POST   /api/studies/:id/screening/run    Run screening forecast
GET    /api/studies/:id/screening/result Get forecast
```

---

## Build Order

```
Week 1:  FastAPI scaffolding, PostgreSQL setup, Study CRUD
         Drug lookup endpoint (Claude + PubChem)
         Screen 1 (Study Setup) + Screen 2 (Drug Properties Review)

Week 2:  Protocol template fill logic (python-docx for DOCX manipulation)
         Screen 4 (Protocol Creation upload + fill + download)

Week 3:  Protocol Risk Analyzer (pdfplumber parse + Claude risk prompt)
         Screen 5 (Risk Report)

Week 4:  Screening Efficiency Forecast (Claude + epidemiology data)
         Screen 6 (Screening Forecast)
         Screen 0 (Dashboard) + Screen 3 (Study Workspace)
         End-to-end testing with real Cliantha protocols
```

---

## What Proves Domain Expertise to Cliantha

When Cliantha sees the prototype, these three things will make them trust it:

1. **Screen 2 (Drug Properties)** — We derive the correct PK sampling
   schedule for any drug they type in, cite the source, and show the
   pharmacokinetic reasoning. A medical writer can't do this instantly.

2. **Screen 5 (Risk Analyzer)** — We cite ICH M13A section numbers and
   FDA label data when flagging issues. We don't say "there's a problem."
   We say "Section 4.3.2 of ICH M13A requires pre-dose safety labs for
   drugs with known cardiac risk."

3. **Screen 6 (Screening Forecast)** — We tell them to run the ECG before
   the blood draw for nilotinib studies. That's a clinical pharmacologist's
   insight, delivered in 3 seconds. No CRO software does this today.
