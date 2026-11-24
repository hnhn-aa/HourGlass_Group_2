# HourGlass – Frontend (HTML/CSS/JS thuần)

Web tĩnh, không cần build. Cài đặt & chạy toàn hệ thống: [../README.md](../README.md) · Hướng dẫn sử dụng: [../USER_GUIDE.md](../USER_GUIDE.md)

```bash
python -m http.server 5500      # rồi mở http://127.0.0.1:5500/index.html  (Backend phải chạy ở :8000)
```

## Luồng dữ liệu

```text
js/config.js ──▶ js/api.js ──▶ FastAPI Backend (/api/...)
 (chọn URL       (fetch + JWT,       │
  Backend)        refresh token,     ▼
                  lỗi tập trung)   /api/bootstrap ──▶ js/adapter.js ──▶ giao diện (dashboard.js, jobs.js…)
```

- **`js/config.js`** – nạp đầu tiên trong `<head>`; chọn Backend theo tên miền (local → `http://127.0.0.1:8000`, production → `PRODUCTION_API_BASE`). Ghi đè bằng `?api=<url>`, khôi phục bằng `?api=reset`.
- **`js/api.js`** – `window.HGApi`: gọi REST API, tự gắn `Authorization: Bearer`, tự làm mới token khi gặp 401, báo lỗi tiếng Việt.
- **`js/adapter.js`** – đồng bộ dữ liệu thật từ `/api/bootstrap` vào các mảng dùng chung; chứa các thao tác ghi: tin tuyển dụng, ứng tuyển, hồ sơ, đánh giá, khiếu nại, xử lý khiếu nại. Các hàm trả về `Promise<{ ok } | { error }>`.
- **`js/mock-data.js`** – chỉ là khung dữ liệu ban đầu, được thay bằng dữ liệu Backend ngay khi đồng bộ; **không dùng để lưu dữ liệu**.

## Các module

| File | Vai trò |
| :--- | :--- |
| `layout.js` | Chèn header/footer cho trang công khai |
| `main.js` · `common.js` | Phiên đăng nhập, thẻ việc làm, hamburger menu, `HG.toast`, `HG.busyAsync`, thông báo |
| `modal.js` | `HG.modal`, `HG.confirm`, modal ứng tuyển |
| `auth.js` · `validators.js` | Đăng nhập / đăng ký, quy tắc kiểm tra form |
| `home.js` · `jobs.js` · `detail.js` | Trang chủ, tìm & lọc việc, chi tiết việc |
| `dashboard.js` | 3 dashboard: Sinh viên / Nhà tuyển dụng / Admin |
| `schedule.js` · `profile-extra.js` · `admin-extra.js` | Lịch làm việc & ca rảnh · Kinh nghiệm · Danh mục & phân quyền |
| `reviews-reports.js` | Giao diện đánh giá uy tín & khiếu nại (`HG.rr`) |
| `saved-jobs.js` | Việc đã lưu (`hourglass_saved_jobs`) & Đã xem gần đây (`hourglass_recent_jobs`, 10 tin) |
| `notify.js` | Chuông thông báo theo vai trò, đã đọc / chưa đọc |
| `ai-assistant.js` + `css/ai-assistant.css` | Khung chat Trợ lý AI HourGlass (gọi `POST /api/ai/chat`) |
| `responsive.js` + `css/responsive.css` | Hiển thị mobile/tablet (≤768px, ≤480px), bảng dạng thẻ |

## Dữ liệu còn lưu trên trình duyệt (localStorage)

Phiên đăng nhập & token, việc đã lưu / đã xem gần đây, **tin nháp** của nhà tuyển dụng, kinh nghiệm trong hồ sơ, tùy chọn thông báo, trạng thái đã đọc thông báo (lịch sử chat AI nằm trong sessionStorage). Kỹ năng sinh viên đã được lưu ở Backend. Mọi dữ liệu nghiệp vụ còn lại (tin, đơn, CV, hồ sơ, đánh giá, khiếu nại…) đều lưu ở Backend.

## Deploy Vercel

`vercel.json` có sẵn (web tĩnh, giữ đuôi `.html`). Sửa `PRODUCTION_API_BASE` trong `js/config.js`, chọn **Root Directory = `frontend`**, **Framework = Other**. Chi tiết xem [README gốc – mục 7](../README.md#7-deploy-frontend-lên-vercel).
