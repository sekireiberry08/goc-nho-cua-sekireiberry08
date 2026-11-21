from __future__ import annotations

import os
import re
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

APP_DIR = Path(__file__).resolve().parent
EXPORT_DIR = APP_DIR / "exports"
EXPORT_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 150 * 1024 * 1024  # 150 MB per PDF

app = FastAPI(title="Local PDF Extractor", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe_name(name: str) -> str:
    stem = Path(name).stem
    stem = re.sub(r"[^\w.-]+", "_", stem, flags=re.UNICODE).strip("._")
    return stem[:80] or "document"


def unique_image_name(index: int, ext: str) -> str:
    ext = re.sub(r"[^a-zA-Z0-9]", "", ext.lower()) or "png"
    return f"image{index}.{ext}"


def extract_pdf(pdf_path: Path, output_dir: Path, original_name: str) -> dict[str, Any]:
    base_name = safe_name(original_name)
    doc_dir = output_dir / base_name
    suffix = 2
    while doc_dir.exists():
        doc_dir = output_dir / f"{base_name}_{suffix}"
        suffix += 1
    images_dir = doc_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    if doc.is_encrypted:
        raise ValueError(f"{original_name}: PDF được mã hóa hoặc cần mật khẩu.")

    markdown_parts: list[str] = [f"# {original_name}\n", f"> {len(doc)} trang\n"]
    image_index = 0
    image_records: list[dict[str, Any]] = []
    ocr_pages = 0
    text_pages = 0

    try:
        import pytesseract
        from PIL import Image
        import io
        ocr_available = shutil.which("tesseract") is not None
    except ImportError:
        pytesseract = None
        Image = None
        io = None
        ocr_available = False

    for page_number, page in enumerate(doc, start=1):
        markdown_parts.append(f"\n## Trang {page_number}\n")
        page_text = page.get_text("text", sort=True).strip()
        used_ocr = False

        # OCR only pages without a usable text layer. The rendered page is also
        # retained so scanned diagrams/photos remain available in the export.
        if len(page_text) < 12 and ocr_available:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            png_bytes = pix.tobytes("png")
            try:
                page_image = Image.open(io.BytesIO(png_bytes))
                ocr_text = pytesseract.image_to_string(page_image, lang=os.getenv("OCR_LANG", "vie+eng"))
            except Exception:
                # Fall back to English if Vietnamese trained data is not installed.
                try:
                    ocr_text = pytesseract.image_to_string(page_image, lang="eng")
                except Exception:
                    ocr_text = ""
            if ocr_text.strip():
                page_text = ocr_text.strip()
                used_ocr = True
                ocr_pages += 1
            scan_name = f"page{page_number}_scan.png"
            (images_dir / scan_name).write_bytes(png_bytes)
            markdown_parts.append(f"![Ảnh quét trang {page_number}](images/{scan_name})\n")

        if page_text:
            text_pages += 1
            markdown_parts.append(page_text.replace("\x00", "") + "\n")
        else:
            markdown_parts.append("*Không trích xuất được văn bản ở trang này.*\n")

        if used_ocr:
            markdown_parts.append("\n> Văn bản trang này được nhận dạng bằng OCR. Cần kiểm tra lại các ký tự/số liệu.\n")

        # Extract original raster images in page display order as far as the PDF
        # structure exposes them. Repeated xrefs on one page are deduplicated.
        seen_xrefs: set[int] = set()
        for image_info in page.get_images(full=True):
            xref = image_info[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            try:
                extracted = doc.extract_image(xref)
                data = extracted.get("image")
                if not data:
                    continue
                image_index += 1
                filename = unique_image_name(image_index, extracted.get("ext", "png"))
                (images_dir / filename).write_bytes(data)
                image_records.append({"name": filename, "page": page_number})
                markdown_parts.append(f"\n![Image {image_index} - trang {page_number}](images/{filename})\n")
            except Exception:
                # Some PDF image objects are masks or malformed; skip safely.
                continue

    markdown = "\n".join(markdown_parts).strip() + "\n"
    (doc_dir / "document.md").write_text(markdown, encoding="utf-8")
    metadata = {
        "source": original_name,
        "pages": len(doc),
        "pages_with_text": text_pages,
        "pages_ocr": ocr_pages,
        "images": image_records,
        "ocr_available": ocr_available,
        "note": "PDF vector graphics may not exist as standalone image objects; scanned pages are retained as page images.",
    }
    import json
    (doc_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"name": original_name, "pages": len(doc), "text_pages": text_pages, "ocr_pages": ocr_pages,
            "images": len(image_records), "markdown": markdown, "ocr_available": ocr_available}


@app.get("/api/health")
def health():
    return {"status": "ok", "ocr_binary": shutil.which("tesseract") is not None}


@app.post("/api/extract")
async def extract(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "Vui lòng chọn ít nhất một file PDF.")
    job_id = uuid.uuid4().hex
    job_dir = Path(tempfile.mkdtemp(prefix=f"pdf-{job_id}-"))
    results = []
    errors = []
    try:
        for upload in files:
            original_name = upload.filename or "document.pdf"
            if not original_name.lower().endswith(".pdf"):
                errors.append({"name": original_name, "error": "Không phải file PDF."})
                continue
            data = await upload.read()
            if len(data) > MAX_FILE_SIZE:
                errors.append({"name": original_name, "error": "Vượt quá giới hạn 150 MB."})
                continue
            if not data.startswith(b"%PDF"):
                errors.append({"name": original_name, "error": "File không có chữ ký PDF hợp lệ."})
                continue
            temp_pdf = job_dir / f"upload_{len(results)}.pdf"
            temp_pdf.write_bytes(data)
            try:
                results.append(extract_pdf(temp_pdf, job_dir, original_name))
            except Exception as exc:
                errors.append({"name": original_name, "error": str(exc)})
            finally:
                temp_pdf.unlink(missing_ok=True)

        if not results:
            raise HTTPException(422, detail={"message": "Không trích xuất được PDF nào.", "errors": errors})

        readme = "# PDF Extractor export\n\nMỗi thư mục tài liệu chứa document.md, images/ và metadata.json.\n"
        (job_dir / "README.md").write_text(readme, encoding="utf-8")
        zip_path = EXPORT_DIR / f"pdf-extracted-{job_id[:8]}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in job_dir.rglob("*"):
                if path.is_file():
                    archive.write(path, path.relative_to(job_dir))
        return {"job_id": job_id, "results": results, "errors": errors,
                "download_url": f"/api/download/{zip_path.name}"}
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


@app.get("/api/download/{filename}")
def download(filename: str):
    # Prevent path traversal; only generated ZIP files are served.
    if not re.fullmatch(r"pdf-extracted-[a-f0-9]{8}\.zip", filename):
        raise HTTPException(404, "Không tìm thấy file.")
    path = EXPORT_DIR / filename
    if not path.is_file():
        raise HTTPException(404, "File đã hết hạn hoặc không tồn tại.")
    return FileResponse(path, media_type="application/zip", filename=filename)
