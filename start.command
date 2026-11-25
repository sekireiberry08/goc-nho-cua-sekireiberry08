#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Chưa cài dependencies. Đang chạy npm install..."
  npm install
fi

echo "🚀 Đang khởi động Góc nhỏ của sekireiberry08..."
echo "🌐 Ứng dụng sẵn sàng tại: http://127.0.0.1:5173"

# Mở trình duyệt tự động trên macOS
if command -v open >/dev/null 2>&1; then
  sleep 1 && open "http://127.0.0.1:5173" &
fi

npm run dev -- --host 127.0.0.1 --port 5173
