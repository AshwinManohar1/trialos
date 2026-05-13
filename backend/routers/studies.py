from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import List

from models import Study, DrugProfile, DerivedPKProperties, ProtocolDocument, RiskReport, ScreeningForecast
from schemas import StudyCreate, StudyResponse, StudyDetailResponse, StudyListItemResponse, DrugProfileResponse, DerivedPKPropertiesResponse, ProtocolDocumentResponse, RiskReportResponse, ScreeningForecastResponse

router = APIRouter(tags=["Studies"])


async def _get_next_study_id() -> str:
    """Generate next study ID in format C1B{6-digit-number} starting from 06600."""
    studies = await Study.find_all().to_list()
    max_num = 6599  # so first generated is 06600
    for s in studies:
        sid = s.id
        if sid and sid.startswith("C1B") and len(sid) == 9:
            try:
                num = int(sid[3:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    next_num = max_num + 1
    return f"C1B{next_num:06d}"


def _study_response(s: Study) -> StudyResponse:
    return StudyResponse(
        id=s.id,
        org_id=s.org_id,
        name=s.name,
        status=s.status,
        study_phase=s.study_phase,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.post("/studies", response_model=StudyResponse, status_code=201)
async def create_study(payload: StudyCreate):
    # If caller provides an explicit ID, honor it; otherwise generate one
    study_id = payload.id if payload.id else await _get_next_study_id()

    existing = await Study.get(study_id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Study {study_id} already exists")

    now = datetime.utcnow()
    study = Study(
        id=study_id,
        name=payload.name,
        status="draft",
        study_phase=payload.study_phase,
        created_at=now,
        updated_at=now,
    )
    await study.insert()
    return _study_response(study)


@router.get("/studies", response_model=List[StudyListItemResponse])
async def list_studies():
    studies = await Study.find(Study.org_id == "cliantha").sort("-created_at").to_list()
    if not studies:
        return []

    study_ids = [s.id for s in studies]

    # Batch fetch drug profiles and risk reports (2 queries for any number of studies)
    drug_profiles = await DrugProfile.find({"study_id": {"$in": study_ids}}).to_list()
    risk_reports  = await RiskReport.find({"study_id": {"$in": study_ids}}).to_list()

    dp_map = {dp.study_id: dp for dp in drug_profiles}
    rr_map = {rr.study_id: rr for rr in risk_reports}

    result = []
    for s in studies:
        dp = dp_map.get(s.id)
        rr = rr_map.get(s.id)

        dp_out = DrugProfileResponse(
            id=str(dp.id),
            study_id=dp.study_id,
            drug_name=dp.drug_name,
            dose=dp.dose,
            formulation=dp.formulation,
            route=dp.route,
            reference_product=dp.reference_product,
            reference_country=dp.reference_country,
            regulatory_targets=dp.regulatory_targets,
            manufacturer=getattr(dp, "manufacturer", None),
            sponsor_name=dp.sponsor_name,
            sponsor_country=dp.sponsor_country,
            target_subjects=dp.target_subjects,
            special_instructions=dp.special_instructions,
            created_at=dp.created_at,
        ) if dp else None

        rr_out = RiskReportResponse(
            id=str(rr.id),
            study_id=rr.study_id,
            protocol_document_id=rr.protocol_document_id,
            findings=rr.findings,
            critical_count=rr.critical_count,
            warning_count=rr.warning_count,
            info_count=rr.info_count,
            generated_at=rr.generated_at,
        ) if rr else None

        result.append(StudyListItemResponse(
            id=s.id,
            org_id=s.org_id,
            name=s.name,
            status=s.status,
            study_phase=s.study_phase,
            created_at=s.created_at,
            updated_at=s.updated_at,
            drug_profile=dp_out,
            risk_report=rr_out,
        ))

    return result


@router.get("/studies/{study_id}", response_model=StudyDetailResponse)
async def get_study(study_id: str):
    study = await Study.get(study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")

    drug_profile = await DrugProfile.find_one(DrugProfile.study_id == study_id)
    pk_props = await DerivedPKProperties.find_one(DerivedPKProperties.study_id == study_id)
    proto_doc = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)
    risk_report = await RiskReport.find_one(RiskReport.study_id == study_id)
    screen_forecast = await ScreeningForecast.find_one(ScreeningForecast.study_id == study_id)

    return StudyDetailResponse(
        study=_study_response(study),
        drug_profile=DrugProfileResponse(
            id=str(drug_profile.id),
            study_id=drug_profile.study_id,
            drug_name=drug_profile.drug_name,
            dose=drug_profile.dose,
            formulation=drug_profile.formulation,
            route=drug_profile.route,
            reference_product=drug_profile.reference_product,
            reference_country=drug_profile.reference_country,
            regulatory_targets=drug_profile.regulatory_targets,
            sponsor_name=drug_profile.sponsor_name,
            sponsor_country=drug_profile.sponsor_country,
            target_subjects=drug_profile.target_subjects,
            special_instructions=drug_profile.special_instructions,
            created_at=drug_profile.created_at,
        ) if drug_profile else None,
        pk_properties=DerivedPKPropertiesResponse(
            id=str(pk_props.id),
            study_id=pk_props.study_id,
            half_life_hours=pk_props.half_life_hours,
            tmax_hours=pk_props.tmax_hours,
            absorption_class=pk_props.absorption_class,
            pk_sampling_timepoints=pk_props.pk_sampling_timepoints,
            washout_days=pk_props.washout_days,
            confinement_hours=pk_props.confinement_hours,
            ambulatory_visits=pk_props.ambulatory_visits,
            posture_restriction=pk_props.posture_restriction,
            safety_flags=pk_props.safety_flags,
            sample_size_recommended=pk_props.sample_size_recommended,
            sample_size_basis=pk_props.sample_size_basis,
            intrasubject_cv=pk_props.intrasubject_cv,
            source_references=pk_props.source_references,
            raw_response=pk_props.raw_response,
            created_at=pk_props.created_at,
        ) if pk_props else None,
        protocol_document=ProtocolDocumentResponse(
            id=str(proto_doc.id),
            study_id=proto_doc.study_id,
            template_filename=proto_doc.template_filename,
            filled_filename=proto_doc.filled_filename,
            template_source=proto_doc.template_source,
            status=proto_doc.status,
            error_message=proto_doc.error_message,
            created_at=proto_doc.created_at,
        ) if proto_doc else None,
        risk_report=RiskReportResponse(
            id=str(risk_report.id),
            study_id=risk_report.study_id,
            protocol_document_id=risk_report.protocol_document_id,
            findings=risk_report.findings,
            critical_count=risk_report.critical_count,
            warning_count=risk_report.warning_count,
            info_count=risk_report.info_count,
            generated_at=risk_report.generated_at,
        ) if risk_report else None,
        screening_forecast=ScreeningForecastResponse(
            id=str(screen_forecast.id),
            study_id=screen_forecast.study_id,
            predicted_failure_rate_low=screen_forecast.predicted_failure_rate_low,
            predicted_failure_rate_high=screen_forecast.predicted_failure_rate_high,
            subjects_to_screen=screen_forecast.subjects_to_screen,
            estimated_cost_inr=screen_forecast.estimated_cost_inr,
            criteria_risks=screen_forecast.criteria_risks,
            screening_order=screen_forecast.screening_order,
            generated_at=screen_forecast.generated_at,
        ) if screen_forecast else None,
    )


@router.delete("/studies/{study_id}", status_code=204)
async def delete_study(study_id: str):
    study = await Study.get(study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")

    # Delete all related documents
    for doc in await DrugProfile.find(DrugProfile.study_id == study_id).to_list():
        await doc.delete()
    for doc in await DerivedPKProperties.find(DerivedPKProperties.study_id == study_id).to_list():
        await doc.delete()
    for doc in await ProtocolDocument.find(ProtocolDocument.study_id == study_id).to_list():
        await doc.delete()
    for doc in await RiskReport.find(RiskReport.study_id == study_id).to_list():
        await doc.delete()
    for doc in await ScreeningForecast.find(ScreeningForecast.study_id == study_id).to_list():
        await doc.delete()

    await study.delete()
