
### 1. Đề bài yêu cầu dùng API có sẵn hay phải tự train AI?

Theo **Điều 12.2 của Thể lệ**, đội thi **hoàn toàn được phép sử dụng thư viện, công cụ, bộ dữ liệu, mô hình và API có sẵn** (như Gemini API, OpenAI API, Claude API hoặc các mô hình trên Hugging Face), miễn là có quyền sử dụng hợp pháp và không dùng sản phẩm đã làm sẵn từ trước cho cùng bài toán này (Điều 12.5).

* **Không cần tự train model từ đầu:** Trong 11 ngày còn lại (từ 22/11 đến 03/12/2026), việc tự train mô hình ngôn ngữ vừa tốn chi phí GPU vừa không thể đạt độ thông minh bằng các mô hình lớn (LLM) hiện có.
* **Cách làm ăn điểm với Ban Giám khảo:** Thay vì chỉ gọi 1 API chat đơn thuần, bạn hãy xây dựng **kiến trúc AI Agent / Workflow nhiều bước** (kết hợp **Multimodal LLM** đọc ảnh chụp màn hình + **Function Calling** gọi công cụ kiểm tra mã số thuế doanh nghiệp, kiểm tra tên miền lừa đảo + **RAG** đối chiếu kho kịch bản lừa đảo tuyển dụng tại Việt Nam).

---

### 2. Gợi ý 3 ý tưởng sản phẩm cho bài toán "Lừa đảo việc nhẹ lương cao" (Nhiều người dùng & Phát triển lâu dài)

Để sản phẩm không chỉ là một trang web "dán text vào check" nhàm chán, bạn có thể phát triển theo 1 trong 3 hướng sau:

#### Hướng 1: "JobShield AI" — Trợ Lý Thẩm Định Tin Tuyển Dụng & Chặn Bẫy Chuyển Tiền Cọc Đa Kênh

* **Cách hoạt động (Đánh trúng hành vi sinh viên):**
* Tân sinh viên tìm việc qua Facebook, Zalo, TikTok, Telegram chỉ cần **tải lên ảnh chụp màn hình bài đăng tuyển dụng / đoạn chat với "HR"**, hoặc **dán link tin tuyển dụng / số tài khoản yêu cầu đóng phí**.
* **AI thực hiện quy trình 4 bước (Multi-Step Audit):**
1. *Soi nội dung & tâm lý thao túng:* Phát hiện các dấu hiệu "red flag" kinh điển (lương bất hợp lý so với mô tả, không yêu cầu kinh nghiệm, ép chuyển sang Telegram/Zalo kín, dụ làm nhiệm vụ tăng tương tác/đặt đơn ảo, yêu cầu đóng phí đồng phục/phí giữ chỗ/phí mở khóa hoa hồng).
2. *Xác minh pháp nhân tự động (Tool Use):* AI tự động trích xuất tên công ty, mã số thuế, địa chỉ trên bài đăng và đối chiếu với dữ liệu doanh nghiệp (kiểm tra xem công ty có thật không, địa chỉ có phải "địa chỉ ma" thường dùng để lừa đảo không).
3. *Mô phỏng kịch bản tiếp theo (Scam Simulator):* Cảnh báo cho sinh viên biết **bước tiếp theo kẻ gian sẽ làm gì** (ví dụ: *"Hiện tại họ đang cho bạn nhận 50k tiền hoa hồng nhiệm vụ 1 để tạo lòng tin. Đến nhiệm vụ 3 họ sẽ yêu cầu nạp 2 triệu và khóa tài khoản"*).
4. *Tạo "Thẻ An Toàn" chia sẻ nhóm:* Xuất ra một thẻ cảnh báo ngắn gọn để sinh viên gửi vào nhóm lớp/ký túc xá cảnh báo bạn bè cùng phòng tránh.




* **Định hướng phát triển lâu dài:**
* Giai đoạn 1: Web App + Chrome Extension (tự động gắn nhãn cảnh báo màu đỏ ngay trên các bài đăng tuyển dụng nghi vấn khi sinh viên lướt mạng xã hội).
* Giai đoạn 2: Tích hợp vào các siêu ứng dụng tài chính (như MoMo) dưới dạng tính năng **"Kiểm tra an toàn trước khi chuyển tiền đặt cọc việc làm"**, và kết nối dữ liệu báo cáo cộng đồng với các trường Đại học / Phòng Công tác Sinh viên.



#### Hướng 2: "Offer & Contract X-Ray" — Trợ Lý Soi Bẫy Hợp Đồng Thử Việc & Cam Kết Đào Tạo

* **Cách hoạt động:** Nhiều sinh viên không bị lừa chuyển khoản ngay từ đầu mà bị dụ đến phỏng vấn trực tiếp, sau đó bị ép ký **"Hợp đồng đào tạo / Thỏa thuận giữ chân"** với các điều khoản gài bẫy (phạt hủy hợp đồng 5–10 triệu, giữ giấy tờ tùy thân, trừ lương vô lý, hoặc gài ký giấy vay tín dụng đen).
* **AI dùng làm gì?** Sinh viên chụp ảnh tờ giấy thỏa thuận/hợp đồng ngay tại buổi phỏng vấn -> AI dùng OCR + LLM đọc hiểu pháp lý lao động cơ bản, **tô đỏ các điều khoản bất lợi/trái luật** và giải thích bằng ngôn ngữ dễ hiểu kèm khuyến nghị từ chối ký.

#### Hướng 3: "Scam-Sparring Simulator" — Phòng Tập "Miễn Dịch Lừa Đảo" Tương Tác Thực Tế Cho Tân Sinh Viên

* **Cách hoạt động:** Kết hợp công cụ kiểm tra tin tuyển dụng thật với một **AI Roleplay Agent** đóng vai kẻ lừa đảo chuyên nghiệp. Trước khi đi tìm việc, tân sinh viên được thử sức trong các tình huống giả lập (ví dụ: *được mời làm CTV chốt đơn Shopee*, *được gọi đi làm mẫu ảnh/nhập liệu tại nhà*). AI sẽ dùng đúng chiêu trò thao túng tâm lý ngoài đời để dụ dỗ, nếu sinh viên sập bẫy chuyển tiền ảo, AI sẽ dừng lại phân tích từng câu nói khiến nạn nhân mất cảnh giác.

*(Lời khuyên: **Hướng 1 - JobShield AI** là thực tế nhất, dễ thu hút người dùng đại trà nhất và dễ demo cho Ban Giám khảo tự tay thử nghiệm nhất).*

---

### 3. AI sẽ được dùng cụ thể cho những trường hợp nào trong dự án?

Để Ban Giám khảo thấy **AI là lõi (AI-first)** chứ không phải gắn thêm cho có, hãy phân chia rõ 4 vai trò của AI trong hệ thống của bạn:

1. **Multimodal Extraction (Đọc hiểu đa phương thức từ ảnh chụp màn hình):**
* Sinh viên thường không copy chữ mà **chụp ảnh màn hình** đoạn chat Zalo/Telegram hoặc tờ rơi tuyển dụng. AI đọc trực tiếp hình ảnh, nhận diện cả bố cục tin nhắn (ai là người gửi, ai là người nhận, ảnh chuyển khoản hoa hồng mồi nhử, mã QR lạ).


2. **Psychological & Linguistic Pattern Detection (Phân tích mẫu ngôn ngữ thao túng):**
* Nhận diện các chiêu trò lừa đảo biến tướng liên tục (khi kẻ gian không dùng từ khóa cũ như "việc nhẹ lương cao" nữa mà đổi sang thuật ngữ mới như *"Affiliate Marketing 0 đồng"*, *"Trợ lý vận hành sàn TMĐT"*, *"Nhập liệu chuẩn hóa dữ liệu AI"*).


3. **Agentic Verification (AI tự động gọi công cụ kiểm chứng):**
* AI tự động bóc tách Tên công ty, Mã số thuế, Link website, Số điện thoại từ bài đăng -> Gọi các hàm (Tools) để kiểm tra tuổi đời tên miền (domain mới tạo vài ngày là dấu hiệu lừa đảo), kiểm tra trạng thái hoạt động của doanh nghiệp hoặc đối chiếu với database báo cáo lừa đảo của cộng đồng trong MongoDB.


4. **Actionable Guidance & Community Crowdsourcing (Tư vấn hành động & Làm giàu dữ liệu):**
* Nếu sinh viên lỡ chuyển tiền hoặc lộ CCCD rồi, AI hướng dẫn từng bước xử lý khẩn cấp (khóa thẻ, trình báo công an, đổi mật khẩu) và tự động ẩn danh hóa thông tin nhạy cảm (số điện thoại, tên nạn nhân) trước khi lưu kịch bản lừa đảo mới vào cơ sở dữ liệu cộng đồng.



---

### 4. Lưu ý kỹ thuật quan trọng về Database (MongoDB -> SQL) & Thể lệ

* **Về việc dùng MongoDB khi dev và chuyển sang SQL sau:**
* Bạn **không nên** đợi đến sát ngày nộp bài (03/12) hay lúc vào chung kết mới đổi từ MongoDB sang SQL, vì chuyển đổi cơ sở dữ liệu gấp rất dễ phát sinh lỗi ngầm.
* **Giải pháp tốt hơn:** Hãy dùng **MongoDB** ngay từ đầu cho đến hết cuộc thi (MongoDB Atlas gói miễn phí chạy trên cloud cực kỳ ổn định và bảo mật tốt nếu bạn cấu hình biến môi trường `.env` chuẩn, không hard-code password lên GitHub), **HOẶC** dùng **PostgreSQL (Supabase)** ngay từ hôm nay vì Supabase hỗ trợ kiểu cột `JSONB` (lưu dữ liệu linh hoạt y hệt MongoDB) nhưng vẫn có đầy đủ tính bảo mật và quan hệ của SQL.


* **Lưu ý về dữ liệu cá nhân (Điều 12.4 & Điều 29 Thể lệ):**
* Vì dự án của bạn xử lý ảnh chụp màn hình tin nhắn/số tài khoản lừa đảo, trong file `README` khi nộp mã nguồn (`.zip`), bạn cần ghi rõ: **Toàn bộ dữ liệu mẫu đều được ẩn danh hóa (che tên, số điện thoại, số tài khoản cá nhân thật)** và chỉ dùng dữ liệu công khai hoặc dữ liệu tự tạo để tránh vi phạm quyền riêng tư/dữ liệu cá nhân của bên thứ ba.


* **Chuẩn bị sẵn dữ liệu mẫu để BGK bấm thử 1-click:**
* Dựng sẵn trên giao diện web **3–4 mẫu ảnh chụp màn hình tin tuyển dụng / đoạn chat lừa đảo kinh điển** để Ban Giám khảo chỉ cần bấm vào là thấy AI phân tích ngay, đồng thời mở nút upload để BGK tự tải ảnh bất kỳ lên kiểm tra.