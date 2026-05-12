import io
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File

from database import get_gridfs
from models import Study, DrugProfile, DerivedPKProperties, ProtocolDocument, RiskReport
from schemas import RiskReportResponse
from services import claude_service, pdf_service, docx_service

router = APIRouter(tags=["Risk Analyzer"])


async def _require_study(study_id: str) -> Study:
    study = await Study.get(study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
    return study


def _risk_out(r: RiskReport) -> RiskReportResponse:
    return RiskReportResponse(
        id=str(r.id),
        study_id=r.study_id,
        protocol_document_id=r.protocol_document_id,
        findings=r.findings,
        critical_count=r.critical_count,
        warning_count=r.warning_count,
        info_count=r.info_count,
        generated_at=r.generated_at,
    )


@router.post(
    "/studies/{study_id}/risk/upload",
    response_model=RiskReportResponse,
    status_code=202,
)
async def upload_risk_document(
    study_id: str,
    file: UploadFile = File(...),
):
    """Upload a PDF or DOCX file to use for risk analysis (separate from protocol template)."""
    await _require_study(study_id)

    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="Only .pdf or .docx files are accepted.")

    contents = await file.read()
    bucket = get_gridfs()
    file_id = await bucket.upload_from_stream(
        f"{study_id}_risk_{filename}", io.BytesIO(contents)
    )

    # Create or update ProtocolDocument row (used as risk analysis source)
    proto_doc = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)

    if proto_doc:
        # Replace old template in GridFS
        if proto_doc.template_gridfs_id:
            try:
                await bucket.delete(ObjectId(proto_doc.template_gridfs_id))
            except Exception:
                pass
        proto_doc.template_filename = filename
        proto_doc.template_gridfs_id = str(file_id)
        proto_doc.status = "pending"
        await proto_doc.save()
    else:
        proto_doc = ProtocolDocument(
            study_id=study_id,
            template_filename=filename,
            template_gridfs_id=str(file_id),
            status="pending",
            created_at=datetime.utcnow(),
        )
        await proto_doc.insert()

    # Return stub risk report placeholder
    risk_report = await RiskReport.find_one(RiskReport.study_id == study_id)
    if not risk_report:
        risk_report = RiskReport(
            study_id=study_id,
            protocol_document_id=str(proto_doc.id),
            findings=[],
            critical_count=0,
            warning_count=0,
            info_count=0,
            generated_at=datetime.utcnow(),
        )
        await risk_report.insert()

    return _risk_out(risk_report)


@router.post(
    "/studies/{study_id}/risk/analyze",
    response_model=RiskReportResponse,
)
async def analyze_risk(study_id: str):
    """
    Trigger risk analysis.
    - If a protocol document exists in GridFS, analyzes it.
    - If no protocol, generates a pre-protocol risk report from PK properties.
    """
    await _require_study(study_id)

    drug_profile = await DrugProfile.find_one(DrugProfile.study_id == study_id)
    if not drug_profile:
        raise HTTPException(
            status_code=400,
            detail="No drug profile found. Save a drug profile first.",
        )

    pk = await DerivedPKProperties.find_one(DerivedPKProperties.study_id == study_id)
    if not pk:
        raise HTTPException(
            status_code=400,
            detail="No PK properties found. Run drug lookup first.",
        )

    proto_doc = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)

    proto_doc_id: str = None
    protocol_text: str = ""

    if proto_doc and proto_doc.template_gridfs_id:
        proto_doc_id = str(proto_doc.id)
        filename = proto_doc.template_filename or ""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        try:
            bucket = get_gridfs()
            stream = await bucket.open_download_stream(ObjectId(proto_doc.template_gridfs_id))
            file_bytes = await stream.read()
            if ext == "pdf":
                protocol_text = pdf_service.extract_text_from_pdf_bytes(file_bytes)
            elif ext == "docx":
                protocol_text = docx_service.extract_text_from_docx_bytes(file_bytes)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract text from document: {str(e)}",
            )

    # Run analysis
    try:
        if protocol_text:
            data = await claude_service.analyze_protocol_risk(
                drug_name=drug_profile.drug_name,
                dose=drug_profile.dose,
                half_life=pk.half_life_hours,
                tmax=pk.tmax_hours,
                safety_flags=pk.safety_flags or [],
                protocol_text=protocol_text,
                regulatory_targets=drug_profile.regulatory_targets or [],
            )
        else:
            # Pre-protocol analysis
            data = await claude_service.analyze_pre_protocol_risk(
                drug_name=drug_profile.drug_name,
                dose=drug_profile.dose,
                half_life=pk.half_life_hours,
                tmax=pk.tmax_hours,
                washout_days=pk.washout_days,
                confinement_hours=pk.confinement_hours,
                safety_flags=pk.safety_flags or [],
                pk_timepoints=pk.pk_sampling_timepoints or [],
                regulatory_targets=drug_profile.regulatory_targets or [],
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    findings = data.get("findings", [])
    critical_count = sum(1 for f in findings if f.get("severity") == "critical")
    warning_count = sum(1 for f in findings if f.get("severity") == "warning")
    info_count = sum(1 for f in findings if f.get("severity") == "info")

    # Upsert risk report
    risk_report = await RiskReport.find_one(RiskReport.study_id == study_id)

    if risk_report:
        risk_report.findings = findings
        risk_report.critical_count = critical_count
        risk_report.warning_count = warning_count
        risk_report.info_count = info_count
        risk_report.protocol_document_id = proto_doc_id
        risk_report.generated_at = datetime.utcnow()
        await risk_report.save()
    else:
        risk_report = RiskReport(
            study_id=study_id,
            protocol_document_id=proto_doc_id,
            findings=findings,
            critical_count=critical_count,
            warning_count=warning_count,
            info_count=info_count,
            generated_at=datetime.utcnow(),
        )
        await risk_report.insert()

    return _risk_out(risk_report)


@router.get(
    "/studies/{study_id}/risk",
    response_model=RiskReportResponse,
)
async def get_risk_report(study_id: str):
    await _require_study(study_id)

    risk_report = await RiskReport.find_one(RiskReport.study_id == study_id)
    if not risk_report:
        raise HTTPException(
            status_code=404,
            detail="No risk report found for this study. Run risk analysis first.",
        )
    return _risk_out(risk_report)
