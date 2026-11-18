# HourGlass – HTML/CSS/JS thuần

```
index.html        Trang chủ
auth.html         Đăng nhập / Đăng ký (chọn vai trò Ứng viên-Sinh viên hoặc Nhà tuyển dụng)
jobs.html         Tìm việc (lọc theo từ khóa / remote)
job-detail.html   Chi tiết việc làm
student.html      Dashboard sinh viên
employer.html     Dashboard nhà tuyển dụng (có form đăng tin)
admin.html        Dashboard admin (duyệt tin)
css/              base, layout, components + 1 file riêng cho mỗi nhóm trang
js/mock-data.js   DỮ LIỆU MẪU (users, jobs, applications...) - sửa/thêm dữ liệu test ở đây
js/adapter.js     ghép mock-data thành dữ liệu hiển thị
js/               icons, main (đăng nhập, đăng ký, lưu việc...), 1 file riêng cho mỗi trang
js/layout.js       Tự chèn Header + Footer vào trang công khai (<div id="site-header"> / <div id="site-footer">)
js/common.js       Helper dùng chung: HG.formatVND, HG.formatSalaryRange, HG.parseSalary, HG.toast, HG.flash, HG.store (đọc/ghi localStorage), HG.changePassword
js/modal.js       Component modal dùng chung: HG.modal.open(), HG.confirm() (popup xác nhận đăng xuất), modal ứng tuyển
js/validators.js  Quy tắc kiểm tra form (khai báo bằng data-rules trong HTML)
js/auth.js        Logic trang auth.html
assets/           favicon
```

- Việc làm đã lưu được giữ giữa các trang bằng `localStorage`.
- Font Inter tải từ Google Fonts (cần internet, nếu không sẽ dùng font hệ thống). Thang cỡ chữ / độ đậm / line-height / khoảng cách là biến `--fs-*`, `--fw-*`, `--lh-*`, `--space-*` trong `css/base.css`.

## Test nhanh
Tài khoản (mật khẩu chung `123456`): `student1@gmail.com`, `employer1@gmail.com`, `admin@gmail.com`.
Đăng nhập xong tự chuyển tới dashboard đúng vai trò. Dữ liệu tạo khi test (đơn ứng tuyển, tin đăng, duyệt tin, việc đã lưu)
lưu trong `localStorage`; xóa dữ liệu trình duyệt của trang để reset.

## Đăng ký / Đăng nhập
Tài khoản đăng ký mới lưu trong `localStorage` (khoá `hg_new_accounts`), demo nên mật khẩu chưa mã hoá. Đăng nhập kiểm tra đúng vai trò đã chọn. `auth.html?mode=signup&role=employer` mở thẳng form tương ứng.

## Toast & thông báo
`HG.toast('Nội dung', 'success' | 'error' | 'info')` hiện thông báo nổi (tối đa 3 cái cùng lúc). `HG.flash(...)` đặt toast hiện ở trang kế tiếp (dùng khi đăng nhập / đăng xuất).

## Đăng tin tuyển dụng (employer.html → Đăng tin)
Validate từng ô (khi rời ô / khi gửi), xem trước trực tiếp bên phải, upload ảnh banner (kéo thả hoặc chọn, PNG/JPG/WEBP/GIF ≤ 3MB, tự nén ≤ 960px trước khi lưu). Mức lương nhập tự do: `30–40K/giờ`, `4–5 triệu/tháng`, `Thỏa thuận`.

## Module mới (đợt 2)
- `js/notify.js` – chuông thông báo thật (header + dashboard): lưu `hg_notifs`, đồng bộ giữa các tab bằng sự kiện `storage`, quét định kỳ 6 giây.
- `js/schedule.js` – Sinh viên: lịch làm việc Tháng / Tuần / Danh sách, xem lùi 1–3 tháng, Date Range Picker, 4 trạng thái ca, hủy ca, lịch sử lịch rảnh. Dữ liệu cũ hơn 3 tháng tự bị dọn.
- `js/profile-extra.js` – Sinh viên: mục Kinh nghiệm làm việc.
- `js/admin-extra.js` – Admin: CRUD danh mục ngành nghề, phân quyền quản trị (chỉ Admin gốc, id 6, được cấp/thu hồi).
- `HG.setAppStatus / HG.updateJob / HG.deleteJob / HG.setJobStatus(id, status, reason) / HG.setUserStatus / HG.setRole` – mọi thay đổi đều lưu bền trong localStorage.
- `HG.busy(btn, fn)` – nút có spinner; `HG.empty(...)` – empty state; `HG.askReason(...)` – popup nhập lý do; `HG.attachSuggest(input)` – gợi ý tìm kiếm.
- Tài khoản demo: student1..3@gmail.com, employer1..2@gmail.com, admin@gmail.com (Admin gốc) – mật khẩu 123456.

## Module mới (đợt 3)
- `js/social.js` – nghiệp vụ: khiếu nại (HG.fileReport/resolveReport), đánh giá (HG.addReview), danh sách đen (HG.blacklistAdd, HG.globalBlock), yêu cầu nghỉ ca/đổi ca/nghỉ việc/chuyển vị trí (HG.addRequest/resolveRequest), hộp thư hỗ trợ, bản tin, nhật ký (HG.audit).
- `js/portal-common.js` – form khiếu nại / đánh giá, khối uy tín & nút "Báo cáo tin" ở trang chi tiết.
- `js/portal-student.js`, `js/portal-employer.js`, `js/portal-admin.js` – giao diện từng vai trò cho các luồng trên.
- `js/portal-extras.js` – tìm kiếm nhanh thật (phím /), tùy chọn thông báo có tác dụng, % hoàn thiện hồ sơ, nhắc ca/báo cáo tuần.
- `js/public-extras.js` – số liệu thật trang chủ, form liên hệ, đăng ký bản tin, nút Liên hệ hỗ trợ.
- Phân quyền Admin: Admin gốc (id 6) toàn quyền; QTV được cấp chọn từng nhóm quyền (HG.PERMS, HG.can). Tab không đủ quyền tự ẩn.
