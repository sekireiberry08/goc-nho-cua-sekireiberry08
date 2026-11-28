#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Chưa cài dependencies frontend. Đang chạy npm install..."
  npm install
fi

# Chuẩn bị Python backend cho PDF Exam Sorter (OCR + Ollama) & Video -> Văn bản (Whisper)
BACKEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

PY_BIN=""
for cand in python3.12 python3.11 python3.10 python3; do
  if command -v "$cand" >/dev/null 2>&1; then
    PY_BIN="$cand"
    break
  fi
done

if [ -n "$PY_BIN" ]; then
  if [ ! -d "backend/.venv" ]; then
    echo "Đang tạo Python venv cho backend ($PY_BIN) tại backend/.venv..."
    "$PY_BIN" -m venv backend/.venv
    backend/.venv/bin/python -m pip install --upgrade pip >/dev/null
    backend/.venv/bin/pip install -r backend/requirements.txt
  fi

  if [ -x "backend/.venv/bin/python" ]; then
    echo "🧠 Đang khởi động Local AI Backend (127.0.0.1:5050)..."
    BACKEND_PORT=5050 backend/.venv/bin/python backend/app.py >/tmp/goc-nho-backend.log 2>&1 &
    BACKEND_PID=$!
  fi
fi

echo "🚀 Đang khởi động Góc nhỏ của sekireiberry08..."
echo "🌐 Mở trình duyệt tại: http://127.0.0.1:5173"

if command -v open >/dev/null 2>&1; then
  sleep 1 && open "http://127.0.0.1:5173" &
fi

npm run dev -- --host 127.0.0.1 --port 5173
