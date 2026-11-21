# AudioSlice

Web app local để upload video, tạo nhiều mốc cắt và xuất từng đoạn audio MP3/WAV/M4A. Backend dùng FFmpeg; giao diện chạy trên trình duyệt.

## 1. Yêu cầu

- Python 3.10+
- FFmpeg và ffprobe đã cài và có trong PATH
- macOS / Linux / Windows

Kiểm tra:
```bash
ffmpeg -version
ffprobe -version
python3 --version
```

macOS (Homebrew):
```bash
brew install ffmpeg
```

Ubuntu:
```bash
sudo apt update
sudo apt install ffmpeg python3-venv
```

## 2. Cài đặt và chạy

```bash
cd youtube-audio-cutter
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Mở http://127.0.0.1:5000

Timeline hỗ trợ chỉnh mốc theo bước 0.01 giây (1/100 giây). Độ chính xác thực tế còn phụ thuộc sample rate/codec nguồn.

## 3. Cách sử dụng

1. Chọn video từ máy hoặc kéo thả vào vùng upload.
2. App tự tạo đoạn đầu tiên (0 đến tối đa 30 giây). Timeline có thể zoom và kéo hai tay nắm để chỉnh mốc.
3. Thêm/xóa đoạn, sửa tên, thời điểm bắt đầu và kết thúc (giây hoặc `mm:ss`).
4. Chọn định dạng và nhấn **Cắt audio**.
5. Nếu có nhiều đoạn, tải về một file ZIP.

## Lưu ý

- Bản MVP này xử lý video upload từ máy tính; không tự tải/rip nội dung qua URL YouTube. Chỉ sử dụng video và audio mà bạn sở hữu hoặc có quyền xử lý.
- File upload và output nằm trong `uploads/` và `outputs/`. Xóa các thư mục này khi muốn dọn dữ liệu.
- Đây là bản chạy local để thử nghiệm, chưa có authentication, quota, cleanup tự động hay cấu hình production.
- Không đưa server debug này lên Internet công khai.
