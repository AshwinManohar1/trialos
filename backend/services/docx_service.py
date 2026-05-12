import io
from datetime import datetime
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH


def _build_variable_map(study, drug_profile, pk) -> dict:
    """Build the placeholder → value mapping."""
    regulatory_targets_str = (
        ", ".join(drug_profile.regulatory_targets)
        if drug_profile.regulatory_targets
        else ""
    )

    # Format PK sampling timepoints
    timepoints = pk.pk_sampling_timepoints or []
    timepoints_str = ", ".join(
        (f"{t:g}h" if t != int(t) else f"{int(t)}h") for t in timepoints
    )

    ambulatory = ", ".join(pk.ambulatory_visits) if pk.ambulatory_visits else "None"

    return {
        "{{DRUG_NAME}}": drug_profile.drug_name or "",
        "{{DOSE}}": drug_profile.dose or "",
        "{{FORMULATION}}": drug_profile.formulation or "",
        "{{REFERENCE_PRODUCT}}": drug_profile.reference_product or "",
        "{{REFERENCE_COUNTRY}}": drug_profile.reference_country or "",
        "{{SPONSOR_NAME}}": drug_profile.sponsor_name or "",
        "{{SPONSOR_COUNTRY}}": drug_profile.sponsor_country or "",
        "{{REGULATORY_TARGETS}}": regulatory_targets_str,
        "{{TARGET_SUBJECTS}}": str(drug_profile.target_subjects or ""),
        "{{HALF_LIFE}}": str(pk.half_life_hours or ""),
        "{{TMAX}}": str(pk.tmax_hours or ""),
        "{{WASHOUT_DAYS}}": str(pk.washout_days or ""),
        "{{CONFINEMENT_HOURS}}": str(pk.confinement_hours or ""),
        "{{PK_SAMPLING_SCHEDULE}}": timepoints_str,
        "{{AMBULATORY_VISITS}}": ambulatory,
        "{{POSTURE_RESTRICTION}}": pk.posture_restriction or "No specific posture restriction",
        "{{SAMPLE_SIZE_RECOMMENDED}}": str(pk.sample_size_recommended or ""),
        "{{SAMPLE_SIZE_BASIS}}": pk.sample_size_basis or "",
        "{{STUDY_ID}}": study.id or "",
        "{{VERSION}}": "1.0",
        "{{DATE}}": study.created_at.strftime("%d %B %Y") if study.created_at else "",
    }


def _replace_in_paragraph(paragraph, var_map: dict):
    """Replace placeholders in a paragraph, preserving formatting as best as possible."""
    for run in paragraph.runs:
        for placeholder, value in var_map.items():
            if placeholder in run.text:
                run.text = run.text.replace(placeholder, value)

    # Also check full paragraph text for placeholders split across runs
    full_text = "".join(run.text for run in paragraph.runs)
    for placeholder, value in var_map.items():
        if placeholder in full_text:
            # Rebuild paragraph text in first run
            if paragraph.runs:
                paragraph.runs[0].text = full_text.replace(placeholder, value)
                for run in paragraph.runs[1:]:
                    run.text = ""
                full_text = paragraph.runs[0].text


def _has_placeholders(doc: Document) -> bool:
    """Check if DOCX contains any {{ }} placeholders."""
    for para in doc.paragraphs:
        if "{{" in para.text:
            return True
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if "{{" in para.text:
                        return True
    return False


def _append_summary_page(doc: Document, study, drug_profile, pk):
    """Append a generated protocol summary page to the document."""
    doc.add_page_break()

    heading = doc.add_heading("Generated Protocol Summary", level=1)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph(
        f"Study ID: {study.id}  |  Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    ).alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph("")

    # Drug Details
    doc.add_heading("1. Drug Details", level=2)
    table1 = doc.add_table(rows=1, cols=2)
    table1.style = "Table Grid"
    hdr = table1.rows[0].cells
    hdr[0].text = "Field"
    hdr[1].text = "Value"

    rows_data = [
        ("Drug Name", drug_profile.drug_name),
        ("Dose", drug_profile.dose),
        ("Formulation", drug_profile.formulation),
        ("Route", drug_profile.route),
        ("Reference Product", drug_profile.reference_product),
        ("Reference Country", drug_profile.reference_country),
        ("Sponsor", f"{drug_profile.sponsor_name} ({drug_profile.sponsor_country})"),
        ("Regulatory Targets", ", ".join(drug_profile.regulatory_targets or [])),
        ("Target Subjects", str(drug_profile.target_subjects)),
    ]
    for label, value in rows_data:
        row = table1.add_row().cells
        row[0].text = label
        row[1].text = str(value) if value is not None else ""

    doc.add_paragraph("")

    # PK Properties
    doc.add_heading("2. Pharmacokinetic Properties", level=2)
    table2 = doc.add_table(rows=1, cols=2)
    table2.style = "Table Grid"
    hdr2 = table2.rows[0].cells
    hdr2[0].text = "Parameter"
    hdr2[1].text = "Value"

    pk_rows = [
        ("Half-life (t½)", f"{pk.half_life_hours} hours"),
        ("Tmax", f"{pk.tmax_hours} hours"),
        ("Absorption Class", pk.absorption_class),
        ("Intrasubject CV", f"{pk.intrasubject_cv}%" if pk.intrasubject_cv else "Not reported"),
        ("Washout Period", f"{pk.washout_days} days"),
        ("Confinement Duration", f"{pk.confinement_hours} hours"),
        ("Posture Restriction", pk.posture_restriction or "None"),
        ("Recommended Sample Size", str(pk.sample_size_recommended)),
        ("Sample Size Basis", pk.sample_size_basis),
    ]
    for label, value in pk_rows:
        row = table2.add_row().cells
        row[0].text = label
        row[1].text = str(value) if value is not None else ""

    doc.add_paragraph("")

    # PK Sampling Schedule
    doc.add_heading("3. PK Sampling Schedule", level=2)
    timepoints = pk.pk_sampling_timepoints or []
    timepoints_str = ", ".join(
        (f"{t:g}h" if t != int(t) else f"{int(t)}h") for t in timepoints
    )
    doc.add_paragraph(timepoints_str or "Not specified")

    # Ambulatory Visits
    if pk.ambulatory_visits:
        doc.add_heading("4. Ambulatory Visits", level=2)
        for visit in pk.ambulatory_visits:
            doc.add_paragraph(f"• {visit}", style="List Bullet")

    # Safety Flags
    if pk.safety_flags:
        doc.add_heading("5. Safety Flags", level=2)
        for flag in pk.safety_flags:
            p = doc.add_paragraph()
            run = p.add_run(f"[{flag.get('type', 'Flag')}] ")
            run.bold = True
            p.add_run(flag.get("description", ""))
            reqs = flag.get("requirements", [])
            if reqs:
                for req in reqs:
                    doc.add_paragraph(f"  → {req}", style="List Bullet")

    # Source References
    if pk.source_references:
        doc.add_heading("6. Source References", level=2)
        for i, ref in enumerate(pk.source_references, 1):
            doc.add_paragraph(f"{i}. {ref}")


def fill_protocol_template_bytes(
    template_bytes: bytes,
    study,
    drug_profile,
    pk,
) -> bytes:
    """
    Fill template from bytes, return filled bytes. No disk I/O.
    Placeholders are like {{DRUG_NAME}}, {{DOSE}}, {{WASHOUT_DAYS}}, etc.
    If template has no placeholders, appends a generated summary page.

    Returns bytes of the filled/generated DOCX.
    """
    doc = Document(io.BytesIO(template_bytes))
    var_map = _build_variable_map(study, drug_profile, pk)
    has_placeholders = _has_placeholders(doc)

    if has_placeholders:
        # Replace in paragraphs
        for para in doc.paragraphs:
            _replace_in_paragraph(para, var_map)

        # Replace in tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        _replace_in_paragraph(para, var_map)

        # Replace in headers and footers
        for section in doc.sections:
            for para in section.header.paragraphs:
                _replace_in_paragraph(para, var_map)
            for para in section.footer.paragraphs:
                _replace_in_paragraph(para, var_map)

    else:
        # No placeholders — append summary page
        _append_summary_page(doc, study, drug_profile, pk)

    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output.read()


def fill_protocol_template(template_path: str, study, drug_profile, pk) -> str:
    """
    Legacy file-based wrapper. Opens DOCX from path, delegates to
    fill_protocol_template_bytes, writes output to disk, returns output path.
    """
    import os

    with open(template_path, "rb") as f:
        template_bytes = f.read()

    filled_bytes = fill_protocol_template_bytes(template_bytes, study, drug_profile, pk)

    generated_dir = os.getenv("GENERATED_DIR", "./generated")
    os.makedirs(generated_dir, exist_ok=True)

    base_name = os.path.basename(template_path)
    name_no_ext = os.path.splitext(base_name)[0]
    out_filename = f"{study.id}_{name_no_ext}_filled.docx"
    out_path = os.path.join(generated_dir, out_filename)

    with open(out_path, "wb") as f:
        f.write(filled_bytes)

    return out_path


def extract_text_from_docx(file_path: str) -> str:
    """Extract all text from a DOCX file on disk."""
    doc = Document(file_path)
    texts = []
    for para in doc.paragraphs:
        if para.text.strip():
            texts.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if para.text.strip():
                        texts.append(para.text)
    return "\n".join(texts)


def extract_text_from_docx_bytes(data: bytes) -> str:
    """Extract all text from a DOCX supplied as bytes (in-memory)."""
    doc = Document(io.BytesIO(data))
    texts = []
    for para in doc.paragraphs:
        if para.text.strip():
            texts.append(para.text)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if para.text.strip():
                        texts.append(para.text)
    return "\n".join(texts)
