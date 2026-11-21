#!/bin/bash
cd "$(dirname "$0")/frontend"
if [ ! -d node_modules ]; then echo "Chưa cài frontend. Chạy npm install trong frontend trước."; read -p "Nhấn Enter để thoát"; exit 1; fi
npm run dev
