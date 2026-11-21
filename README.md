# Góc nhỏ của sekireiberry08

Trang web local gộp bốn tiện ích vào cùng một giao diện tab:

- **Trích xuất PDF**: trích xuất văn bản, ảnh và OCR, xem Markdown và tải kết quả dạng ZIP.
- **Cắt audio**: tải video từ máy, chọn một hoặc nhiều đoạn trên timeline rồi xuất MP3, WAV hoặc M4A.
- **Ôn Lịch sử Đảng**: học trọng tâm, luyện timeline và quiz từ dữ liệu Excel.
- **Ôn Mạng máy tính**: luyện ngân hàng câu hỏi theo chương và theo dõi tiến độ.

Hai ứng dụng ôn tập được quản lý dưới dạng Git submodule. Khi clone repo chính, lấy cả hai ứng dụng bằng:

```bash
git clone --recurse-submodules https://github.com/sekireiberry08/goc-nho-cua-sekireiberry08.git
```

Nếu đã clone repo chính, khởi tạo các submodule bằng `git submodule update --init --recursive`.
Khi cập nhật ứng dụng con, hãy commit/push thay đổi trong repo con trước, sau đó cập nhật commit tham chiếu và push repo chính.

Giao diện hỗ trợ Tiếng Việt và English, cùng chế độ sáng và tối. Lựa chọn được lưu trong trình duyệt.

## Yêu cầu

- Python 3.10+
- Node.js 20+
- FFmpeg và `ffprobe` (cần cho tính năng cắt audio)
- macOS: Homebrew

Cài các công cụ hệ thống trên macOS:

```bash
brew install ffmpeg tesseract tesseract-lang
```

Tesseract chỉ cần nếu muốn nhận dạng chữ trong PDF scan. Các nền tảng khác có thể cài Python, Node.js, FFmpeg và Tesseract bằng trình quản lý gói tương ứng.

## Cài đặt lần đầu

Chạy tại thư mục gốc của dự án:

```bash
python3 -m venv pdf-extractor/backend/.venv
pdf-extractor/backend/.venv/bin/python -m pip install -r pdf-extractor/backend/requirements.txt

python3 -m venv youtube-audio-cutter/.venv
youtube-audio-cutter/.venv/bin/python -m pip install -r youtube-audio-cutter/requirements.txt

npm --prefix pdf-extractor/frontend install
npm --prefix lich-su-dang-killer install
```

## Khởi chạy

```bash
./start.command
```

Mở **http://127.0.0.1:5173**. Chọn tính năng bằng các tab ở đầu trang. Dừng các dịch vụ bằng `Ctrl+C` trong cửa sổ Terminal.

Lệnh chạy chung khởi động giao diện web và hai backend local:

- Frontend: `127.0.0.1:5173`
- Backend trích xuất PDF: `127.0.0.1:8000`
- Backend cắt audio: `127.0.0.1:5001`
- Ứng dụng ôn Lịch sử Đảng: `127.0.0.1:5174`
- Ứng dụng ôn Mạng máy tính: `127.0.0.1:5175`

Nếu một cổng đã được sử dụng, hãy dừng ứng dụng đang chiếm cổng đó trước khi khởi chạy. Các ứng dụng ôn tập được tải trong tab của giao diện chính; giao diện tối/sáng được đồng bộ với các tab này.

## Lưu ý sử dụng

- Tất cả xử lý chạy trên máy local. Tính năng cắt audio nhận video tải lên từ máy, **không tự tải hoặc rip video từ YouTube**; chỉ xử lý nội dung bạn có quyền sử dụng.
- OCR PDF mặc định dùng ngôn ngữ `vie+eng`. Nếu thiếu dữ liệu tiếng Việt, có thể đặt `OCR_LANG=eng` khi chạy backend PDF.
- File xuất PDF được lưu trong `pdf-extractor/backend/exports/`; video tải lên và audio đã cắt nằm trong `youtube-audio-cutter/uploads/` và `youtube-audio-cutter/outputs/`.
- Hướng dẫn chi tiết cho từng tính năng: [PDF Extractor](pdf-extractor/README.md) và [AudioSlice](youtube-audio-cutter/README.md).
