#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
command -v brew >/dev/null 2>&1 || { echo "Cần cài Homebrew trước: https://brew.sh"; read -p "Enter để thoát"; exit 1; }
command -v tesseract >/dev/null 2>&1 || brew install tesseract tesseract-lang
python3 -m venv "$ROOT/backend/.venv"
source "$ROOT/backend/.venv/bin/activate"
python -m pip install --upgrade pip
pip install -r "$ROOT/backend/requirements.txt"
cd "$ROOT/frontend"
npm install
echo "\nCài đặt xong. Mở start-backend.command và start-frontend.command để chạy ứng dụng."
read -p "Nhấn Enter để đóng cửa sổ"
