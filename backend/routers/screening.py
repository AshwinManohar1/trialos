from datetime import datetime
from fastapi import APIRouter, HTTPException

from models import Study, DrugProfile, DerivedPKProperties, ScreeningForecast
from schemas import ScreeningForecastResponse
from services import claude_service

router = APIRouter(tags=["Screening Forecast"])


async def _require_study(study_id: str) -> Study:
    study = await Study.get(study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
    return study


def _forecast_out(f: ScreeningForecast) -> ScreeningForecastResponse:
    return ScreeningForecastResponse(
        id=str(f.id),
        study_id=f.study_id,
        predicted_failure_rate_low=f.predicted_failure_rate_low,
        predicted_failure_rate_high=f.predicted_failure_rate_high,
        subjects_to_screen=f.subjects_to_screen,
        estimated_cost_inr=f.estimated_cost_inr,
        criteria_risks=f.criteria_risks,
        screening_order=f.screening_order,
        generated_at=f.generated_at,
    )


@router.post(
    "/studies/{study_id}/screening/run",
    response_model=ScreeningForecastResponse,
)
async def run_screening_forecast(study_id: str):
    """
    Trigger screening forecast.
    Uses the drug profile for target subjects; if no explicit criteria provided,
    generates based on drug class defaults for BE healthy volunteer studies.
    """
    await _require_study(study_id)

    drug_profile = await DrugProfile.find_one(DrugProfile.study_id == study_id)
    if not drug_profile:
        raise HTTPException(
            status_code=400,
            detail="No drug profile found. Save a drug profile first.",
        )

    pk = await DerivedPKProperties.find_one(DerivedPKProperties.study_id == study_id)

    # criteria_text: any free-text study-specific additions from special instructions
    criteria_text = drug_profile.special_instructions or ""

    # drug_class from PK absorption_class (e.g. "BCS Class II, NSAID")
    drug_class = pk.absorption_class if pk else ""

    # Pass safety_flags directly — the service builds them into the prompt
    safety_flags = pk.safety_flags if pk else []

    try:
        data = await claude_service.forecast_screening(
            drug_name=drug_profile.drug_name,
            dose=drug_profile.dose,
            target_subjects=drug_profile.target_subjects,
            criteria_text=criteria_text,
            safety_flags=safety_flags,
            regulatory_targets=drug_profile.regulatory_targets or [],
            drug_class=drug_class,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Upsert screening forecast
    forecast = await ScreeningForecast.find_one(ScreeningForecast.study_id == study_id)

    if forecast:
        forecast.predicted_failure_rate_low = float(data.get("predicted_failure_rate_low", 0.0))
        forecast.predicted_failure_rate_high = float(data.get("predicted_failure_rate_high", 0.0))
        forecast.subjects_to_screen = int(data.get("subjects_to_screen", 0))
        forecast.estimated_cost_inr = float(data["estimated_cost_inr"]) if data.get("estimated_cost_inr") is not None else None
        forecast.criteria_risks = data.get("criteria_risks", [])
        forecast.screening_order = data.get("screening_order", [])
        forecast.generated_at = datetime.utcnow()
        await forecast.save()
    else:
        forecast = ScreeningForecast(
            study_id=study_id,
            predicted_failure_rate_low=float(data.get("predicted_failure_rate_low", 0.0)),
            predicted_failure_rate_high=float(data.get("predicted_failure_rate_high", 0.0)),
            subjects_to_screen=int(data.get("subjects_to_screen", 0)),
            estimated_cost_inr=float(data["estimated_cost_inr"]) if data.get("estimated_cost_inr") is not None else None,
            criteria_risks=data.get("criteria_risks", []),
            screening_order=data.get("screening_order", []),
            generated_at=datetime.utcnow(),
        )
        await forecast.insert()

    return _forecast_out(forecast)


@router.get(
    "/studies/{study_id}/screening",
    response_model=ScreeningForecastResponse,
)
async def get_screening_forecast(study_id: str):
    await _require_study(study_id)

    forecast = await ScreeningForecast.find_one(ScreeningForecast.study_id == study_id)
    if not forecast:
        raise HTTPException(
            status_code=404,
            detail="No screening forecast found. Run forecast first.",
        )
    return _forecast_out(forecast)
