# Paperkit — Local PDF Extractor

Ứng dụng local trên macOS: import nhiều PDF, trích xuất text theo trang, ảnh raster nhúng, OCR các trang scan không có text layer, copy Markdown và tải ZIP.

## Yêu cầu
- macOS (Apple Silicon hoặc Intel)
- Python 3.10+
- Node.js 20+
- Homebrew (để cài Tesseract OCR)

## Cài đặt lần đầu

```bash
brew install tesseract tesseract-lang
```

Tạo môi trường Python và cài backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Cài frontend:

```bash
cd ../frontend
npm install
```

## Chạy ứng dụng
Mở Terminal thứ nhất:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Mở Terminal thứ hai:

```bash
cd frontend
npm run dev
```

Mở http://127.0.0.1:5173

## OCR tiếng Việt
Mặc định ứng dụng dùng `vie+eng`. Kiểm tra ngôn ngữ Tesseract:

```bash
tesseract --list-langs
```

Nếu chưa có `vie`, cài dữ liệu ngôn ngữ phù hợp qua Homebrew (`tesseract-lang`) hoặc đặt `OCR_LANG=eng` khi chạy backend. Nếu Tesseract chưa được cài, trích xuất text layer và ảnh vẫn hoạt động; trang scan sẽ được lưu thành ảnh nhưng không có OCR text.

## Đầu ra ZIP
Mỗi PDF có một thư mục gồm:
- `document.md`: văn bản chia theo trang và liên kết ảnh
- `images/`: ảnh raster nhúng; trang scan được lưu thành `pageN_scan.png`
- `metadata.json`: số trang, số trang OCR, danh sách ảnh

## Lưu ý kỹ thuật
- Xử lý diễn ra trên máy local; backend chỉ bind vào `127.0.0.1`.
- OCR chỉ chạy trên trang không có text layer để tránh nhận dạng trùng văn bản.
- Ảnh nhúng được giữ nguyên dữ liệu gốc khi PDF cho phép trích xuất.
- Đồ họa vector không phải lúc nào cũng tồn tại dưới dạng ảnh riêng. Với trang scan, ứng dụng lưu ảnh render toàn trang. Các sơ đồ vector phức tạp có thể cần render trang hoặc vùng trang riêng nếu muốn xuất thành ảnh độc lập.
- PDF có mật khẩu, hỏng hoặc file vượt 150 MB sẽ được báo lỗi ở kết quả.
- ZIP xuất hiện trong `backend/exports/` và được tải qua endpoint local. Xóa các ZIP cũ trong thư mục đó khi không cần nữa.
