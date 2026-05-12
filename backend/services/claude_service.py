import os
import json
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

# ──────────────────────────────────────────────
# Core OpenAI helpers
# ──────────────────────────────────────────────

async def _call_openai(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> str:
    """Call OpenAI and return raw text response."""
    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content


async def _call_openai_json(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
    """Call OpenAI and parse JSON response. Retries once on parse failure."""
    raw = await _call_openai(system_prompt, user_prompt, max_tokens)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raw = await _call_openai(system_prompt, user_prompt, max_tokens)
        return json.loads(raw)


# ──────────────────────────────────────────────
# Prompts
# ──────────────────────────────────────────────

DRUG_LOOKUP_SYSTEM = """You are a senior clinical pharmacokineticist specialising in bioequivalence studies at a CRO.

Return ONLY valid JSON matching this schema exactly:

{
  "half_life_hours": <float — mean elimination half-life from label/literature>,
  "tmax_hours": <float — median Tmax from label>,
  "absorption_class": "<BCS class and key PK characteristics, e.g. 'BCS Class II, low solubility high permeability, food-sensitive'>",
  "pk_sampling_timepoints": [<float hours post-dose, pre-dose is 0.0, MINIMUM 16 values, MAXIMUM 22 values>],
  "washout_days": <integer — ceiling(5 × half_life_hours / 24), MINIMUM 7 days>,
  "confinement_hours": <integer — MUST equal the largest timepoint NOT in ambulatory_visits; typically 24h>,
  "ambulatory_visits": ["<e.g. '36h post-dose'>"],
  "posture_restriction": "<string or null>",
  "intrasubject_cv": <float — percentage CV for Cmax from BE literature or FDA recommendation, e.g. 22.5>,
  "sample_size_recommended": <integer — 2-period crossover, 80% power, alpha 0.05, GMR 1.00, based on intrasubject_cv>,
  "sample_size_basis": "<string — e.g. 'CV 22.5% for Cmax (FDA BE Rec), 2-period crossover, 80% power, alpha=0.05, GMR=1.00, dropout buffer 10%'>",
  "safety_flags": [
    {
      "type": "<string>",
      "description": "<clinical mechanism and risk>",
      "requirements": ["<specific protocol requirement — e.g. 'ECG at screening, pre-dose, 2h, 4h post-dose each period'>"]
    }
  ],
  "source_references": ["<full citation with year — e.g. 'FDA Guidance: Atorvastatin Calcium Tablets BE Recommendation (2023)'>"]
}

HARD RULES — violation = wrong answer:
1. pk_sampling_timepoints MUST have ≥16 values
2. Pre-dose MUST be 0.0 (always first)
3. Dense sampling REQUIRED around Tmax: every 0.5h from 0h up to Tmax+1h
4. Last timepoint MUST be ≥ 3×half_life_hours (round up to nearest: 24, 36, 48, 72, 96h)
5. confinement_hours MUST be the last in-house sample time. Samples AFTER confinement_hours go in ambulatory_visits
6. ambulatory_visits lists every scheduled sample time that falls AFTER confinement_hours
7. washout_days = max(ceil(5 × half_life_hours / 24), 7) days
8. safety_flags MUST include ALL class-specific flags: cardiac (QTc), hepatic, renal, hematologic, drug-drug interaction, food interaction — as applicable to this drug class
9. source_references MUST include the specific FDA BE Recommendation for this drug (or EMA equivalent), the ICH M13A guideline (2023), and the originator label
10. sample_size_recommended must be calculated from intrasubject_cv using standard crossover BE formula"""


RISK_ANALYZER_SYSTEM = """You are a senior clinical pharmacologist and regulatory affairs specialist reviewing a bioequivalence protocol for a CRO.

Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "critical|warning|info",
      "section": "<exact protocol section name>",
      "issue": "<concise one-line description of the problem>",
      "clinical_basis": "<why this matters — cite specific guideline: ICH M13A §X.X, FDA Guidance doc name, ICH E6(R3) §Y.Y, or ICH M3(R2)>",
      "fix": "<specific concrete fix — not generic advice>"
    }
  ]
}

DEDUPLICATION RULE: Each unique clinical problem gets ONE finding. Do not split one problem (e.g. QTc monitoring) into multiple findings.

IMPORTANT: The PK parameters (t½, Tmax, washout days, sampling timepoints, confinement hours) were pre-computed using validated clinical formulas. Only flag these as errors if the protocol document states DIFFERENT values that are arithmetically wrong — compare what the protocol says against the expected values provided in the user message.

Check ALL of these — each MUST produce at least one finding IF a gap exists in the protocol text:
1. Washout period — does the protocol state the correct value? Expected: ≥{washout_min_days} days. If wrong, cite calculation.
2. PK sampling schedule — dense enough around Tmax? Last sample ≥{last_sample_min}h?
3. Confinement vs ambulatory — protocol must explicitly list all post-confinement samples as ambulatory visits with logistics.
4. Food restriction — exact fasting hours stated? Standardised meal for food-sensitive drugs?
5. Safety monitoring — ECG timing and QTcF threshold? Electrolytes (cardiac drugs)? CBC? LFT? BP? Urine (SGLT2)? CK (statins)?
6. Sample size justification — CV source cited (FDA BE Recommendation)? Power, alpha, GMR stated?
7. Posture restriction — specified with exact duration if drug has orthostatic risk?
8. Drug-drug interactions — specific CYP isoforms and P-gp inhibitors/inducers excluded?
9. Regulatory references — ICH M13A 2023, ICH E6(R3), and specific FDA/EMA BE Recommendation cited in protocol?
10. Operational conflicts — blood draw, ECG, vital signs at same nominal time without priority order stated?"""


PRE_PROTOCOL_RISK_SYSTEM = """You are a senior clinical pharmacologist and regulatory affairs specialist.

A bioequivalence protocol has NOT yet been written. The PK parameters (t½, Tmax, washout, confinement, sampling timepoints) have ALREADY been computed and validated in the Drug Properties step — do NOT flag those values as risks unless the provided data shows they are arithmetically wrong (e.g. washout < 5×t½, last sample < 3×t½).

Your job: identify what the PROTOCOL WRITER must include when drafting — monitoring requirements, safety procedures, operational logistics, and regulatory compliance gaps. These are design decisions not yet made.

Return ONLY valid JSON:
{
  "findings": [
    {
      "severity": "critical|warning|info",
      "section": "<which protocol section — e.g. 'Section 7: Safety Monitoring', 'Section 10: Statistical Analysis'>",
      "issue": "<concise one-line problem statement>",
      "clinical_basis": "<cite specific guideline: ICH M13A §X, FDA Guidance for this drug class, ICH E6(R3), ICH M3(R2)>",
      "fix": "<specific concrete requirement — not generic>"
    }
  ]
}

DEDUPLICATION: Each unique clinical problem = ONE finding.

FOCUS AREAS (generate a finding for each that applies to this drug):
1. Safety monitoring protocols NOT yet specified:
   - Cardiac: ECG timing, QTcF threshold for withdrawal, electrolyte monitoring
   - Hepatic: LFT schedule, ALT/AST thresholds for withdrawal
   - Renal: eGFR/creatinine thresholds for screening exclusion
   - Hematologic: CBC parameters and exclusion thresholds
2. Food restriction specification: exact fasting hours, standardised meal composition, grapefruit juice exclusion
3. Drug-drug interaction exclusions: name specific CYP isoforms, P-gp, transporters — give actual inhibitor/inducer examples to exclude
4. Posture restriction protocol (if drug has orthostatic effects): exact duration, BP monitoring schedule
5. Sample size statistical section: power statement, alpha, CV source (cite FDA BE Recommendation), dropout buffer
6. Ambulatory visit logistics: nurse home visit vs subject return, time window tolerance, cold chain
7. Regulatory cross-reference in protocol: ICH M13A 2023 §, specific FDA BE Recommendation document name
8. Only flag washout/confinement/sampling if arithmetic check shows they are INSUFFICIENT (check is shown in the user message)"""


SCREENING_FORECAST_SYSTEM = """You are a clinical trial enrollment specialist for a CRO running bioequivalence studies in healthy Indian volunteers.

You will receive a full set of eligibility criteria (standard BE criteria + drug-specific criteria). For EACH criterion, estimate screen failure probability based on:
- Healthy Indian adult population epidemiology (not general population)
- Stringency of the threshold (e.g. QTcF <450ms excludes ~5-8% of healthy adults)
- Drug-class specific considerations from FDA BE Recommendations

Return ONLY valid JSON:
{
  "predicted_failure_rate_low": <float 0-1, conservative estimate>,
  "predicted_failure_rate_high": <float 0-1, pessimistic estimate>,
  "subjects_to_screen": <integer — use midpoint: target / (1 - avg_failure_rate), rounded up>,
  "estimated_cost_inr": <float — (subjects_to_screen - target_subjects) × 5000>,
  "criteria_risks": [
    {
      "criterion_id": "<E1, E2, I1, I2 ... — E=exclusion, I=inclusion>",
      "criterion_text": "<exact criterion text>",
      "failure_probability": <float 0-1, based on Indian healthy volunteer population>,
      "reason": "<population-specific reason with data if possible>"
    }
  ],
  "screening_order": [
    {
      "step": <integer 1-based>,
      "test": "<specific test name>",
      "rationale": "<why this step comes before the next — failure rate vs cost logic>",
      "cost_per_screen_inr": <float — realistic cost for this test in India>
    }
  ]
}

RULES:
1. criteria_risks MUST have one entry per criterion — minimum 10 entries for a BE study
2. Sort criteria_risks by failure_probability DESCENDING
3. screening_order: highest-failure-rate cheapest tests FIRST; expensive tests (ECG, labs) only after cheaper disqualifiers pass
4. subjects_to_screen = ceil(target / (1 - (low+high)/2))
5. estimated_cost_inr = (subjects_to_screen - target_subjects) × 5000
6. All probabilities must be 0-1 range (not percentages)"""


STANDARD_BE_CRITERIA = """STANDARD HEALTHY VOLUNTEER BE ELIGIBILITY CRITERIA (apply to ALL BE studies):

Inclusion:
I1. Age 18–45 years (male or female), inclusive
I2. Body Mass Index (BMI) 18.0–30.0 kg/m²
I3. Body weight ≥ 50 kg
I4. Healthy as determined by medical history, physical examination, vital signs (BP, HR, RR, temperature)
I5. 12-lead ECG within normal limits (QTcF < 450 ms)
I6. Clinical laboratory values within normal range (haematology, biochemistry, urinalysis)
I7. Negative urine drug screen and breath alcohol at screening and check-in

Exclusion:
E1. Any clinically significant acute or chronic medical condition
E2. Known hypersensitivity to the study drug or its class
E3. Use of any prescription medication within 14 days prior to dosing
E4. Use of any OTC medication, herbal supplement, or vitamin within 7 days prior to dosing
E5. History of alcohol abuse (>21 units/week) or current smoker (>5 cigarettes/day)
E6. Participation in another clinical trial within 90 days
E7. Donation of blood (>450 mL) within 90 days
E8. History of difficulty with venepuncture or poor venous access
E9. Pregnant or breastfeeding (females); unwilling to use contraception during study
E10. Any condition that in the investigator's opinion would compromise safety or data integrity"""


# ──────────────────────────────────────────────
# Drug PK Lookup
# ──────────────────────────────────────────────

async def lookup_drug_pk(
    drug_name: str,
    dose: str,
    formulation: str,
    special_instructions: str = "",
    regulatory_targets: list = None,
) -> tuple:
    """Call OpenAI to get PK properties."""
    reg_str = ", ".join(regulatory_targets) if regulatory_targets else "US FDA"

    user_prompt = (
        f"Drug: {drug_name} {dose} {formulation}\n"
        f"Regulatory targets: {reg_str}\n"
        f"Route of administration: Oral\n"
        f"Study-specific instructions: {special_instructions or 'Standard fasting BE study'}\n\n"
        f"Return the complete PK profile and study parameter set for a 2-period crossover BE study "
        f"targeting {reg_str}. Apply all HARD RULES from the system prompt exactly."
    )

    result = await _call_openai_json(DRUG_LOOKUP_SYSTEM, user_prompt, max_tokens=2500)
    raw = json.dumps(result)
    return result, raw


# ──────────────────────────────────────────────
# Risk Analyzer
# ──────────────────────────────────────────────

async def analyze_protocol_risk(
    drug_name: str,
    dose: str,
    half_life: float,
    tmax: float,
    safety_flags: list,
    protocol_text: str,
    regulatory_targets: list = None,
) -> dict:
    """Analyze a protocol document for risks."""
    safety_flags_str = json.dumps(safety_flags, indent=2) if safety_flags else "None identified"
    reg_str = ", ".join(regulatory_targets) if regulatory_targets else "US FDA"
    washout_min_h = round(half_life * 5, 1)
    washout_min_days = max(7, -(-int(washout_min_h) // 24))  # ceiling division
    last_sample_min_h = round(half_life * 3, 1)

    user_prompt = (
        f"Drug: {drug_name} {dose}\n"
        f"Target regulatory agencies: {reg_str}\n"
        f"Known PK: t½ = {half_life}h, Tmax = {tmax}h\n"
        f"Minimum washout: 5 × {half_life}h = {washout_min_h}h = {washout_min_days} days\n"
        f"Minimum last PK sample: 3 × {half_life}h = {last_sample_min_h}h\n"
        f"Safety flags:\n{safety_flags_str}\n\n"
        f"Protocol text to review:\n---\n{protocol_text[:15000]}\n---\n\n"
        f"Identify ALL gaps. Apply the DEDUPLICATION RULE — one finding per unique clinical problem."
    )

    return await _call_openai_json(RISK_ANALYZER_SYSTEM, user_prompt, max_tokens=4096)


async def analyze_pre_protocol_risk(
    drug_name: str,
    dose: str,
    half_life: float,
    tmax: float,
    washout_days: int,
    confinement_hours: int,
    safety_flags: list,
    pk_timepoints: list,
    regulatory_targets: list = None,
) -> dict:
    """Generate pre-protocol risk report based on PK properties only."""
    safety_flags_str = json.dumps(safety_flags, indent=2) if safety_flags else "None identified"
    reg_str = ", ".join(regulatory_targets) if regulatory_targets else "US FDA"
    washout_min_h = round(half_life * 5, 1)
    washout_min_days = max(7, -(-int(washout_min_h) // 24))
    last_tp = pk_timepoints[-1] if pk_timepoints else 0
    last_sample_min_h = round(half_life * 3, 1)
    in_house_tps = [t for t in pk_timepoints if t <= confinement_hours]
    ambulatory_tps = [t for t in pk_timepoints if t > confinement_hours]

    user_prompt = (
        f"Drug: {drug_name} {dose}\n"
        f"Target regulatory agencies: {reg_str}\n"
        f"PK parameters: t½ = {half_life}h, Tmax = {tmax}h\n"
        f"Calculated minimum washout: 5 × {half_life}h = {washout_min_h}h = {washout_min_days} days "
        f"(proposed: {washout_days} days — {'OK' if washout_days >= washout_min_days else 'INSUFFICIENT'})\n"
        f"Confinement: {confinement_hours}h\n"
        f"In-house PK samples: {in_house_tps}\n"
        f"Ambulatory PK samples (post-confinement): {ambulatory_tps}\n"
        f"Last PK sample: {last_tp}h (minimum required: {last_sample_min_h}h — "
        f"{'OK' if last_tp >= last_sample_min_h else 'INSUFFICIENT'})\n"
        f"Safety flags:\n{safety_flags_str}\n\n"
        f"Generate findings covering all required protocol risks. Apply the DEDUPLICATION RULE."
    )

    return await _call_openai_json(PRE_PROTOCOL_RISK_SYSTEM, user_prompt, max_tokens=4096)


# ──────────────────────────────────────────────
# Screening Forecast
# ──────────────────────────────────────────────

async def forecast_screening(
    drug_name: str,
    dose: str,
    target_subjects: int,
    criteria_text: str = "",
    safety_flags: list = None,
    regulatory_targets: list = None,
    drug_class: str = "",
) -> dict:
    """Forecast screening failure rates and recommend screening order."""
    reg_str = ", ".join(regulatory_targets) if regulatory_targets else "US FDA"

    # Always build a full criteria set: standard BE + drug-specific additions
    drug_specific = criteria_text.strip() if criteria_text.strip() else "No additional drug-specific criteria provided — use drug class defaults."

    safety_flags_str = ""
    if safety_flags:
        for flag in safety_flags:
            flag_type = flag.get("type", "")
            reqs = flag.get("requirements", [])
            safety_flags_str += f"\nSafety exclusion ({flag_type}): " + "; ".join(reqs)

    user_prompt = (
        f"Study: {drug_name} {dose} BE study\n"
        f"Drug class: {drug_class or drug_name.split()[0]}\n"
        f"Regulatory target: {reg_str}\n"
        f"Target enrollment: {target_subjects} subjects\n\n"
        f"=== FULL ELIGIBILITY CRITERIA ===\n"
        f"{STANDARD_BE_CRITERIA}\n"
        f"=== DRUG-SPECIFIC ADDITIONS ===\n"
        f"{drug_specific}"
        f"{safety_flags_str}\n\n"
        f"Analyze ALL criteria above. Generate criteria_risks for EACH criterion "
        f"(minimum 10 entries). Calculate subjects_to_screen using the formula in the system prompt."
    )

    return await _call_openai_json(SCREENING_FORECAST_SYSTEM, user_prompt, max_tokens=4096)
