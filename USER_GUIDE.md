# 📘 Hướng dẫn sử dụng HourGlass

Tài liệu này hướng dẫn **từng luồng nghiệp vụ** cho 3 vai trò trên HourGlass. Cách cài đặt và chạy hệ thống xem tại [README.md](README.md).

| Vai trò | Dùng để | Trang làm việc |
| :--- | :--- | :--- |
| 🎓 **Sinh viên** | Tìm việc, lưu tin, nộp CV, theo dõi đơn, quản lý lịch làm việc | `student.html` |
| 🏢 **Nhà tuyển dụng** | Đăng tin, quản lý tin, sàng lọc ứng viên | `employer.html` |
| 🛡️ **Quản trị viên (Admin)** | Kiểm duyệt tin, quản lý người dùng, xử lý khiếu nại, thống kê | `admin.html` |

**Tài khoản dùng thử** (mật khẩu `123456`): `student1@gmail.com` · `employer1@gmail.com` · `admin@gmail.com`

> 🆕 **Mới cập nhật:** Trợ lý AI HourGlass ([A7](#a7-trợ-lý-ai-hourglass)) · Tìm kiếm nhanh trong dashboard ([A6](#a6-tìm-kiếm-nhanh-trong-dashboard)) · Thông báo theo vai trò ([A4](#a4-thông-báo)) · Kỹ năng & kinh nghiệm sinh viên ([B2](#b2-hoàn-thiện-hồ-sơ-cá-nhân))

---

## Mục lục

- [Phần A – Dùng chung cho mọi người](#phần-a--dùng-chung-cho-mọi-người)
- [Phần B – Sinh viên](#phần-b--sinh-viên)
- [Phần C – Nhà tuyển dụng](#phần-c--nhà-tuyển-dụng)
- [Phần D – Quản trị viên (Admin)](#phần-d--quản-trị-viên-admin)
- [Phần E – Vòng đời tin tuyển dụng & đơn ứng tuyển](#phần-e--vòng-đời-tin-tuyển-dụng--đơn-ứng-tuyển)
- [Phần F – Câu hỏi thường gặp](#phần-f--câu-hỏi-thường-gặp)

---

## Bức tranh toàn cảnh

```text
 NHÀ TUYỂN DỤNG              QUẢN TRỊ VIÊN                    SINH VIÊN
 ──────────────              ─────────────                    ─────────
 Đăng tin ─────────────▶ Kiểm duyệt tin ──(Phê duyệt)──▶ Tin hiển thị công khai
                              │ (Từ chối + lý do)                   │
 Sửa & gửi duyệt lại ◀────────┘                     Tìm kiếm · Lưu tin · Xem chi tiết
                                                                    │
 Quản lý ứng viên ◀───────────────────────────────── Nộp đơn kèm CV
   Duyệt → Phỏng vấn → Nhận / Từ chối ──────────────▶ Theo dõi đơn · Lịch làm việc
                                                                    │
 Đánh giá ứng viên ◀──────── (sau khi trúng tuyển) ──────▶ Đánh giá nhà tuyển dụng
                              Xử lý khiếu nại ◀──────────── Gửi khiếu nại
```

---

## Phần A – Dùng chung cho mọi người

### A1. Đăng ký tài khoản

1. Bấm **Đăng ký** trên thanh điều hướng (hoặc mở `auth.html?mode=signup`).
2. Chọn loại tài khoản: **Ứng viên / Sinh viên** hoặc **Nhà tuyển dụng**.
3. Điền thông tin:
   - **Sinh viên:** Họ và tên, Trường đang theo học *(không bắt buộc)*, Email, Số điện thoại.
   - **Nhà tuyển dụng:** Họ và tên người đại diện, Tên công ty / doanh nghiệp, Email, Số điện thoại.
4. Đặt **mật khẩu tối thiểu 8 ký tự, có cả chữ và số**, nhập lại cho khớp, rồi đánh dấu đồng ý điều khoản.
5. Bấm **Tạo tài khoản**. Hệ thống đăng nhập và chuyển thẳng tới trang làm việc của bạn.

> Không thể tự đăng ký tài khoản Admin. Quyền quản trị do **Admin gốc** cấp (xem [D7](#d7-phân-quyền-quản-trị-chỉ-admin-gốc)).

### A2. Đăng nhập / Đăng xuất

1. Bấm **Đăng nhập**, chọn đúng loại tài khoản (Ứng viên hoặc Nhà tuyển dụng), nhập email và mật khẩu.
2. Tài khoản Admin đăng nhập ở form nào cũng được.
3. Để đăng xuất: bấm nút **Đăng xuất** ở góc phải header, rồi xác nhận.

> 🔒 Nếu thấy thông báo *"Phiên đăng nhập đã hết hạn"*, hãy đăng nhập lại, bạn sẽ được đưa về đúng trang đang làm.
> Tài khoản bị Admin khóa sẽ không đăng nhập được.
> Hiện chưa có chức năng *Quên mật khẩu* trên giao diện; hãy liên hệ Admin để được hỗ trợ.

### A3. Tìm kiếm việc làm (không cần đăng nhập)

1. **Trang chủ:** nhập từ khóa (vd. *barista*, *gia sư*) và khu vực, rồi bấm **Tìm việc ngay**.
2. **Trang Tìm việc (`jobs.html`)**:
   - Ô tìm kiếm theo tên công việc, kỹ năng hoặc công ty.
   - **Bộ lọc**: Danh mục, Khu vực, Ca làm việc (sáng / chiều / tối / linh hoạt), Hình thức (Part-time / Toàn thời gian / Thực tập), Làm việc từ xa. Trên điện thoại, bấm nút **Bộ lọc** để mở bảng lọc.
   - **Tab nhanh theo ca:** Tất cả ca · Ca sáng · Ca chiều · Ca tối.
   - **Sắp xếp:** Mới nhất · Lương cao nhất · Sắp hết hạn · Theo tên A–Z.
3. Bấm vào thẻ việc làm để xem **chi tiết**: mô tả, yêu cầu, quyền lợi, mức lương, hạn ứng tuyển, thông tin doanh nghiệp và **điểm uy tín** của nhà tuyển dụng.

Chỉ những tin **đã được Admin duyệt** và **còn hạn** mới hiển thị công khai.

### A4. Thông báo

Biểu tượng 🔔 trên header hiện số thông báo chưa đọc, nội dung khác nhau theo vai trò:

- **Sinh viên:** đơn được tiếp nhận, lời mời phỏng vấn (kèm giờ), trúng tuyển, bị từ chối (kèm lý do).
- **Nhà tuyển dụng:** hồ sơ ứng tuyển mới, tin được duyệt hoặc bị từ chối (kèm lý do).
- **Admin:** tin tuyển dụng chờ kiểm duyệt, khiếu nại chờ xử lý.

Ngoài ra còn các thông báo phát sinh khi thao tác (đánh giá mới, kết quả xử lý khiếu nại…).

Thông báo **chưa đọc** có nền sáng và chấm xanh. Bấm vào một thông báo để tới đúng trang liên quan (thông báo chuyển sang đã đọc), hoặc bấm **Đánh dấu tất cả đã đọc**. Trạng thái đã đọc được nhớ trên trình duyệt đang dùng.

### A5. Dùng trên điện thoại

- Menu trang công khai nằm trong nút **☰** (góc phải).
- Trong dashboard: nút **☰** (góc trái) mở thanh menu bên; biểu tượng **🔍** mở ô tìm kiếm nhanh.
- Các bảng quản lý tự chuyển thành dạng thẻ dễ đọc trên màn hình nhỏ.

### A6. Tìm kiếm nhanh trong dashboard

Gõ vào ô tìm kiếm trên thanh đầu trang của dashboard, danh sách gợi ý hiện ngay bên dưới:

| Vai trò | Tìm được |
| :--- | :--- |
| Sinh viên | Việc làm, công ty, các mục menu |
| Nhà tuyển dụng | Ứng viên, vị trí tuyển dụng, các mục menu |
| Admin | Người dùng (tên, email), tin tuyển dụng, các mục menu |

Dùng **↑ / ↓** để chọn, **Enter** để mở, **Esc** để đóng. Chọn một kết quả sẽ chuyển tới đúng tab hoặc mở chi tiết tương ứng.

### A7. Trợ lý AI HourGlass

1. Trong cả 3 dashboard, bấm **Chat ngay** ở thẻ *Trợ lý AI HourGlass* (thanh menu bên trái).
2. Chọn một **câu hỏi gợi ý** theo vai trò (vd. sinh viên: *Viết CV khi chưa có kinh nghiệm*; NTD: *Cách viết mô tả công việc*; Admin: *Quy trình duyệt tin*) hoặc tự gõ câu hỏi → **Enter**.
3. Nút **Làm mới cuộc trò chuyện** xóa lịch sử chat. Lịch sử chỉ giữ trong tab trình duyệt hiện tại, riêng cho từng tài khoản.

> Nếu máy chủ chưa cấu hình khóa AI (`AI_API_KEY`), trợ lý vẫn trả lời bằng kịch bản hướng dẫn có sẵn của HourGlass. Mất kết nối máy chủ thì khung chat báo lỗi thân thiện, bạn chỉ cần gửi lại.

---

## Phần B – Sinh viên

Đăng nhập bằng tài khoản Sinh viên → tự chuyển tới `student.html`. Menu bên trái gồm: **Tổng quan · Hồ sơ cá nhân · CV của tôi · Việc đã lưu · Đơn ứng tuyển · Lịch làm việc · Cài đặt tài khoản**.

### B1. Tổng quan

Xem nhanh số đơn đã nộp, số việc đã lưu, số lịch phỏng vấn, các đơn gần đây, lịch trong tuần và **việc làm gợi ý**. Có thể bấm 🔖 trên việc gợi ý để lưu ngay.

### B2. Hoàn thiện hồ sơ cá nhân

1. Vào **Hồ sơ cá nhân**.
2. Cập nhật: Họ và tên, Email, Số điện thoại, Ngày sinh, Địa chỉ, Trường đại học, Chuyên ngành, Giới thiệu bản thân.
3. Thêm **Kỹ năng & Thế mạnh**: gõ tên rồi bấm **Thêm** hoặc nhấn **Enter**; hoặc bấm nhanh các **chip gợi ý** (Giao tiếp, Tiếng Anh, Tin học văn phòng, Canva…). Kỹ năng trùng bị chặn và báo ngay; bấm **×** để xóa. Kỹ năng được **lưu vào máy chủ**, tải lại trang (F5) hoặc đổi máy vẫn còn.
4. Thêm **Kinh nghiệm làm việc** bằng nút **Thêm kinh nghiệm** (vị trí, nơi làm, thời gian, mô tả); bấm xóa để bỏ từng mục. Kinh nghiệm hiện được lưu **trên trình duyệt đang dùng**.
5. Bấm **Lưu thông tin hồ sơ**. Thông báo thành công chỉ hiện khi máy chủ đã lưu xong; nếu có lỗi (vd. email đã có người dùng), ô bị lỗi sẽ được tô đỏ.

> ⚠️ **Đổi email** cũng là đổi email đăng nhập. Hệ thống sẽ hỏi xác nhận, lưu xong thì yêu cầu bạn **đăng nhập lại bằng email mới**.

Bên dưới form có hai khối:
- **Đánh giá & uy tín của bạn:** điểm trung bình, số sao theo từng mức và nhận xét từ nhà tuyển dụng.
- **Khiếu nại đã gửi:** trạng thái từng khiếu nại và phản hồi của Admin.

### B3. Quản lý CV

1. Vào **CV của tôi** → bấm vào khung **Tải lên CV mới** và chọn file.
   - Định dạng: **PDF, DOC, DOCX** · Dung lượng: **tối đa 5MB** · Lưu tối đa **5 CV**.
2. Với từng CV:
   - **Xem:** file PDF mở ngay trong cửa sổ xem trước; file Word thì bấm **Tải xuống**.
   - **Đặt mặc định:** CV mặc định được chọn sẵn khi ứng tuyển.
   - **🗑 Xóa:** có hộp xác nhận trước khi xóa.

### B4. Lưu tin & xem lại tin đã xem

- **Lưu tin:** bấm biểu tượng 🔖 trên thẻ việc làm (trang chủ, trang Tìm việc) hoặc nút **Lưu tin** ở trang chi tiết. Bấm lần nữa để bỏ lưu. Mọi nút của cùng một tin đổi trạng thái cùng lúc, kể cả ở tab trình duyệt khác.
- **Đã xem gần đây:** mỗi lần mở trang chi tiết, tin đó được tự động ghi lại (giữ **10 tin gần nhất**).
- Vào **Việc đã lưu** để xem hai danh sách **Việc làm đã lưu** và **Đã xem gần đây**:
  - **Ứng tuyển** ngay từ danh sách. Nếu đã nộp, nút chuyển thành **Xem đơn**; tin hết hạn hoặc bị gỡ thì nút bị khóa.
  - **Bỏ lưu** / **Xóa** từng tin, hoặc **Bỏ lưu tất cả** / **Xóa lịch sử xem**.

> Danh sách đã lưu và lịch sử xem được giữ **trên trình duyệt đang dùng**, riêng cho từng tài khoản.

### B5. Nộp đơn ứng tuyển

1. Mở trang chi tiết việc làm → **Ứng tuyển ngay** (hoặc nút **Ứng tuyển** trong mục Việc đã lưu).
2. Trong cửa sổ ứng tuyển:
   - **Chọn CV đã lưu**, *hoặc* **tải lên CV mới** (.pdf/.doc/.docx, ≤ 5MB).
   - Viết **lời nhắn** gửi nhà tuyển dụng *(không bắt buộc, tối đa 500 ký tự)*.
3. Bấm **Gửi hồ sơ ứng tuyển** → thấy màn hình *"Ứng tuyển thành công!"*.

Quy tắc:
- Mỗi tin chỉ được nộp **một lần**.
- Chỉ nộp được vào tin **đã duyệt** và **còn hạn**.
- Nhà tuyển dụng nhận thông báo ngay khi bạn nộp.

### B6. Theo dõi đơn ứng tuyển

Vào **Đơn ứng tuyển**. Lọc theo nhóm: *Tất cả · Đang chờ duyệt · Đã tiếp nhận · Đã trúng tuyển · Bị từ chối*.

| Trạng thái hiển thị | Ý nghĩa | Bạn có thể |
| :--- | :--- | :--- |
| **Đang chờ duyệt** | Nhà tuyển dụng chưa xem | **Hủy đơn** |
| **Đã tiếp nhận** | Nhà tuyển dụng đã xem hồ sơ | Chờ phản hồi |
| **Mời phỏng vấn** | Có lịch phỏng vấn (hiện ngày giờ ngay trên thẻ) | Chuẩn bị phỏng vấn |
| **Đã trúng tuyển** 🎉 | Được nhận việc | **★ Đánh giá NTD** |
| **Bị từ chối** | Hiện kèm lý do từ nhà tuyển dụng | Ứng tuyển việc khác |
| **Bạn đã hủy đơn** | Bạn đã rút đơn | — |

Mọi thẻ đơn đều có nút **Xem tin** và **Khiếu nại**.

### B7. Lịch làm việc & lịch rảnh

1. Vào **Lịch làm việc**:
   - Xem ca làm và lịch phỏng vấn theo **Tháng · Tuần · Danh sách**.
   - **Xem lùi** 1 / 2 / 3 tháng, hoặc chọn khoảng *Từ ngày – Đến ngày* rồi bấm **Áp dụng**.
   - Màu chấm thể hiện trạng thái ca: Đã nhận lịch · Đang chờ duyệt · Đã hủy · Hoàn thành.
2. **Đăng ký khung giờ rảnh trong tuần:** đánh dấu ô Ca sáng / chiều / tối cho từng ngày, rồi bấm **Lưu ca rảnh**. Hệ thống ưu tiên gợi ý việc có ca trùng với giờ rảnh của bạn.
3. **Lịch sử cập nhật lịch rảnh:** xem các phiên bản trong 3 tháng gần nhất và bấm **Khôi phục** nếu cần.

### B8. Đánh giá nhà tuyển dụng

Chỉ đánh giá được khi đơn ở trạng thái **Đã trúng tuyển**:

1. Trong **Đơn ứng tuyển**, bấm **★ Đánh giá NTD**, hoặc nút **★ Đánh giá nhà tuyển dụng** ở trang chi tiết việc làm.
2. Chọn **1–5 sao**, viết nhận xét *(không bắt buộc, tối đa 1000 ký tự)* → **Gửi đánh giá**.
3. Mỗi công việc chỉ đánh giá **một lần**. Sau khi gửi, nút chuyển thành *"Đã đánh giá"*.

### B9. Gửi khiếu nại

1. Bấm **🛡 Khiếu nại** trên thẻ đơn ứng tuyển, hoặc **Báo cáo tin tuyển dụng vi phạm** ở trang chi tiết việc làm.
2. Chọn đối tượng (**Tin tuyển dụng** hoặc **Doanh nghiệp**), chọn lý do gợi ý hoặc tự mô tả (**tối thiểu 5 ký tự**) → **Gửi khiếu nại**.
3. Theo dõi kết quả trong **Hồ sơ cá nhân → Khiếu nại đã gửi**; bạn cũng nhận thông báo khi Admin xử lý xong.

> Trong lúc một khiếu nại đang chờ xử lý, không thể gửi thêm khiếu nại trùng cho cùng đối tượng.

### B10. Cài đặt tài khoản

- **Đổi mật khẩu:** nhập mật khẩu hiện tại, mật khẩu mới (**ít nhất 6 ký tự, có cả chữ và số**, khác mật khẩu cũ) và xác nhận → **Cập nhật mật khẩu**.
- **Tùy chọn thông báo:** bật/tắt các loại thông báo → **Lưu tùy chọn**.

---

## Phần C – Nhà tuyển dụng

Đăng nhập bằng tài khoản Nhà tuyển dụng → tự chuyển tới `employer.html`. Menu gồm: **Tổng quan · Hồ sơ công ty · Quản lý tin tuyển dụng · Đăng tin tuyển dụng · Quản lý ứng viên · Cài đặt tài khoản**.

### C1. Tổng quan (KPI)

Xem số tin đang đăng, tổng hồ sơ nhận được, hồ sơ mới, tỷ lệ trúng tuyển, các ứng viên mới nhất và bảng tóm tắt tin tuyển dụng.

### C2. Hồ sơ công ty

1. Vào **Hồ sơ công ty**, cập nhật: Tên công ty, Người đại diện, Lĩnh vực, Số điện thoại, Email, Địa chỉ, Giới thiệu doanh nghiệp.
2. Bấm **Lưu thông tin công ty**. Đổi email cũng là đổi email đăng nhập (cần đăng nhập lại).
3. Huy hiệu **Đã xác minh** do Admin cấp, doanh nghiệp không tự bật được. Doanh nghiệp đã xác minh được sinh viên tin tưởng hơn.

Bên dưới có khối **Đánh giá & uy tín** (điểm từ sinh viên) và **Khiếu nại đã gửi**.

### C3. Đăng tin tuyển dụng

1. Vào **Đăng tin tuyển dụng** (hoặc **Đăng tin mới**).
2. Điền thông tin. Khung **Xem trước bài đăng** cập nhật trực tiếp khi bạn gõ.

   | Nhóm | Trường (\* = bắt buộc) |
   | :--- | :--- |
   | Thông tin cơ bản | Tên công việc\*, Danh mục\*, Hình thức làm việc\*, Mô tả công việc\*, Yêu cầu ứng viên\* |
   | Chế độ & thời gian | Mức lương\* (vd. `30–40K/giờ`, `4–5 triệu/tháng`, `Thỏa thuận`), Khu vực\*, Địa chỉ cụ thể, Ca làm việc, Số lượng cần tuyển, Hạn ứng tuyển\* |
   | Hình ảnh | Banner công việc *(không bắt buộc)* – PNG / JPG / JPEG / WEBP, **tối đa 5MB**, khuyến nghị tỷ lệ 16:9 |

3. Chọn một trong hai:
   - **Đăng tuyển ngay:** tin được gửi lên máy chủ ở trạng thái **Chờ kiểm duyệt**, Admin nhận thông báo.
   - **Lưu nháp:** chỉ lưu **trên trình duyệt đang dùng** (chưa gửi lên máy chủ). Khi sẵn sàng thì mở lại và **Gửi kiểm duyệt**.
4. Hạn ứng tuyển không được ở quá khứ, và mức lương tối đa phải ≥ mức tối thiểu.

### C4. Quản lý tin tuyển dụng

Vào **Quản lý tin tuyển dụng**, lọc theo: *Tất cả · Nháp · Chờ kiểm duyệt · Đã đăng · Hết hạn · Bị từ chối*.

| Trạng thái | Ý nghĩa | Thao tác |
| :--- | :--- | :--- |
| **Nháp** | Chỉ lưu trên trình duyệt | Sửa · **Gửi kiểm duyệt** · Xóa |
| **Chờ kiểm duyệt** | Đang chờ Admin | Xem · Sửa |
| **Đã đăng** | Hiển thị công khai | **Xem tin công khai** · Sửa · Xóa |
| **Bị từ chối / Bị khóa** | Admin từ chối hoặc khóa (hiện kèm lý do) | **Sửa** rồi gửi duyệt lại |
| **Hết hạn** | Đã qua hạn ứng tuyển | **Gia hạn / sửa tin** |

> 🔁 **Mọi lần sửa tin đã gửi đều đưa tin về trạng thái "Chờ kiểm duyệt"**. Nhà tuyển dụng không thể tự duyệt tin.

### C5. Quản lý ứng viên

1. Vào **Quản lý ứng viên**, chọn cách xem **Kanban** (các cột theo trạng thái) hoặc **Danh sách**, và lọc theo **vị trí tuyển dụng**.
2. **Xem CV:** mở hồ sơ ứng viên gồm trường, chuyên ngành, email, số điện thoại, ngày nộp, lời nhắn và **link mở file CV thật**.
3. Xử lý hồ sơ (sinh viên nhận thông báo sau mỗi bước):

   | Nút | Kết quả | Ghi chú |
   | :--- | :--- | :--- |
   | **Duyệt** | → *Đã tiếp nhận* | Có thể kèm ghi chú gửi ứng viên |
   | **Phỏng vấn** | → *Mời phỏng vấn* | **Bắt buộc chọn ngày giờ** phỏng vấn, phải ở tương lai |
   | **Nhận** | → *Trúng tuyển* | Có thể kèm ghi chú gửi ứng viên |
   | **Từ chối** | → *Từ chối* | **Bắt buộc nhập lý do, ít nhất 10 ký tự** (có lý do gợi ý sẵn) |

4. Ở chế độ Kanban có thể **kéo thả** thẻ ứng viên sang cột trạng thái mới.
5. Hồ sơ ở trạng thái *Trúng tuyển* hoặc *Từ chối* là kết quả cuối, không chuyển tiếp được nữa.

### C6. Đánh giá & khiếu nại ứng viên

Trong cửa sổ hồ sơ ứng viên:
- **★ Đánh giá ứng viên:** chỉ dùng được khi ứng viên đã **trúng tuyển**; chấm 1–5 sao kèm nhận xét, mỗi ứng viên mỗi công việc một lần.
- **🛡 Khiếu nại ứng viên:** báo cáo người dùng hoặc đơn ứng tuyển có dấu hiệu sai phạm (hồ sơ giả mạo, không đến làm như đã hẹn…).

### C7. Cài đặt tài khoản

Đổi mật khẩu và chọn các thông báo muốn nhận về ứng viên, giống [B10](#b10-cài-đặt-tài-khoản).

---

## Phần D – Quản trị viên (Admin)

Đăng nhập `admin@gmail.com` → `admin.html`. Menu gồm: **Tổng quan hệ thống · Quản lý sinh viên · Quản lý nhà tuyển dụng · Quản lý việc làm · Thống kê & báo cáo · Kiểm duyệt tin đăng · Danh mục ngành nghề · Phân quyền quản trị**.

### D1. Tổng quan hệ thống

Theo dõi số người dùng, tin tuyển dụng (chờ duyệt / đã duyệt / từ chối), đơn ứng tuyển, tỷ lệ trúng tuyển, khiếu nại chờ xử lý, biểu đồ tăng trưởng và hoạt động gần đây.

### D2. Kiểm duyệt tin đăng ⭐ (việc hằng ngày)

1. Vào **Kiểm duyệt tin đăng**. Tab mặc định **Chờ duyệt gấp** liệt kê tin mới gửi.
2. Xem nội dung tin, rồi chọn:
   - **Phê duyệt:** tin hiển thị công khai ngay, nhà tuyển dụng nhận thông báo.
   - **Từ chối:** **nhập lý do**; lý do được gửi tới nhà tuyển dụng để sửa và gửi lại.
3. Các tab *Tất cả · Đã duyệt · Từ chối / Khóa* dùng để tra cứu lại.

### D3. Quản lý việc làm

Xem **toàn bộ** tin trên hệ thống (lọc *Tất cả · Đang hoạt động · Chờ kiểm duyệt · Bị từ chối*, tìm theo tiêu đề hoặc công ty):
- **Xem** chi tiết tin.
- **Khóa tin** (nhập lý do): gỡ tin vi phạm khỏi trang công khai.
- **Xóa** tin.

### D4. Quản lý người dùng

- **Quản lý sinh viên:** tìm theo tên, email hoặc trường; **Khóa / Mở khóa** tài khoản. Tài khoản bị khóa không đăng nhập được.
- **Quản lý nhà tuyển dụng:** **Xác minh / Hủy xác minh** doanh nghiệp (doanh nghiệp nhận thông báo), và **Khóa / Mở khóa** tài khoản.
- Không thể khóa tài khoản Admin gốc.

### D5. Thống kê & xử lý khiếu nại

1. Vào **Thống kê & báo cáo**: xem tỷ lệ duyệt tin, tổng đơn ứng tuyển, ngành hot nhất, số khiếu nại và biểu đồ tin theo ngành nghề.
2. Bảng **Danh sách báo cáo từ người dùng**: khiếu nại *Chờ xử lý* luôn ở đầu, mỗi dòng có loại, người gửi, lý do, đối tượng và thời gian.
3. Bấm **Xử lý** → nhập **ghi chú phản hồi** (gửi tới người khiếu nại), rồi chọn:
   - **Giải quyết:** xác nhận vi phạm. Với khiếu nại về tin tuyển dụng, có thể đánh dấu **"Gỡ tin tuyển dụng vi phạm"**: tin bị gỡ, các khiếu nại khác đang chờ về cùng tin cũng được đóng, và nhà tuyển dụng nhận thông báo.
   - **Bác bỏ:** khiếu nại không đủ căn cứ (**bắt buộc ghi lý do, tối thiểu 5 ký tự**).
4. Mỗi khiếu nại chỉ xử lý được **một lần**.

### D6. Danh mục ngành nghề

**Thêm danh mục** (tên + mô tả), **Sửa**, **Xóa**, và tìm theo tên. Danh mục dùng để phân loại tin và làm bộ lọc ở trang Tìm việc.

### D7. Phân quyền quản trị (chỉ Admin gốc)

Chỉ **Admin gốc** (`admin@gmail.com`) mới dùng được chức năng này:
- **Cấp quyền QTV** cho một tài khoản sinh viên hoặc nhà tuyển dụng (cần xác nhận).
- **Thu hồi quyền:** tài khoản trở về vai trò ban đầu.

Các quản trị viên khác chỉ xem được danh sách, các nút bị khóa với chú thích *"Chỉ Admin gốc"*.

---

## Phần E – Vòng đời tin tuyển dụng & đơn ứng tuyển

**Tin tuyển dụng**

```text
 [Nháp] ──Gửi kiểm duyệt──▶ [Chờ kiểm duyệt] ──Admin phê duyệt──▶ [Đã đăng] ──quá hạn──▶ [Hết hạn]
  (chỉ trên trình duyệt)          │   ▲                                 │
                                  │   └──────── NTD sửa tin ◀───────────┤
                    Admin từ chối ▼                                     │ Admin khóa / gỡ do khiếu nại
                            [Bị từ chối] ──NTD sửa & gửi lại──▶ ...     ▼
                                                                  [Bị khóa / gỡ]
```

**Đơn ứng tuyển**

```text
 [Đang chờ duyệt] ──▶ [Đã tiếp nhận] ──▶ [Mời phỏng vấn] ──▶ [Trúng tuyển]  ⇒ hai bên đánh giá nhau
        │                   │                   │
        │                   └───────────────────┴──▶ [Từ chối] (kèm lý do)
        └──Sinh viên hủy──▶ [Đã hủy]
```

---

## Phần F – Câu hỏi thường gặp

**Tôi đăng tin nhưng sinh viên không thấy?**
Tin cần được Admin **phê duyệt**. Kiểm tra trạng thái trong *Quản lý tin tuyển dụng*; nếu bị từ chối, xem lý do, sửa rồi gửi lại.

**Tôi không bấm được "Ứng tuyển"?**
Tin đã hết hạn, đã bị gỡ, hoặc bạn đã nộp đơn cho tin này rồi. Bạn cũng cần đăng nhập bằng tài khoản **Sinh viên**.

**Vì sao tôi không thấy nút "Đánh giá"?**
Chỉ đánh giá được sau khi đơn ở trạng thái **Trúng tuyển**, và mỗi công việc chỉ đánh giá một lần.

**Lưu nháp tin tuyển dụng rồi đổi máy tính thì sao?**
Tin nháp chỉ nằm trên trình duyệt đã lưu. Muốn dùng ở máy khác, hãy **Gửi kiểm duyệt** trước. Tương tự, danh sách *Việc đã lưu / Đã xem gần đây* của sinh viên cũng gắn với trình duyệt.

**Thông báo "Không kết nối được máy chủ API"?**
Máy chủ Backend chưa chạy hoặc mất kết nối. Dữ liệu chưa được lưu, hãy thử lại sau (người quản trị hệ thống xem mục *Xử lý sự cố* trong [README.md](README.md#9-xử-lý-sự-cố-thường-gặp)).

**Trợ lý AI trả lời giống nhau / không "thông minh"?**
Máy chủ đang chạy ở chế độ kịch bản vì chưa có `AI_API_KEY`. Người quản trị hệ thống thêm khóa vào `backend/.env` và khởi động lại Backend (xem [README.md](README.md#bước-2--biến-môi-trường-backendenv)).

**Đổi email xong bị đăng xuất?**
Đây là hành vi đúng: email là tên đăng nhập. Hãy đăng nhập lại bằng email mới.
