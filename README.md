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

## 🧪 Kiểm thử API (Automated Tests & Postman)

1. **Chạy bộ kiểm thử tự động (`unittest`)**:
   ```bash
   cd backend
   python tests/test_api.py
   ```
2. **Kiểm thử với Postman**:
   - Import file `backend/tests/postman_collection.json` vào ứng dụng Postman.
   - Đảm bảo biến môi trường `baseUrl` trong Collection đang trỏ tới `http://127.0.0.1:8000`.
