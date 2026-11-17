/* layout.js – tự chèn Header + Footer vào mọi trang công khai.
   Cách dùng: đặt <div id="site-header"></div> và <div id="site-footer"></div> trong HTML,
   nạp file này TRƯỚC main.js (main.js sẽ biến header thành menu theo vai trò đang đăng nhập:
   Sinh viên / Nhà tuyển dụng / Quản trị viên). */
(function () {
  'use strict';
  var NAV_ITEMS = [['index.html', 'Trang chủ'], ['jobs.html', 'Tìm việc'], ['categories.html', 'Danh mục'], ['about.html', 'Giới thiệu']];
  var icon = function (n, s) { return '<svg class="icon" width="' + s + '" height="' + s + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var page = location.pathname.split('/').pop() || 'index.html';

  var h = document.getElementById('site-header');
  if (h) {
    var active = h.getAttribute('data-active') || page;
    var NAV = NAV_ITEMS.map(function (i) {
      return '<a href="' + i[0] + '"' + (i[0] === active ? ' class="active"' : '') + '>' + i[1] + '</a>';
    }).join('');
    h.outerHTML = '<header class="site-header"><div class="container header-inner"><div><a class="logo" href="index.html"><span class="logo-mark"><span></span><i></i></span><span>Hour<span>Glass</span></span></a></div><nav>'+NAV+'<a class="nav-auth" href="auth.html?mode=signin">Đăng nhập</a><a class="nav-auth" href="auth.html?mode=signup">Đăng ký</a></nav><div class="header-actions" id="header-actions"><a class="text-btn" href="auth.html?mode=signin">Đăng nhập</a><a class="primary-btn small" href="auth.html?mode=signup">Đăng ký '+icon('arrow',16)+'</a></div><button class="mobile-menu" id="menu-toggle" aria-label="Menu">'+icon('menu',20)+'</button></div></header>';
  }
  var f = document.getElementById('site-footer');
  if (f) f.outerHTML = '<footer><div class="container footer-grid"><div><a class="logo logo-inverse" href="index.html"><span class="logo-mark"><span></span><i></i></span><span>Hour<span>Glass</span></span></a><p>Chủ động thời gian – Kiến tạo tương lai.</p><div class="socials"><span>f</span><span>in</span><span>ig</span></div></div><div><strong>Khám phá</strong><a href="jobs.html">Tìm việc làm</a><a href="categories.html">Danh mục</a><a href="jobs.html">Công ty nổi bật</a></div><div><strong>Dành cho bạn</strong><a href="student.html">Sinh viên</a><a href="employer.html">Nhà tuyển dụng</a><a href="about.html">Về HourGlass</a></div><div><strong>HourGlass</strong><a href="about.html">Về chúng tôi</a><a href="about.html#contact">Liên hệ</a><a href="about.html#contact">Chính sách bảo mật</a></div><div class="newsletter"><strong>Đừng bỏ lỡ cơ hội mới</strong><p>Nhận việc làm phù hợp mỗi tuần.</p><label><input placeholder="Email của bạn"><button><svg class="icon" width="20" height="20" aria-hidden="true"><use href="#i-arrow"/></svg></button></label></div></div><div class="container footer-bottom"><span>© '+new Date().getFullYear()+' HourGlass. Made for students, with care.</span><a href="admin.html">Cổng quản trị</a></div></footer>';
})();
