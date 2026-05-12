import io
from datetime import datetime
from typing import List
from bson import ObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from database import get_gridfs
from models import OrgTemplate
from schemas import OrgTemplateOut

router = APIRouter(tags=["Templates"])


def _tpl_out(t: OrgTemplate) -> OrgTemplateOut:
    return OrgTemplateOut(
        id=str(t.id),
        org_id=t.org_id,
        name=t.name,
        description=t.description,
        filename=t.filename,
        is_default=t.is_default,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("/templates", response_model=List[OrgTemplateOut])
async def list_templates():
    """List all org templates for org_id='cliantha'."""
    templates = await OrgTemplate.find(OrgTemplate.org_id == "cliantha").sort("created_at").to_list()
    return [_tpl_out(t) for t in templates]


@router.post("/templates/upload", response_model=OrgTemplateOut, status_code=201)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(None),
):
    """Upload a new org-level DOCX template."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are accepted.")

    contents = await file.read()
    bucket = get_gridfs()
    file_id = await bucket.upload_from_stream(f"org_{file.filename}", io.BytesIO(contents))

    count = await OrgTemplate.find(OrgTemplate.org_id == "cliantha").count()
    is_first = count == 0

    now = datetime.utcnow()
    tpl = OrgTemplate(
        org_id="cliantha",
        name=name,
        description=description,
        filename=file.filename,
        gridfs_id=str(file_id),
        is_default=is_first,
        created_at=now,
        updated_at=now,
    )
    await tpl.insert()
    return _tpl_out(tpl)


@router.get("/templates/{template_id}", response_model=OrgTemplateOut)
async def get_template(template_id: str):
    """Get a single org template by ID."""
    tpl = await OrgTemplate.get(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found.")
    return _tpl_out(tpl)


@router.patch("/templates/{template_id}/default", response_model=OrgTemplateOut)
async def set_default_template(template_id: str):
    """Set this template as the org default; unsets all others."""
    tpl = await OrgTemplate.get(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found.")

    # Unset all existing defaults for this org, set only this one
    all_tpls = await OrgTemplate.find(OrgTemplate.org_id == tpl.org_id).to_list()
    for t in all_tpls:
        t.is_default = (str(t.id) == template_id)
        t.updated_at = datetime.utcnow()
        await t.save()

    # Re-fetch to get fresh state
    tpl = await OrgTemplate.get(template_id)
    return _tpl_out(tpl)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: str):
    """Delete an org template. Removes file from GridFS and DB row."""
    tpl = await OrgTemplate.get(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found.")

    bucket = get_gridfs()
    try:
        await bucket.delete(ObjectId(tpl.gridfs_id))
    except Exception:
        pass

    await tpl.delete()
