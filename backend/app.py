import csv
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
import zipfile
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_file

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        fitz = None

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None

try:
    import requests
except ImportError:
    requests = None

try:
    from faster_whisper import WhisperModel
except ImportError:
    WhisperModel = None

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
OCR_LANG = os.environ.get("OCR_LANG", "eng+vie")
DEFAULT_WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mp3", ".wav", ".m4a"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 3 * 1024 * 1024 * 1024  # 3 GB

WHISPER_MODELS: dict[str, object] = {}
PDF_JOBS: dict[str, dict] = {}


def get_whisper_model(model_size: str):
    if WhisperModel is None:
        raise RuntimeError("Chưa cài thư viện faster-whisper trong Python backend.")
    size = model_size if model_size in {"tiny", "base", "small", "medium"} else DEFAULT_WHISPER_MODEL
    if size not in WHISPER_MODELS:
        WHISPER_MODELS[size] = WhisperModel(size, device="cpu", compute_type="int8")
    return WHISPER_MODELS[size], size


def safe_folder_name(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name).strip(" .")
    return cleaned[:100] or "Chưa xác định"


def parse_subjects(raw: str) -> list[dict]:
    subjects = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^(.*?)\s*\((.*?)\)\s*$", line)
        if match:
            canonical, aliases = match.group(1).strip(), match.group(2).strip()
        else:
            canonical, aliases = line, ""
        if canonical and canonical not in [s["name"] for s in subjects]:
            subjects.append({"name": canonical, "aliases": aliases, "raw": line})
    return subjects


def extract_pdf_text(pdf_bytes: bytes, dpi: int = 200) -> str:
    if fitz is None:
        raise RuntimeError("Chưa cài PyMuPDF (fitz) trong Python backend.")
    chunks = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        if doc.is_encrypted:
            raise ValueError("PDF có mật khẩu hoặc bị mã hóa.")
        for page in doc:
            text = page.get_text("text").strip()
            if len(text) < 35 and pytesseract is not None and Image is not None:
                pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                text = pytesseract.image_to_string(image, lang=OCR_LANG, config="--psm 3")
            chunks.append(text)
    return "\n\n".join(chunks)


def classify_with_ollama(text: str, subjects: list[dict], model: str):
    if requests is None:
        raise RuntimeError("Chưa cài thư viện requests trong Python backend.")
    text = text.strip()
    if len(text) > 24000:
        text = text[:16000] + "\n\n[... middle omitted ...]\n\n" + text[-8000:]
    subject_lines = "\n".join(
        f'- Tên chuẩn: {s["name"]}; tên khác: {s["aliases"] or "không có"}'
        for s in subjects
    )
    prompt = f"""
Bạn là bộ phân loại đề thi. Chỉ được chọn MỘT môn trong danh sách được cung cấp.
Hiểu các tên viết tắt, tiếng Việt/Anh và tên tương đương; dựa chủ yếu vào nội dung câu hỏi,
không chỉ dựa vào tên file. Nếu không đủ bằng chứng, chọn chính xác "Chưa xác định".
Không tự tạo môn mới. Trả lời JSON hợp lệ, không markdown, theo schema:
{{"subject":"tên chuẩn hoặc Chưa xác định","confidence":0.0,"reason":"lý do ngắn bằng tiếng Việt"}}
confidence là số từ 0 đến 1, không cần giả vờ chắc chắn.

DANH SÁCH MÔN:
{subject_lines}

NỘI DUNG PDF:
{text}
"""
    response = requests.post(
        f"{OLLAMA_URL.rstrip('/')}/api/chat",
        json={
            "model": model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": "Phân loại chính xác, không bịa. Chỉ trả JSON."},
                {"role": "user", "content": prompt},
            ],
            "options": {"temperature": 0},
        },
        timeout=600,
    )
    response.raise_for_status()
    content = response.json().get("message", {}).get("content", "")
    data = json.loads(content)
    selected = str(data.get("subject", "Chưa xác định")).strip()
    allowed = {s["name"] for s in subjects}
    if selected not in allowed:
        selected = "Chưa xác định"
    try:
        confidence = max(0.0, min(1.0, float(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0.0
    reason = str(data.get("reason", "")).strip()[:500]
    if confidence < 0.55:
        selected = "Chưa xác định"
        reason = (reason + " (Độ tin cậy thấp; đưa vào mục cần kiểm tra.)").strip()
    return selected, confidence, reason


@app.get("/api/health")
def health():
    ollama_models = []
    ollama_online = False
    if requests is not None:
        try:
            res = requests.get(f"{OLLAMA_URL.rstrip('/')}/api/tags", timeout=1.5)
            if res.ok:
                ollama_online = True
                ollama_models = [m.get("name") for m in res.json().get("models", []) if m.get("name")]
        except Exception:
            pass

    return jsonify({
        "ok": True,
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "tesseract": shutil.which("tesseract") is not None,
        "whisper": WhisperModel is not None,
        "pymupdf": fitz is not None,
        "pytesseract": pytesseract is not None,
        "ollama": ollama_online,
        "ollamaModels": ollama_models,
        "defaultOllamaModel": OLLAMA_MODEL,
        "defaultWhisperModel": DEFAULT_WHISPER_MODEL,
    })


@app.post("/api/pdf-sorter/sort")
def pdf_sorter_sort():
    subjects = parse_subjects(request.form.get("subjects", ""))
    files = request.files.getlist("files")
    model = (request.form.get("model") or OLLAMA_MODEL).strip() or OLLAMA_MODEL

    if not subjects:
        return jsonify(error="Hãy nhập ít nhất một môn học."), 400
    if not any(f and f.filename for f in files):
        return jsonify(error="Hãy chọn ít nhất một file PDF."), 400

    temp_dir = Path(tempfile.mkdtemp(prefix="pdf_exam_sorter_"))
    report_rows = []
    names_seen: dict[tuple[str, str], int] = {}

    for subject in subjects:
        (temp_dir / safe_folder_name(subject["name"])).mkdir(parents=True, exist_ok=True)
    (temp_dir / "Chưa xác định").mkdir(exist_ok=True)

    try:
        for uploaded in files:
            if not uploaded or not uploaded.filename:
                continue
            original_name = Path(uploaded.filename).name
            if Path(original_name).suffix.lower() != ".pdf":
                report_rows.append({
                    "filename": original_name,
                    "subject": "Bỏ qua",
                    "confidence": 0,
                    "reason": "Không phải PDF",
                })
                continue

            data = uploaded.read()
            if not data:
                report_rows.append({
                    "filename": original_name,
                    "subject": "Lỗi",
                    "confidence": 0,
                    "reason": "File rỗng",
                })
                continue

            try:
                text = extract_pdf_text(data)
                if not text.strip():
                    subject, confidence, reason = "Chưa xác định", 0.0, "Không trích xuất được văn bản."
                else:
                    subject, confidence, reason = classify_with_ollama(text, subjects, model)
            except Exception as exc:
                if requests is not None and isinstance(exc, requests.ConnectionError):
                    return jsonify(error="Không kết nối được Ollama. Hãy mở Ollama (`ollama serve`) và kiểm tra model đã tải."), 503
                subject, confidence, reason = "Chưa xác định", 0.0, f"Lỗi xử lý: {str(exc)[:350]}"

            folder = safe_folder_name(subject)
            target_dir = temp_dir / folder
            target_dir.mkdir(parents=True, exist_ok=True)
            key = (folder, original_name)
            names_seen[key] = names_seen.get(key, 0) + 1
            n = names_seen[key]
            target_name = original_name if n == 1 else f"{Path(original_name).stem}_{n}{Path(original_name).suffix}"
            (target_dir / target_name).write_bytes(data)

            report_rows.append({
                "filename": original_name,
                "subject": subject,
                "confidence": round(confidence, 2),
                "reason": reason,
            })

        report_path = temp_dir / "classification_report.csv"
        with report_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=["filename", "subject", "confidence", "reason"])
            writer.writeheader()
            writer.writerows(report_rows)

        zip_path = temp_dir / "classified_exams.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in temp_dir.rglob("*"):
                if path.is_file() and path != zip_path:
                    zf.write(path, path.relative_to(temp_dir))

        token = datetime.now().strftime("%Y%m%d%H%M%S%f")
        PDF_JOBS[token] = {
            "temp_dir": str(temp_dir),
            "zip_path": str(zip_path),
            "rows": report_rows,
            "total": len(report_rows),
            "token": token,
        }
        return jsonify({
            "token": token,
            "total": len(report_rows),
            "rows": report_rows,
        })
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify(error=f"Không thể xử lý: {str(exc)[:500]}"), 500


@app.get("/api/pdf-sorter/download/<token>")
def pdf_sorter_download(token: str):
    job = PDF_JOBS.get(token)
    if not job or not Path(job["zip_path"]).exists():
        return jsonify(error="Không tìm thấy ZIP (có thể server đã khởi động lại)."), 404
    return send_file(job["zip_path"], as_attachment=True, download_name="classified_exams.zip")


@app.get("/api/pdf-sorter/report/<token>")
def pdf_sorter_report(token: str):
    job = PDF_JOBS.get(token)
    if not job:
        return jsonify(error="Không tìm thấy báo cáo."), 404
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["filename", "subject", "confidence", "reason"])
    writer.writeheader()
    writer.writerows(job["rows"])
    return app.response_class(
        "\ufeff" + output.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=classification_report.csv"},
    )


@app.post("/api/video-to-txt/transcribe")
def video_to_txt_transcribe():
    uploaded = request.files.get("video")
    language = (request.form.get("language") or "auto").strip().lower()
    requested_model = (request.form.get("model") or DEFAULT_WHISPER_MODEL).strip().lower()

    if not uploaded or not uploaded.filename:
        return jsonify(error="Bạn chưa chọn video hoặc audio."), 400

    original_name = Path(uploaded.filename).name
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        return jsonify(error="Định dạng chưa được hỗ trợ. Hãy dùng MP4, MOV, MKV, WebM, AVI, M4V, MP3, WAV hoặc M4A."), 400

    if language not in {"auto", "vi", "en"}:
        return jsonify(error="Ngôn ngữ không hợp lệ."), 400

    temp_video = None
    temp_audio = None
    try:
        with tempfile.NamedTemporaryFile(prefix="upload_", suffix=suffix, dir=UPLOAD_DIR, delete=False) as f:
            temp_video = Path(f.name)
            uploaded.save(f)

        with tempfile.NamedTemporaryFile(prefix="audio_", suffix=".wav", dir=UPLOAD_DIR, delete=False) as f:
            temp_audio = Path(f.name)

        command = [
            "ffmpeg", "-y", "-i", str(temp_video),
            "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "pcm_s16le", str(temp_audio),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            return jsonify(error="Không đọc được file media. Hãy kiểm tra file và đảm bảo FFmpeg đã cài đặt."), 422

        model, used_model = get_whisper_model(requested_model)
        chosen_language = None if language == "auto" else language
        segments, info = model.transcribe(
            str(temp_audio),
            language=chosen_language,
            beam_size=5,
            vad_filter=True,
        )

        transcript_segments = [
            {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
            }
            for segment in segments
        ]

        transcript = " ".join(s["text"] for s in transcript_segments).strip()
        return jsonify({
            "filename": original_name,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": info.duration,
            "segments": transcript_segments,
            "text": transcript,
            "model": used_model,
        })
    except FileNotFoundError:
        return jsonify(error="Không tìm thấy FFmpeg. Cài đặt bằng lệnh: brew install ffmpeg"), 500
    except Exception as exc:
        app.logger.exception("Transcription failed")
        return jsonify(error=f"Không thể chuyển video: {exc}"), 500
    finally:
        for path in (temp_video, temp_audio):
            if path:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="Dung lượng upload vượt quá giới hạn 3 GB."), 413


if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "5050"))
    app.run(host="127.0.0.1", port=port, debug=False)
