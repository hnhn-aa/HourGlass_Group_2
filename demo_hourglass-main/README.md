# ⏳ HourGlass — Hệ thống Cổng việc làm thêm cho Sinh viên

**HourGlass** là nền tảng kết nối việc làm bán thời gian (Part-time), thực tập (Internship) và toàn thời gian (Full-time) dành cho sinh viên, nhà tuyển dụng và quản trị viên. Dự án được tổ chức theo kiến trúc tách biệt hoàn toàn giữa **Backend (FastAPI + SQLAlchemy + Alembic + MySQL/SQLite)** và **Frontend (HTML5/CSS3/Vanilla JS)**.

---

## 📂 Cấu trúc Thư mục Dự án

```text
HourGlass_Final_Project/
├── backend/                        # Phân hệ Backend (FastAPI Modular Architecture)
│   ├── app/
│   │   ├── core/
│   │   │   └── security.py         # Mã hóa mật khẩu (bcrypt & PBKDF2) + JWT Access/Refresh Token
│   │   ├── db/
│   │   │   └── database.py         # Kết nối SQLAlchemy Engine, SessionLocal, get_db()
│   │   ├── dependencies/
│   │   │   └── middleware.py       # Xác thực JWT & Phân quyền theo Role (Student, Employer, Admin)
│   │   ├── models/                 # 17 bảng dữ liệu ORM (SQLAlchemy)
│   │   │   ├── user.py             # users
│   │   │   ├── profile.py          # password_resets, student_profiles, employer_profiles, admin_profiles
│   │   │   ├── job.py              # job_categories, job_locations, jobs, job_saves
│   │   │   ├── application.py      # application_statuses, cvs, applications, application_status_logs
│   │   │   ├── schedule.py         # availabilities, schedules
│   │   │   ├── report.py           # reports
│   │   │   └── review.py           # reviews
│   │   ├── schemas/                # Pydantic v2 Validation & Serialization Schemas
│   │   │   ├── users.py
│   │   │   ├── jobs.py
│   │   │   ├── applications.py
│   │   │   ├── reviews.py
│   │   │   ├── reports.py
│   │   │   └── schedules.py
│   │   ├── services/               # Tầng xử lý logic nghiệp vụ (Business Logic Layer)
│   │   │   ├── auth_services.py
│   │   │   ├── user_services.py
│   │   │   ├── job_services.py
│   │   │   ├── application_services.py
│   │   │   ├── review_services.py
│   │   │   ├── report_services.py
│   │   │   └── schedule_services.py
│   │   ├── routers/                # Tầng điều hướng RESTful API Endpoints
│   │   │   ├── users.py
│   │   │   ├── jobs.py
│   │   │   ├── applications.py
│   │   │   ├── reviews.py
│   │   │   ├── reports.py
│   │   │   └── schedules.py
│   │   └── main.py                 # Điểm khởi chạy ứng dụng FastAPI, CORS, Static/Uploads, Exception Handlers
│   ├── migrations/                 # Cấu hình & phiên bản Alembic Database Migration
│   │   ├── versions/
│   │   │   └── 761599e23f17_init_tables_users_categories_job_posts_.py
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── tests/                      # Bộ kiểm thử tự động & Postman Collection
│   │   ├── test_api.py
│   │   └── postman_collection.json
│   ├── .env.example                # File mẫu cấu hình biến môi trường
│   ├── alembic.ini                 # Cấu hình Alembic CLI
│   ├── requirements.txt            # Danh sách thư viện Python cần thiết
│   └── seed_data.py                # Script khởi tạo & nạp dữ liệu mẫu cho toàn bộ 17 bảng
│
├── frontend/                       # Phân hệ Giao diện Người dùng (Web Client)
│   ├── assets/                     # Hình ảnh & Favicon
│   ├── css/                        # Bộ giao diện CSS theo từng trang và component
│   ├── js/                         # Logic giao diện, adapter dữ liệu, lịch học/làm, thông báo
│   ├── index.html                  # Trang chủ HourGlass
│   ├── auth.html                   # Đăng nhập / Đăng ký
│   ├── jobs.html                   # Tìm kiếm & lọc danh sách việc làm
│   ├── job-detail.html             # Chi tiết tin tuyển dụng & ứng tuyển
│   ├── categories.html             # Danh mục ngành nghề
│   ├── student.html                # Không gian làm việc của Sinh viên (Hồ sơ, CV, Lịch, Đơn ứng tuyển)
│   ├── employer.html               # Không gian làm việc của Nhà tuyển dụng (Đăng tin, Duyệt ứng viên)
│   ├── admin.html                  # Bảng điều khiển Quản trị viên (Duyệt tin, Khiếu nại, Thống kê)
│   └── about.html                  # Giới thiệu về HourGlass
│
└── README.md                       # Tài liệu hướng dẫn cài đặt & vận hành hệ thống
```

---

## ⚙️ Hướng dẫn Cài đặt & Khởi chạy Backend

### Bước 1: Chuẩn bị môi trường Python
Yêu cầu **Python 3.10+**. Mở terminal tại thư mục gốc của dự án và di chuyển vào `backend/`:

```bash
cd backend
python -m venv venv
# Kích hoạt môi trường ảo trên Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Hoặc trên macOS / Linux:
# source venv/bin/activate

pip install -r requirements.txt
```

### Bước 2: Cấu hình Biến môi trường (`.env`)
Sao chép file `.env.example` thành `.env` trong thư mục `backend/`:

```bash
cp .env.example .env
```

Chỉnh sửa thông tin kết nối cơ sở dữ liệu trong `backend/.env`:
- **Sử dụng MySQL** (mặc định):
  ```env
  DATABASE_URL=mysql+pymysql://root:060207@127.0.0.1:3306/project_fastapi
  SECRET_KEY=hourglass-super-secret-jwt-key-2026
  ```
- **Sử dụng SQLite** (nếu muốn chạy nhanh không cần cài MySQL Server):
  ```env
  DATABASE_URL=sqlite:///./hourglass.db
  SECRET_KEY=hourglass-super-secret-jwt-key-2026
  ```

### Bước 3: Khởi tạo Database (Alembic Migration) & Nạp Dữ liệu mẫu (Seed Data)

```bash
# Chạy Alembic migration để khởi tạo 17 bảng dữ liệu chuẩn:
alembic upgrade head

# Nạp dữ liệu mẫu đầy đủ cho toàn bộ 17 bảng (kèm tạo file CV PDF mẫu trong uploads/):
python seed_data.py --reset
```

**Tài khoản mẫu sau khi chạy `seed_data.py` (mật khẩu chung: `123456`):**
| Vai trò | Email | Họ và tên |
| :--- | :--- | :--- |
| **Sinh viên** | `student1@gmail.com` | Nguyễn Văn An |
| **Sinh viên** | `student2@gmail.com` | Trần Thị Bình |
| **Sinh viên** | `student3@gmail.com` | Lê Minh Đức |
| **Nhà tuyển dụng** | `employer1@gmail.com` | Phạm Quốc Huy (Highlands Coffee) |
| **Nhà tuyển dụng** | `employer2@gmail.com` | Hoàng Thu Trang (FPT Shop) |
| **Quản trị viên (Admin)** | `admin@gmail.com` | Nguyễn Hoàng Nam |

### Bước 4: Khởi chạy Server FastAPI

Từ thư mục `backend/`, chạy lệnh:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Sau khi server khởi chạy:
- **Swagger UI (Tài liệu & thử nghiệm API trực quan)**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`
- **Health Check**: `http://127.0.0.1:8000/health`

---

## 🖥️ Hướng dẫn Mở và Chạy Frontend

Phân hệ `frontend/` được xây dựng bằng HTML5/CSS3/JavaScript thuần, giữ nguyên toàn bộ cấu trúc liên kết tĩnh (`assets/`, `css/`, `js/`). Bạn có thể chạy theo 1 trong 2 cách:

### Cách 1: Sử dụng VS Code Live Server (Khuyên dùng)
1. Mở thư mục dự án trong **Visual Studio Code**.
2. Nhấp chuột phải vào file `frontend/index.html` và chọn **"Open with Live Server"**.
3. Trình duyệt sẽ tự động mở tại địa chỉ `http://127.0.0.1:5500/frontend/index.html`.

### Cách 2: Sử dụng HTTP Server tích hợp của Python
Mở một terminal mới tại thư mục `frontend/`:

```bash
cd frontend
python -m http.server 5500
```
Sau đó mở trình duyệt và truy cập: `http://127.0.0.1:5500/index.html`.

---

## 🧪 BÁO CÁO & TÀI LIỆU KIỂM THỬ HỆ THỐNG (TEST DOCUMENTATION)

> **Học phần**: Phát triển Ứng dụng & Dịch vụ Web / Đồ án nhóm  
> **Nhiệm vụ (Sprint 3 · 19/11 – 25/11)**: **ST3-06 — Bổ sung tài liệu kiểm thử, chuẩn hóa Swagger UI, xuất Postman Collection & xử lý lỗi phát sinh**  
> **Người thực hiện**: **Nguyễn Tuấn Việt (MSV: B25DTCN266)**  
> **Thành viên phối hợp**: 
> - **Ngô Xuân Tài**: Xây dựng & nạp Seed Data mẫu 17 bảng (`seed_data.py`)
> - **Trịnh Đình Phúc & Hoàng Đình Khang**: Kiểm thử người dùng giao diện, phát hiện & phản hồi lỗi

---

### 1. Tổng quan & Kế hoạch Kiểm thử (Test Plan)

#### 1.1. Mục tiêu kiểm thử
1. **Kiểm tra chức năng (Functional Testing)**: Đảm bảo toàn bộ luồng nghiệp vụ hoạt động chính xác từ khâu đăng ký, đăng tin, duyệt tin, nộp hồ sơ CV, chuyển trạng thái đơn đến đánh giá uy tín và báo cáo vi phạm.
2. **Kiểm tra phân quyền (RBAC Testing)**: Đảm bảo sinh viên, nhà tuyển dụng và quản trị viên chỉ truy cập được đúng tài nguyên được ủy quyền.
3. **Kiểm tra tính toàn vẹn dữ liệu (Data Integrity)**: Xác thực ràng buộc Unique (Email, trùng lặp ứng tuyển, trùng lặp đánh giá bản thân), Foreign Key, Validation Schemas.
4. **Kiểm tra chuẩn hóa phản hồi (Standardized Response)**: Tất cả các mã HTTP lỗi (400, 401, 403, 404, 409, 422) đều trả về định dạng JSON thống nhất kèm thông báo tiếng Việt rõ nghĩa cho người dùng cuối.

#### 1.2. Phạm vi kiểm thử
- **Đơn vị (Unit Test) & Tích hợp (Integration Test)**: Chạy qua bộ kiểm thử tự động `tests/test_api.py`.
- **Thực nghiệm người dùng API (API End-to-End)**: Kiểm thử hộp đen thông qua Postman Collection `tests/postman_collection.json`.
- **Giao diện tài liệu tương tác**: Thử nghiệm trực tiếp qua Swagger UI (`/docs`).

---

### 2. Dữ liệu Kiểm thử Thực nghiệm (Seed Data 17 Bảng)

Bộ dữ liệu mẫu chuẩn được xây dựng tại `seed_data.py`, bao gồm các tài khoản kiểm thử chính (**Mật khẩu chung:** `123456`):

| ID | Họ và tên | Email | Vai trò (Role) | Thuộc tính hồ sơ nổi bật |
|:---|:---|:---|:---|:---|
| **1** | Nguyễn Văn An | `student1@gmail.com` | `student` | Đại học Bách Khoa, CNTT, có sẵn CV mẫu |
| **2** | Trần Thị Bình | `student2@gmail.com` | `student` | Đại học Kinh tế Quốc dân, Marketing |
| **3** | Lê Minh Đức | `student3@gmail.com` | `student` | Học viện Ngân hàng, Tài chính doanh nghiệp |
| **4** | Phạm Quốc Huy | `employer1@gmail.com` | `employer` | Highlands Coffee, Đã xác minh (Verified) |
| **5** | Hoàng Thu Trang | `employer2@gmail.com` | `employer` | FPT Shop, Bán lẻ công nghệ |
| **6** | Nguyễn Hoàng Nam | `admin@gmail.com` | `admin` | Quản trị viên hệ thống HourGlass |

---

### 3. Ma trận Kịch bản Kiểm thử Chi tiết (Test Cases Matrix)

#### Module 1: Xác thực & Phân quyền (Auth & Users)
| Mã TC | Tên ca kiểm thử | Phương thức & URL | Dữ liệu đầu vào (Payload) | Mã kỳ vọng | Kết quả thực tế | Trạng thái |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-AUTH-01** | Đăng nhập thành công với tài khoản Nhà tuyển dụng | `POST /users/login` | `{"email": "employer1@gmail.com", "password": "123456"}` | `200 OK` | Nhận Access Token & Refresh Token | **PASS** |
| **TC-AUTH-02** | Đăng nhập thất bại khi sai mật khẩu | `POST /users/login` | `{"email": "employer1@gmail.com", "password": "sai"}` | `400 Bad Request` | Thông báo: "Mật khẩu không chính xác" | **PASS** |
| **TC-AUTH-03** | Lấy thông tin cá nhân với Bearer Token hợp lệ | `GET /users/me` | Header `Authorization: Bearer <token>` | `200 OK` | Trả về thông tin `employer1@gmail.com` | **PASS** |
| **TC-AUTH-04** | Truy cập endpoint bảo vệ khi không có Token | `GET /users/me` | Không truyền Header | `401 Unauthorized` | Trả về thông báo tiếng Việt chuẩn | **PASS** |
| **TC-AUTH-05** | Đăng ký tài khoản Sinh viên mới | `POST /api/users` | `{"full_name": "Ngô Xuân Tài", "email": "tai.nx@ptit.edu.vn", "password": "123", "role": "student"}` | `201 Created` | Tạo User và tự động tạo StudentProfile | **PASS** |
| **TC-AUTH-06** | Đăng ký tài khoản với email đã tồn tại | `POST /api/users` | `{"email": "tai.nx@ptit.edu.vn", ...}` | `409 Conflict` | Thông báo: "Email đã tồn tại" | **PASS** |

#### Module 2: Quản lý Tin tuyển dụng (Job Postings & Workflow)
| Mã TC | Tên ca kiểm thử | Phương thức & URL | Mô tả nghiệp vụ | Mã kỳ vọng | Kết quả thực tế | Trạng thái |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-JOB-01** | Nhà tuyển dụng tạo tin tuyển dụng mới | `POST /jobs` | Đăng tin part-time có lương hợp lệ (35k - 45k) | `201 Created` | Tin có trạng thái mặc định `pending` | **PASS** |
| **TC-JOB-02** | Tạo tin tuyển dụng với khoảng lương sai (`salary_min > salary_max`) | `POST /api/jobs` | `salary_min: 50000, salary_max: 20000` | `422 Unprocessable` | Bị chặn bởi Pydantic validator | **PASS** |
| **TC-JOB-03** | Tìm kiếm tin tuyển dụng theo từ khóa | `GET /api/jobs?keyword=FastAPI` | Tìm việc liên quan đến Python/FastAPI | `200 OK` | Danh sách trả về đúng các tin chứa từ khóa | **PASS** |
| **TC-JOB-04** | Admin duyệt tin tuyển dụng mới | `PATCH /api/admin/jobs/{id}/review` | Chuyển trạng thái từ `pending` sang `approved` | `200 OK` | Tin chuyển sang `approved` | **PASS** |
| **TC-JOB-05** | Sinh viên lưu / bỏ lưu tin vào danh sách yêu thích | `POST /api/job-saves/toggle` | `{"user_id": 1, "job_id": 3}` | `200 OK` | Trả về `is_saved: true/false` | **PASS** |

#### Module 3: Ứng tuyển & Quản lý Hồ sơ CV (Applications & CV)
| Mã TC | Tên ca kiểm thử | Phương thức & URL | Mô tả nghiệp vụ | Mã kỳ vọng | Kết quả thực tế | Trạng thái |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-APP-01** | Nộp hồ sơ kèm upload file CV PDF | `POST /api/applications` | Multipart/form-data kèm file `.pdf` | `201 Created` | Lưu file vào `uploads/` và tạo bản ghi | **PASS** |
| **TC-APP-02** | Chặn nộp hồ sơ với file không hợp lệ (.exe) | `POST /api/applications` | File `bad.exe` giả mạo | `400 Bad Request` | Báo lỗi định dạng file không hỗ trợ | **PASS** |
| **TC-APP-03** | Chặn nộp hồ sơ trùng lặp vào cùng 1 tin | `POST /api/applications` | Sinh viên 1 ứng tuyển lại vào việc đã nộp | `409 Conflict` | Báo lỗi hồ sơ đã được nộp trước đó | **PASS** |
| **TC-APP-04** | Nộp hồ sơ bằng JSON chọn CV có sẵn | `POST /api/applications/json` | Chọn `cv_id` hợp lệ của chính sinh viên | `201 Created` | Khởi tạo đơn ứng tuyển thành công | **PASS** |
| **TC-APP-05** | Chặn sử dụng CV của sinh viên khác | `POST /api/applications/json` | Sinh viên 2 cố tình gửi `cv_id` của Sinh viên 1 | `403 Forbidden` | Báo lỗi không có quyền truy cập CV này | **PASS** |
| **TC-APP-06** | Nhà tuyển dụng cập nhật trạng thái đơn (Phỏng vấn) | `PATCH /api/applications/{id}/status` | Chuyển trạng thái sang `interview` | `200 OK` | `status_name` cập nhật thành `interview` | **PASS** |
| **TC-APP-07** | Xem lịch sử thay đổi trạng thái đơn (Audit Log) | `GET /api/applications/{id}/logs` | Truy vấn danh sách lịch sử xử lý | `200 OK` | Trả về danh sách log đầy đủ người đổi & note | **PASS** |

#### Module 4: Đánh giá Uy tín & Xử lý Khiếu nại (Reviews & Reports)
| Mã TC | Tên ca kiểm thử | Phương thức & URL | Mô tả nghiệp vụ | Mã kỳ vọng | Kết quả thực tế | Trạng thái |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-REV-01** | Chặn người dùng tự đánh giá bản thân | `POST /api/reviews` | `reviewer_id == target_id` | `422 Unprocessable` | Báo lỗi: "Không thể tự đánh giá chính mình" | **PASS** |
| **TC-REV-02** | Đánh giá nhà tuyển dụng và tính toán lại điểm uy tín | `POST /api/reviews` | Sinh viên 3 chấm 4 sao cho Highlands Coffee | `201 Created` | Tạo review thành công | **PASS** |
| **TC-REV-03** | Truy vấn tổng hợp điểm uy tín người dùng | `GET /api/users/4/reputation` | Xem điểm trung bình và huy hiệu uy tín | `200 OK` | Điểm TB ~4.67, Huy hiệu: "Rất uy tín" | **PASS** |
| **TC-REP-01** | Sinh viên gửi khiếu nại tin tuyển dụng vi phạm | `POST /api/reports` | Báo cáo tin vi phạm chính sách | `201 Created` | Tạo khiếu nại thành công | **PASS** |
| **TC-REP-02** | Chặn gửi khiếu nại trùng lặp đang chờ xử lý | `POST /api/reports` | Gửi lại cùng đối tượng khi đơn cũ chưa xong | `409 Conflict` | Báo lỗi khiếu nại trùng lặp | **PASS** |
| **TC-REP-03** | Admin gỡ tin đăng vi phạm & tự động duyệt khiếu nại | `DELETE /api/admin/jobs/1/remove` | Gỡ tin vi phạm chính sách | `200 OK` | Tin chuyển sang `rejected`, khiếu nại thành `resolved` | **PASS** |
| **TC-REP-04** | Thống kê số liệu hệ thống toàn diện cho Admin | `GET /api/admin/statistics` | Thống kê tổng số users, jobs, reports, apps | `200 OK` | Dữ liệu chính xác 100% khớp database | **PASS** |

---

### 4. Kết quả Kiểm thử Tự động (Automated Unit & Integration Tests)

Toàn bộ các ca kiểm thử tích hợp chuyên sâu được tự động hóa tại file [backend/tests/test_api.py](file:///c:/Users/Admin/Downloads/demo_hourglass-main/demo_hourglass-main/backend/tests/test_api.py).

#### Lệnh chạy kiểm thử:
```bash
cd backend
python tests/test_api.py
```

#### Kết quả chạy thực tế:
```text
test_applications_upload_cv_logs_and_status_updates (__main__.HourglassMergedAPITest.test_applications_upload_cv_logs_and_status_updates) ... ok
test_branch_b_jwt_auth_and_profiles_and_jobs (__main__.HourglassMergedAPITest.test_branch_b_jwt_auth_and_profiles_and_jobs) ... ok
test_health_docs_static_and_catalogs (__main__.HourglassMergedAPITest.test_health_docs_static_and_catalogs) ... ok
test_jobs_create_receive_update_and_admin_review (__main__.HourglassMergedAPITest.test_jobs_create_receive_update_and_admin_review) ... ok
test_reports_admin_remove_and_statistics (__main__.HourglassMergedAPITest.test_reports_admin_remove_and_statistics) ... ok
test_reviews_and_reputation (__main__.HourglassMergedAPITest.test_reviews_and_reputation) ... ok
test_users_and_profiles_creation (__main__.HourglassMergedAPITest.test_users_and_profiles_creation) ... ok

----------------------------------------------------------------------
Ran 7 test suites in 3.622s

OK (Tất cả 7/7 test suites ĐẠT 100%)
```

---

### 5. Hướng dẫn Kiểm thử với Postman Collection

File Collection chuẩn hóa đã được chuẩn bị tại:
👉 **[backend/tests/postman_collection.json](file:///c:/Users/Admin/Downloads/demo_hourglass-main/demo_hourglass-main/backend/tests/postman_collection.json)**

#### 5.1. Cấu trúc 5 Thư mục Kiểm thử trong Postman
1. **`0. Health, Users & Danh mục` (8 requests)**: Kiểm tra Health check, danh mục ngành nghề, địa điểm, danh sách hồ sơ và tạo người dùng mới.
2. **`1. Đăng tin & Tiếp nhận tin đăng` (6 requests)**: Đăng tin tuyển dụng, tìm kiếm lọc tin theo từ khóa/danh mục, admin duyệt/từ chối tin đăng.
3. **`2. Ứng tuyển & Cập nhật trạng thái hồ sơ` (5 requests)**: Nộp đơn kèm file/JSON, xem chi tiết hồ sơ, cập nhật trạng thái đơn (chuyển sang phỏng vấn/nhận việc) và xem audit log.
4. **`3. Đánh giá & Chấm điểm uy tín` (3 requests)**: Đánh giá sao, chấm điểm uy tín và truy vấn huy hiệu của đối tác/sinh viên.
5. **`4. Khiếu nại & Quản trị Admin` (5 requests)**: Gửi báo cáo vi phạm, admin tiếp nhận xử lý khiếu nại, gỡ bỏ tin vi phạm và xuất số liệu thống kê.

#### 5.2. Hướng dẫn sử dụng Postman
1. Mở ứng dụng **Postman** -> Nhấn nút **Import** -> Chọn file `backend/tests/postman_collection.json`.
2. Kiểm tra biến môi trường Collection Variable `baseUrl`: Giá trị mặc định là `http://127.0.0.1:8000`.
3. Có thể chạy từng Request đơn lẻ hoặc dùng tính năng **Run Collection** để chạy toàn bộ 27 kịch bản tự động.

---

### 6. Tài liệu API & Thử nghiệm Trực quan qua Swagger UI

Hệ thống HourGlass cung cấp tài liệu API chuẩn OpenAPI 3.0 với giao diện tương tác trực tiếp:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

#### Các đặc điểm nổi bật trên Swagger UI:
- **Gắn Tag rõ ràng**: Phân tách 9 nhóm nghiệp vụ chính (`System`, `Catalogs`, `Users`, `Jobs`, `Applications`, `Reviews`, `Reports`, `Schedules & Availabilities`, `Admin`).
- **Mô tả chi tiết & Ví dụ mẫu (Examples)**: Từng endpoint đều có mô tả tóm tắt tiếng Việt, tham số query/path rõ ràng, schema JSON mẫu chuẩn kèm giải thích ngữ nghĩa.
- **Tích hợp nút "Authorize"**: Hỗ trợ nhập JWT Bearer Token (`Bearer <access_token>`) để thử nghiệm trực tiếp các API phân quyền mà không cần công cụ bên ngoài.

---

### 7. Nhật ký Xử lý & Khắc phục Lỗi (Bug Fix Log)

Trong quá trình tự chạy kiểm thử toàn bộ hệ sinh thái API theo phản hồi từ các thành viên trong nhóm (Phúc, Khang), các lỗi sau đã được phát hiện và khắc phục triệt để:

| STT | Lỗi phát hiện | Nguyên nhân kỹ thuật | Giải pháp khắc phục | Trạng thái |
|:---|:---|:---|:---|:---|
| **1** | `AttributeError: module 'jwt' has no attribute 'encode'` khi đăng nhập | Môi trường cài đặt nhầm package `jwt` lỗi thời thay vì thư viện chuẩn `PyJWT` | Gỡ bỏ thư viện `jwt` cũ và cài đặt chính xác `PyJWT==2.10.1` | **ĐÃ SỬA** |
| **2** | Trạng thái đơn nộp không hiển thị đúng sau khi `update_application_status` (`'submitted' != 'interview'`) | Quan hệ ORM `app.status_obj` được cache trên Session nên khi đổi `status_id` chưa tự động load lại quan hệ mới | Gán trực tiếp `app.status_obj = status_obj` đồng thời với `app.status_id` trước khi commit | **ĐÃ SỬA** |
| **3** | `PermissionError: [WinError 32]` khi xóa file DB SQLite tạm thời trên Windows | Connection pool của SQLAlchemy chưa đóng triệt để file handle trước khi `tempfile` dọn dẹp | Bổ sung `engine.dispose()` vào phương thức `tearDownClass` trong `test_api.py` | **ĐÃ SỬA** |
| **4** | Lỗi định dạng JSON trả về khi vi phạm ràng buộc cơ sở dữ liệu | FastAPI mặc định có thể ném ngoại lệ SQLAlchemy không kiểm soát | Xây dựng bộ bắt lỗi tập trung `sqlalchemy_integrity_error_handler` trả về mã `409 Conflict` kèm thông báo tiếng Việt | **ĐÃ SỬA** |

---

### 8. Minh chứng Nghiệm thu Sprint 3

- **Họ tên sinh viên thực hiện**: **Nguyễn Tuấn Việt**
- **Mã sinh viên**: **B25DTCN266**
- **Nhiệm vụ bàn giao**:
  - [x] Giữ nguyên toàn bộ cấu trúc dự án, hướng dẫn cài đặt Backend và hướng dẫn chạy Frontend gốc.
  - [x] Bổ sung tài liệu kiểm thử chi tiết và hướng dẫn vận hành toàn diện vào `README.md`.
  - [x] Bộ Postman Collection đầy đủ 27 requests bao phủ 5 luồng nghiệp vụ chính tại `backend/tests/postman_collection.json`.
  - [x] Bộ kiểm thử tự động `backend/tests/test_api.py` vượt qua **100%** (7/7 test suites).
  - [x] Khắc phục toàn bộ các lỗi phát sinh trong quá trình chạy nghiệm thu thực tế.
  - [x] Tài liệu tương tác Swagger UI hoạt động ổn định tại `http://127.0.0.1:8000/docs`.

---
*HourGlass Project © 2026 — Đảm bảo chất lượng phần mềm & Vận hành hệ thống.*
