"""
Activity Task List Service
Extracts ordered task list from a Cliantha clinical trial protocol PDF.

Strategy:
1. pdfplumber: find Sequence of Events table → extract first column (task names)
2. pdfplumber text fallback: scan for numbered / bulleted procedure lists
3. GPT-4o fallback: only if < 5 tasks found by rules
"""

import io
import re
import base64
import json
from typing import Optional
import pdfplumber


# ─── Constants ────────────────────────────────────────────────────────────────

SOE_KEYWORDS = [
    'sequence of event',
    'schedule of event',
    'schedule of assessment',
    'study procedures',
    'list of activities',
    'details of events',
    'proposed time relative',
    'applicable\nto',
    'dosing day',
    'check-in',
    'pre-dose',
]

# Patterns that indicate a row is a header or metadata, not a task
SKIP_PATTERNS = [
    r'^(assessment|procedure|activity|parameter|visit|timepoint|day|period|hour|time|evaluation)s?$',
    r'^[\d\.\-\+\s\(\)\/]+$',   # purely numeric / timepoint
    r'^\s*$',                     # blank
]

STUDY_INFO_PATTERNS = {
    'protocol_id': [
        r'\b(C1B\d{5})\b',
        r'Protocol\s*(?:No\.?|Number|ID)\s*[:\-]\s*([A-Z0-9\-]+)',
    ],
    'drug_name': [
        r'(?:study drug|test drug|drug name|investigational product)\s*[:\-]\s*([^\n\r,]+)',
        r'Title.*?(?:of\s+)?([A-Z][a-z]+(?:inib|artan|olol|pril|statin|mycin|cillin|vir|mab|nib)\b[^\n]*)',
    ],
    'num_periods': [
        r'(\d)\s*[-–]\s*[Pp]eriod',
        r'[Pp]eriod[s]?\s*[:\-]\s*(\d)',
        r'(\d)\s*[Pp]eriods?\s+(?:crossover|design|study)',
    ],
    'num_subjects': [
        r'(\d{2,3})\s*(?:healthy|male|female|adult)\s+(?:subjects|volunteers)',
        r'[Nn]umber\s+of\s+[Ss]ubjects\s*[:\-]\s*(\d+)',
        r'[Ee]nroll(?:ment|ed)?\s*[:\-]?\s*(\d+)',
        r'[Nn]\s*=\s*(\d+)',
    ],
}


# ─── Logo / Header Extraction ─────────────────────────────────────────────────

def extract_header_image_b64(pdf_bytes: bytes) -> Optional[str]:
    """
    Render the top 18% of page 1 as PNG and return as base64.
    This captures the logo + header exactly as it appears in the source PDF.
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if not pdf.pages:
                return None
            page = pdf.pages[0]
            crop_bottom = page.height * 0.18
            cropped = page.crop((0, 0, page.width, crop_bottom))
            img = cropped.to_image(resolution=180)
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{b64}"
    except Exception as e:
        print(f"⚠ Header image extraction failed: {e}")
        return None


# ─── Study Info Extraction ────────────────────────────────────────────────────

def extract_study_info(pdf_bytes: bytes) -> dict:
    """Extract protocol ID, drug name, periods, subjects from first 4 pages."""
    info = {
        'protocol_id': '',
        'drug_name': '',
        'num_periods': None,
        'num_subjects': None,
    }

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_to_check = min(4, len(pdf.pages))
            full_text = ''
            for i in range(pages_to_check):
                full_text += '\n' + (pdf.pages[i].extract_text() or '')

            for field, patterns in STUDY_INFO_PATTERNS.items():
                for pattern in patterns:
                    m = re.search(pattern, full_text, re.IGNORECASE)
                    if m:
                        val = m.group(1).strip()
                        if field in ('num_periods', 'num_subjects'):
                            try:
                                val = int(val)
                            except ValueError:
                                continue
                        info[field] = val
                        break

    except Exception as e:
        print(f"⚠ Study info extraction failed: {e}")

    return info


# ─── Task Extraction ──────────────────────────────────────────────────────────

def _should_skip(cell: str) -> bool:
    """Return True if a cell value should be excluded from the task list."""
    cell = cell.strip()
    if not cell or len(cell) < 3:
        return True
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, cell, re.IGNORECASE):
            return True
    return False


def _detect_task_column(header_row: list) -> int:
    """
    Given the header row of an SOE-style table, return the index of the
    column that contains task / event names.

    Cliantha protocols typically have:
      Col 0: Day
      Col 1: Proposed time / Clock time
      Col 2: Details of events / Event / Assessment  ← tasks here
      Col 3: Applicable to / Period

    We search column headers for keywords; default to col 2 if none found.
    """
    task_keywords = ['detail', 'event', 'assessment', 'procedure', 'activity', 'description']
    for i, cell in enumerate(header_row):
        cell_text = str(cell or '').lower().strip()
        if any(kw in cell_text for kw in task_keywords):
            return i
    # Fallback: if first col looks like "Day", use col 2
    first = str(header_row[0] or '').lower().strip()
    if 'day' in first or 'date' in first:
        return min(2, len(header_row) - 1)
    return 0  # worst-case: first column


def _extract_tasks_from_table(table: list) -> list:
    """
    Given a pdfplumber 2D table, detect the task-name column and extract
    task names in document order. Skips header row and None/empty cells.
    """
    if not table or len(table) < 2:
        return []

    header = table[0]
    task_col = _detect_task_column(header)
    tasks = []

    for row in table[1:]:  # skip header
        if not row or len(row) <= task_col:
            continue
        cell = str(row[task_col] or '').strip()
        # Normalise whitespace / newlines within cell
        cell = re.sub(r'\s+', ' ', cell).strip()
        if not _should_skip(cell):
            # For multi-part cells like "1) Lunch\n2) Dinner", take first part
            parts = re.split(r'\n\d+\)', cell)
            cell = parts[0].strip()
            cell = re.sub(r'^\d+\)\s*', '', cell).strip()
            if cell and not _should_skip(cell):
                tasks.append(cell)

    return tasks


def _is_soe_table(table: list) -> bool:
    """
    Return True if this table looks like a Sequence of Events table.
    SOE tables have a header row containing 'day' and one of the event keywords.
    Summary / parameter tables are excluded.
    """
    if not table or not table[0]:
        return False
    header_text = ' '.join(str(c or '').lower() for c in table[0])

    # Must contain a time/day column AND an event/detail column
    has_day = any(kw in header_text for kw in ['day', 'date', 'visit', 'period'])
    has_event = any(kw in header_text for kw in ['event', 'detail', 'assessment', 'procedure', 'activity'])
    if has_day and has_event:
        return True

    # Reject known summary table headers
    reject_keywords = ['protocol title', 'regulatory', 'objectives', 'study design',
                       'hemoglobin', 'hematology', 'restriction', 'compensation']
    if any(kw in header_text for kw in reject_keywords):
        return False

    return False


def _is_task_noise(cell: str) -> bool:
    """Return True if a cell value is clearly not a clinical task."""
    # ICD numbered consent items: "1. I have read..."
    if re.match(r'^\d+\.\s+[iI] ', cell):
        return True
    # Very long sentences (>250 chars) — narrative text, not tasks
    if len(cell) > 250:
        return True
    # Lab parameter lists
    if re.search(r'\b(hemoglobin|hematocrit|RBC|WBC|platelet|neutrophil|lymphocyte|BUN|creatinine)\b', cell, re.I):
        return True
    # Dietary restrictions list items
    if re.match(r'^(caffeine|cigarette|tobacco|recreational|alcohol|grapefruit|unusual diet|prescribed|OTC)', cell, re.I):
        return True
    return False


def _clean_task_cell(cell: str) -> str:
    """Clean up a task cell value."""
    # Remove leading list markers like "1)" at start
    cell = re.sub(r'^\d+\)\s*', '', cell).strip()
    # Truncate at sub-items: "Lunch 2) Further meals" → "Lunch"
    # Handles both "\n2)" and " 2)" inline
    cell = re.split(r'[\n\s]\d+\)', cell)[0].strip()
    # Normalise whitespace
    cell = re.sub(r'\s+', ' ', cell).strip()
    return cell


def _page_is_icd(text: str) -> bool:
    """Return True if this page is from the Informed Consent Document section."""
    icd_phrases = ['informed consent document', 'i have read and understood', 'voluntary participation']
    count = sum(1 for p in icd_phrases if p in text.lower())
    return count >= 2


def extract_tasks_rules(pdf_bytes: bytes) -> list:
    """
    Primary extraction: find the SOE table in the PDF and extract task names.

    Priority order:
    1. Pages with exact 'SEQUENCE OF EVENTS' or 'SCHEDULE OF EVENTS' section heading
    2. Pages with broader SOE keywords
    Rejects ICD pages, summary tables, and noise cells.
    """
    all_tasks = []

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            # Phase 1: find pages with exact SOE section heading (highest priority)
            priority_pages = []
            fallback_pages = []

            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ''
                text_lower = text.lower()

                # Skip ICD pages
                if _page_is_icd(text_lower):
                    continue

                exact_headings = ['sequence of events', 'schedule of events', 'schedule of assessments']
                if any(h in text_lower for h in exact_headings):
                    priority_pages.append(i)
                elif any(kw in text_lower for kw in SOE_KEYWORDS):
                    fallback_pages.append(i)

            target_pages = priority_pages if priority_pages else fallback_pages
            if not target_pages:
                target_pages = list(range(min(len(pdf.pages), 20)))

            # Phase 2: extract SOE tables from target pages
            for idx in target_pages:
                page = pdf.pages[idx]
                text_lower = (page.extract_text() or '').lower()

                # Skip ICD pages that slipped through
                if _page_is_icd(text_lower):
                    continue

                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 3:
                        continue
                    max_cols = max((len(row) for row in table if row), default=0)
                    if max_cols < 2:
                        continue
                    if not _is_soe_table(table):
                        continue

                    raw_tasks = _extract_tasks_from_table(table)
                    for t in raw_tasks:
                        t = _clean_task_cell(t)
                        if t and not _should_skip(t) and not _is_task_noise(t):
                            all_tasks.append(t)

    except Exception as e:
        print(f"⚠ Rule-based extraction failed: {e}")

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for t in all_tasks:
        key = t.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(t)

    return unique


async def extract_tasks_ai_fallback(pdf_bytes: bytes) -> list:
    """
    AI fallback using GPT-4o. Called only when rule-based extraction returns < 5 tasks.
    """
    try:
        from services.claude_service import get_client

        # Get text from first 10 pages
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages[:10]:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
        full_text = '\n'.join(pages_text)[:10000]

        response = await get_client().chat.completions.create(
            model='gpt-4o',
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'You are a clinical trial protocol parser. '
                        'Extract the complete ordered list of study procedures, assessments, and activities '
                        'from the Sequence of Events or Schedule of Assessments table. '
                        'Return JSON with key "tasks" containing an array of strings. '
                        'Preserve the exact document order. Do not add tasks that are not in the protocol.'
                    ),
                },
                {
                    'role': 'user',
                    'content': f'Extract all task/assessment names from this clinical trial protocol:\n\n{full_text}',
                },
            ],
            response_format={'type': 'json_object'},
            temperature=0,
        )

        data = json.loads(response.choices[0].message.content)
        raw = data.get('tasks', data.get('assessments', data.get('procedures', [])))
        return [str(t).strip() for t in raw if t and len(str(t).strip()) > 2]

    except Exception as e:
        print(f"⚠ AI fallback extraction failed: {e}")
        return []


async def parse_protocol_pdf(pdf_bytes: bytes) -> dict:
    """
    Full pipeline: extract tasks, study info, and header image from a protocol PDF.
    Returns a dict ready to be sent as JSON response.
    """
    parse_method = 'rules'
    warning = None

    # 1. Study info
    study_info = extract_study_info(pdf_bytes)

    # 2. Header image (top of page 1)
    logo_b64 = extract_header_image_b64(pdf_bytes)

    # 3. Task extraction
    task_names = extract_tasks_rules(pdf_bytes)

    if len(task_names) < 5:
        print(f"⚠ Rule-based extraction found only {len(task_names)} tasks — trying AI fallback")
        ai_tasks = await extract_tasks_ai_fallback(pdf_bytes)
        if len(ai_tasks) > len(task_names):
            task_names = ai_tasks
            parse_method = 'ai_fallback'
            warning = 'Rule-based extraction found few tasks. AI fallback was used.'
        elif not task_names:
            warning = 'Could not extract tasks automatically. Please check that the PDF contains a Sequence of Events table.'

    # 4. Build task objects
    tasks = [
        {'id': i + 1, 'name': name}
        for i, name in enumerate(task_names)
    ]

    return {
        'tasks': tasks,
        'study_info': study_info,
        'logo_b64': logo_b64,
        'parse_method': parse_method,
        'warning': warning,
        'task_count': len(tasks),
    }


# ─── PDF Generation (ReportLab) ──────────────────────────────────────────────

def generate_task_pdf(tasks: list, study_info: dict, logo_b64: Optional[str]) -> bytes:
    """
    Generate a formatted PDF task list using ReportLab.
    Matches Cliantha's clinical document aesthetic.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Spacer, Image, Paragraph,
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from datetime import datetime

    buffer = io.BytesIO()
    PAGE_W, PAGE_H = A4  # 595.28 x 841.89 pts

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.5 * cm,
    )

    story = []
    styles = getSampleStyleSheet()

    navy = colors.HexColor('#1B2A3B')
    teal = colors.HexColor('#0F7B6C')
    border = colors.HexColor('#DEE2E6')
    surface2 = colors.HexColor('#F8F9FA')
    text3 = colors.HexColor('#6C757D')

    # ── Header image (logo from source PDF) ──────────────────────────────
    if logo_b64:
        try:
            img_data = base64.b64decode(logo_b64.split(',')[1])
            usable_width = PAGE_W - 3 * cm  # account for margins
            img = Image(io.BytesIO(img_data), width=usable_width, height=2.5 * cm)
            img.hAlign = 'CENTER'
            story.append(img)
            story.append(Spacer(1, 0.4 * cm))
        except Exception as e:
            print(f"⚠ Logo embed failed: {e}")

    # ── Document title ────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        textColor=navy,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    story.append(Paragraph('ACTIVITY TASK LIST', title_style))

    # ── Study info strip ──────────────────────────────────────────────────
    info_parts = []
    if study_info.get('protocol_id'):
        info_parts.append(f"Protocol: {study_info['protocol_id']}")
    if study_info.get('drug_name'):
        info_parts.append(f"Drug: {study_info['drug_name']}")
    if study_info.get('num_periods'):
        info_parts.append(f"Periods: {study_info['num_periods']}")
    if study_info.get('num_subjects'):
        info_parts.append(f"Subjects: {study_info['num_subjects']}")
    info_parts.append(f"Generated: {datetime.utcnow().strftime('%d %b %Y')}")

    if info_parts:
        info_style = ParagraphStyle(
            'Info',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            textColor=text3,
            alignment=TA_CENTER,
            spaceAfter=10,
        )
        story.append(Paragraph('  ·  '.join(info_parts), info_style))

    story.append(Spacer(1, 0.2 * cm))

    # ── Task table ────────────────────────────────────────────────────────
    usable_width = PAGE_W - 3 * cm
    col_widths = [1.2 * cm, usable_width - 1.2 * cm - 1.5 * cm, 1.5 * cm]

    # Header row
    table_data = [['#', 'Task / Assessment', '✓']]

    task_style = ParagraphStyle(
        'Task',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
    )

    for task in tasks:
        para = Paragraph(str(task.get('name', '')), task_style)
        table_data.append([str(task.get('id', '')), para, ''])

    t = Table(table_data, colWidths=col_widths, repeatRows=1)

    row_count = len(table_data)
    alt_bg = [
        ('BACKGROUND', (0, i), (-1, i), surface2)
        for i in range(2, row_count, 2)
    ]

    t.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), navy),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        # Data
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),   # # col
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),      # task col
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),    # ✓ col
        ('LEFTPADDING', (1, 1), (1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.4, border),
        ('LINEBELOW', (0, 0), (-1, 0), 1, teal),
        # Alternating rows
        *alt_bg,
    ]))

    story.append(t)

    # ── Footer note ───────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        textColor=text3,
        alignment=TA_CENTER,
    )
    story.append(Paragraph(
        'Auto-generated by TrialOS · Cliantha Research Ltd · For internal use only',
        footer_style,
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
