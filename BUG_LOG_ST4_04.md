# Báo Cáo Kiểm Thử & Nhật Ký Khắc Phục Lỗi Tích Hợp FE–BE (`[ST4-04]`)

- **Mã nhiệm vụ**: `T069E7E` (`[ST4-04] Gỡ mock-data & sửa lỗi tích hợp`) & `T069E64` (`[Tích hợp] Ghép API Hồ sơ cá nhân, Đánh giá & Khiếu nại`)
- **Người thực hiện**: Bùi Hữu Nhân (`B25DTCN254`)
- **Sprint**: Sprint 3 (19/11 – 25/11/2026)

---

## 1. Tổng quan công việc đã thực hiện

1. **Gỡ bỏ hoàn toàn `frontend/js/mock-data.js`**:
   - Xóa file `frontend/js/mock-data.js` khỏi dự án.
   - Gỡ bỏ thẻ `<script src="js/mock-data.js"></script>` trên toàn bộ 9 trang giao diện: `index.html`, `jobs.html`, `job-detail.html`, `categories.html`, `about.html`, `auth.html`, `student.html`, `employer.html`, `admin.html`.
   - Khởi tạo các mảng store rỗng trên bộ nhớ tại `frontend/js/main.js` và nạp 100% dữ liệu thật từ endpoint `GET /api/bootstrap` thông qua `frontend/js/adapter.js`.
2. **Dọn sạch các khóa `localStorage` giả lập cũ (`purgeLegacyMockKeys`)**:
   - Tự động xóa các khóa dữ liệu mẫu từng lưu cục bộ ở giai đoạn prototype (`hg_profile_*`, `hg_emp_profile_*`, `hg_cvs_*`, `hg_report_status`) ngay khi khởi chạy `adapter.js`.
3. **Đồng bộ 100% luồng Hồ sơ cá nhân, Upload CV/Ảnh, Đánh giá uy tín & Khiếu nại với REST API thật**:
   - Hồ sơ sinh viên & kỹ năng: `PUT /api/students/{id}`, `POST /api/students/{id}/avatar`.
   - Hồ sơ doanh nghiệp & logo: `PUT /api/employer/{id}`, `POST /api/employer/{id}/logo`.
   - Quản lý & upload CV: `GET /api/cvs`, `POST /api/cvs/upload`, `PATCH /api/cvs/{id}/default`, `DELETE /api/cvs/{id}`.
   - Ứng tuyển công việc: `POST /api/applications` (multipart upload CV trực tiếp) & `POST /api/applications/json` (chọn CV đã lưu).
   - Đánh giá uy tín 2 chiều (Sinh viên ↔ Nhà tuyển dụng): `POST /api/reviews`, `GET /api/users/{id}/reputation`, `GET /api/users/{id}/reviews`.
   - Gửi & xử lý khiếu nại vi phạm: `POST /api/reports`, `GET /api/users/{id}/reports`, `PATCH /api/admin/reports/{id}`.

---

## 2. Nhật ký lỗi tích hợp FE–BE đã phát hiện và khắc phục (Bug Log)

| Mã Bug | Phân hệ | Mô tả lỗi phát sinh khi kết nối FE–BE | Nguyên nhân gốc (Root Cause) | Giải pháp khắc phục & File cập nhật | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BUG-01** | Toàn hệ thống (`mock-data`) | Khi DB trên Backend chưa có khiếu nại hoặc vừa xóa tin tuyển dụng, giao diện vẫn hiện 2 báo cáo vi phạm mẫu và 5 việc làm giả từ `mock-data.js`. | `mock-data.js` nạp cứng dữ liệu mẫu trước khi `/api/bootstrap` phản hồi; khi mảng trả về rỗng, logic cũ giữ lại mảng mẫu. | Xóa hẳn `frontend/js/mock-data.js`; gỡ thẻ `<script>` trên cả 9 trang HTML; cập nhật `applyBootstrapPayload()` trong `frontend/js/adapter.js` để thay thế hoàn toàn bằng dữ liệu từ Backend (kể cả mảng rỗng). | **Đã sửa (Resolved)** |
| **BUG-02** | Hồ sơ Sinh viên (`skills`) | Kỹ năng sinh viên (`skills`) thêm/xóa trên giao diện bị mất sau khi tải lại trang hoặc bị lỗi `422 Unprocessable Entity` khi gọi `PUT /api/students/{id}`. | Trong DB, cột `skills` lưu chuỗi JSON, nhưng schema Pydantic nhận/trả mảng `list[str]`. Ngoài ra thao tác thêm nhanh chip kỹ năng trước đây chỉ lưu vào `localStorage`. | Viết hàm chuẩn hóa `HG.parseSkills()` và `HG.saveStudentSkills()` trong `frontend/js/adapter.js` kết hợp debounce đồng bộ tự động trong `frontend/js/dashboard.js` lên `PUT /api/students/{id}`. | **Đã sửa (Resolved)** |
| **BUG-03** | Upload CV & Xem trước CV (`cvs`) | Sau khi upload CV thành công (`POST /api/cvs/upload`), bấm nút **"Xem"** CV hoặc tải xuống bị lỗi `404 Not Found` trên cổng Frontend (`5500`). | Backend trả về đường dẫn tương đối `/uploads/cvs/...`, khi chạy Live Server ở cổng `5500` trình duyệt ghép nhầm sang `http://127.0.0.1:5500/uploads/...` thay vì cổng Backend `8000`. | Xây dựng `HG.toStoredUploadUrl()` và `HG.resolveUploadUrl()` trong `frontend/js/adapter.js` để luôn ghép đường dẫn `/uploads/...` với `HGApi.getBaseUrl()` (`http://127.0.0.1:8000`). | **Đã sửa (Resolved)** |
| **BUG-04** | Upload Ảnh tin đăng & Avatar/Logo | Ảnh banner tin tuyển dụng hoặc ảnh đại diện bị vỡ icon (`broken image`) khi DB chứa chuỗi rác (như `"string"` từ Swagger) hoặc URL локаl cũ. | Thiếu bước kiểm tra định dạng URL ảnh trước khi gán vào `src` của thẻ `<img>` và thiếu cơ chế fallback tự động ở pha capture. | Kiểm tra biểu thức chính quy URL hợp lệ trong `HG.avatarUrl()` (`common.js`) & `HG.resolveImageUrl()` (`adapter.js`), đồng thời gắn trình lắng nghe lỗi ảnh toàn cục (`HG.IMG_PLACEHOLDER`) trong `main.js`. | **Đã sửa (Resolved)** |
| **BUG-05** | Ứng tuyển công việc (`modal.js`) | Khi mở modal Ứng tuyển ngay sau khi vừa tải CV mới lên ở tab Hồ sơ, danh sách `<select name="cv">` trong modal không hiển thị CV mới vừa upload. | Modal ứng tuyển chỉ đọc mảng `cvs` cũ lúc mới mở trang mà chưa gọi lại API lấy danh sách CV mới nhất của sinh viên. | Bổ sung `HG.fetchMyCvs()` (`GET /api/cvs?student_id=...`) gọi ngay khi `applyModal` mở trong `frontend/js/modal.js` để cập nhật nóng danh sách CV mà không làm mất dữ liệu đang nhập. | **Đã sửa (Resolved)** |
| **BUG-06** | Đánh giá uy tín (`reviews`) | Sinh viên hoặc Nhà tuyển dụng có thể bấm gửi đánh giá nhiều lần hoặc gửi đánh giá khi chưa chọn số sao, gây lỗi `400/422` từ Backend. | Chưa khóa nút gửi trong lúc chờ Promise API (`HG.busyAsync`) và chưa kiểm tra trạng thái `alreadyReviewed` đối với cùng một `job_id`. | Cập nhật `frontend/js/reviews-reports.js` & `frontend/js/detail.js`: kiểm tra `alreadyReviewed()`, validate số sao `1..5` tại chỗ, dùng `HG.busyAsync()` chống double-submit và tự động làm mới bảng điểm uy tín sau khi gửi. | **Đã sửa (Resolved)** |
| **BUG-07** | Khiếu nại & Kiểm duyệt (`reports`) | Khi Admin giải quyết khiếu nại có tích chọn **"Gỡ tin tuyển dụng vi phạm"**, trạng thái khiếu nại chuyển sang `Đã giải quyết` nhưng tin tuyển dụng vẫn còn hiển thị ở danh sách công khai. | Sau khi gọi `PATCH /api/admin/reports/{id}` với `remove_job: true`, Frontend chưa gọi `HG.syncFromBackend()` để đồng bộ lại mảng `jobs` và `window.HG_JOBS`. | Cập nhật `HG.processReport()` trong `frontend/js/adapter.js`: chuỗi hóa `.then(HG.syncFromBackend)` sau khi xử lý khiếu nại và bắn thông báo `HG.notify` cho cả người báo cáo lẫn nhà tuyển dụng. | **Đã sửa (Resolved)** |
| **BUG-08** | Lịch rảnh & Lịch làm việc (`schedules`) | Bấm "Lưu ca rảnh" gửi trùng lặp các ô đã có sẵn hoặc khi thêm ca làm việc trùng giờ bị lỗi `409 Conflict` nhưng không hiển thị rõ ca nào bị trùng. | Chưa tính phần chênh lệch (diff) giữa lưới ca rảnh hiện tại với bảng `availabilities` trên DB, và thiếu hàm kiểm tra giao thoa khung giờ trước khi gọi API. | Cập nhật `HG.saveAvailability()` (`adapter.js`) chỉ gửi `POST` cho ca mới tích và `DELETE` cho ca bỏ tích; bổ sung `findClash()` trong `frontend/js/schedule.js` để cảnh báo rõ tên ca và khung giờ bị trùng. | **Đã sửa (Resolved)** |
| **BUG-09** | Chuông thông báo (`notify.js`) | Trạng thái "Đã đọc" của các thông báo sinh từ dữ liệu thật (đơn ứng tuyển đổi trạng thái, tin được duyệt, khiếu nại mới) bị reset về "Chưa đọc" mỗi lần `/api/bootstrap` đồng bộ lại. | ID thông báo trước đây sinh ngẫu nhiên theo `Date.now()` nên mỗi lần đồng bộ tạo bản ghi mới. | Chuẩn hóa ID cố định theo thực thể (`d-app-{id}-{status}`, `d-job-{id}-{status}`, `d-rep-{id}`) trong `syncDerived()` tại `frontend/js/notify.js`, giữ nguyên cờ `read` trong `localStorage`. | **Đã sửa (Resolved)** |

---

## 3. Kiểm tra xác nhận sau khi gỡ `mock-data.js`

- [x] `frontend/js/mock-data.js` đã bị xóa hoàn toàn khỏi mã nguồn.
- [x] Toàn bộ 9 trang HTML không còn nạp `js/mock-data.js`, không phát sinh lỗi `404` hay `ReferenceError` trên Console.
- [x] Toàn bộ thao tác Thêm / Sửa / Xóa / Upload trên Hồ sơ cá nhân, CV, Đánh giá và Khiếu nại hoạt động trực tiếp với Backend FastAPI (`http://127.0.0.1:8000`) và phản ánh tức thời lên giao diện.
