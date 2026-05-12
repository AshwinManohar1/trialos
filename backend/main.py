import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import connect_db, close_db
from models import (
    Study, DrugProfile, DerivedPKProperties,
    ProtocolDocument, RiskReport, ScreeningForecast, OrgTemplate
)
from routers import studies, drug_lookup, protocol, risk, screening, templates

app = FastAPI(
    title="TrialOS API",
    version="1.0.0",
    description="Clinical Trial AI Platform — Bioequivalence Studies",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten after you have a real domain
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

DOCUMENT_MODELS = [
    Study, DrugProfile, DerivedPKProperties,
    ProtocolDocument, RiskReport, ScreeningForecast, OrgTemplate
]

# ──────────────────────────────────────────────
# Seed data (3 real Cliantha studies)
# ──────────────────────────────────────────────

SEED_STUDIES = [
    {
        "id": "C1B06600",
        "name": "Nilotinib 200mg Capsule BE Study",
        "status": "complete",
        "drug_profile": {
            "drug_name": "Nilotinib",
            "dose": "200mg",
            "formulation": "Hard Gelatin Capsule",
            "route": "oral",
            "reference_product": "Tasigna 200mg",
            "reference_country": "USA",
            "regulatory_targets": ["US FDA", "EU EMA"],
            "sponsor_name": "Natco Pharma Ltd",
            "sponsor_country": "India",
            "target_subjects": 28,
            "special_instructions": "Administer under fasting conditions. QTc monitoring required. Avoid grapefruit.",
        },
        "pk_properties": {
            "half_life_hours": 17.0,
            "tmax_hours": 3.0,
            "absorption_class": "BCS Class II, food-dependent (fasting required)",
            "pk_sampling_timepoints": [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 24.0, 36.0, 48.0, 72.0],
            "washout_days": 14,
            "confinement_hours": 24,
            "ambulatory_visits": ["36h post-dose", "48h post-dose", "72h post-dose"],
            "posture_restriction": "Upright posture for 4 hours post-dose",
            "safety_flags": [
                {
                    "type": "QTc prolongation",
                    "description": "Nilotinib can cause QT interval prolongation and sudden death",
                    "requirements": [
                        "12-lead ECG at screening, pre-dose, 2h, 4h, 6h post-dose each period",
                        "Electrolytes (K+, Mg2+) corrected before dosing",
                        "Exclude subjects with QTcF > 450ms at screening",
                        "Hold dose if QTcF > 480ms"
                    ]
                },
                {
                    "type": "Myelosuppression",
                    "description": "BCR-ABL inhibitor; CBC monitoring required",
                    "requirements": [
                        "Complete blood count at screening and end-of-study",
                        "Exclude subjects with abnormal baseline CBC"
                    ]
                }
            ],
            "sample_size_recommended": 28,
            "sample_size_basis": "Based on intrasubject CV of 28% for Cmax, 2-period crossover, 80% power, alpha 0.05, GMR 0.95",
            "intrasubject_cv": 28.0,
            "source_references": [
                "Tasigna (nilotinib) US Prescribing Information. Novartis 2023.",
                "ICH M13A Guideline on Bioequivalence for Immediate-Release Solid Oral Dosage Forms (2023)",
                "FDA Draft Guidance: Nilotinib Capsules BE Recommendation"
            ],
            "raw_response": "Seeded from Cliantha study archive.",
        },
    },
    {
        "id": "C1B06601",
        "name": "Empagliflozin 25mg Tablet BE Study",
        "status": "active",
        "drug_profile": {
            "drug_name": "Empagliflozin",
            "dose": "25mg",
            "formulation": "Film-coated Tablet",
            "route": "oral",
            "reference_product": "Jardiance 25mg",
            "reference_country": "EU",
            "regulatory_targets": ["EU EMA", "Health Canada"],
            "sponsor_name": "Sun Pharmaceutical Industries Ltd",
            "sponsor_country": "India",
            "target_subjects": 24,
            "special_instructions": "Fasting study. Monitor for symptomatic hypoglycaemia. Urinalysis required.",
        },
        "pk_properties": {
            "half_life_hours": 12.4,
            "tmax_hours": 1.5,
            "absorption_class": "BCS Class II, low solubility, high permeability",
            "pk_sampling_timepoints": [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 24.0, 36.0, 48.0],
            "washout_days": 10,
            "confinement_hours": 24,
            "ambulatory_visits": ["36h post-dose", "48h post-dose"],
            "posture_restriction": None,
            "safety_flags": [
                {
                    "type": "Genital mycotic infections",
                    "description": "SGLT2 inhibitor class effect; glucosuria promotes fungal growth",
                    "requirements": [
                        "Urinalysis (glucose, ketones) at baseline and each check-out",
                        "Exclude subjects with active genital infections"
                    ]
                },
                {
                    "type": "Euglycaemic ketoacidosis risk",
                    "description": "Rare but serious DKA risk even in non-diabetic subjects under stress",
                    "requirements": [
                        "Urinary ketones checked pre-dose and at discharge",
                        "Hold dosing if subject is fasting >24h prior"
                    ]
                }
            ],
            "sample_size_recommended": 24,
            "sample_size_basis": "Based on intrasubject CV of 18% for AUC, 2-period crossover, 80% power, alpha 0.05, GMR 1.00",
            "intrasubject_cv": 18.0,
            "source_references": [
                "Jardiance (empagliflozin) EU Summary of Product Characteristics. Boehringer Ingelheim 2023.",
                "EMA Guideline on the Investigation of Bioequivalence (CPMP/EWP/QWP/1401/98 Rev. 1)",
                "Health Canada Guidance on Comparative Bioavailability Standards"
            ],
            "raw_response": "Seeded from Cliantha study archive.",
        },
    },
    {
        "id": "C1B06602",
        "name": "Olmesartan Medoxomil 40mg Tablet BE Study",
        "status": "draft",
        "drug_profile": {
            "drug_name": "Olmesartan Medoxomil",
            "dose": "40mg",
            "formulation": "Film-coated Tablet",
            "route": "oral",
            "reference_product": "Benicar 40mg",
            "reference_country": "USA",
            "regulatory_targets": ["US FDA"],
            "sponsor_name": "Torrent Pharmaceuticals Ltd",
            "sponsor_country": "India",
            "target_subjects": 26,
            "special_instructions": "Fasting study. Monitor blood pressure at each PK timepoint due to antihypertensive effect.",
        },
        "pk_properties": {
            "half_life_hours": 13.0,
            "tmax_hours": 2.0,
            "absorption_class": "Prodrug (medoxomil ester), hydrolysed in GI tract; BCS Class II",
            "pk_sampling_timepoints": [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 24.0, 36.0, 48.0, 72.0],
            "washout_days": 10,
            "confinement_hours": 24,
            "ambulatory_visits": ["36h post-dose", "48h post-dose", "72h post-dose"],
            "posture_restriction": "Seated position for BP measurements; supine position monitored for orthostatic hypotension",
            "safety_flags": [
                {
                    "type": "Hypotension",
                    "description": "ARB class antihypertensive; risk of symptomatic hypotension in healthy volunteers",
                    "requirements": [
                        "Blood pressure and heart rate at each PK timepoint",
                        "Orthostatic BP check (supine-to-standing) at 2h and 4h post-dose",
                        "Exclude subjects with baseline SBP < 110 mmHg"
                    ]
                },
                {
                    "type": "Sprue-like enteropathy",
                    "description": "Rare but serious GI adverse effect class-specific to olmesartan",
                    "requirements": [
                        "Detailed GI history at screening",
                        "Instruct subjects to report severe diarrhoea or weight loss at follow-up"
                    ]
                }
            ],
            "sample_size_recommended": 26,
            "sample_size_basis": "Based on intrasubject CV of 22% for Cmax, 2-period crossover, 80% power, alpha 0.05, GMR 1.00",
            "intrasubject_cv": 22.0,
            "source_references": [
                "Benicar (olmesartan medoxomil) US Prescribing Information. Daiichi Sankyo 2022.",
                "FDA Guidance for Industry: Olmesartan Medoxomil Tablets BE Recommendation",
                "ICH M13A Guideline on Bioequivalence for Immediate-Release Solid Oral Dosage Forms (2023)"
            ],
            "raw_response": "Seeded from Cliantha study archive.",
        },
    },
]


async def seed_database():
    """Seed the database with example studies if empty."""
    count = await Study.count()
    if count > 0:
        return  # Already seeded

    for seed in SEED_STUDIES:
        now = datetime.utcnow()
        study = Study(
            id=seed["id"],
            name=seed["name"],
            status=seed["status"],
            org_id="cliantha",
            created_at=now,
            updated_at=now,
        )
        await study.insert()

        dp_data = seed["drug_profile"]
        drug_profile = DrugProfile(
            study_id=seed["id"],
            drug_name=dp_data["drug_name"],
            dose=dp_data["dose"],
            formulation=dp_data["formulation"],
            route=dp_data["route"],
            reference_product=dp_data["reference_product"],
            reference_country=dp_data["reference_country"],
            regulatory_targets=dp_data["regulatory_targets"],
            sponsor_name=dp_data["sponsor_name"],
            sponsor_country=dp_data["sponsor_country"],
            target_subjects=dp_data["target_subjects"],
            special_instructions=dp_data.get("special_instructions"),
            created_at=now,
        )
        await drug_profile.insert()

        pk_data = seed["pk_properties"]
        pk = DerivedPKProperties(
            study_id=seed["id"],
            half_life_hours=pk_data["half_life_hours"],
            tmax_hours=pk_data["tmax_hours"],
            absorption_class=pk_data["absorption_class"],
            pk_sampling_timepoints=pk_data["pk_sampling_timepoints"],
            washout_days=pk_data["washout_days"],
            confinement_hours=pk_data["confinement_hours"],
            ambulatory_visits=pk_data["ambulatory_visits"],
            posture_restriction=pk_data.get("posture_restriction"),
            safety_flags=pk_data["safety_flags"],
            sample_size_recommended=pk_data["sample_size_recommended"],
            sample_size_basis=pk_data["sample_size_basis"],
            intrasubject_cv=pk_data.get("intrasubject_cv"),
            source_references=pk_data["source_references"],
            raw_response=pk_data.get("raw_response", ""),
            created_at=now,
        )
        await pk.insert()

    print("Database seeded with 3 example Cliantha studies.")


# ──────────────────────────────────────────────
# Startup / Shutdown
# ──────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await connect_db(DOCUMENT_MODELS)
    await seed_database()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────

app.include_router(studies.router, prefix="/api")
app.include_router(drug_lookup.router, prefix="/api")
app.include_router(protocol.router, prefix="/api")
app.include_router(risk.router, prefix="/api")
app.include_router(screening.router, prefix="/api")
app.include_router(templates.router, prefix="/api")


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "TrialOS API", "version": "1.0.0"}


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "TrialOS API",
        "version": "1.0.0",
        "description": "Clinical Trial AI Platform for Cliantha CRO",
        "docs": "/docs",
        "redoc": "/redoc",
    }
