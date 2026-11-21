#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PDF_BACKEND="$ROOT_DIR/pdf-extractor/backend"
AUDIO_BACKEND="$ROOT_DIR/youtube-audio-cutter"
FRONTEND="$ROOT_DIR/pdf-extractor/frontend"
HISTORY_APP="$ROOT_DIR/lich-su-dang-killer"
QUIZ_APP="$ROOT_DIR/quiz-mmt"
PDF_PID=""
AUDIO_PID=""
HISTORY_PID=""
QUIZ_PID=""

if [ ! -x "$PDF_BACKEND/.venv/bin/uvicorn" ] || [ ! -x "$AUDIO_BACKEND/.venv/bin/python" ] || [ ! -d "$FRONTEND/node_modules" ] || [ ! -d "$HISTORY_APP/node_modules" ] || [ ! -f "$QUIZ_APP/index.html" ]; then
  echo "Chưa cài đủ dependencies. Hãy làm theo mục 'Cài đặt lần đầu' trong README.md."
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "Không tìm thấy FFmpeg/ffprobe. Hãy cài FFmpeg (macOS: brew install ffmpeg)."
  exit 1
fi

cleanup() {
  trap - EXIT INT TERM
  for pid in "$QUIZ_PID" "$HISTORY_PID" "$AUDIO_PID" "$PDF_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  [ -z "$AUDIO_PID" ] || wait "$AUDIO_PID" 2>/dev/null || true
  [ -z "$PDF_PID" ] || wait "$PDF_PID" 2>/dev/null || true
  [ -z "$HISTORY_PID" ] || wait "$HISTORY_PID" 2>/dev/null || true
  [ -z "$QUIZ_PID" ] || wait "$QUIZ_PID" 2>/dev/null || true
}

wait_for_service() {
  local url="$1"
  local pid="$2"
  local name="$3"
  local attempt
  for attempt in {1..30}; do
    if curl --silent --fail "$url" >/dev/null; then
      return
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Không thể khởi động $name. Kiểm tra log phía trên và cổng dịch vụ."
      exit 1
    fi
    sleep 1
  done
  echo "$name không phản hồi sau 30 giây."
  exit 1
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(
  cd "$PDF_BACKEND"
  exec .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
) &
PDF_PID=$!

(
  cd "$AUDIO_BACKEND"
  exec .venv/bin/python -m flask --app app run --no-debugger --no-reload --host 127.0.0.1 --port 5001
) &
AUDIO_PID=$!

(
  cd "$HISTORY_APP"
  exec npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
) &
HISTORY_PID=$!

(
  exec python3 -m http.server 5175 --bind 127.0.0.1 --directory "$QUIZ_APP"
) &
QUIZ_PID=$!

wait_for_service "http://127.0.0.1:8000/api/health" "$PDF_PID" "Backend PDF"
wait_for_service "http://127.0.0.1:5001/" "$AUDIO_PID" "Backend cắt audio"
wait_for_service "http://127.0.0.1:5174/" "$HISTORY_PID" "Ứng dụng ôn Lịch sử Đảng"
wait_for_service "http://127.0.0.1:5175/" "$QUIZ_PID" "Ứng dụng ôn Mạng máy tính"

echo "Đã sẵn sàng: http://127.0.0.1:5173"
npm --prefix "$FRONTEND" run dev -- --host 127.0.0.1 --strictPort
