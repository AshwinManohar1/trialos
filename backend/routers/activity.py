import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any

from services.activity_service import parse_protocol_pdf, generate_task_pdf

router = APIRouter(tags=["Activity"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ActivityTask(BaseModel):
    id: int
    name: str


class StudyInfo(BaseModel):
    protocol_id: Optional[str] = ''
    drug_name: Optional[str] = ''
    num_periods: Optional[int] = None
    num_subjects: Optional[int] = None


class ExportRequest(BaseModel):
    tasks: List[ActivityTask]
    study_info: StudyInfo
    logo_b64: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/activity/parse")
async def parse_activity_pdf(file: UploadFile = File(...)):
    """
    Upload a Cliantha protocol PDF.
    Returns ordered task list + study info + header image for use in export.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()
    if len(contents) < 1000:
        raise HTTPException(status_code=400, detail="File appears to be empty or too small.")

    try:
        result = await parse_protocol_pdf(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")

    if not result['tasks']:
        raise HTTPException(
            status_code=422,
            detail="No tasks could be extracted from this PDF. "
                   "Ensure it is a clinical trial protocol containing a Sequence of Events table.",
        )

    return result


@router.post("/activity/export")
async def export_activity_pdf(payload: ExportRequest):
    """
    Generate and download a formatted PDF task list.
    Accepts the (possibly edited) task list + study info + header image from /parse.
    """
    if not payload.tasks:
        raise HTTPException(status_code=400, detail="Task list is empty.")

    try:
        tasks_dicts = [t.model_dump() for t in payload.tasks]
        info_dict = payload.study_info.model_dump()
        pdf_bytes = generate_task_pdf(tasks_dicts, info_dict, payload.logo_b64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    protocol_id = payload.study_info.protocol_id or 'activity'
    filename = f"{protocol_id}_task_list.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
