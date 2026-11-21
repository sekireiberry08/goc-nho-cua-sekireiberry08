#!/bin/bash
cd "$(dirname "$0")/backend"
if [ ! -d .venv ]; then echo "Chưa cài backend. Xem README.md trước."; read -p "Nhấn Enter để thoát"; exit 1; fi
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
