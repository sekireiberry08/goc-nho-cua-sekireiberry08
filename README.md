# Góc nhỏ của sekireiberry08

Cổng tiện ích học tập & công cụ lập trình cá nhân hợp nhất, xử lý 100% trên trình duyệt (Client-side) và tối ưu triển khai 1-click trên **Vercel**.

---

## 🌟 6 Tiện ích tích hợp

1. **🛠️ MiRust → Jasmin Compiler Lab (v4)**:
   - Trình biên dịch ngôn ngữ MiRust sang bytecode Jasmin cho máy ảo Java (JVM).
   - Pipeline: Lexer → Recursive-Descent & Pratt Parser → AST Inspector → Basic Type Checking → Jasmin JVM Codegen.
   - Hỗ trợ hàm, tham số, đệ quy, `i32`/`bool`/`void`, biến `let`/`let mut`, `if/else`, `while`, `for in`, `switch/case/break`, in ấn `println_i32`.
   - Tích hợp bộ kiểm thử tự động (Test Suite) và nạp mẫu code sẵn.

2. **📚 Ôn Lịch Sử Đảng (SP1039 - HCMUT)**:
   - Hệ thống học chủ động: Học lý thuyết trọng tâm theo Chuẩn đầu ra (CĐR), Game Timeline ghép nối sự kiện lịch sử, và Ngân hàng Quiz trắc nghiệm.
   - Lọc theo từng chương hoặc toàn bộ ngân hàng câu hỏi, chế độ luyện riêng các câu làm sai.
   - Tự động lưu tiến độ vào `localStorage` theo Guest ID, hỗ trợ xuất/sao lưu dữ liệu học tập JSON.

3. **🌐 Ôn Thi Mạng Máy Tính (MMT)**:
   - Ngân hàng câu hỏi trắc nghiệm toàn diện 8 chương theo chương trình ĐH Bách Khoa TP.HCM.
   - Chế độ kiểm tra đáp án tức thì (Instant Feedback) kèm giải thích chi tiết cơ chế hoạt động mạng.
   - Thống kê tỷ lệ chính xác, lọc câu sai, làm lại chương.

4. **📄 Trích Xuất Dữ Liệu PDF**:
   - Trích xuất văn bản có cấu trúc từ tệp PDF trực tiếp bằng `pdfjs-dist`.
   - Tự động định dạng sang Markdown và tải về trọn gói tệp nén ZIP (`document.md`, `metadata.json`).
   - Xử lý 100% trong bộ nhớ trình duyệt, bảo mật riêng tư tuyệt đối.

5. **✂️ Cắt & Trích Xuất Audio**:
   - Trình phát video/audio tích hợp, chọn nhiều mốc thời gian (segments) linh hoạt.
   - Sử dụng Web Audio API để giải mã và xuất âm thanh chất lượng cao chuẩn WAV (16-bit PCM) hoặc gói ZIP.
   - Không yêu cầu cài đặt FFmpeg hay Python backend.

---

## 🚀 Tech Stack

- **Frontend Framework:** React 19 + TypeScript + Vite 8
- **Styling & UI:** Tailwind CSS v4 + Lucide React
- **Client Libraries:**
  - `pdfjs-dist`: Xử lý và trích xuất PDF client-side
  - `jszip`: Nén và đóng gói ZIP trong bộ nhớ
  - `xlsx`: Đọc dữ liệu ngân hàng đề thi Excel
  - Web Audio API: Xử lý và cắt âm thanh trực tiếp
- **Deployment:** Vercel (Single Page App với `vercel.json`)

---

## 💻 Hướng dẫn chạy Local

### Yêu cầu
- Node.js 20+

### Cài đặt và khởi chạy

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy dev server
npm run dev
```

Mở trình duyệt tại **http://127.0.0.1:5173**.

Hoặc trên macOS, bạn chỉ cần nhấp đúp vào tệp **`start.command`**.

---

## ☁️ Triển khai lên Vercel

Dự án đã được cấu hình sẵn tệp `vercel.json`. Để triển khai:

1. Đẩy mã nguồn lên GitHub:
   ```bash
   git add .
   git commit -m "feat: unify all tools into single Vite app for Vercel"
   git push origin main
   ```
2. Trên Vercel, chọn **Import Project** từ GitHub repository `goc-nho-cua-sekireiberry08`.
3. Vercel sẽ tự động nhận diện cấu hình:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Nhấn **Deploy** — website sẽ hoạt động toàn cầu trên CDN của Vercel!
