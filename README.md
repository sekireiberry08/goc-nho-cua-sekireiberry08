# Góc nhỏ của sekireiberry08

Bộ công cụ đa phương tiện, tài liệu và lập trình hợp nhất trong một thư mục duy nhất.

## 5 Tiện ích tích hợp

1. **Video & Audio Studio** *(100% Client-side)*
   - **Cắt, ghép & crop video**: Kéo thả nhiều video để ghép nối trên timeline, cắt đoạn (`S`), xoá (`Del`), sắp xếp lại, crop tỉ lệ chuẩn (`16:9`, `9:16`, `1:1`, `4:5`, `4:3`, tự do), xuất video hoặc xuất thẳng MP3.
   - **MP4 → MP3 & Cắt Audio**: Chuyển toàn bộ video MP4/MOV/WebM sang MP3 (128/192/320 kbps) hoặc cắt nhiều đoạn xuất MP3/WAV/ZIP ngay trên trình duyệt.

2. **Cọ xoá vật thể ảnh** *(100% Client-side)*
   - Tô lên watermark, chữ hoặc chi tiết thừa trên ảnh (kéo thả hoặc dán `Ctrl/Cmd+V`), tự động xoá theo mảng vá nền, hoàn tác (`Ctrl/Cmd+Z`), xem ảnh gốc và tải PNG.

3. **Video → Văn bản** *(Local Backend: FFmpeg + faster-whisper)*
   - Chuyển giọng nói trong video/audio thành văn bản cục bộ trên máy, hỗ trợ chỉnh sửa và tải **TXT**, **SRT**, **VTT**.

4. **PDF Studio**
   - **Phân loại đề thi (AI + OCR)** *(Local Backend: PyMuPDF + Tesseract + Ollama)*: OCR PDF scan (`eng+vie`), phân loại bằng Ollama theo danh sách môn học, xuất ZIP chia thư mục và báo cáo CSV.
   - **Trích xuất Markdown** *(100% Client-side)*: Trích xuất nội dung PDF sang Markdown và gói ZIP.

5. **MiRust → Jasmin Compiler** *(100% Client-side)*
   - Biên dịch mã MiRust sang JVM bytecode Jasmin kèm AST viewer và Test Suite.

---

## Khởi chạy Local

### 1. Công cụ hệ thống (cho Video → Văn bản & PDF AI/OCR)
```bash
brew install ffmpeg tesseract tesseract-lang ollama
ollama pull qwen2.5:7b
```

### 2. Chạy ứng dụng
Trên macOS, nhấp đúp **`start.command`** hoặc chạy trong Terminal:
```bash
./start.command
```
Ứng dụng tự động khởi chạy Local Backend (`127.0.0.1:5050`) và Frontend (`http://127.0.0.1:5173`).

> Các tính năng xử lý trình duyệt (Video/MP3, Xoá vật thể, Trích xuất PDF Markdown, MiRust Compiler) hoạt động độc lập cả khi chỉ chạy `npm run dev` hoặc deploy lên Vercel.
