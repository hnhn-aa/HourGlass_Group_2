/* layout.js – tự chèn Header + Footer vào mọi trang công khai.
   Cách dùng: đặt <div id="site-header"></div> và <div id="site-footer"></div> trong HTML,
   nạp file này TRƯỚC main.js (main.js sẽ biến header thành menu theo vai trò đang đăng nhập:
   Sinh viên / Nhà tuyển dụng / Quản trị viên). */
(function () {
  'use strict';
  var tr = function (k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; };
  var NAV_ITEMS = [
    ['index.html', 'nav.home', 'Trang chủ'],
    ['jobs.html', 'nav.jobs', 'Tìm việc'],
    ['categories.html', 'nav.categories', 'Danh mục'],
    ['about.html', 'nav.about', 'Giới thiệu']
  ];
  var icon = function (n, s) { return '<svg class="icon" width="' + s + '" height="' + s + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var switcher = function (extra) {
    if (window.HGI18n && typeof window.HGI18n.renderSwitcher === 'function') {
      return window.HGI18n.renderSwitcher(extra);
    }
    var cur = 'vi';
    try { cur = (localStorage.getItem('hourglass_lang') || 'vi').replace(/^"|"$/g, ''); } catch (e) {}
    return '<div class="lang-switch' + (extra ? ' ' + extra : '') + '" role="group" aria-label="Chuyển đổi ngôn ngữ" data-i18n-title="nav.lang_label">' +
      '<button type="button" class="lang-btn' + (cur === 'vi' ? ' active' : '') + '" data-lang-switch="vi">VI</button>' +
      '<span class="lang-sep" aria-hidden="true">|</span>' +
      '<button type="button" class="lang-btn' + (cur === 'en' ? ' active' : '') + '" data-lang-switch="en">EN</button>' +
      '</div>';
  };
  var page = location.pathname.split('/').pop() || 'index.html';

  var h = document.getElementById('site-header');
  if (h) {
    var active = h.getAttribute('data-active') || page;
    var NAV = NAV_ITEMS.map(function (i) {
      return '<a href="' + i[0] + '"' + (i[0] === active ? ' class="active"' : '') + ' data-i18n="' + i[1] + '">' + tr(i[1], i[2]) + '</a>';
    }).join('');
    h.outerHTML =
      '<header class="site-header"><div class="container header-inner">' +
        '<div><a class="logo" href="index.html"><span class="logo-mark"><span></span><i></i></span><span>Hour<span>Glass</span></span></a></div>' +
        '<nav>' +
          NAV +
          '<a class="nav-auth" href="auth.html?mode=signin" data-i18n="nav.signin">' + tr('nav.signin', 'Đăng nhập') + '</a>' +
          '<a class="nav-auth" href="auth.html?mode=signup" data-i18n="nav.signup">' + tr('nav.signup', 'Đăng ký') + '</a>' +
          '<div class="nav-lang-mobile">' + switcher('lang-switch--mobile') + '</div>' +
        '</nav>' +
        '<div class="header-right-cluster">' +
          switcher('lang-switch--desktop') +
          '<div class="header-actions" id="header-actions">' +
            '<a class="text-btn" href="auth.html?mode=signin" data-i18n="nav.signin">' + tr('nav.signin', 'Đăng nhập') + '</a>' +
            '<a class="primary-btn small" href="auth.html?mode=signup"><span data-i18n="nav.signup">' + tr('nav.signup', 'Đăng ký') + '</span> ' + icon('arrow', 16) + '</a>' +
          '</div>' +
        '</div>' +
        '<button class="mobile-menu" id="menu-toggle" aria-label="' + tr('nav.menu', 'Menu') + '" data-i18n-title="nav.menu">' + icon('menu', 20) + '</button>' +
      '</div></header>';
  }

  var year = new Date().getFullYear();
  var f = document.getElementById('site-footer');
  if (f) {
    f.outerHTML =
      '<footer><div class="container footer-grid">' +
        '<div><a class="logo logo-inverse" href="index.html"><span class="logo-mark"><span></span><i></i></span><span>Hour<span>Glass</span></span></a>' +
          '<p data-i18n="footer.tagline">' + tr('footer.tagline', 'Chủ động thời gian – Kiến tạo tương lai.') + '</p>' +
          '<div class="socials"><span>f</span><span>in</span><span>ig</span></div></div>' +
        '<div><strong data-i18n="footer.explore">' + tr('footer.explore', 'Khám phá') + '</strong>' +
          '<a href="jobs.html" data-i18n="footer.find_jobs">' + tr('footer.find_jobs', 'Tìm việc làm') + '</a>' +
          '<a href="categories.html" data-i18n="footer.categories">' + tr('footer.categories', 'Danh mục') + '</a>' +
          '<a href="jobs.html" data-i18n="footer.top_companies">' + tr('footer.top_companies', 'Công ty nổi bật') + '</a></div>' +
        '<div><strong data-i18n="footer.for_you">' + tr('footer.for_you', 'Dành cho bạn') + '</strong>' +
          '<a href="student.html" data-i18n="footer.students">' + tr('footer.students', 'Sinh viên') + '</a>' +
          '<a href="employer.html" data-i18n="footer.employers">' + tr('footer.employers', 'Nhà tuyển dụng') + '</a>' +
          '<a href="about.html" data-i18n="footer.about_hg">' + tr('footer.about_hg', 'Về HourGlass') + '</a></div>' +
        '<div><strong>HourGlass</strong>' +
          '<a href="about.html" data-i18n="footer.about_us">' + tr('footer.about_us', 'Về chúng tôi') + '</a>' +
          '<a href="about.html#contact" data-i18n="footer.contact">' + tr('footer.contact', 'Liên hệ') + '</a>' +
          '<a href="about.html#contact" data-i18n="footer.privacy">' + tr('footer.privacy', 'Chính sách bảo mật') + '</a></div>' +
        '<div class="newsletter"><strong data-i18n="footer.newsletter_title">' + tr('footer.newsletter_title', 'Đừng bỏ lỡ cơ hội mới') + '</strong>' +
          '<p data-i18n="footer.newsletter_desc">' + tr('footer.newsletter_desc', 'Nhận việc làm phù hợp mỗi tuần.') + '</p>' +
          '<label><input placeholder="' + tr('footer.newsletter_placeholder', 'Email của bạn') + '" data-i18n-placeholder="footer.newsletter_placeholder">' +
          '<button><svg class="icon" width="20" height="20" aria-hidden="true"><use href="#i-arrow"/></svg></button></label></div>' +
      '</div>' +
      '<div class="container footer-bottom">' +
        '<span>© ' + year + ' HourGlass. Made for students, with care.</span>' +
        '<a href="admin.html" data-i18n="footer.admin_portal">' + tr('footer.admin_portal', 'Cổng quản trị') + '</a>' +
      '</div></footer>';
  }
})();
