import io
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from database import get_gridfs
from models import Study, DrugProfile, DerivedPKProperties, ProtocolDocument, OrgTemplate
from schemas import ProtocolDocumentResponse
from services import docx_service

router = APIRouter(tags=["Protocol"])


async def _require_study(study_id: str) -> Study:
    study = await Study.get(study_id)
    if not study:
        raise HTTPException(status_code=404, detail=f"Study {study_id} not found")
    return study


def _proto_out(p: ProtocolDocument) -> ProtocolDocumentResponse:
    return ProtocolDocumentResponse(
        id=str(p.id),
        study_id=p.study_id,
        template_filename=p.template_filename,
        filled_filename=p.filled_filename,
        template_source=p.template_source,
        status=p.status,
        error_message=p.error_message,
        created_at=p.created_at,
    )


@router.post(
    "/studies/{study_id}/protocol/upload",
    response_model=ProtocolDocumentResponse,
    status_code=201,
)
async def upload_protocol_template(study_id: str, file: UploadFile = File(...)):
    """Upload a DOCX template file for this study."""
    await _require_study(study_id)

    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are accepted.")

    contents = await file.read()
    bucket = get_gridfs()
    file_id = await bucket.upload_from_stream(
        f"{study_id}_{file.filename}", io.BytesIO(contents)
    )

    proto = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)

    if proto:
        # Delete old template from GridFS if exists
        if proto.template_gridfs_id:
            try:
                await bucket.delete(ObjectId(proto.template_gridfs_id))
            except Exception:
                pass
        proto.template_filename = file.filename
        proto.template_gridfs_id = str(file_id)
        proto.status = "pending"
        proto.error_message = None
        proto.filled_filename = None
        proto.filled_gridfs_id = None
        await proto.save()
    else:
        proto = ProtocolDocument(
            study_id=study_id,
            template_filename=file.filename,
            template_gridfs_id=str(file_id),
            status="pending",
            created_at=datetime.utcnow(),
        )
        await proto.insert()

    return _proto_out(proto)


@router.post(
    "/studies/{study_id}/protocol/fill",
    response_model=ProtocolDocumentResponse,
)
async def fill_protocol(study_id: str):
    """Fill a DOCX template with derived PK properties.

    Template resolution order:
    1. Per-study uploaded template (ProtocolDocument.template_gridfs_id)
    2. Org default template (OrgTemplate where is_default=True, org_id='cliantha')
    3. 400 error if neither exists
    """
    study = await _require_study(study_id)

    bucket = get_gridfs()
    template_bytes: bytes = None
    template_source: str = None
    template_filename: str = None

    proto = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)

    # 1. Check per-study uploaded template
    if proto and proto.template_gridfs_id:
        stream = await bucket.open_download_stream(ObjectId(proto.template_gridfs_id))
        template_bytes = await stream.read()
        template_source = "study_upload"
        template_filename = proto.template_filename
    else:
        # 2. Fall back to org default template
        org_tpl = await OrgTemplate.find_one(
            OrgTemplate.org_id == "cliantha",
            OrgTemplate.is_default == True,
        )
        if org_tpl:
            stream = await bucket.open_download_stream(ObjectId(org_tpl.gridfs_id))
            template_bytes = await stream.read()
            template_source = "org_template"
            template_filename = org_tpl.filename
        else:
            raise HTTPException(
                status_code=400,
                detail="Upload a template first via /api/templates/upload",
            )

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

    # Ensure a ProtocolDocument row exists
    if not proto:
        proto = ProtocolDocument(
            study_id=study_id,
            status="pending",
            created_at=datetime.utcnow(),
        )
        await proto.insert()

    proto.status = "processing"
    await proto.save()

    try:
        filled_bytes = docx_service.fill_protocol_template_bytes(
            template_bytes=template_bytes,
            study=study,
            drug_profile=drug_profile,
            pk=pk,
        )
        filled_filename = f"{study_id}_filled_protocol.docx"
        filled_id = await bucket.upload_from_stream(
            filled_filename, io.BytesIO(filled_bytes)
        )

        # Delete previous filled file from GridFS if any
        if proto.filled_gridfs_id:
            try:
                await bucket.delete(ObjectId(proto.filled_gridfs_id))
            except Exception:
                pass

        proto.filled_filename = filled_filename
        proto.filled_gridfs_id = str(filled_id)
        proto.template_source = template_source
        proto.template_filename = proto.template_filename or template_filename
        proto.status = "complete"
        proto.error_message = None
        await proto.save()

        # Advance study status: active → complete once protocol is generated
        if study.status in ("draft", "active"):
            study.status = "complete"
            study.updated_at = datetime.utcnow()
            await study.save()

    except Exception as e:
        proto.status = "failed"
        proto.error_message = str(e)
        await proto.save()
        raise HTTPException(status_code=500, detail=f"Protocol fill failed: {e}")

    return _proto_out(proto)


@router.get(
    "/studies/{study_id}/protocol",
    response_model=ProtocolDocumentResponse,
)
async def get_protocol_status(study_id: str):
    await _require_study(study_id)

    proto = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)
    if not proto:
        raise HTTPException(
            status_code=404,
            detail="No protocol document found for this study.",
        )
    return _proto_out(proto)


@router.get("/studies/{study_id}/protocol/download")
async def download_filled_protocol(study_id: str):
    """Download the filled DOCX protocol from GridFS."""
    await _require_study(study_id)

    proto = await ProtocolDocument.find_one(ProtocolDocument.study_id == study_id)
    if not proto:
        raise HTTPException(status_code=404, detail="No protocol document found.")

    if proto.status != "complete" or not proto.filled_gridfs_id:
        raise HTTPException(
            status_code=400,
            detail=f"Protocol is not ready for download. Status: {proto.status}",
        )

    bucket = get_gridfs()
    stream = await bucket.open_download_stream(ObjectId(proto.filled_gridfs_id))
    contents = await stream.read()

    return StreamingResponse(
        io.BytesIO(contents),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{proto.filled_filename}"'},
    )
