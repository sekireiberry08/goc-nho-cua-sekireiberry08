import os, re, uuid, shutil, subprocess
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, abort
from werkzeug.utils import secure_filename

BASE = Path(__file__).resolve().parent
UPLOADS = BASE / "uploads"
OUTPUTS = BASE / "outputs"
UPLOADS.mkdir(exist_ok=True)
OUTPUTS.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # 1 GB
ALLOWED = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError((p.stderr or p.stdout or "Lệnh xử lý thất bại")[-2500:])
    return p.stdout

def ffprobe(path):
    raw = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    return float(raw.strip())

@app.get("/")
def index():
    return render_template("index.html")

@app.post("/api/upload")
def upload():
    f = request.files.get("video")
    if not f or not f.filename:
        return jsonify(error="Bạn chưa chọn video."), 400
    ext = Path(secure_filename(f.filename)).suffix.lower()
    if ext not in ALLOWED:
        return jsonify(error="Định dạng chưa hỗ trợ. Hãy dùng MP4, MOV, MKV hoặc WebM."), 400
    job = uuid.uuid4().hex
    path = UPLOADS / f"{job}{ext}"
    f.save(path)
    try:
        duration = ffprobe(path)
    except Exception as e:
        path.unlink(missing_ok=True)
        return jsonify(error=f"Không đọc được video: {e}"), 400
    return jsonify(job=job, filename=f.filename, duration=duration)

@app.post("/api/cut")
def cut():
    data = request.get_json(force=True)
    job = str(data.get("job", ""))
    source_candidates = list(UPLOADS.glob(job + ".*"))
    if not re.fullmatch(r"[a-f0-9]{32}", job) or not source_candidates:
        return jsonify(error="Không tìm thấy video nguồn. Hãy tải video lên lại."), 404
    source = source_candidates[0]
    segments = data.get("segments", [])
    fmt = data.get("format", "mp3").lower()
    if fmt not in {"mp3", "wav", "m4a"}:
        return jsonify(error="Định dạng không hợp lệ."), 400
    if not isinstance(segments, list) or not segments or len(segments) > 100:
        return jsonify(error="Cần có từ 1 đến 100 đoạn cắt."), 400
    duration = ffprobe(source)
    output_dir = OUTPUTS / job
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    created = []
    try:
        for i, seg in enumerate(segments, 1):
            start, end = float(seg["start"]), float(seg["end"])
            if start < 0 or end <= start or end > duration + 0.05:
                raise ValueError(f"Đoạn {i} có mốc thời gian không hợp lệ.")
            name = re.sub(r"[^A-Za-z0-9_-]+", "_", str(seg.get("name") or f"clip_{i}")).strip("_")[:50]
            name = name or f"clip_{i}"
            out = output_dir / f"{i:02d}_{name}.{fmt}"
            # Output-side seeking decodes from the input before trimming, improving
            # timestamp accuracy for very short clips (including sub-second clips).
            cmd = ["ffmpeg", "-y", "-i", str(source), "-ss", f"{start:.2f}", "-t", f"{end-start:.2f}", "-vn"]
            if fmt == "mp3":
                cmd += ["-c:a", "libmp3lame", "-q:a", "2"]
            elif fmt == "wav":
                cmd += ["-c:a", "pcm_s16le"]
            else:
                cmd += ["-c:a", "aac", "-b:a", "192k"]
            cmd += [str(out)]
            run(cmd)
            created.append(out)
    except Exception as e:
        shutil.rmtree(output_dir, ignore_errors=True)
        return jsonify(error=str(e)), 400

    if len(created) == 1:
        return jsonify(download=f"/download/{job}/{created[0].name}", count=1)
    archive = OUTPUTS / f"{job}.zip"
    archive.unlink(missing_ok=True)
    import zipfile
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for p in created:
            z.write(p, p.name)
    return jsonify(download=f"/download/{job}/{archive.name}", count=len(created))

@app.get("/download/<job>/<filename>")
def download(job, filename):
    if not re.fullmatch(r"[a-f0-9]{32}", job) or Path(filename).name != filename:
        abort(404)
    path = OUTPUTS / job / filename
    if not path.exists():
        path = OUTPUTS / filename
    if not path.exists() or path.parent not in {OUTPUTS, OUTPUTS / job}:
        abort(404)
    return send_file(path, as_attachment=True, download_name=path.name)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
