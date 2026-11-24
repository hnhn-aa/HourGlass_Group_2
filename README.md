# ⏳ HourGlass — Cổng việc làm thêm cho Sinh viên

**HourGlass** kết nối **sinh viên** tìm việc part-time / thực tập với **nhà tuyển dụng**, dưới sự kiểm duyệt của **quản trị viên**. Dự án gồm hai phần tách biệt:

| Phần | Công nghệ | Cổng mặc định |
| :--- | :--- | :--- |
| **Backend** (`backend/`) | FastAPI · SQLAlchemy 2 · Alembic · JWT · SQLite hoặc MySQL | `http://127.0.0.1:8000` |
| **Frontend** (`frontend/`) | HTML5 · CSS3 · JavaScript thuần (không cần build) | `http://127.0.0.1:5500` |

📘 Hướng dẫn sử dụng theo từng vai trò (Sinh viên · Nhà tuyển dụng · Admin): **[USER_GUIDE.md](USER_GUIDE.md)**

### ✨ Tính năng chính

| Nhóm | Nội dung |
| :--- | :--- |
| Sinh viên | Tìm & lọc việc theo ca/khu vực, lưu tin, nộp đơn kèm CV, theo dõi đơn, lịch làm việc & ca rảnh, đánh giá NTD, khiếu nại |
| Nhà tuyển dụng | Đăng tin kèm ảnh banner, quản lý tin, sàng lọc ứng viên dạng **Kanban** (kéo thả) hoặc danh sách, KPI tuyển dụng |
| Admin | Kiểm duyệt tin, quản lý người dùng, xác minh doanh nghiệp, xử lý khiếu nại, thống kê, danh mục, phân quyền quản trị |
| 🆕 **Trợ lý AI HourGlass** | Nút **Chat ngay** ở thanh bên cả 3 dashboard, gợi ý câu hỏi theo vai trò. Gọi `POST /api/ai/chat` (Gemini / OpenAI qua `AI_API_KEY`); **không có key vẫn trả lời** bằng kịch bản có sẵn |
| 🆕 **Kỹ năng & kinh nghiệm SV** | Thêm kỹ năng bằng nút/Enter, chặn trùng, chip gợi ý, **lưu vào CSDL**; kinh nghiệm nhập theo lưới 2 hàng, thêm/xóa mượt |
| 🆕 **Tìm kiếm nhanh** | Ô tìm kiếm trên topbar dashboard: SV tìm việc/công ty, NTD tìm ứng viên/vị trí, Admin tìm người dùng/email/tin. Chọn kết quả → chuyển đúng tab |
| 🆕 **Thông báo** | Chuông 🔔 theo từng vai trò, phân biệt đã đọc/chưa đọc, **Đánh dấu tất cả đã đọc**, nhớ trạng thái trên trình duyệt |
| 🆕 Giao diện | Avatar tự tạo chữ viết tắt khi thiếu ảnh, ảnh tin 16:9 có ảnh dự phòng, menu bên dạng ngăn kéo dưới 992px, bảng cuộn ngang trên màn hình nhỏ |

---

## 📑 Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Chạy nhanh trong 5 phút (SQLite)](#2-chạy-nhanh-trong-5-phút-sqlite)
3. [Cài đặt Backend chi tiết](#3-cài-đặt-backend-chi-tiết)
4. [Chạy Frontend (cổng 5500)](#4-chạy-frontend-cổng-5500)
5. [Tài khoản test mặc định](#5-tài-khoản-test-mặc-định)
6. [Cấu hình địa chỉ Backend cho Frontend](#6-cấu-hình-địa-chỉ-backend-cho-frontend)
7. [Deploy Frontend lên Vercel](#7-deploy-frontend-lên-vercel)
8. [Kiểm thử tự động](#8-kiểm-thử-tự-động)
9. [Xử lý sự cố thường gặp](#9-xử-lý-sự-cố-thường-gặp)
10. [Cấu trúc thư mục](#10-cấu-trúc-thư-mục)

---

## 1. Yêu cầu hệ thống

- **Python 3.10 trở lên** (`python --version`)
- **pip** và **Git**
- Một trong hai cách chạy Frontend: **VS Code + extension Live Server**, hoặc **Python** (`http.server` có sẵn)
- *(Tùy chọn)* **MySQL 8** nếu không muốn dùng SQLite

---

## 2. Chạy nhanh trong 5 phút (SQLite)

Mở **2 cửa sổ terminal** tại thư mục gốc dự án.

**Terminal 1 – Backend:**

```bash
cd backend
python -m venv venv
# Windows (PowerShell):  .\venv\Scripts\Activate.ps1
# macOS / Linux:         source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head              # tạo 17 bảng (không có file .env -> tự dùng SQLite backend/hourglass.db)
python seed_data.py               # nạp dữ liệu mẫu + tài khoản test
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 – Frontend:**

```bash
cd frontend
python -m http.server 5500
```

Mở trình duyệt: **<http://127.0.0.1:5500/index.html>** → đăng nhập bằng `student1@gmail.com` / `123456`.

> 💡 Không cần tạo `.env` cho cách chạy nhanh: khi thiếu `DATABASE_URL`, Backend tự dùng SQLite tại `backend/hourglass.db`. Chỉ tạo `.env` khi cần MySQL hoặc khi deploy (mục 3 – Bước 2).

---

## 3. Cài đặt Backend chi tiết

Mọi lệnh trong mục này chạy **bên trong thư mục `backend/`**.

### Bước 1 – Môi trường ảo & thư viện (`requirements.txt`)

```bash
cd backend
python -m venv venv
```

Kích hoạt môi trường ảo:

| Hệ điều hành | Lệnh |
| :--- | :--- |
| Windows PowerShell | `.\venv\Scripts\Activate.ps1` *(nếu bị chặn: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`)* |
| Windows CMD | `venv\Scripts\activate.bat` |
| macOS / Linux | `source venv/bin/activate` |

Cài thư viện:

```bash
pip install -r requirements.txt
```

Các thư viện chính: `fastapi`, `uvicorn`, `SQLAlchemy`, `alembic`, `pydantic`, `PyJWT`, `bcrypt`, `python-multipart` (upload file), `PyMySQL` (MySQL), `slowapi`, `httpx` + `pytest` (kiểm thử).

### Bước 2 – Biến môi trường (`backend/.env`)

```bash
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

> File mẫu `.env.example` mặc định dùng **SQLite** (`sqlite:///./hourglass.db`), chạy được ngay. Muốn dùng MySQL thì bỏ comment dòng MySQL và điền mật khẩu của bạn.
>
> ⚠️ **Không commit / không gửi file `.env`** (đã có trong `.gitignore`). Chỉ chia sẻ `.env.example`; khóa thật (`SECRET_KEY`, `AI_API_KEY`) chỉ nằm trong `.env` trên máy mỗi người.

| Biến | Ý nghĩa | Ví dụ |
| :--- | :--- | :--- |
| `DATABASE_URL` | Chuỗi kết nối CSDL | `sqlite:///./hourglass.db` hoặc `mysql+pymysql://root:matkhau@127.0.0.1:3306/project_fastapi` |
| `SECRET_KEY` | Khóa ký JWT – **bắt buộc đổi khi deploy** | chuỗi ngẫu nhiên ≥ 32 ký tự |
| `CORS_ORIGINS` | *(tùy chọn)* Tên miền Frontend được gọi API, phân tách bằng dấu phẩy. Bỏ trống = cho phép tất cả. `localhost` / `127.0.0.1` ở mọi cổng luôn được phép | `https://hourglass.vercel.app` |
| `CORS_ORIGIN_REGEX` | *(tùy chọn)* Biểu thức cho các bản Preview của Vercel | `https://hourglass-.*\.vercel\.app` |
| `AI_API_KEY` | *(tùy chọn)* Khóa Gemini (`AIza...`) hoặc OpenAI cho Trợ lý AI. Để trống = trả lời theo kịch bản | lấy tại Google AI Studio |
| `AI_PROVIDER` · `AI_MODEL` · `AI_BASE_URL` | *(tùy chọn)* Chọn nhà cung cấp/model; `AI_BASE_URL` cho dịch vụ tương thích OpenAI (Groq, OpenRouter…) | `auto` · `gemini-2.5-flash` |

**Dùng SQLite (khuyên dùng khi học/demo):** không cần cài gì thêm. File CSDL luôn nằm tại `backend/hourglass.db`, dù bạn chạy lệnh từ thư mục nào.

**Dùng MySQL:** tạo database trước rồi mới chạy migration:

```sql
CREATE DATABASE project_fastapi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> Tạo khóa bí mật nhanh: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### Bước 3 – Chạy migration (`alembic upgrade head`)

```bash
alembic upgrade head
```

Lệnh này tạo đủ **17 bảng** (users, student/employer/admin_profiles, jobs, applications, cvs, reviews, reports, schedules…), cột `image_url` cho tin tuyển dụng và cột `skills` cho hồ sơ sinh viên. Kiểm tra phiên bản hiện tại bằng `alembic current` (kết quả mong đợi: `c3f7a91d2e45 (head)`).

> 📦 Gói dự án gửi kèm `backend/hourglass.db` đã có dữ liệu mẫu và đã ở phiên bản head, nên `alembic upgrade head` không làm gì thêm, có thể bỏ qua cả bước 3 và 4.

> ⚠️ **Đã lỡ chạy server trước khi migrate?** Server tự tạo bảng khi khởi động, nên `alembic upgrade head` sẽ báo *"table already exists"*. Khi đó chỉ cần đánh dấu CSDL đã ở phiên bản mới nhất: `alembic stamp head`.

### Bước 4 – Khởi tạo dữ liệu mẫu (`python seed_data.py`)

```bash
python seed_data.py
```

Script nạp dữ liệu cho toàn bộ 17 bảng: 6 tài khoản (mục 5), 5 danh mục ngành nghề, địa điểm Hà Nội, tin tuyển dụng, đơn ứng tuyển, lịch làm việc, đánh giá, khiếu nại… và tạo các file CV PDF mẫu trong `backend/uploads/`.

> ⚠️ **`seed_data.py` luôn XÓA SẠCH dữ liệu cũ** rồi nạp lại từ đầu (cờ `--reset` luôn bật). Không chạy lệnh này trên CSDL đang có dữ liệu thật.
>
> Nếu bỏ qua bước này, server cũng **tự nạp dữ liệu mẫu** ở lần khởi động đầu tiên khi bảng `users` còn trống.

### Bước 5 – Chạy Backend FastAPI (cổng 8000)

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

| Địa chỉ | Nội dung |
| :--- | :--- |
| <http://127.0.0.1:8000/docs> | Swagger UI – tài liệu & thử API trực tiếp |
| <http://127.0.0.1:8000/redoc> | ReDoc |
| <http://127.0.0.1:8000/health> | Kiểm tra kết nối CSDL (`"status": "ok"`) |
| `http://127.0.0.1:8000/uploads/...` | File CV và ảnh tin tuyển dụng đã tải lên |

> 📱 **Thử trên điện thoại cùng mạng Wi-Fi:** chạy `uvicorn app.main:app --host 0.0.0.0 --port 8000` và `python -m http.server 5500 --bind 0.0.0.0`, rồi mở `http://<IP-máy-tính>:5500/index.html` trên điện thoại. Frontend tự gọi `http://<IP-máy-tính>:8000`.

---

## 4. Chạy Frontend (cổng 5500)

Frontend là web tĩnh, **không cần cài đặt hay build**. **Luôn bật Backend trước**, nếu không, các thao tác lưu dữ liệu sẽ báo lỗi *"Không kết nối được máy chủ API"*.

### Cách 1 – VS Code Live Server (khuyên dùng)

1. Cài extension **Live Server** (Ritwick Dey) trong VS Code.
2. Mở thư mục dự án, nhấp chuột phải vào `frontend/index.html` → **Open with Live Server**.
3. Trình duyệt mở tại `http://127.0.0.1:5500/frontend/index.html` (hoặc `http://127.0.0.1:5500/index.html` nếu bạn mở VS Code ngay tại thư mục `frontend/`).

### Cách 2 – Python `http.server`

```bash
cd frontend
python -m http.server 5500
```

Truy cập <http://127.0.0.1:5500/index.html>.

> Không mở file HTML trực tiếp bằng cách nhấp đúp (`file:///...`): một số trình duyệt chặn gọi API từ trang `file://`, và Chrome đôi khi chưa kịp ghi phiên đăng nhập khi chuyển trang nên có thể bị đưa ngược về trang đăng nhập. Chạy qua Live Server / `http.server` như trên thì không gặp lỗi này.

### Các trang chính

| Trang | Đường dẫn |
| :--- | :--- |
| Trang chủ | `index.html` |
| Đăng nhập / Đăng ký | `auth.html?mode=signin` · `auth.html?mode=signup` |
| Tìm việc · Chi tiết việc | `jobs.html` · `job-detail.html?id=<id>` |
| Danh mục · Giới thiệu | `categories.html` · `about.html` |
| Dashboard Sinh viên | `student.html` |
| Dashboard Nhà tuyển dụng | `employer.html` |
| Bảng điều khiển Admin | `admin.html` |

---

## 5. Tài khoản test mặc định

Sau khi chạy `python seed_data.py` – **mật khẩu chung: `123456`**

| Vai trò | Email | Họ tên | Ghi chú |
| :--- | :--- | :--- | :--- |
| 🎓 **Sinh viên** | `student1@gmail.com` | Nguyễn Văn An | Đại học Công nghệ – đã có CV & đơn ứng tuyển |
| 🎓 Sinh viên | `student2@gmail.com` | Trần Thị Bình | Đại học Kinh tế Quốc dân |
| 🎓 Sinh viên | `student3@gmail.com` | Lê Minh Đức | Học viện Công nghệ Bưu chính Viễn thông |
| 🏢 **Nhà tuyển dụng** | `employer1@gmail.com` | Phạm Quốc Huy | **Highlands Coffee** – đã có tin & ứng viên |
| 🏢 Nhà tuyển dụng | `employer2@gmail.com` | Hoàng Thu Trang | **FPT Shop** |
| 🛡️ **Quản trị viên** | `admin@gmail.com` | Nguyễn Hoàng Nam | **Admin gốc** – được cấp/thu hồi quyền quản trị cho tài khoản khác |

Khi đăng nhập, chọn đúng loại tài khoản (Ứng viên / Nhà tuyển dụng) trên form. Tài khoản Admin đăng nhập ở form nào cũng được.

---

## 6. Cấu hình địa chỉ Backend cho Frontend

Mọi trang đều nạp **`frontend/js/config.js`** đầu tiên. File này tự chọn địa chỉ Backend theo tên miền đang mở trang:

| Trang đang mở tại | Backend được dùng |
| :--- | :--- |
| `localhost`, `127.0.0.1`, `[::1]`, mở file trực tiếp (`file://`) | **`http://127.0.0.1:8000`** |
| IP mạng LAN (`192.168.x.x`…) | `http://<cùng IP>:8000` (chạy uvicorn với `--host 0.0.0.0`) |
| Tên miền khác (vd. `hourglass.vercel.app`) | Hằng số **`PRODUCTION_API_BASE`** trong `config.js` |

**Khi deploy, chỉ cần sửa một dòng** trong `frontend/js/config.js`:

```js
var PRODUCTION_API_BASE = 'https://hourglass-api.onrender.com';   // URL Backend thật (HTTPS, không có "/" cuối)
```

- Dùng `'/'` nếu Backend và Frontend chạy **cùng tên miền** (Backend phục vụ luôn Frontend, hoặc có proxy `rewrites` trên Vercel).
- Nếu quên sửa (vẫn là URL mẫu `hourglass-api.example.com`), Frontend **không gọi API** mà dùng dữ liệu đồng bộ gần nhất / dữ liệu mẫu, kèm cảnh báo trong Console – trang vẫn chạy, không văng lỗi.

**Khi Backend tắt, treo hoặc lỗi:** mọi request có giới hạn thời gian (15 giây; tải file 60 giây; `/api/bootstrap` 60 giây để chờ Backend "thức dậy" trên host miễn phí). Frontend hiển thị dữ liệu đồng bộ gần nhất (hoặc dữ liệu mẫu nếu chưa từng kết nối) và báo một lần: *"Chưa kết nối được máy chủ…"*. Biến `HG.dataSource` (`'api'` · `'cache'` · `'mock'`) cho biết dữ liệu đang hiển thị lấy từ đâu.

**Đổi Backend tạm thời không cần sửa code** (tiện khi test bản Preview):

| Cách | Ví dụ |
| :--- | :--- |
| Thêm `?api=` vào URL (được ghi nhớ trong trình duyệt) | `https://hourglass.vercel.app/index.html?api=https://staging-api.example.com` |
| Quay về mặc định | `...?api=reset` |
| Console trình duyệt | `HG_CONFIG.setApiBase('https://...')` · `HG_CONFIG.resetApiBase()` · xem hiện tại: `HG_CONFIG.apiBase` |

File CV và ảnh tin tuyển dụng được lưu trong DB dưới dạng đường dẫn tương đối `/uploads/...`, rồi tự ghép với địa chỉ Backend hiện tại. Vì vậy đổi Backend không làm hỏng ảnh hay CV.

---

## 7. Deploy Frontend lên Vercel

Thư mục `frontend/` đã có sẵn **`vercel.json`**:

- Web tĩnh, **không có bước build** (`"framework": null`).
- **Giữ nguyên đuôi `.html`** (`"cleanUrls": false`), vì code điều hướng của dự án nhận diện trang theo tên file `.html`.
- Có sẵn đường dẫn ngắn: `/login`, `/register`, `/jobs`, `/jobs/<id>`, `/student`, `/employer`, `/admin`.
- Header bảo mật cơ bản; `js/config.js` không bị cache, nên đổi Backend có hiệu lực ngay.

### Các bước

1. **Deploy Backend trước** lên một dịch vụ hỗ trợ Python và **HTTPS** (Render, Railway, Fly.io, VPS…), với lệnh chạy:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
   Đặt các biến môi trường `DATABASE_URL`, `SECRET_KEY` (mới, ngẫu nhiên) và `CORS_ORIGINS=https://<tên-dự-án>.vercel.app`.
2. Sửa `PRODUCTION_API_BASE` trong `frontend/js/config.js` thành URL HTTPS của Backend, rồi commit và push.
3. Trên <https://vercel.com> → **Add New… → Project** → import repository.
4. Trong màn hình cấu hình:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Other`
   - **Build Command / Output Directory:** để trống
5. Bấm **Deploy**, rồi mở `https://<tên-dự-án>.vercel.app/index.html` và đăng nhập thử.

Hoặc dùng Vercel CLI:

```bash
npm i -g vercel
cd frontend
vercel          # bản Preview
vercel --prod   # bản Production
```

> ⚠️ **Lưu ý khi deploy**
> - Trang Vercel chạy **HTTPS**, nên Backend **bắt buộc là HTTPS**; trình duyệt chặn gọi `http://` từ trang `https://` (mixed content).
> - Thư mục `backend/uploads/` cần **ổ đĩa lưu trữ bền vững** (persistent disk/volume) trên dịch vụ deploy Backend. Nếu không, CV và ảnh đã tải lên sẽ mất sau mỗi lần khởi động lại.
> - SQLite chỉ phù hợp demo; khi deploy thật nên dùng MySQL hoặc CSDL được quản lý.

---

## 8. Kiểm thử tự động

Các bài test dùng CSDL SQLite tạm, **không cần bật server** và **không đụng tới `hourglass.db`**:

```bash
cd backend
python -m pytest tests -v                  # toàn bộ test + bảng báo cáo hồi quy ở cuối
python tests/test_regression_roles.py      # chỉ kịch bản hồi quy 3 vai trò
python tests/test_api.py                   # kiểm thử từng nhóm API
python -m pytest tests/test_ai_chat.py tests/test_student_skills.py -v   # Trợ lý AI & kỹ năng sinh viên
python -m pytest tests/test_schedules.py -v   # Lịch làm việc: thêm/sửa/xóa ca, chặn trùng giờ (409), quyền sở hữu
```

Kịch bản hồi quy `test_regression_roles.py` gồm 19 bước có mã, in `[PASS]/[FAIL]/[SKIP]` cho từng bước:

- **NTD-01…05** – Nhà tuyển dụng: đăng nhập → upload ảnh → tạo tin kèm ảnh → xem danh sách ứng viên & KPI.
- **AD-01…04** – Admin: đăng nhập → duyệt tin → xử lý khiếu nại (gỡ tin) → đối chiếu 10 chỉ số thống kê Dashboard.
- **SV-01…07** – Sinh viên: đăng nhập → tìm kiếm & lọc → nộp đơn kèm CV PDF → cập nhật hồ sơ → gửi đánh giá → gửi khiếu nại.
- **PQ-01…03** – Phân quyền: chặn tự duyệt tin, chặn thao tác thay người khác, chặn tự xác minh doanh nghiệp.

Bước phụ thuộc vào một bước bị lỗi sẽ được SKIP kèm lý do. Lệnh trả mã thoát khác 0 khi có lỗi, nên dùng được cho CI.

**Postman:** import `backend/tests/postman_collection.json`, đặt biến `baseUrl = http://127.0.0.1:8000`.

---

## 9. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
| :--- | :--- |
| Thông báo *"Không kết nối được máy chủ API (http://127.0.0.1:8000)"* | Backend chưa chạy, hoặc chạy sai cổng. Kiểm tra <http://127.0.0.1:8000/health>. |
| `alembic upgrade head` báo *table already exists* | Server đã tự tạo bảng trước đó → chạy `alembic stamp head`. |
| `ModuleNotFoundError: No module named 'app'` | Chạy `alembic` / `uvicorn` / `seed_data.py` **bên trong thư mục `backend/`** và đã kích hoạt `venv`. |
| Lỗi kết nối MySQL (`Can't connect` / `Unknown database`) | Bật MySQL Server, tạo database (mục 3 – Bước 2), kiểm tra user/mật khẩu trong `DATABASE_URL`. |
| Đăng nhập được nhưng lưu dữ liệu báo *"Phiên đăng nhập đã hết hạn"* | Token cũ không còn hợp lệ (đổi `SECRET_KEY` hoặc chạy lại seed) → đăng xuất rồi đăng nhập lại. |
| Lỗi CORS trên Console khi deploy | Thêm đúng tên miền Vercel vào `CORS_ORIGINS` của Backend (không có `/` cuối), rồi khởi động lại Backend. |
| Frontend trên Vercel vẫn gọi Backend cũ | Trình duyệt đang ghi nhớ địa chỉ từ `?api=` → mở `.../index.html?api=reset`. |
| Muốn làm lại dữ liệu demo từ đầu | Tắt server → `python seed_data.py` → bật lại server. |
| Trợ lý AI chỉ trả lời theo kịch bản | Chưa đặt `AI_API_KEY` trong `backend/.env` (hoặc key hết hạn mức). Đặt key rồi khởi động lại Backend; xem trạng thái tại <http://127.0.0.1:8000/api/ai/status>. |
| Dọn dữ liệu test/nháp khỏi DB demo | `python scripts/clean_demo_data.py` (xem trước) → thêm `--apply` để xóa thật; tự sao lưu vào `backend/backups/`. |

---

## 10. Cấu trúc thư mục

```text
HourGlass_Final_Project/
├── README.md                      # Tài liệu cài đặt, chạy & deploy (file này)
├── USER_GUIDE.md                  # Hướng dẫn sử dụng theo vai trò
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── paths.py           # Đường dẫn lưu trữ duy nhất: hourglass.db, uploads/, static/
│   │   │   ├── security.py        # Mã hóa mật khẩu (bcrypt) + JWT access/refresh token
│   │   │   └── skills.py          # Chuẩn hóa danh sách kỹ năng (JSON ⇄ list)
│   │   ├── db/database.py         # SQLAlchemy engine, SessionLocal, get_db(), init_db()
│   │   ├── dependencies/middleware.py  # Xác thực JWT & phân quyền (Student / Employer / Admin)
│   │   ├── models/                # 17 bảng ORM
│   │   ├── schemas/               # Pydantic v2 (validate & serialize)
│   │   ├── services/              # Logic nghiệp vụ (ai_services.py: Trợ lý AI + chế độ dự phòng)
│   │   ├── routers/               # RESTful endpoints (/api/...), ai_chat.py: POST /api/ai/chat
│   │   └── main.py                # Khởi tạo FastAPI, CORS, /uploads, xử lý lỗi, /api/bootstrap
│   ├── migrations/versions/       # 761599e23f17 (17 bảng) → a8c4e12f9b03 (image_url) → c3f7a91d2e45 (skills)
│   ├── scripts/clean_demo_data.py # Dọn dữ liệu test/nháp khỏi DB demo (có sao lưu)
│   ├── tests/                     # test_api · test_e2e_flow · test_regression_roles · test_ai_chat · test_student_skills · test_schedules · Postman
│   ├── uploads/                   # CV (cv_*.pdf) & ảnh tin (jobs/*) do người dùng tải lên
│   ├── .env.example               # Mẫu biến môi trường
│   ├── alembic.ini
│   ├── requirements.txt
│   └── seed_data.py               # Nạp dữ liệu mẫu (xóa dữ liệu cũ!)
└── frontend/
    ├── vercel.json                # Cấu hình deploy Vercel
    ├── *.html                     # index, auth, jobs, job-detail, categories, about, student, employer, admin
    ├── css/                       # base, layout, components, từng trang + responsive.css (mobile/tablet)
    ├── assets/                    # favicon, hình ảnh
    └── js/
        ├── config.js              # ★ Chọn địa chỉ Backend theo môi trường (local / production)
        ├── api.js                 # Gọi REST API: JWT, tự làm mới token, xử lý lỗi tập trung
        ├── adapter.js             # Đồng bộ dữ liệu Backend ↔ giao diện, hồ sơ / đánh giá / khiếu nại
        ├── main.js · common.js    # Phiên đăng nhập, thẻ việc làm, toast, header, hamburger menu
        ├── dashboard.js           # Logic 3 dashboard (Sinh viên / NTD / Admin)
        ├── saved-jobs.js          # Việc đã lưu & Đã xem gần đây (localStorage)
        ├── reviews-reports.js     # Giao diện đánh giá uy tín & khiếu nại
        ├── responsive.js          # Bảng dạng thẻ trên mobile
        ├── notify.js              # Chuông thông báo theo vai trò (đã đọc / chưa đọc)
        ├── ai-assistant.js        # Khung chat Trợ lý AI HourGlass (+ css/ai-assistant.css)
        ├── profile-extra.js       # Kinh nghiệm làm việc của sinh viên
        └── …                      # auth, jobs, detail, home, schedule, modal, validators…
```
