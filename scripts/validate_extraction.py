"""
Pre-build validation script.
Runs Claude API extraction against real protocol PDFs to validate
output quality before writing production code.

Usage:
    ANTHROPIC_API_KEY=sk-... python3 scripts/validate_extraction.py
    python3 scripts/validate_extraction.py --pdf activity-docs/C1B05975.pdf
"""

import os
import sys
import json
import argparse
import pdfplumber
import anthropic

EXTRACTION_PROMPT = """You are a clinical trial protocol extraction engine.

Extract the following structured information from the trial protocol text below.
Return ONLY valid JSON matching the schema exactly. No explanation, no markdown fences.

Schema:
{
  "protocol_id": "string (use filename or study number if found)",
  "study": {
    "title": "string",
    "phase": "string (BE / Phase 1 / Phase 2 / Phase 3 / Phase 4)",
    "therapeutic_area": "string",
    "sponsor": "string",
    "design": "string (e.g. open label, randomized, two-period crossover)"
  },
  "endpoints": {
    "primary": ["string"],
    "secondary": ["string"]
  },
  "criteria": {
    "inclusion": [
      {
        "id": "I1",
        "text": "string",
        "complexity_score": 0,
        "complexity_flags": [],
        "source_citation": {"page": 0, "quote_fragment": "string"}
      }
    ],
    "exclusion": [
      {
        "id": "E1",
        "text": "string",
        "complexity_score": 0,
        "complexity_flags": [],
        "source_citation": {"page": 0, "quote_fragment": "string"}
      }
    ]
  },
  "visits": [
    {
      "name": "string",
      "day": 0,
      "procedures": ["string"]
    }
  ],
  "task_list": [
    {
      "task_id": "T1",
      "description": "string",
      "assigned_role": "coordinator|PI|sponsor|IRB|pharmacist",
      "due": "string (e.g. Day -1, pre-dose, post-dose 48h)",
      "visit_ref": "string or null"
    }
  ],
  "roster_template": [
    {
      "role": "string",
      "required_count": 1,
      "qualifications": "string"
    }
  ],
  "recruitment_risk": {
    "score": 0,
    "top_risk_criteria": ["I3", "E7"],
    "rationale": "string"
  },
  "extraction_status": "complete|partial",
  "missing_sections": []
}

Complexity scoring for each criterion (0-10):
- +3 if criterion contains a negation ("no prior use of", "absence of", "must not have")
- +3 if criterion requires a specific lab value or numeric threshold
- +2 if criterion has a time-window constraint ("within N months/years")
- +2 if criterion uses a subjective term without a defined threshold ("clinically significant", "adequate")
- Sum, cap at 10

complexity_flags: list any of ["negation", "lab_threshold", "time_window", "subjective"] that apply.

source_citation.quote_fragment: copy 8-15 words verbatim from the source text that contain this criterion.
source_citation.page: page number where this criterion appears (1-indexed).

recruitment_risk.score: average of the top 3 highest complexity_score criteria, rounded to nearest integer.

Protocol text:
---
{text}
---
"""


def extract_text(pdf_path: str) -> tuple[str, int]:
    """Extract text from PDF, return (text, page_count)."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text:
                pages.append(f"[PAGE {i}]\n{text}")
    return "\n\n".join(pages), page_count


def chunk_by_sections(text: str, max_chars: int = 80000) -> list[str]:
    """
    For very long protocols, chunk by recognizable section headers.
    For our validation PDFs (42-53 pages), the full text fits in one call.
    """
    if len(text) <= max_chars:
        return [text]

    chunks = []
    current = []
    current_len = 0
    for line in text.split("\n"):
        if current_len + len(line) > max_chars and current:
            chunks.append("\n".join(current))
            current = []
            current_len = 0
        current.append(line)
        current_len += len(line)
    if current:
        chunks.append("\n".join(current))
    return chunks


def extract_protocol(pdf_path: str, client: anthropic.Anthropic) -> dict:
    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(pdf_path)}")
    print(f"{'='*60}")

    text, page_count = extract_text(pdf_path)
    print(f"  Extracted {page_count} pages, {len(text):,} characters")

    chunks = chunk_by_sections(text)
    print(f"  Processing in {len(chunks)} chunk(s)")

    prompt = EXTRACTION_PROMPT.format(text=chunks[0])

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()

    # Strip markdown fences if model adds them despite instructions
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = raw[:-3].strip()

    try:
        result = json.loads(raw)
        result["_source_pdf"] = os.path.basename(pdf_path)
        result["_page_count"] = page_count
        result["_char_count"] = len(text)
        print(f"  Extraction: SUCCESS")
        print(f"  Study: {result.get('study', {}).get('title', 'N/A')}")
        print(f"  Inclusion criteria: {len(result.get('criteria', {}).get('inclusion', []))}")
        print(f"  Exclusion criteria: {len(result.get('criteria', {}).get('exclusion', []))}")
        print(f"  Tasks: {len(result.get('task_list', []))}")
        print(f"  Visits: {len(result.get('visits', []))}")
        print(f"  Recruitment risk score: {result.get('recruitment_risk', {}).get('score', 'N/A')}")
        print(f"  Status: {result.get('extraction_status', 'N/A')}")
        return result
    except json.JSONDecodeError as e:
        print(f"  Extraction: FAILED (JSON parse error: {e})")
        return {
            "error": "json_parse_failed",
            "reason": str(e),
            "_source_pdf": os.path.basename(pdf_path),
            "_raw_response": raw[:500]
        }


def print_sample(result: dict):
    """Print a human-readable sample of the extraction for review."""
    if "error" in result:
        print(f"\n  ERROR: {result['error']} — {result.get('reason', '')}")
        return

    print(f"\n  --- SAMPLE OUTPUT ---")
    criteria = result.get("criteria", {})
    inclusions = criteria.get("inclusion", [])
    exclusions = criteria.get("exclusion", [])

    print(f"\n  TOP 3 INCLUSION CRITERIA (by complexity):")
    sorted_inc = sorted(inclusions, key=lambda x: x.get("complexity_score", 0), reverse=True)
    for c in sorted_inc[:3]:
        print(f"    [{c['id']}] score={c['complexity_score']} flags={c.get('complexity_flags',[])})")
        print(f"         {c['text'][:120]}")
        citation = c.get("source_citation", {})
        print(f"         Citation: page {citation.get('page','?')} — \"{citation.get('quote_fragment','?')}\"")

    print(f"\n  TOP 3 EXCLUSION CRITERIA (by complexity):")
    sorted_exc = sorted(exclusions, key=lambda x: x.get("complexity_score", 0), reverse=True)
    for c in sorted_exc[:3]:
        print(f"    [{c['id']}] score={c['complexity_score']} flags={c.get('complexity_flags',[])})")
        print(f"         {c['text'][:120]}")
        citation = c.get("source_citation", {})
        print(f"         Citation: page {citation.get('page','?')} — \"{citation.get('quote_fragment','?')}\"")

    print(f"\n  RECRUITMENT RISK:")
    rr = result.get("recruitment_risk", {})
    print(f"    Score: {rr.get('score', 'N/A')}/10")
    print(f"    Top criteria: {rr.get('top_risk_criteria', [])}")
    print(f"    Rationale: {rr.get('rationale', 'N/A')[:200]}")

    print(f"\n  VISIT SCHEDULE:")
    for v in result.get("visits", [])[:4]:
        procs = ", ".join(v.get("procedures", [])[:4])
        print(f"    Day {v.get('day','?'):>4}: {v.get('name','?')} — {procs}")

    print(f"\n  SAMPLE TASKS:")
    for t in result.get("task_list", [])[:5]:
        print(f"    [{t.get('task_id','?')}] {t.get('assigned_role','?'):12} {t.get('description','?')[:80]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", help="Path to a single PDF to process")
    parser.add_argument("--all", action="store_true", help="Process all PDFs in activity-docs/")
    parser.add_argument("--output", default="scripts/validation_results.json", help="Output JSON path")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable not set.")
        print("Run: ANTHROPIC_API_KEY=sk-... python3 scripts/validate_extraction.py")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    activity_docs = os.path.join(base_dir, "activity-docs")

    if args.pdf:
        pdfs = [args.pdf]
    else:
        # Default: process all main protocol PDFs (not Activity PDFs)
        pdfs = sorted([
            os.path.join(activity_docs, f)
            for f in os.listdir(activity_docs)
            if f.endswith(".pdf") and "Activity" not in f
        ])

    print(f"Clinical Trial Protocol Extraction — Pre-build Validation")
    print(f"PDFs to process: {len(pdfs)}")
    print(f"Model: claude-sonnet-4-6")

    results = []
    for pdf_path in pdfs:
        result = extract_protocol(pdf_path, client)
        print_sample(result)
        results.append(result)

    output_path = os.path.join(base_dir, args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    success = sum(1 for r in results if "error" not in r)
    print(f"  Succeeded: {success}/{len(results)}")
    print(f"  Full results saved to: {output_path}")

    if success < len(results):
        failed = [r["_source_pdf"] for r in results if "error" in r]
        print(f"  Failed: {failed}")


if __name__ == "__main__":
    main()
