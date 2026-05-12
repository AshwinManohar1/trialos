from datetime import datetime
from fastapi import APIRouter, HTTPException

from models import Study, DrugProfile, DerivedPKProperties
from schemas import DrugProfileCreate, DrugProfileResponse, DerivedPKPropertiesResponse
from services import claude_service

router = APIRouter(tags=["Drug Lookup"])


async def _require_study(study_id: str) -> Study:
    study = await Study.get(study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
    return study


def _profile_out(p: DrugProfile) -> DrugProfileResponse:
    return DrugProfileResponse(
        id=str(p.id),
        study_id=p.study_id,
        drug_name=p.drug_name,
        dose=p.dose,
        formulation=p.formulation,
        route=p.route,
        reference_product=p.reference_product,
        reference_country=p.reference_country,
        regulatory_targets=p.regulatory_targets,
        manufacturer=getattr(p, "manufacturer", None),
        sponsor_name=p.sponsor_name,
        sponsor_country=p.sponsor_country,
        target_subjects=p.target_subjects,
        special_instructions=p.special_instructions,
        created_at=p.created_at,
    )


def _pk_out(pk: DerivedPKProperties) -> DerivedPKPropertiesResponse:
    return DerivedPKPropertiesResponse(
        id=str(pk.id),
        study_id=pk.study_id,
        half_life_hours=pk.half_life_hours,
        tmax_hours=pk.tmax_hours,
        absorption_class=pk.absorption_class,
        pk_sampling_timepoints=pk.pk_sampling_timepoints,
        washout_days=pk.washout_days,
        confinement_hours=pk.confinement_hours,
        ambulatory_visits=pk.ambulatory_visits,
        posture_restriction=pk.posture_restriction,
        safety_flags=pk.safety_flags,
        sample_size_recommended=pk.sample_size_recommended,
        sample_size_basis=pk.sample_size_basis,
        intrasubject_cv=pk.intrasubject_cv,
        source_references=pk.source_references,
        raw_response=pk.raw_response,
        created_at=pk.created_at,
    )


@router.post(
    "/studies/{study_id}/drug-profile",
    response_model=DrugProfileResponse,
    status_code=201,
)
async def save_drug_profile(study_id: str, payload: DrugProfileCreate):
    await _require_study(study_id)

    # Delete existing profile for this study (one-to-one)
    existing = await DrugProfile.find_one(DrugProfile.study_id == study_id)
    if existing:
        await existing.delete()

    profile = DrugProfile(
        study_id=study_id,
        drug_name=payload.drug_name,
        dose=payload.dose,
        formulation=payload.formulation,
        route=payload.route,
        reference_product=payload.reference_product,
        reference_country=payload.reference_country,
        regulatory_targets=payload.regulatory_targets,
        manufacturer=payload.manufacturer,
        sponsor_name=payload.sponsor_name,
        sponsor_country=payload.sponsor_country,
        target_subjects=payload.target_subjects,
        special_instructions=payload.special_instructions,
        created_at=datetime.utcnow(),
    )
    await profile.insert()
    return _profile_out(profile)


@router.post(
    "/studies/{study_id}/drug-lookup",
    response_model=DerivedPKPropertiesResponse,
)
async def trigger_drug_lookup(study_id: str):
    """Trigger AI PK lookup using saved drug profile."""
    await _require_study(study_id)

    drug_profile = await DrugProfile.find_one(DrugProfile.study_id == study_id)
    if not drug_profile:
        raise HTTPException(
            status_code=400,
            detail="No drug profile found. Save a drug profile first via POST /drug-profile.",
        )

    try:
        data, raw = await claude_service.lookup_drug_pk(
            drug_name=drug_profile.drug_name,
            dose=drug_profile.dose,
            formulation=drug_profile.formulation,
            special_instructions=drug_profile.special_instructions or "",
            regulatory_targets=drug_profile.regulatory_targets or [],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Delete existing derived properties for this study
    existing_pk = await DerivedPKProperties.find_one(DerivedPKProperties.study_id == study_id)
    if existing_pk:
        await existing_pk.delete()

    pk = DerivedPKProperties(
        study_id=study_id,
        half_life_hours=float(data.get("half_life_hours", 0)),
        tmax_hours=float(data.get("tmax_hours", 0)),
        absorption_class=data.get("absorption_class", ""),
        pk_sampling_timepoints=data.get("pk_sampling_timepoints", []),
        washout_days=int(data.get("washout_days", 7)),
        confinement_hours=int(data.get("confinement_hours", 24)),
        ambulatory_visits=data.get("ambulatory_visits", []),
        posture_restriction=data.get("posture_restriction"),
        safety_flags=data.get("safety_flags", []),
        sample_size_recommended=int(data.get("sample_size_recommended", 0)),
        sample_size_basis=data.get("sample_size_basis", ""),
        intrasubject_cv=float(data["intrasubject_cv"]) if data.get("intrasubject_cv") is not None else None,
        source_references=data.get("source_references", []),
        raw_response=raw,
        created_at=datetime.utcnow(),
    )
    await pk.insert()

    # Advance study status: draft → active once PK properties are computed
    study = await Study.get(study_id)
    if study and study.status == "draft":
        study.status = "active"
        study.updated_at = datetime.utcnow()
        await study.save()

    return _pk_out(pk)


@router.get(
    "/studies/{study_id}/drug-lookup",
    response_model=DerivedPKPropertiesResponse,
)
async def get_drug_lookup(study_id: str):
    await _require_study(study_id)

    pk = await DerivedPKProperties.find_one(DerivedPKProperties.study_id == study_id)
    if not pk:
        raise HTTPException(
            status_code=404,
            detail="No PK properties found for this study. Run drug lookup first.",
        )
    return _pk_out(pk)
