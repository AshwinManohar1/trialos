import pdfplumber


def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract all text from a PDF file using pdfplumber.
    Returns concatenated text from all pages.
    """
    pages_text = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                pages_text.append(f"--- Page {i + 1} ---\n{text}")
    return "\n\n".join(pages_text)


def extract_text_from_pdf_bytes(data: bytes) -> str:
    """
    Extract all text from PDF bytes (in-memory).
    """
    import io
    pages_text = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                pages_text.append(f"--- Page {i + 1} ---\n{text}")
    return "\n\n".join(pages_text)
