/* Dashboard sinh viên / nhà tuyển dụng / admin - đầy đủ tính năng cho mọi vai trò */
(function () {
  'use strict';
  var I = HG.icon, E = HG.esc, JOBS = jobs;
  var role = document.body.dataset.role, user = HG.user();

  /* Chưa đăng nhập hoặc sai vai trò -> chuyển về auth.html */
  if (!user || user.role !== role) {
    location.replace('auth.html?role=' + role + '&next=' + location.pathname.split('/').pop() + '&notice=' + encodeURIComponent('Vui lòng đăng nhập để vào trang này.'));
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  /* Bản ghi thay thế khi tin / doanh nghiệp đã bị xóa: id = null để KHÔNG trỏ nhầm sang bản ghi số 1 */
  function jobOf(a) { return byId(JOBS, a.job_id) || { id: a.job_id, title: 'Việc làm #' + a.job_id, employer_id: null }; }
  function companyOf(j) { return byId(employer_profiles, j && (j.employer_id || j.recruiter_id)) || { company_name: 'Doanh nghiệp', id: null, user_id: null }; }
  function statusName(id) {
    var st = byId(application_statuses, id);
    return st ? st.name : 'submitted';
  }
  function getStatusPair(name) {
    var map = {
      submitted: [tr('stu.st.submitted', 'Đã nộp'), 'pending'],
      reviewing: [tr('stu.st.reviewing', 'Đang xem xét'), 'reviewing'],
      interview: [tr('stu.st.interview', 'Mời phỏng vấn'), 'interview'],
      accepted: [tr('stu.st.accepted', 'Đã trúng tuyển'), 'accepted'],
      rejected: [tr('stu.st.rejected', 'Từ chối'), ''],
      withdrawn: [tr('stu.st.withdrawn', 'Đã rút đơn'), '']
    };
    return map[name] || map.submitted;
  }
  var STATUS = {
    submitted: ['Đã nộp', 'pending'],
    reviewing: ['Đang xem xét', 'reviewing'],
    interview: ['Mời phỏng vấn', 'interview'],
    accepted: ['Đã trúng tuyển', 'accepted'],
    rejected: ['Từ chối', ''],
    withdrawn: ['Đã rút đơn', '']
  };

  function setStat(key, value, sub) {
    var el = document.querySelector('[data-stat="' + key + '"]');
    if (!el) return;
    el.textContent = value;
    var em = el.parentNode.querySelector('em');
    if (em) em.textContent = sub || '';
  }

  function after(sectionId, html) {
    var el = $(sectionId);
    if (el) el.insertAdjacentHTML('beforeend', html);
  }

  /* ---- Toast thông báo nổi ---- */
  function showToast(msg, type) { HG.toast(msg, type || 'success'); }

  /* ---- Header thông tin người dùng ---- */
  var display = user.full_name, emp = null;
  if (role === 'employer') {
    emp = employer_profiles.filter(function (e) { return e.user_id === user.id; })[0];
    if (emp) display = emp.company_name;
  }
  var avatarEl = document.querySelector('.dash-avatar');
  if (avatarEl) {
    var myStudent = role === 'student' && student_profiles.filter(function (p) { return p.user_id === user.id; })[0];
    var myCompany = role === 'employer' && employer_profiles.filter(function (p) { return p.user_id === user.id; })[0];
    HG.setAvatar(avatarEl, display, myStudent ? myStudent.avatar_url : myCompany ? myCompany.logo_url : '', { type: myCompany ? 'company' : 'person' });
  }
  var nameStrong = document.querySelector('.user-name strong');
  if (nameStrong) nameStrong.textContent = display;

  /* Nút đăng xuất ở header */
  var headerRight = document.querySelector('.dash-header > div:last-child');
  if (headerRight && !$('logout-btn')) {
    var loTxt = typeof window.t === 'function' ? window.t('nav.logout') : 'Đăng xuất';
    headerRight.insertAdjacentHTML('beforeend', '<button class="logout-btn" id="logout-btn" type="button" aria-label="' + E(loTxt) + '" data-i18n-title="nav.logout">' + I('logout', 18) + '<span data-i18n="nav.logout">' + E(loTxt) + '</span></button>');
  }

  /* Thông báo ở header dashboard: do js/notify.js đảm nhiệm (dữ liệu thật + trạng thái đã đọc lưu localStorage) */

  /* ---- Tiện ích tìm kiếm & chuẩn hóa tiếng Việt ---- */
  function removeVietnameseTones(str) {
    if (!str) return '';
    str = String(str);
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
    str = str.replace(/Đ/g, 'D');
    str = str.replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '');
    str = str.replace(/[\u02C6\u0306\u031B]/g, '');
    return str;
  }

  function matchText(source, query) {
    if (!query) return true;
    if (!source) return false;
    var s = String(source).toLowerCase();
    var q = String(query).trim().toLowerCase();
    if (s.indexOf(q) !== -1) return true;
    var sNorm = removeVietnameseTones(s);
    var qNorm = removeVietnameseTones(q);
    return sNorm.indexOf(qNorm) !== -1;
  }

  function debounce(fn, delay) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  var globalSearchQuery = '';
  var globalSearchListeners = [];
  var currentActiveTab = 0;
  var dispatchRoleSearch = function (q) {};

  HG.removeVietnameseTones = removeVietnameseTones;
  HG.matchText = matchText;
  HG.getGlobalSearchQuery = function () { return globalSearchQuery; };
  HG.onGlobalSearch = function (cb) {
    if (typeof cb === 'function') globalSearchListeners.push(cb);
  };
  function notifyGlobalSearch(q) {
    globalSearchListeners.forEach(function (cb) {
      try { cb(q); } catch (e) { console.error(e); }
    });
  }

  /* Khởi tạo thanh Tìm kiếm nhanh Header thành thẻ <input type="text"> thực thụ */
  var oldDashSearch = document.querySelector('.dash-search');
  var headerSearchInput = null;
  var headerSearchClear = null;

  if (oldDashSearch) {
    var searchWrap = document.createElement('div');
    searchWrap.className = 'dash-search dash-search-live';   /* bố cục do CSS quyết định (ẩn/hiện theo breakpoint) */
    searchWrap.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; pointer-events: none; color: #9aa2b2;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
      '<input type="text" class="dash-search-input" id="dash-header-search" placeholder="' + E(tr('common.quick_search', 'Tìm kiếm nhanh...')) + '" data-i18n-placeholder="common.quick_search" autocomplete="off" style="padding-left: 34px; padding-right: 32px;" aria-label="' + E(tr('common.quick_search', 'Tìm kiếm nhanh')) + '">' +
      '<button type="button" id="dash-header-search-clear" aria-label="Xóa tìm kiếm" title="Xóa tìm kiếm" style="position: absolute; right: 8px; border: none; background: transparent; color: #9aa2b2; cursor: pointer; padding: 2px 6px; font-size: 16px; line-height: 1; border-radius: 50%; display: none;">&times;</button>';

    oldDashSearch.parentNode.replaceChild(searchWrap, oldDashSearch);
    headerSearchInput = searchWrap.querySelector('#dash-header-search');
    headerSearchClear = searchWrap.querySelector('#dash-header-search-clear');

    /* Mobile/tablet (≤768px): ô tìm kiếm thu thành nút kính lúp, bấm để mở thành hàng tìm kiếm toàn chiều ngang */
    var dashHeaderEl = document.querySelector('.dash-header');
    var rightGroup = dashHeaderEl && dashHeaderEl.children[1];
    if (dashHeaderEl && rightGroup) {
      var searchToggle = document.createElement('button');
      searchToggle.type = 'button';
      searchToggle.className = 'dash-search-toggle';
      searchToggle.setAttribute('aria-label', 'Mở tìm kiếm nhanh');
      searchToggle.setAttribute('aria-expanded', 'false');
      searchToggle.setAttribute('aria-controls', 'dash-header-search');
      searchToggle.innerHTML = I('search', 20);
      rightGroup.insertBefore(searchToggle, rightGroup.firstChild);
      var setSearchOpen = function (open) {
        dashHeaderEl.classList.toggle('search-open', open);
        searchToggle.setAttribute('aria-expanded', String(open));
        searchToggle.innerHTML = I(open ? 'x' : 'search', 20);
        searchToggle.setAttribute('aria-label', open ? 'Đóng tìm kiếm nhanh' : 'Mở tìm kiếm nhanh');
        if (open) setTimeout(function () { headerSearchInput.focus(); }, 30);
      };
      searchToggle.addEventListener('click', function () { setSearchOpen(!dashHeaderEl.classList.contains('search-open')); });
      headerSearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !headerSearchInput.value && dashHeaderEl.classList.contains('search-open')) { setSearchOpen(false); searchToggle.focus(); }
      });
    }

    var handleSearchInput = function (instant) {
      var val = headerSearchInput ? headerSearchInput.value : '';
      globalSearchQuery = val.trim();
      if (headerSearchClear) {
        headerSearchClear.style.display = val.length > 0 ? 'block' : 'none';
      }
      dispatchRoleSearch(globalSearchQuery);
      notifyGlobalSearch(globalSearchQuery);
    };

    var debouncedSearch = debounce(function () {
      handleSearchInput(false);
    }, 250);

    headerSearchInput.addEventListener('input', debouncedSearch);

    headerSearchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchInput(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (headerSearchInput.value) {
          headerSearchInput.value = '';
          handleSearchInput(true);
        } else {
          headerSearchInput.blur();
        }
      }
    });

    if (headerSearchClear) {
      headerSearchClear.addEventListener('click', function (e) {
        e.preventDefault();
        if (headerSearchInput) {
          headerSearchInput.value = '';
          headerSearchInput.focus();
        }
        handleSearchInput(true);
      });
    }

    /* Phím tắt / để focus nhanh vào ô tìm kiếm */
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== headerSearchInput && ['INPUT', 'TEXTAREA'].indexOf((document.activeElement || {}).tagName) === -1) {
        e.preventDefault();
        if (headerSearchInput) {
          headerSearchInput.focus();
          headerSearchInput.select();
        }
      }
    });
  }

  /* ---- Sidebar drawer trên mobile ---- */
  var sidebar = $('dash-sidebar'), backdrop = $('dash-backdrop'), menuBtn = $('dash-menu');
  var drawerMq = window.matchMedia('(max-width: 991.98px)');   /* trùng breakpoint ngăn kéo trong dashboard.css */
  function toggleDrawer(open) {
    var wasOpen = !!(sidebar && sidebar.classList.contains('open'));
    if (sidebar) sidebar.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('dash-drawer-open', !!open && drawerMq.matches);
    if (open && !wasOpen && drawerMq.matches && sidebar) {
      var first = sidebar.querySelector('nav [data-tab].active') || sidebar.querySelector('nav [data-tab]');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    } else if (!open && wasOpen && menuBtn && sidebar && (sidebar.contains(document.activeElement) || document.activeElement === document.body || !document.activeElement)) {
      /* đóng bằng nền mờ / Esc / phím: trả focus về nút ☰ (không làm khi người dùng đã focus chỗ khác, VD ô tìm kiếm) */
      menuBtn.focus({ preventScroll: true });
    }
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { toggleDrawer(!sidebar.classList.contains('open')); });
  if (backdrop) backdrop.addEventListener('click', function () { toggleDrawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) toggleDrawer(false); });
  /* Kéo cửa sổ rộng ra ≥ 992px khi ngăn kéo đang mở → tự đóng, bỏ lớp phủ & khóa cuộn */
  var onDrawerMq = function () { if (!drawerMq.matches && sidebar && sidebar.classList.contains('open')) toggleDrawer(false); };
  if (drawerMq.addEventListener) drawerMq.addEventListener('change', onDrawerMq); else if (drawerMq.addListener) drawerMq.addListener(onDrawerMq);

  /* ---- Chuyển tab sidebar ---- */
  var tabs = document.querySelectorAll('.dash-sidebar nav [data-tab]');
  var views = document.querySelectorAll('.dash-view');
  var placeholder = $('dash-placeholder');

  function showTab(n) {
    currentActiveTab = Number(n);
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === String(n)); });
    var found = false;
    views.forEach(function (v) {
      var on = v.dataset.view === String(n);
      v.hidden = !on;
      if (on) found = true;
    });
    if (placeholder) placeholder.hidden = found;
    if (!found && placeholder) {
      var title = (tabs[n] && tabs[n].querySelector('span')) ? tabs[n].querySelector('span').textContent : 'Mục quản lý';
      placeholder.innerHTML = '<div class="placeholder-panel"><span>' + I('sparkle', 30) + '</span><h1>' + title + '</h1>' +
        '<p>Khu vực quản lý ' + title.toLowerCase() + ' của bạn. Dữ liệu đã sẵn sàng để trải nghiệm.</p>' +
        '<button class="primary-btn" onclick="location.reload()">Làm mới trang ' + I('arrow') + '</button></div>';
    }
    dispatchRoleSearch(globalSearchQuery);
    notifyGlobalSearch(globalSearchQuery);
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      showTab(Number(t.dataset.tab));
      toggleDrawer(false);
    });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto-tab]');
    if (b) {
      e.preventDefault();
      showTab(Number(b.dataset.gotoTab));
    }
  });

  /* Mở tab theo URL query parameter ?tab=X */
  var params = new URLSearchParams(location.search);
  if (params.get('tab') !== null) {
    showTab(Number(params.get('tab')));
  }

  /* =========================================================
     TÌM KIẾM NHANH (topbar): dropdown gợi ý trực tiếp theo vai trò
     - Sinh viên: việc làm, công ty, đơn ứng tuyển của tôi + chuyển nhanh tới các mục
     - Nhà tuyển dụng: ứng viên, vị trí tuyển dụng của tôi + Đăng tin / Quản lý ứng viên…
     - Admin: người dùng (tên, email), tin tuyển dụng + các mục quản trị
     Chọn kết quả → điền từ khóa vào bộ lọc chung & chuyển tab (hoặc mở trang chi tiết).
     ========================================================= */
  (function initQuickSearch() {
    if (!headerSearchInput) return;
    var wrap = headerSearchInput.closest('.dash-search-live') || headerSearchInput.parentNode;
    var box = document.createElement('div');
    box.className = 'qs-dropdown';
    box.id = 'dash-qs-list';
    box.setAttribute('role', 'listbox');
    box.setAttribute('aria-label', 'Gợi ý tìm kiếm nhanh');
    box.hidden = true;
    wrap.appendChild(box);
    headerSearchInput.setAttribute('role', 'combobox');
    headerSearchInput.setAttribute('aria-autocomplete', 'list');
    headerSearchInput.setAttribute('aria-controls', box.id);
    headerSearchInput.setAttribute('aria-expanded', 'false');

    var PER_GROUP = 5, results = [], active = -1;
    function getNavItems() {
      return {
        student: [
          [tr('stu.tab_overview', 'Tổng quan'), 0, 'home', 'tong quan trang chu dashboard overview'],
          [tr('stu.tab_profile', 'Hồ sơ cá nhân'), 1, 'user', 'ho so ca nhan thong tin ky nang kinh nghiem profile'],
          [tr('stu.tab_cv', 'CV của tôi'), 2, 'file', 'cv cua toi tai len ho so xin viec my cv'],
          [tr('stu.tab_saved', 'Việc đã lưu'), 3, 'bookmark', 'viec da luu yeu thich bookmark saved jobs'],
          [tr('stu.tab_apps', 'Đơn ứng tuyển'), 4, 'briefcase', 'don ung tuyen trang thai da nop applications'],
          [tr('stu.tab_schedule', 'Lịch làm việc'), 5, 'calendar', 'lich lam viec ca lam lich ranh work schedule'],
          [tr('stu.tab_settings', 'Cài đặt tài khoản'), 6, 'settings', 'cai dat tai khoan mat khau settings'],
          [tr('stu.find_new_jobs', 'Tìm việc làm mới'), 'jobs.html', 'search', 'tim viec lam moi part time find jobs']
        ],
        employer: [
          [tr('emp.tab_post', 'Đăng tin tuyển dụng'), 3, 'plus', 'dang tin tuyen dung tao tin moi post job'],
          [tr('emp.tab_candidates', 'Quản lý ứng viên'), 4, 'users', 'quan ly ung vien ho so kanban cv candidates'],
          [tr('emp.tab_jobs', 'Quản lý tin tuyển dụng'), 2, 'file', 'quan ly tin tuyen dung tin da dang manage jobs'],
          [tr('emp.tab_profile', 'Hồ sơ công ty'), 1, 'briefcase', 'ho so cong ty doanh nghiep company profile'],
          [tr('emp.tab_overview', 'Tổng quan'), 0, 'home', 'tong quan dashboard thong ke overview'],
          [tr('emp.tab_settings', 'Cài đặt tài khoản'), 5, 'settings', 'cai dat tai khoan mat khau settings']
        ],
        admin: [
          [tr('adm.tab_moderation', 'Kiểm duyệt tin đăng'), 5, 'shield', 'kiem duyet tin dang duyet tin cho duyet moderation'],
          [tr('adm.tab_jobs', 'Quản lý việc làm'), 3, 'file', 'quan ly viec lam tin tuyen dung manage jobs'],
          [tr('adm.tab_students', 'Quản lý sinh viên'), 1, 'users', 'quan ly sinh vien nguoi dung students'],
          [tr('adm.tab_employers', 'Quản lý nhà tuyển dụng'), 2, 'briefcase', 'quan ly nha tuyen dung doanh nghiep employers'],
          [tr('adm.tab_reports', 'Thống kê & báo cáo'), 4, 'chart', 'thong ke bao cao khieu nai reports analytics'],
          [tr('adm.tab_categories', 'Danh mục ngành nghề'), 6, 'sparkle', 'danh muc nganh nghe categories'],
          [tr('adm.tab_roles', 'Phân quyền quản trị'), 7, 'user', 'phan quyen quan tri vien admin permissions'],
          [tr('adm.tab_overview', 'Tổng quan hệ thống'), 0, 'home', 'tong quan he thong dashboard overview']
        ]
      }[role] || [];
    }
    function statusLabel(st) {
      return {
        draft: tr('emp.jst.draft', 'Bản nháp'),
        pending: tr('adm.mod_st.pending', 'Chờ duyệt'),
        approved: tr('emp.stat_active_sub', 'Đang hiển thị'),
        rejected: tr('emp.jst.rejected', 'Bị từ chối'),
        locked: tr('emp.jst.locked', 'Bị khóa'),
        expired: tr('emp.jst.expired', 'Hết hạn'),
        closed: tr('emp.jst.expired', 'Đã đóng')
      }[st] || st;
    }
    function roleLabel(r) {
      return {
        student: tr('nav.role.student', 'Sinh viên'),
        employer: tr('nav.role.employer', 'Nhà tuyển dụng'),
        recruiter: tr('nav.role.employer', 'Nhà tuyển dụng'),
        admin: tr('nav.role.admin', 'Quản trị viên')
      }[r] || r;
    }

    function fold(v) { return removeVietnameseTones(String(v || '').normalize('NFC').toLowerCase()).replace(/\s+/g, ' ').trim(); }
    /* Tô sáng phần khớp (không phân biệt dấu) – removeVietnameseTones giữ nguyên độ dài chuỗi NFC */
    function hl(text, q) {
      var t = String(text || '').normalize('NFC'), k = fold(q), i = k ? fold(t).indexOf(k) : -1;
      if (i < 0) return E(t);
      return E(t.slice(0, i)) + '<mark>' + E(t.slice(i, i + k.length)) + '</mark>' + E(t.slice(i + k.length));
    }
    function hit(q) { var k = fold(q); return function () { for (var i = 0; i < arguments.length; i++) if (fold(arguments[i]).indexOf(k) !== -1) return true; return false; }; }
    function rank(list, q, field) {   /* khớp từ đầu chuỗi lên trước */
      var k = fold(q);
      return list.sort(function (a, b) { return (fold(a[field]).indexOf(k) === 0 ? 0 : 1) - (fold(b[field]).indexOf(k) === 0 ? 0 : 1); }).slice(0, PER_GROUP);
    }
    function navItems(q) {
      var m = q ? hit(q) : null;
      var NAV = getNavItems();
      var gQuick = tr('qs.group_quick', 'Chuyển nhanh');
      return NAV.filter(function (n) { return !m || m(n[0], n[3]); }).slice(0, q ? PER_GROUP : 6).map(function (n) {
        return typeof n[1] === 'string'
          ? { group: gQuick, title: n[0], icon: n[2], href: n[1], hint: tr('qs.hint_open_page', 'Mở trang') }
          : { group: gQuick, title: n[0], icon: n[2], tab: n[1], query: '', hint: tr('qs.hint_open_tab', 'Mở mục') };
      });
    }
    function avatar(name, color) { return { letter: String(name || '?').trim().charAt(0).toUpperCase(), color: color || '#4f7dff' }; }

    function collect(q) {
      if (!q) return navItems('');      // chưa gõ gì → chỉ gợi ý chuyển nhanh tới các mục
      var out = [], m = hit(q);
      if (role === 'student') {
        var pub = (window.HG_JOBS || []).filter(function (j) { return m(j.title, j.company); });
        rank(pub, q, 'title').forEach(function (j) {
          var locTxt = HG.trVal ? HG.trVal('area', j.location) : j.location;
          out.push({ group: tr('qs.group_jobs', 'Việc làm'), title: j.title, sub: j.company + (locTxt ? ' · ' + locTxt : ''), av: avatar(j.company, j.color), href: 'job-detail.html?id=' + j.id, hint: tr('qs.hint_view_post', 'Xem tin') });
        });
        var seen = {}, comps = [];
        (window.HG_JOBS || []).forEach(function (j) {
          if (!j.company || !m(j.company)) return;
          if (!seen[j.company]) { seen[j.company] = { name: j.company, color: j.color, n: 0 }; comps.push(seen[j.company]); }
          seen[j.company].n++;
        });
        rank(comps, q, 'name').forEach(function (c) {
          out.push({ group: tr('qs.group_companies', 'Công ty'), title: c.name, sub: tr('qs.open_jobs_count', c.n + ' việc đang tuyển', { n: c.n }), av: avatar(c.name, c.color), href: 'jobs.html?q=' + encodeURIComponent(c.name), hint: tr('qs.hint_view_jobs', 'Xem việc') });
        });
        var sidQ = HG.studentId(user);
        var mine = HG.applications().filter(function (a) { return a.student_id === sidQ; }).map(function (a) {
          var j = byId(jobs, a.job_id) || {}; return { title: j.title || '', app: a };
        }).filter(function (x) { return x.title && m(x.title); });
        rank(mine, q, 'title').forEach(function (x) {
          out.push({ group: tr('qs.group_my_apps', 'Đơn ứng tuyển của tôi'), title: x.title, sub: tr('emp.cand_submitted_on', 'Nộp ' + HG.fmtDate(x.app.applied_at), { date: HG.fmtDate(x.app.applied_at) }), icon: 'briefcase', tab: 4, query: x.title, hint: tr('qs.hint_open_tab', 'Mở mục') });
        });
      } else if (role === 'employer') {
        var ep = employer_profiles.filter(function (e) { return e.user_id === user.id; })[0] || {};
        var own = jobs.filter(function (j) { return j.employer_id === ep.id; });
        var ownIds = own.map(function (j) { return j.id; });
        var cands = [], seenC = {};
        HG.applications().forEach(function (a) {
          if (ownIds.indexOf(a.job_id) === -1) return;
          var sp = byId(student_profiles, a.student_id) || {}, u = byId(users, sp.user_id) || {};
          if (!u.full_name || !m(u.full_name, u.email)) return;
          var j = byId(jobs, a.job_id) || {};
          if (seenC[u.id]) { seenC[u.id].jobs.push(j.title); return; }
          seenC[u.id] = { name: u.full_name, email: u.email, jobs: [j.title] }; cands.push(seenC[u.id]);
        });
        rank(cands, q, 'name').forEach(function (c) {
          out.push({ group: tr('qs.group_candidates', 'Ứng viên'), title: c.name, sub: tr('emp.cand_Applied_for', 'Ứng tuyển:') + ' ' + c.jobs.filter(Boolean).join(', '), av: avatar(c.name, '#8f86ff'), tab: 4, query: c.name, hint: tr('qs.hint_view_profile', 'Xem hồ sơ') });
        });
        rank(own.filter(function (j) { return m(j.title); }), q, 'title').forEach(function (j) {
          out.push({ group: tr('qs.group_positions', 'Vị trí tuyển dụng'), title: j.title, sub: statusLabel(j.status) || tr('qs.group_job_posts', 'Tin tuyển dụng'), icon: 'file', tab: 2, query: j.title, hint: tr('qs.hint_manage_jobs', 'Quản lý tin') });
        });
      } else if (role === 'admin') {
        var us = users.filter(function (u) { return m(u.full_name, u.email); });
        rank(us, q, 'full_name').forEach(function (u) {
          var tab = u.role === 'admin' ? 7 : (u.role === 'student' ? 1 : 2);
          out.push({ group: tr('qs.group_users', 'Người dùng'), title: u.full_name, sub: u.email + ' · ' + roleLabel(u.role), av: avatar(u.full_name, u.role === 'admin' ? '#665CF6' : u.role === 'student' ? '#4f7dff' : '#ff8ec7'), tab: tab, query: u.email, hint: tr('qs.hint_view_account', 'Xem tài khoản') });
        });
        var allJobs = jobs.filter(function (j) { var e = byId(employer_profiles, j.employer_id) || {}; return m(j.title, e.company_name); });
        rank(allJobs, q, 'title').forEach(function (j) {
          var e = byId(employer_profiles, j.employer_id) || {};
          out.push({ group: tr('qs.group_job_posts', 'Tin tuyển dụng'), title: j.title, sub: (e.company_name || tr('adm.default_company', 'Doanh nghiệp')) + ' · ' + statusLabel(j.status), icon: 'file', tab: 3, query: j.title, hint: tr('qs.hint_manage_jobs', 'Quản lý tin') });
        });
      }
      return out.concat(navItems(q));
    }

    function iconHtml(r) {
      if (r.av) return '<span class="qs-ico is-avatar" style="background:' + E(r.av.color) + '">' + E(r.av.letter) + '</span>';
      return '<span class="qs-ico">' + I(r.icon || 'search', 16) + '</span>';
    }
    function render() {
      var q = headerSearchInput.value.trim();
      results = collect(q);
      active = q && results.length ? 0 : -1;
      var html = '', lastGroup = null;
      if (!results.length) {
        html = '<div class="qs-empty">' + tr('qs.empty_for', 'Không tìm thấy kết quả cho “<b>' + E(q) + '</b>”.', { q: E(q) }) + '<small>' +
          E(role === 'student' ? tr('qs.empty_hint_stu', 'Thử tên việc làm, tên công ty hoặc tên mục như “CV”, “Lịch làm việc”.')
            : role === 'employer' ? tr('qs.empty_hint_emp', 'Thử tên ứng viên, vị trí tuyển dụng hoặc “Đăng tin”.')
            : tr('qs.empty_hint_adm', 'Thử tên người dùng, email hoặc tiêu đề tin tuyển dụng.')) + '</small></div>';
      }
      results.forEach(function (r, i) {
        if (r.group !== lastGroup) { html += '<div class="qs-group" role="presentation">' + E(r.group) + '</div>'; lastGroup = r.group; }
        var sub = r.sub ? hl(r.sub, q) : '';
        html += '<div class="qs-item' + (i === active ? ' is-active' : '') + '" role="option" id="qs-opt-' + i + '" data-qs="' + i + '" aria-selected="' + (i === active) + '">' +
          iconHtml(r) + '<span class="qs-text"><b>' + hl(r.title, q) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
          '<span class="qs-hint">' + E(r.hint || '') + ' ↵</span></div>';
      });
      if (results.length) html += '<div class="qs-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> ' + E(tr('qs.foot_select', 'chọn')) + '</span><span><kbd>Enter</kbd> ' + E(tr('qs.foot_open', 'mở')) + '</span><span><kbd>Esc</kbd> ' + E(tr('qs.foot_close', 'đóng')) + '</span></div>';
      box.innerHTML = html;
      open();
      syncActive();
    }
    function open() { box.hidden = false; headerSearchInput.setAttribute('aria-expanded', 'true'); }
    function close() {
      box.hidden = true; active = -1;
      headerSearchInput.setAttribute('aria-expanded', 'false');
      headerSearchInput.removeAttribute('aria-activedescendant');
    }
    function syncActive() {
      box.querySelectorAll('.qs-item').forEach(function (el) {
        var on = Number(el.dataset.qs) === active;
        el.classList.toggle('is-active', on); el.setAttribute('aria-selected', String(on));
        if (on && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      });
      if (active >= 0) headerSearchInput.setAttribute('aria-activedescendant', 'qs-opt-' + active);
      else headerSearchInput.removeAttribute('aria-activedescendant');
    }
    function scrollTopInstant() {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
    }
    function choose(r) {
      if (!r) return;
      close();
      if (r.href) { location.href = r.href; return; }
      headerSearchInput.value = r.query || '';
      handleSearchInput(true);          // áp dụng bộ lọc chung → tab đích chỉ còn kết quả vừa chọn
      showTab(r.tab);
      scrollTopInstant();
      headerSearchInput.blur();
      var hdr = document.querySelector('.dash-header.search-open');
      if (hdr && !r.query) { var tg = hdr.querySelector('.dash-search-toggle'); if (tg) tg.click(); }
    }

    var renderSoon = debounce(render, 90);
    headerSearchInput.addEventListener('input', renderSoon);
    headerSearchInput.addEventListener('focus', render);
    /* Pha "capture" chạy trước các phím tắt sẵn có của ô tìm kiếm (Enter lọc, Esc xóa) */
    headerSearchInput.addEventListener('keydown', function (e) {
      if (box.hidden) { if (e.key === 'ArrowDown') { e.preventDefault(); render(); } return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!results.length) return;
        active = e.key === 'ArrowDown' ? (active + 1) % results.length : (active <= 0 ? results.length - 1 : active - 1);
        syncActive();
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        choose(results[active]);
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();   // Esc lần 1: chỉ đóng dropdown
        close();
      } else if (e.key === 'Tab') {
        close();
      }
    }, true);
    box.addEventListener('mousedown', function (e) {
      var it = e.target.closest('[data-qs]');
      e.preventDefault();               // giữ focus ở ô nhập
      if (it) choose(results[Number(it.dataset.qs)]);
    });
    box.addEventListener('mousemove', function (e) {
      var it = e.target.closest('[data-qs]');
      if (it && Number(it.dataset.qs) !== active) { active = Number(it.dataset.qs); syncActive(); }
    });
    document.addEventListener('mousedown', function (e) { if (!box.hidden && !wrap.contains(e.target)) close(); });
    headerSearchInput.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== headerSearchInput) close(); }, 120); });
    if (headerSearchClear) headerSearchClear.addEventListener('click', function () { setTimeout(render, 0); });
    document.addEventListener('hg:synced', function () { if (!box.hidden) render(); });
  })();

  /* =========================================================
     1. SINH VIÊN (STUDENT)
     ========================================================= */
  if (role === 'student') {
    var sid = HG.studentId(user) || 0;   /* 0 = tài khoản chưa có hồ sơ sinh viên: không hiển thị nhầm dữ liệu của sinh viên khác */
    /* Luôn có object hồ sơ (dữ liệu backend có thể chưa có dòng student_profiles) – tránh lỗi làm dừng cả tab Hồ sơ */
    var profile = student_profiles.filter(function (p) { return p.user_id === user.id; })[0] || { user_id: user.id };
    var now = new Date();

    var firstName = (user.full_name || '').split(' ').pop();
    var fnEl = document.querySelector('[data-first-name]');
    if (fnEl) fnEl.textContent = firstName;

    var todayEl = $('today');
    function updateTodayHeading() {
      if (!todayEl) return;
      var en = window.HGI18n && window.HGI18n.getLang && window.HGI18n.getLang() === 'en';
      if (en) {
        var wdEn = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][now.getDay()];
        var mEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()];
        todayEl.textContent = wdEn + ', ' + mEn + ' ' + now.getDate();
      } else {
        todayEl.textContent = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'][now.getDay()] + ', ' + now.getDate() + ' THÁNG ' + (now.getMonth() + 1);
      }
    }
    updateTodayHeading();

    /* Đơn ứng tuyển */
    var getStudentApps = function() {
      return HG.applications().filter(function (a) { return a.student_id === sid; })
        .sort(function (a, b) { return (b.applied_at || '').localeCompare(a.applied_at || ''); });
    };

    var updateStudentStats = function() {
      var apps = getStudentApps();
      var interviews = apps.filter(function (a) { return statusName(a.status_id) === 'interview'; }).length;
      setStat('apps', apps.length, tr('stu.stat_apps_sub', 'Tổng số đơn đã nộp'));
      setStat('saved', HG.getSaved().length, tr('stu.stat_saved_sub', 'Việc đã lưu'));
      setStat('interviews', interviews, tr('stu.stat_interviews_sub', 'Đang chờ phỏng vấn'));

      var appBadge = document.querySelector('.dash-sidebar nav button[data-tab="4"] b');
      if (appBadge) appBadge.textContent = apps.length;
    };
    updateStudentStats();

    /* Tab 0: Đơn gần đây & Việc gợi ý (có hỗ trợ tìm kiếm nhanh) */
    var secApps = $('student-apps');
    var recEl = $('recommended');

    function renderStudentOverview(q) {
      q = q || globalSearchQuery;
      if (secApps) {
        secApps.querySelectorAll('.app-row, .empty-note').forEach(function(el){ el.remove(); });
        var apps = getStudentApps().filter(function (a) {
          if (!q) return true;
          var j = jobOf(a), c = companyOf(j), stName = statusName(a.status_id), st = getStatusPair(stName);
          return matchText(j.title, q) || matchText(c.company_name, q) || matchText(st[0], q);
        });
        secApps.insertAdjacentHTML('beforeend', apps.slice(0, 5).map(function (a) {
          var j = jobOf(a), c = companyOf(j), st = getStatusPair(statusName(a.status_id));
          return '<div class="app-row">' + HG.avatar(c.company_name, c.logo_url, { type: 'company', className: 'company-logo' }) +
            '<div><strong>' + E(j.title) + '</strong><small>' + E(c.company_name) + '</small></div>' +
            '<span class="status ' + st[1] + '">' + E(st[0]) + '</span><small>' + HG.fmtDate(a.applied_at) + '</small></div>';
        }).join('') || '<p class="empty-note">' + (q ? E(tr('stu.no_apps_match', 'Không tìm thấy đơn phù hợp với "' + q + '".', { q: q })) : E(tr('stu.no_apps_yet', 'Chưa có đơn ứng tuyển nào.'))) + '</p>');
      }

      if (recEl) {
        var appliedIds = getStudentApps().map(function (a) { return a.job_id; });
        var recJobs = (window.HG_JOBS || []).filter(function (j) {
          return appliedIds.indexOf(j.id) === -1 && (!q || matchText(j.title, q) || matchText(j.company, q) || matchText(j.location, q));
        });
        recEl.innerHTML = recJobs.slice(0, 3).map(function (j) {
          var isSaved = HG.isSaved(j.id);
          var locTxt = HG.trVal ? HG.trVal('area', j.location) : j.location;
          return '<div style="cursor:pointer;" onclick="location.href=\'job-detail.html?id=' + j.id + '\'">' +
            HG.avatar(j.company, j.logo_url, { type: 'company', className: 'company-logo' }) +
            '<div><strong>' + E(j.title) + '</strong><small>' + E(j.company) + ' · ' + E(locTxt) + '</small></div>' +
            '<b>' + E(j.salary) + '</b>' +
            '<button type="button" class="dash-save-btn' + (isSaved ? ' saved' : '') + '" data-rec-job="' + j.id + '" onclick="event.stopPropagation();">' +
              I('bookmark', 18) +
            '</button>' +
            '</div>';
        }).join('') || '<p class="empty-note">' + (q ? E(tr('stu.no_jobs_match', 'Không tìm thấy việc làm phù hợp với "' + q + '".', { q: q })) : E(tr('stu.all_jobs_applied', 'Bạn đã ứng tuyển tất cả việc làm hiện có.'))) + '</p>';
      }
    }

    if (recEl) {
      recEl.addEventListener('click', function(e) {
        var b = e.target.closest('[data-rec-job]');
        if (b) {
          e.stopPropagation();
          var jid = Number(b.dataset.recJob);
          var saved = HG.toggleSaved(jid);
          b.classList.toggle('saved', saved);
          updateStudentStats();
          renderSavedJobs();
          showToast(saved ? tr('stu.saved_fav_toast', 'Đã lưu việc làm vào mục yêu thích!') : tr('stu.unsaved_fav_toast', 'Đã bỏ lưu việc làm.'));
        }
      });
    }

    renderStudentOverview();

    /* Tab 0: Lịch tuần này */
    var weekDaysEl = $('week-days');
    function renderWeekOverview() {
      if (weekDaysEl) {
        var dow = (now.getDay() + 6) % 7, mon = new Date(now);
        mon.setDate(now.getDate() - dow);
        var dNames = [tr('day.mon', 'T2'), tr('day.tue', 'T3'), tr('day.wed', 'T4'), tr('day.thu', 'T5'), tr('day.fri', 'T6'), tr('day.sat', 'T7'), tr('day.sun', 'CN')];
        weekDaysEl.innerHTML = dNames.map(function (d, i) {
          var day = new Date(mon); day.setDate(mon.getDate() + i);
          return '<span' + (i === dow ? ' class="today"' : '') + '><small>' + E(d) + '</small><b>' + day.getDate() + '</b></span>';
        }).join('');
      }

      var secWeek = $('student-week');
      if (secWeek) {
        var todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        var ev = schedules.filter(function (s) { return s.student_id === sid && (s.start_datetime || '').slice(0, 10) >= todayStr; })
          .sort(function (a, b) { return (a.start_datetime || '').localeCompare(b.start_datetime || ''); }).slice(0, 3);
        secWeek.querySelectorAll('.event-card, .empty-note').forEach(function(el){ el.remove(); });
        after('student-week', ev.map(function (s, i) {
          return '<div class="event-card' + (i % 2 ? ' pink' : '') + '"><i></i><span><small>' + s.start_datetime.slice(8, 10) + '/' + s.start_datetime.slice(5, 7) + ' · ' +
            s.start_datetime.slice(11, 16) + ' – ' + s.end_datetime.slice(11, 16) + '</small><strong>' + E(s.title) + '</strong></span></div>';
        }).join('') || '<p class="empty-note">' + E(tr('stu.no_upcoming_sched', 'Chưa có lịch sắp tới.')) + '</p>');
      }
    }
    renderWeekOverview();

    /* TAB 1: HỒ SƠ CÁ NHÂN */
    var profAvatar = $('prof-avatar'), profDispName = $('prof-display-name'), profDispSub = $('prof-display-sub');
    var inName = $('prof-fullname'), inEmail = $('prof-email'), inPhone = $('prof-phone'), inDob = $('prof-dob'), inAddress = $('prof-address');
    var inUni = $('prof-uni'), inMajor = $('prof-major'), inBio = $('prof-bio');

    /* ---- % hoàn thiện hồ sơ: tính từ dữ liệu ĐÃ LƯU trên Backend (users + student_profiles + cvs),
       không tính chữ đang gõ dở trong form – nên chỉ thay đổi sau khi "Lưu hồ sơ", thêm/xóa kỹ năng
       (tự đồng bộ lên DB) hoặc tải lên/xóa CV. Tổng trọng số = 100. ---- */
    var COMPLETION_FIELDS = [
      { key: 'stu.comp.fullname', label: 'Họ và tên', w: 10, ok: function () { return !!String(user.full_name || '').trim(); } },
      { key: 'stu.comp.phone', label: 'Số điện thoại', w: 10, ok: function () { return !!String(user.phone || '').trim(); } },
      { key: 'stu.comp.dob', label: 'Ngày sinh', w: 10, ok: function () { return !!profile.date_of_birth; } },
      { key: 'stu.comp.address', label: 'Địa chỉ', w: 10, ok: function () { return !!String(profile.address || '').trim(); } },
      { key: 'stu.comp.uni', label: 'Trường đại học', w: 15, ok: function () { return !!String(profile.university || '').trim(); } },
      { key: 'stu.comp.major', label: 'Chuyên ngành', w: 15, ok: function () { return !!String(profile.major || '').trim(); } },
      { key: 'stu.comp.bio', label: 'Giới thiệu bản thân', w: 10, ok: function () { return !!String(profile.bio || '').trim(); } },
      { key: 'stu.comp.skills', label: 'Kỹ năng', w: 10, ok: function () {
        var list = Array.isArray(studentSkills) ? studentSkills : (HG.parseSkills ? HG.parseSkills(profile.skills) : profile.skills);
        return Array.isArray(list) && list.length > 0;
      } },
      { key: 'stu.comp.cv', label: 'CV', w: 10, ok: function () { return cvs.some(function (c) { return c && c.student_id === sid; }); } }
    ];
    HG.profileCompletion = function () {
      var pct = 0, missing = [];
      COMPLETION_FIELDS.forEach(function (f) { if (f.ok()) pct += f.w; else missing.push(tr(f.key, f.label)); });
      return { percent: Math.min(100, pct), missing: missing };
    };
    function updateProfileCompletion() {
      var r = HG.profileCompletion();
      var badge = $('prof-complete-badge'), wrap = $('prof-complete'), fill = $('prof-complete-fill'), hint = $('prof-complete-hint');
      if (badge) badge.textContent = tr('stu.prof_complete_pct', 'Hồ sơ hoàn thiện ' + r.percent + '%', { pct: r.percent });
      if (fill) fill.style.width = r.percent + '%';
      if (wrap) {
        wrap.classList.toggle('is-done', r.percent >= 100);
        var track = wrap.querySelector('[role="progressbar"]'); if (track) track.setAttribute('aria-valuenow', String(r.percent));
      }
      if (hint) hint.textContent = r.missing.length ? tr('stu.prof_missing_hint', 'Còn thiếu: ' + r.missing.join(', ') + '.', { items: r.missing.join(', ') }) : tr('stu.prof_full_hint', 'Hồ sơ đã đầy đủ – nhà tuyển dụng có thể đánh giá bạn tốt nhất.');
      /* Trạng thái tài khoản thật (users.status) thay cho nhãn cố định */
      var stBadge = $('prof-status-badge');
      if (stBadge) {
        var active = !user.status || user.status === 'active';
        stBadge.classList.toggle('prof-badge--warn', !active);
        stBadge.innerHTML = I(active ? 'check' : 'alert', 14) + '<span data-i18n="' + (active ? 'stu.account_active' : 'stu.account_locked') + '">' + E(active ? tr('stu.account_active', 'Tài khoản đã kích hoạt') : tr('stu.account_locked', 'Tài khoản đang bị khóa')) + '</span>';
      }
    }

    function syncProfileDisplay() {
      updateProfileCompletion();
      if (profAvatar) HG.setAvatar(profAvatar, user.full_name, profile.avatar_url);
      if (profDispName) profDispName.textContent = user.full_name;
      if (profDispSub) profDispSub.textContent = (profile.major || tr('nav.role.student', 'Sinh viên')) + ' · ' + (profile.university || tr('stu.uni_not_updated', 'Chưa cập nhật trường'));
      if (inName) inName.value = user.full_name || '';
      if (inEmail) inEmail.value = user.email || '';
      if (inPhone) inPhone.value = user.phone || '';
      if (inDob) inDob.value = profile.date_of_birth || '';
      if (inAddress) inAddress.value = profile.address || '';
      if (inUni) inUni.value = profile.university || '';
      if (inMajor) inMajor.value = profile.major || '';
      if (inBio) inBio.value = profile.bio || '';
    }
    syncProfileDisplay();

    /* Kỹ năng & thế mạnh: thêm (nút / Enter), chip gợi ý nhanh, xóa (×) – lưu theo sinh viên */
    var SKILL_MAX_LEN = 40, SKILL_MAX_COUNT = 20;
    var SKILL_SUGGESTIONS = ['Giao tiếp', 'Tiếng Anh', 'Tin học văn phòng', 'Làm việc nhóm', 'Pha chế', 'Bán hàng', 'Canva', 'Chăm sóc khách hàng'];
    var SKILL_SUGGEST_EN = {
      'Giao tiếp': 'Communication',
      'Tiếng Anh': 'English',
      'Tin học văn phòng': 'Office IT (Word/Excel)',
      'Làm việc nhóm': 'Teamwork',
      'Pha chế': 'Barista / Bartending',
      'Bán hàng': 'Sales',
      'Canva': 'Canva',
      'Chăm sóc khách hàng': 'Customer Service'
    };
    function skillSuggestLabel(s) {
      return (typeof window.getCurrentLang === 'function' && window.getCurrentLang() === 'en' && SKILL_SUGGEST_EN[s]) ? SKILL_SUGGEST_EN[s] : s;
    }
    /* Nguồn dữ liệu: student_profiles[].skills từ Backend (mảng; null = chưa từng lưu).
       localStorage 'hg_skills_<sid>' chỉ là bản nháp/offline; 'hg_skills_pending_<sid>' = còn thay đổi chưa gửi lên. */
    var SKILLS_CACHE = 'hg_skills_' + sid, SKILLS_PENDING = 'hg_skills_pending_' + sid;
    var parseSkills = HG.parseSkills || function (v) { return Array.isArray(v) ? v.slice() : null; };
    var skillsWrap = $('student-skills-container'), skillIn = $('new-skill-input'), skillSuggestEl = $('skill-suggestions');
    var skillsStatusEl = $('skills-sync-status');
    var skillsVersion = 0, skillsSyncing = false, skillsTimer = null;

    function profileSkillsFromServer() {
      var p = student_profiles.find(function (x) { return x.id === sid; }) || profile;
      return parseSkills(p && p.skills);
    }
    function skillsPending() { return HG.read(SKILLS_PENDING, false) === true; }
    function setSkillsPending(v) { HG.write(SKILLS_PENDING, !!v); }
    function setSkillsStatus(state) {
      if (!skillsStatusEl) return;
      var text = {
        saving: tr('stu.skill_saving', 'Đang lưu kỹ năng…'),
        saved: tr('stu.skill_saved', 'Đã lưu vào hồ sơ.'),
        offline: tr('stu.skill_offline', 'Chưa kết nối được máy chủ – kỹ năng được giữ tạm trên máy và sẽ đồng bộ khi bấm "Lưu hồ sơ" hoặc khi máy chủ hoạt động lại.'),
        error: tr('stu.skill_error', 'Chưa lưu được kỹ năng – vui lòng thử lại.')
      }[state] || '';
      skillsStatusEl.textContent = text;
      skillsStatusEl.className = 'skills-sync' + (state ? ' is-' + state : '');
    }
    function initialSkills() {
      var server = profileSkillsFromServer(), cached = parseSkills(HG.read(SKILLS_CACHE, null));
      if (skillsPending() && cached) return cached;   // còn thay đổi chưa gửi → ưu tiên bản trên máy
      if (server) return server;                     // dữ liệu thật từ database
      if (cached) { setSkillsPending(true); return cached; }  // tài khoản cũ: chuyển kỹ năng đã lưu tạm lên DB
      return [];
    }
    var studentSkills = initialSkills();

    function cleanSkill(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
    function skillKey(v) { return cleanSkill(v).toLocaleLowerCase('vi'); }
    function skillIndex(v) {
      var k = skillKey(v);
      for (var i = 0; i < studentSkills.length; i++) if (skillKey(studentSkills[i]) === k) return i;
      return -1;
    }
    /* Chip gợi ý coi như "đã chọn" khi đã có kỹ năng trùng hoặc cụ thể hơn (VD "Giao tiếp tốt" ~ "Giao tiếp") */
    function suggestionUsed(s) {
      var k = skillKey(s);
      return studentSkills.some(function (x) { var xk = skillKey(x); return xk === k || xk.indexOf(k + ' ') === 0; });
    }
    function saveSkills() {
      HG.write(SKILLS_CACHE, studentSkills);
      setSkillsPending(true);
      skillsVersion++;
      scheduleSkillsSync();
    }
    /* Tự động đồng bộ (gom các thao tác liên tiếp trong 0,7 giây thành 1 request) */
    function scheduleSkillsSync() {
      clearTimeout(skillsTimer);
      skillsTimer = setTimeout(syncSkillsNow, 700);
    }
    function syncSkillsNow() {
      if (skillsSyncing) { scheduleSkillsSync(); return; }
      if (!HG.saveStudentSkills || !skillsPending()) return;
      var version = skillsVersion;
      skillsSyncing = true;
      setSkillsStatus('saving');
      HG.saveStudentSkills(sid, studentSkills.slice()).then(function (res) {
        skillsSyncing = false;
        if (res && res.ok) {
          if (version !== skillsVersion) { scheduleSkillsSync(); return; }   // có thay đổi mới trong lúc gửi
          setSkillsPending(false);
          var saved = parseSkills(res.skills) || [];
          if (saved.join('\n') !== studentSkills.join('\n')) { studentSkills = saved; renderSkills(); }
          HG.write(SKILLS_CACHE, studentSkills);
          setSkillsStatus('saved');
        } else if (res && res.status) {
          setSkillsStatus('error');
          showToast(res.error || 'Không lưu được kỹ năng.', 'error');
        } else {
          setSkillsStatus('offline');
        }
      });
    }
    function renderSkills(flashIndex, flashClass) {
      updateProfileCompletion();
      var delTitle = tr('stu.skill_del_title', 'Xóa kỹ năng');
      if (skillsWrap) {
        skillsWrap.innerHTML = studentSkills.length
          ? studentSkills.map(function (s, i) {
              return '<span class="skill-tag' + (i === flashIndex ? ' ' + flashClass : '') + '" data-skill-index="' + i + '">' + E(s) +
                '<button type="button" data-del-skill="' + i + '" title="' + E(delTitle) + '" aria-label="' + E(delTitle + ' ' + s) + '">&times;</button></span>';
            }).join('')
          : '<p class="skills-empty" data-i18n="stu.skill_empty">' + E(tr('stu.skill_empty', 'Chưa có kỹ năng nào – hãy thêm kỹ năng hoặc chọn nhanh bên dưới.')) + '</p>';
      }
      if (skillSuggestEl) {
        var usedTitle = tr('stu.skill_already_in_list', 'Đã có trong danh sách');
        skillSuggestEl.innerHTML = '<span class="skill-suggest-label" data-i18n="stu.skill_quick_label">' + E(tr('stu.skill_quick_label', 'Gợi ý nhanh:')) + '</span>' + SKILL_SUGGESTIONS.map(function (s) {
          var used = suggestionUsed(s);
          var disp = skillSuggestLabel(s);
          return '<button type="button" class="skill-suggest-chip' + (used ? ' is-used' : '') + '" data-suggest-skill="' + E(disp) + '"' +
            (used ? ' disabled aria-pressed="true" title="' + E(usedTitle) + '"' : ' aria-pressed="false"') + '>' +
            (used ? I('check', 12) : '+') + ' ' + E(disp) + '</button>';
        }).join('');
      }
    }
    function addSkill(raw) {
      var val = cleanSkill(raw);
      if (!val) { showToast(tr('stu.skill_enter_err', 'Hãy nhập tên kỹ năng trước khi thêm.'), 'error'); if (skillIn) skillIn.focus(); return false; }
      if (val.length > SKILL_MAX_LEN) { showToast(tr('stu.skill_max_len_err', 'Tên kỹ năng tối đa ' + SKILL_MAX_LEN + ' ký tự.', { max: SKILL_MAX_LEN }), 'error'); return false; }
      var dup = skillIndex(val);
      if (dup !== -1) {
        renderSkills(dup, 'is-dup');   // nháy sáng thẻ đã có
        showToast(tr('stu.skill_dup_toast', 'Kỹ năng "' + studentSkills[dup] + '" đã có trong danh sách.', { skill: studentSkills[dup] }), 'info');
        return false;
      }
      if (studentSkills.length >= SKILL_MAX_COUNT) { showToast(tr('stu.skill_max_count_err', 'Bạn chỉ nên giữ tối đa ' + SKILL_MAX_COUNT + ' kỹ năng nổi bật nhất.', { max: SKILL_MAX_COUNT }), 'error'); return false; }
      studentSkills.push(val);
      saveSkills();
      renderSkills(studentSkills.length - 1, 'is-new');
      showToast(tr('stu.skill_added_toast', 'Đã thêm kỹ năng "' + val + '".', { skill: val }));
      return true;
    }
    function submitSkillInput() {
      if (!skillIn) return;
      if (addSkill(skillIn.value)) skillIn.value = '';
      skillIn.focus();
    }
    renderSkills();

    /* Gắn sự kiện bằng ủy quyền trên tab Hồ sơ: vẫn hoạt động khi danh sách được render lại */
    var profileView = (skillsWrap && skillsWrap.closest('.dash-view')) || document;
    profileView.addEventListener('click', function (e) {
      var del = e.target.closest('[data-del-skill]');
      if (del && skillsWrap && skillsWrap.contains(del)) {
        var idx = Number(del.dataset.delSkill), name = studentSkills[idx];
        if (name === undefined) return;
        studentSkills.splice(idx, 1);
        saveSkills();
        renderSkills();
        showToast(tr('stu.skill_removed_toast', 'Đã xóa kỹ năng "' + name + '".', { skill: name }), 'info');
        return;
      }
      var chip = e.target.closest('[data-suggest-skill]');
      if (chip && !chip.disabled) { addSkill(chip.dataset.suggestSkill); return; }
      if (e.target.closest('#add-skill-btn')) { e.preventDefault(); submitSkillInput(); }
    });
    if (skillIn) {
      /* Enter trong ô kỹ năng: thêm kỹ năng, KHÔNG gửi form hồ sơ */
      skillIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitSkillInput(); }
      });
    }
    /* Dữ liệu mới từ Backend (/api/bootstrap): nạp kỹ năng đã lưu trong DB; còn thay đổi chưa gửi → gửi lên */
    document.addEventListener('hg:synced', function () {
      if (skillsSyncing) return;
      if (skillsPending()) { scheduleSkillsSync(); return; }
      var server = profileSkillsFromServer();
      if (server && server.join('\n') !== studentSkills.join('\n')) {
        studentSkills = server;
        HG.write(SKILLS_CACHE, studentSkills);
        renderSkills();
      }
    });
    if (skillsPending()) scheduleSkillsSync();

    var profForm = $('student-profile-form');
    /* Người dùng đang sửa dở form hồ sơ -> không ghi đè ô nhập khi dữ liệu Backend đồng bộ về */
    var profDirty = false;
    if (profForm) profForm.addEventListener('input', function (e) {
      if (e.target.closest('#student-skills-container, #new-skill-input, .exp-form, #student-exp-list, [id^="exp-"]')) return;
      profDirty = true;
    });
    function refreshProfileRefs() {
      var freshU = users.find(function (x) { return x.id === user.id; });
      if (freshU) user = freshU;
      var freshP = student_profiles.find(function (x) { return x.user_id === user.id; });
      /* Không có hồ sơ trong DB thật -> hồ sơ trống của chính tài khoản (không giữ dữ liệu mẫu/cũ) */
      profile = freshP || { user_id: user.id };
      sid = freshP ? freshP.id : 0;
    }
    document.addEventListener('hg:synced', function () {
      refreshProfileRefs();
      if (profDirty) updateProfileCompletion(); else syncProfileDisplay();
    });

    if (profForm) {
      profForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var V = window.HGValidate, bad = null, msg = '';
        [[inName, 'required|fullname', 'họ và tên'], [inEmail, 'required|email', 'email'], [inPhone, 'phone', 'số điện thoại']].forEach(function (r) {
          var m = V ? V.check(r[0].value, r[1], { label: r[2] }) : '';
          r[0].classList.toggle('invalid', !!m);
          if (m && !bad) { bad = r[0]; msg = m; }
        });
        if (bad) { showToast(msg, 'error'); bad.focus(); return; }

        /* [ST4-04] Gửi thẳng lên Backend (PUT /api/students/{id}); chỉ cập nhật giao diện khi API xác nhận */
        var payload = {
          full_name: inName.value.trim(),
          email: inEmail.value.trim().toLowerCase(),
          phone: inPhone.value.trim(),
          university: inUni.value.trim(),
          major: inMajor.value.trim(),
          date_of_birth: inDob.value || null,
          address: inAddress.value.trim(),
          bio: inBio.value.trim(),
          skills: studentSkills.slice()   // mảng chuỗi – Backend tự chuyển sang JSON để lưu DB
        };
        var emailChanged = payload.email !== String(user.email || '').toLowerCase();
        var submitBtn = profForm.querySelector('[type="submit"]');
        var go = emailChanged
          ? HG.confirm({ title: tr('stu.change_email_title', 'Đổi email đăng nhập?'), message: tr('stu.change_email_msg', 'Email mới (' + payload.email + ') sẽ dùng để đăng nhập. Sau khi lưu, bạn cần đăng nhập lại bằng email mới.', { email: payload.email }), confirmText: tr('stu.save_relogin', 'Lưu & đăng nhập lại'), icon: 'mail' })
          : Promise.resolve(true);
        go.then(function (ok) {
          if (!ok) return;
          HG.busyAsync(submitBtn, function () { return HG.saveStudentProfile(sid, payload); }).then(function (res) {
            if (res && res.busy) return;
            if (!res || !res.ok) {
              var errMsg = (res && res.error) || tr('stu.profile_save_err', 'Không lưu được hồ sơ.');
              if (res && res.status === 409) { inEmail.classList.add('invalid'); inEmail.focus(); }
              showToast(errMsg, 'error');
              return;
            }
            /* Kỹ năng đã được gửi cùng hồ sơ → không còn thay đổi chờ đồng bộ (trừ khi vừa sửa thêm) */
            if (JSON.stringify(payload.skills) === JSON.stringify(studentSkills)) { clearTimeout(skillsTimer); setSkillsPending(false); setSkillsStatus('saved'); }
            /* Đồng bộ lại tham chiếu sau khi /api/bootstrap thay mảng dữ liệu */
            refreshProfileRefs();
            profDirty = false;
            syncProfileDisplay();
            var userHeaderName = document.querySelector('.user-name strong');
            if (userHeaderName) userHeaderName.textContent = user.full_name;
            if (HG.notify) HG.notify(user.id, tr('stu.profile_saved_toast', 'Hồ sơ sinh viên của bạn đã được cập nhật.'), { link: 'student.html?tab=1', kind: 'info' });
            if (emailChanged) {
              HG.flash(tr('stu.email_changed_flash', 'Đã đổi email đăng nhập thành ' + payload.email + '. Vui lòng đăng nhập lại.', { email: payload.email }), 'info');
              if (window.HGApi) window.HGApi.clearTokens();
              try { localStorage.removeItem('hg_session'); } catch (x) {}
              HG.goAuth({ mode: 'signin', role: 'student', next: 'student.html?tab=1' });
              return;
            }
            showToast(tr('stu.profile_saved_toast', 'Cập nhật hồ sơ sinh viên thành công!'));
          });
        });
      });
    }

    /* [ST4-04] Đánh giá uy tín nhận được + Khiếu nại đã gửi (dữ liệu thật từ API) */
    if (HG.rr && profForm) HG.rr.mountProfileExtras(profForm);

    /* TAB 2: CV CỦA TÔI – dữ liệu & thao tác qua API thật (GET/POST/PATCH/DELETE /api/cvs)
       File được lưu ở backend/uploads, URL trả về dạng "/uploads/cv_xxx.pdf" -> HG.resolveFileUrl() */
    function cvsFromStore() {
      return cvs.filter(function (c) { return c.student_id === sid; })
        .sort(function (a, b) { return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || b.id - a.id; });
    }
    var studentCvs = cvsFromStore();
    var cvListEl = $('student-cv-list');
    var cvLoaded = studentCvs.length > 0, cvLoadError = '';

    function cvApi(method, path, body) {
      if (!window.HGApi) return Promise.resolve({ error: 'Chưa nạp được module API.' });
      return window.HGApi.request(method, path, body, { silentError: true })
        .then(function (res) { return Object.assign({ ok: true }, res); })
        .catch(function (err) { return HG.apiFail(err, 'Máy chủ từ chối thao tác với CV.'); });
    }
    function reloadCvs() {
      return cvApi('GET', '/api/cvs?student_id=' + sid).then(function (res) {
        cvLoaded = true;
        if (res.ok) {
          cvLoadError = '';
          var list = res.cvs || [];
          /* cập nhật kho dùng chung để modal ứng tuyển / thống kê đọc đúng dữ liệu */
          for (var i = cvs.length - 1; i >= 0; i--) if (cvs[i].student_id === sid) cvs.splice(i, 1);
          list.forEach(function (c) { cvs.push(c); });
          studentCvs = cvsFromStore();
        } else {
          cvLoadError = res.error;
        }
        renderCvList();
        return res;
      });
    }

    function renderCvList() {
      updateProfileCompletion();
      if (!cvListEl) return;
      if (!cvLoaded && !studentCvs.length) { cvListEl.innerHTML = '<p class="empty-note"><span class="spinner" aria-hidden="true"></span> ' + E(tr('stu.cv_loading', 'Đang tải danh sách CV…')) + '</p>'; return; }
      var errHtml = cvLoadError ? '<div class="rr-error" role="alert">' + I('alert', 16) + '<span>' + E(cvLoadError) + '</span><button type="button" class="rr-retry" data-reload-cv>' + E(tr('stu.cv_retry', 'Thử lại')) + '</button></div>' : '';
      cvListEl.innerHTML = errHtml + (studentCvs.map(function(c) {
        var ft = String(c.file_type || '').toLowerCase(), isDoc = ft === 'docx' || ft === 'doc' || /\.docx?$/i.test(c.file_name || '');
        var url = HG.resolveFileUrl(c.file_url);
        var upText = tr('stu.cv_uploaded_on', 'Đã tải lên: ' + HG.fmtDate(c.uploaded_at) + ' · ' + (isDoc ? 'Word Document' : 'PDF'), { date: HG.fmtDate(c.uploaded_at), type: isDoc ? 'Word Document' : 'PDF' });
        return '<div class="cv-card-item">' +
          '<div class="cv-info-left">' +
            '<span class="cv-file-icon' + (isDoc ? ' docx' : '') + '">' + I('file', 22) + '</span>' +
            '<div>' +
              '<strong>' + E(c.file_name) + (c.is_default ? ' <span class="prof-badge" style="font-size:10px;padding:1px 6px;">' + E(tr('stu.cv_default_badge', 'Mặc định')) + '</span>' : '') + '</strong>' +
              '<small>' + E(upText) + '</small>' +
            '</div>' +
          '</div>' +
          '<div class="cv-actions-right">' +
            (url ? '<button type="button" class="cv-action-btn" data-preview-cv="' + c.id + '">' + I('eye', 14) + ' ' + E(tr('stu.cv_view', 'Xem')) + '</button>' : '<span class="cv-action-btn" style="cursor:default; color:#d9485f;">' + I('alert', 14) + ' ' + E(tr('stu.cv_missing_file', 'Thiếu file')) + '</span>') +
            (!c.is_default ? '<button type="button" class="cv-action-btn" data-default-cv="' + c.id + '">' + E(tr('stu.cv_set_default', 'Đặt mặc định')) + '</button>' : '') +
            '<button type="button" class="cv-action-btn danger" data-del-cv="' + c.id + '" title="' + E(tr('stu.cv_delete', 'Xóa')) + '">' + I('trash', 14) + '</button>' +
          '</div>' +
        '</div>';
      }).join('') || '<p class="empty-note">' + E(tr('stu.cv_empty', 'Bạn chưa tải lên CV nào.')) + '</p>');
    }
    renderCvList();
    reloadCvs();
    document.addEventListener('hg:synced', function () { if (cvLoaded) { studentCvs = cvsFromStore(); renderCvList(); } });

    function openCvPreview(cvItem) {
      var url = HG.resolveFileUrl(cvItem.file_url);
      var ft = String(cvItem.file_type || '').toLowerCase();
      var isPdf = ft === 'pdf' || /\.pdf($|\?)/i.test(cvItem.file_url || '');
      HG.modal.open({
        className: 'modal-preview-cv',
        html: '<div style="padding: 10px;">' +
          '<h2 style="font-size: var(--fs-h4); margin-bottom: 6px;">' + E(tr('stu.cv_preview_title', 'Xem CV: ' + cvItem.file_name, { name: cvItem.file_name })) + '</h2>' +
          '<p style="color:#7a8599; font-size: var(--fs-xs); margin-bottom: 12px; word-break: break-all;">' + E(tr('stu.cv_server_file', 'File trên máy chủ:')) + ' <a href="' + E(url) + '" target="_blank" rel="noopener">' + E(url) + '</a></p>' +
          (isPdf
            ? '<div style="position:relative; border:1px solid #e2e6f4; border-radius:12px; overflow:hidden; background:#f8f9fe;">' +
                '<iframe src="' + E(url) + '" title="CV Preview" style="width:100%; height:60vh; border:0; display:block;" data-cv-frame></iframe>' +
              '</div>'
            : '<div style="background:#f8f9fe; border:1px solid #e2e6f4; border-radius:12px; padding:24px; text-align:center; font-size:var(--fs-body-sm);">' +
                I('file', 28) + '<p style="margin:10px 0 0;">' + E(tr('stu.cv_word_no_preview', 'Trình duyệt không xem trước được file Word. Hãy tải xuống để mở bằng Microsoft Word / Google Docs.')) + '</p></div>') +
          '<p class="hint-line" data-cv-err style="color:#d9485f;" hidden></p>' +
          '<div style="margin-top: 16px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">' +
            '<a class="secondary-btn" href="' + E(url) + '" target="_blank" rel="noopener" download>' + I('download', 16) + ' ' + E(tr('stu.cv_download', 'Tải xuống')) + '</a>' +
            '<a class="secondary-btn" href="' + E(url) + '" target="_blank" rel="noopener">' + I('eye', 16) + ' ' + E(tr('stu.cv_open_tab', 'Mở tab mới')) + '</a>' +
            '<button type="button" class="primary-btn" data-close>' + E(tr('common.close', 'Đóng')) + '</button>' +
          '</div>' +
        '</div>',
        onMount: function (api) {
          /* Kiểm tra file có thực sự tồn tại trên máy chủ (tránh khung xem trống khi 404) */
          if (!window.fetch || !url) return;
          fetch(url, { method: 'HEAD' }).then(function (r) {
            if (r.ok) return;
            var errEl = api.box.querySelector('[data-cv-err]');
            if (errEl) { errEl.hidden = false; errEl.textContent = 'HTTP ' + r.status; }
          }).catch(function () {});
        }
      });
    }

    if (cvListEl) {
      cvListEl.addEventListener('click', function(e) {
        if (e.target.closest('[data-reload-cv]')) { cvLoaded = false; renderCvList(); reloadCvs(); return; }

        var defBtn = e.target.closest('[data-default-cv]');
        if (defBtn) {
          var cid = Number(defBtn.dataset.defaultCv);
          HG.busyAsync(defBtn, function () { return cvApi('PATCH', '/api/cvs/' + cid + '/default', {}); }).then(function (res) {
            if (res && res.busy) return;
            if (!res || !res.ok) { showToast((res && res.error) || 'Không đặt được CV mặc định.', 'error'); return; }
            reloadCvs().then(function () { showToast(tr('stu.cv_default_toast', 'Đã đặt làm CV ứng tuyển mặc định.')); });
          });
          return;
        }

        var delBtn = e.target.closest('[data-del-cv]');
        if (delBtn) {
          var did = Number(delBtn.dataset.delCv);
          var delItem = studentCvs.filter(function (c) { return c.id === did; })[0];
          HG.confirm({ title: tr('stu.cv_del_title', 'Xóa CV?'), message: tr('stu.cv_del_msg', 'Bạn có chắc muốn xóa "' + (delItem ? delItem.file_name : 'CV') + '"? Thao tác này không thể hoàn tác.', { name: delItem ? delItem.file_name : 'CV' }), confirmText: tr('stu.cv_del_confirm', 'Xóa CV'), danger: true, icon: 'trash' }).then(function (ok) {
            if (!ok) return;
            HG.busyAsync(delBtn, function () { return cvApi('DELETE', '/api/cvs/' + did); }).then(function (res) {
              if (res && res.busy) return;
              if (!res || !res.ok) { showToast((res && res.error) || 'Không xóa được CV.', 'error'); return; }
              reloadCvs().then(function () { showToast(tr('stu.cv_deleted_toast', 'Đã xóa CV thành công.')); });
            });
          });
          return;
        }

        var prevBtn = e.target.closest('[data-preview-cv]');
        if (prevBtn) {
          var cvItem = studentCvs.filter(function(x){ return x.id === Number(prevBtn.dataset.previewCv); })[0];
          if (cvItem) openCvPreview(cvItem);
        }
      });
    }

    var cvPicker = $('cv-file-picker');
    if (cvPicker) {
      var dropzone = cvPicker.closest('.upload-dropzone');
      cvPicker.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();
        if (['pdf', 'doc', 'docx'].indexOf(ext) === -1) { showToast(tr('stu.cv_err_type', 'CV chỉ hỗ trợ định dạng PDF, DOC hoặc DOCX.'), 'error'); cvPicker.value = ''; return; }
        if (file.size > 5 * 1024 * 1024) { showToast(tr('stu.cv_err_size', 'File CV vượt quá 5MB, hãy chọn file nhỏ hơn.'), 'error'); cvPicker.value = ''; return; }
        if (!file.size) { showToast(tr('stu.cv_err_empty', 'File CV bị rỗng, vui lòng chọn file khác.'), 'error'); cvPicker.value = ''; return; }
        if (studentCvs.length >= 5) { showToast(tr('stu.cv_err_limit', 'Bạn chỉ có thể lưu tối đa 5 CV. Hãy xóa bớt CV cũ.'), 'error'); cvPicker.value = ''; return; }
        if (!window.HGApi) { showToast('Chưa nạp được module API.', 'error'); return; }

        var dzStrong = dropzone && dropzone.querySelector('strong'), dzText = dzStrong ? dzStrong.textContent : '';
        if (dropzone) dropzone.classList.add('is-loading');
        if (dzStrong) dzStrong.innerHTML = '<span class="spinner" aria-hidden="true"></span> ' + E(tr('stu.cv_uploading', 'Đang tải lên ' + file.name + '…', { name: file.name }));
        cvPicker.disabled = true;
        window.HGApi.uploadCv(sid, file, file.name)
          .then(function (res) {
            var cv = res && res.cv;
            if (!cv || !cv.file_url) throw { status: 500, message: 'Máy chủ không trả về đường dẫn file CV.' };
            return reloadCvs().then(function () {
              showToast(tr('stu.cv_uploaded_toast', 'Đã tải lên CV: ' + cv.file_name, { name: cv.file_name }));
              if (HG.notify) HG.notify(user.id, tr('stu.cv_uploaded_toast', 'Đã tải lên CV "' + cv.file_name + '".', { name: cv.file_name }), { link: 'student.html?tab=2', kind: 'app' });
            });
          })
          .catch(function (err) { showToast(HG.apiFail(err, 'Máy chủ từ chối file CV.').error, 'error'); })
          .then(function () {
            if (dropzone) dropzone.classList.remove('is-loading');
            if (dzStrong) dzStrong.textContent = dzText;
            cvPicker.disabled = false; cvPicker.value = '';
          });
      });
    }

    /* TAB 3: VIỆC ĐÃ LƯU & ĐÃ XEM GẦN ĐÂY – dữ liệu localStorage qua HG.savedJobs (js/saved-jobs.js)
       hourglass_saved_jobs (lưu/bỏ lưu) · hourglass_recent_jobs (10 tin mở gần nhất ở job-detail.html) */
    var savedContainer = $('saved-jobs-container');
    var savedTabs = $('saved-list-tabs'), clearAllBtn = $('saved-clear-all');
    var SJ = HG.savedJobs;
    var savedListMode = new URLSearchParams(location.search).get('list') === 'recent' ? 'recent' : 'saved';

    /* Gộp thông tin mới nhất của tin (nếu còn trong hệ thống) với ảnh chụp đã lưu */
    function savedEntryView(entry) {
      var raw = jobs.find(function (x) { return x.id === entry.id; });
      var live = raw ? HG.toJob(raw) : null;
      var rawSal = (live && live.salary) || entry.salary || tr('common.Negotiable', 'Thỏa thuận');
      var v = {
        id: entry.id,
        title: (live && live.title) || entry.title || tr('rep.target.job_fmt', 'Tin #' + entry.id, { id: entry.id }),
        company: (live && live.company) || entry.company || tr('common.suggest_employer', 'Nhà tuyển dụng'),
        location: (live && live.location) || entry.location || '',
        salary: HG.translateSalaryText ? HG.translateSalaryText(rawSal) : rawSal,
        logo: (live && live.logo) || entry.logo || (entry.company || 'H').charAt(0),
        color: (live && live.color) || entry.color || '#4f7dff',
        logo_url: (live && live.logo_url) || '',
        status: raw ? raw.status : 'missing',
        when: entry.saved_at || entry.viewed_at
      };
      var app = getStudentApps().filter(function (a) { return a.job_id === entry.id && statusName(a.status_id) !== 'withdrawn'; })[0];
      v.applied = !!app;
      v.open = v.status === 'approved';
      return v;
    }

    function savedEmpty(icon, bg, color, title, text, action) {
      return '<div style="background: #fff; border: 1px solid #e9edf8; border-radius: 18px; padding: 40px; text-align: center;">' +
        '<span style="width: 54px; height: 54px; border-radius: 50%; background: ' + bg + '; color: ' + color + '; display: grid; place-items: center; margin: 0 auto 14px;">' + I(icon, 26) + '</span>' +
        '<h3>' + title + '</h3>' +
        '<p style="color: #7b8599; font-size: var(--fs-body-sm); margin: 6px auto 18px; max-width: 440px;">' + text + '</p>' + (action || '') +
        '</div>';
    }

    function paintSavedTabs(nSaved, nRecent) {
      if (savedTabs) {
        savedTabs.querySelectorAll('[data-saved-list]').forEach(function (b) {
          var k = b.dataset.savedList, on = k === savedListMode;
          var key = k === 'saved' ? 'stu.tab_saved_list' : 'stu.tab_recent_list';
          var base = tr(key, k === 'saved' ? 'Việc làm đã lưu' : 'Đã xem gần đây');
          b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
          b.innerHTML = E(base) + ' <span class="pill-count">' + (k === 'saved' ? nSaved : nRecent) + '</span>';
        });
      }
      if (clearAllBtn) {
        var n = savedListMode === 'saved' ? nSaved : nRecent;
        clearAllBtn.disabled = !n;
        clearAllBtn.style.opacity = n ? '' : '.5';
        clearAllBtn.querySelector('span').textContent = savedListMode === 'saved' ? tr('stu.unsave_all', 'Bỏ lưu tất cả') : tr('stu.clear_history', 'Xóa lịch sử xem');
      }
    }

    function renderSavedJobs() {
      if (!savedContainer || !SJ) return;
      var savedEntries = SJ.list(), recentEntries = SJ.recent();
      paintSavedTabs(savedEntries.length, recentEntries.length);
      var isRecent = savedListMode === 'recent';
      var entries = isRecent ? recentEntries : savedEntries;
      var q = globalSearchQuery;

      if (!entries.length) {
        savedContainer.innerHTML = isRecent
          ? savedEmpty('eye', '#f0f4ff', '#4f7dff', tr('stu.recent_empty_title', 'Bạn chưa xem tin tuyển dụng nào gần đây'), tr('stu.recent_empty_desc', 'Mỗi khi bạn mở trang chi tiết một công việc, tin đó sẽ tự động xuất hiện ở đây (tối đa 10 tin gần nhất).'), '<a class="primary-btn" href="jobs.html">' + E(tr('stu.view_jobs_now', 'Xem việc làm ngay')) + ' ' + I('arrow') + '</a>')
          : savedEmpty('bookmark', '#fff0f7', '#ff6fae', tr('stu.saved_empty_title', 'Chưa có việc làm nào được lưu'), tr('stu.saved_empty_desc', 'Nhấn biểu tượng bookmark trên thẻ công việc hoặc nút "Lưu tin" ở trang chi tiết để xem lại và ứng tuyển bất cứ lúc nào.'), '<a class="primary-btn" href="jobs.html">' + E(tr('stu.explore_jobs_now', 'Khám phá việc làm ngay')) + ' ' + I('arrow') + '</a>');
        return;
      }

      var views = entries.map(savedEntryView).filter(function (v) {
        return !q || matchText(v.title, q) || matchText(v.company, q) || matchText(v.location, q);
      });
      if (!views.length) {
        savedContainer.innerHTML = savedEmpty('search', '#f0f4ff', '#4f7dff', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), '<strong>' + E(q) + '</strong>');
        return;
      }

      savedContainer.innerHTML = views.map(function (v) {
        var whenTs = Date.parse(v.when || '');
        var agoStr = isNaN(whenTs) ? '' : HG.timeAgo(whenTs).toLowerCase();
        var whenTxt = !agoStr ? '' : (isRecent ? tr('stu.viewed_ago', 'Đã xem ' + agoStr, { time: agoStr }) : tr('stu.saved_ago', 'Đã lưu ' + agoStr, { time: agoStr }));
        var note = !v.open
          ? '<span class="status rejected" style="font-size:11px; padding:2px 8px; margin-left:6px;">' + E(v.status === 'expired' ? tr('stu.job_expired', 'Hết hạn') : v.status === 'missing' ? tr('stu.job_removed', 'Đã gỡ') : tr('stu.job_paused', 'Tạm ngưng tuyển')) + '</span>'
          : (v.applied ? '<span class="status accepted" style="font-size:11px; padding:2px 8px; margin-left:6px;">' + E(tr('stu.job_applied_badge', 'Đã ứng tuyển')) + '</span>' : '');
        var applyBtn = v.applied
          ? '<a class="secondary-btn small" href="student.html?tab=4" data-goto-apps>' + I('check', 14) + ' ' + E(tr('stu.view_app_btn', 'Xem đơn')) + '</a>'
          : (v.open
            ? '<button type="button" class="primary-btn small" data-apply-job="' + v.id + '">' + E(tr('stu.apply_short', 'Ứng tuyển')) + '</button>'
            : '<button type="button" class="primary-btn small" disabled style="opacity:.5; cursor:not-allowed;">' + E(tr('stu.apply_short', 'Ứng tuyển')) + '</button>');
        var quick = isRecent
          ? '<button type="button" class="dash-save-btn' + (HG.isSaved(v.id) ? ' saved' : '') + '" data-save-job="' + v.id + '">' + I('bookmark', 18) + '</button>' +
            '<button type="button" class="secondary-btn small" data-remove-recent="' + v.id + '">' + I('x', 14) + ' ' + E(tr('stu.remove_short', 'Xóa')) + '</button>'
          : '<button type="button" class="secondary-btn small" data-unsave-job="' + v.id + '">' + I('trash', 14) + ' ' + E(tr('stu.unsave_btn', 'Bỏ lưu')) + '</button>';
        var locTxt = HG.trVal ? HG.trVal('area', v.location) : v.location;
        return '<div class="saved-job-card" data-saved-card="' + v.id + '">' +
          '<div class="saved-job-info">' +
            HG.avatar(v.company, v.logo_url, { type: 'company', className: 'company-logo', style: 'width: 44px; height: 44px; font-size: 16px;' }) +
            '<div>' +
              '<h3 style="font-size: var(--fs-body); margin-bottom: 4px;"><a href="job-detail.html?id=' + v.id + '">' + E(v.title) + '</a>' + note + '</h3>' +
              '<p style="color: #707a92; font-size: var(--fs-xs); margin: 0;">' + E(v.company) + (locTxt ? ' · ' + E(locTxt) : '') + ' · <strong>' + E(v.salary) + '</strong></p>' +
              (whenTxt ? '<small style="color:#9aa3b8; font-size:11px;">' + I('clock', 12) + ' ' + E(whenTxt) + '</small>' : '') +
            '</div>' +
          '</div>' +
          '<div class="saved-job-actions">' + applyBtn + quick + '</div>' +
        '</div>';
      }).join('');
    }
    renderSavedJobs();

    if (savedTabs) {
      savedTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-saved-list]'); if (!b) return;
        savedListMode = b.dataset.savedList;
        renderSavedJobs();
      });
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function () {
        var isRecent = savedListMode === 'recent';
        var n = isRecent ? SJ.recent().length : SJ.list().length;
        if (!n) return;
        HG.confirm({
          title: isRecent ? tr('stu.clear_recent_title', 'Xóa lịch sử xem?') : tr('stu.clear_saved_title', 'Bỏ lưu tất cả?'),
          message: isRecent ? tr('stu.clear_recent_msg', 'Toàn bộ ' + n + ' tin đã xem gần đây sẽ bị xóa khỏi danh sách.', { n: n }) : tr('stu.clear_saved_msg', 'Bạn có chắc muốn bỏ lưu ' + n + ' việc làm đã lưu không?', { n: n }),
          confirmText: isRecent ? tr('stu.clear_history', 'Xóa lịch sử') : tr('stu.unsave_all', 'Bỏ lưu tất cả'), danger: true, icon: 'trash'
        }).then(function (ok) {
          if (!ok) return;
          if (isRecent) SJ.clearRecent();
          else SJ.ids().forEach(function (jid) { HG.toggleSaved(jid); });   /* qua HG.toggleSaved để đồng bộ cả Backend */
          updateStudentStats(); renderSavedJobs();
          showToast(isRecent ? tr('stu.cleared_recent_toast', 'Đã xóa lịch sử xem gần đây.') : tr('stu.cleared_saved_toast', 'Đã bỏ lưu tất cả việc làm.'), 'info');
        });
      });
    }

    if (savedContainer) {
      savedContainer.addEventListener('click', function(e) {
        var ap = e.target.closest('[data-apply-job]');
        if (ap) { HG.openModal('apply', Number(ap.dataset.applyJob)); return; }

        var un = e.target.closest('[data-unsave-job]');
        if (un) {
          var uid = Number(un.dataset.unsaveJob);
          if (HG.isSaved(uid)) HG.toggleSaved(uid);
          updateStudentStats(); renderSavedJobs();
          showToast(tr('stu.unsaved_one_toast', 'Đã bỏ lưu tin.'), 'info');
          return;
        }

        var rr = e.target.closest('[data-remove-recent]');
        if (rr) {
          SJ.removeRecent(Number(rr.dataset.removeRecent));
          renderSavedJobs();
          showToast(tr('stu.removed_recent_toast', 'Đã xóa khỏi lịch sử xem.'), 'info');
          return;
        }

        var sv = e.target.closest('[data-save-job]');
        if (sv) {
          var nowSaved = HG.toggleSaved(Number(sv.dataset.saveJob));
          updateStudentStats(); renderSavedJobs();
          showToast(nowSaved ? tr('stu.saved_one_toast', 'Đã lưu tin vào "Việc làm đã lưu".') : tr('stu.unsaved_one_toast', 'Đã bỏ lưu tin.'), nowSaved ? 'success' : 'info');
        }
      });
    }

    /* Đồng bộ tức thời khi lưu/bỏ lưu/xem tin ở trang khác hoặc tab trình duyệt khác, và sau khi ứng tuyển */
    var savedRefreshT = null;
    function scheduleSavedRefresh() {
      clearTimeout(savedRefreshT);
      savedRefreshT = setTimeout(function () { updateStudentStats(); renderSavedJobs(); renderStudentOverview(); }, 60);
    }
    document.addEventListener('hg:saved-change', scheduleSavedRefresh);
    document.addEventListener('hg:synced', scheduleSavedRefresh);

    /* TAB 4: ĐƠN ỨNG TUYỂN – tab theo nhóm trạng thái, hủy đơn khi nhà tuyển dụng chưa xử lý, cập nhật tức thời */
    var fullAppsEl = $('student-apps-full');
    var activeAppFilter = 'all';
    var APP_GROUPS = {
      pending: ['submitted'], received: ['reviewing', 'interview'], accepted: ['accepted'], rejected: ['rejected']
    };
    var APP_LABEL = {
      submitted: ['Đang chờ duyệt', 'pending'], reviewing: ['Đã tiếp nhận', 'reviewing'], interview: ['Mời phỏng vấn', 'interview'],
      accepted: ['Đã trúng tuyển', 'accepted'], rejected: ['Bị từ chối', 'rejected'], withdrawn: ['Bạn đã hủy đơn', 'rejected']
    };

    function getAppLabelPair(stName) {
      var map = {
        submitted: [tr('stu.st.pending_review', 'Đang chờ duyệt'), 'pending'],
        reviewing: [tr('stu.st.received', 'Đã tiếp nhận'), 'reviewing'],
        interview: [tr('stu.st.interview', 'Mời phỏng vấn'), 'interview'],
        accepted: [tr('stu.st.accepted', 'Đã trúng tuyển'), 'accepted'],
        rejected: [tr('stu.st.rejected', 'Bị từ chối'), 'rejected'],
        withdrawn: [tr('stu.st.withdrawn', 'Bạn đã hủy đơn'), 'rejected']
      };
      return map[stName] || map.submitted;
    }

    function renderAppPills() {
      var apps = getStudentApps(), tabs = $('app-filter-tabs'); if (!tabs) return;
      var pillKeyMap = {
        all: 'stu.app_filter_all',
        pending: 'stu.app_filter_pending',
        received: 'stu.app_filter_received',
        accepted: 'stu.app_filter_accepted',
        rejected: 'stu.app_filter_rejected'
      };
      tabs.querySelectorAll('[data-app-filter]').forEach(function (b) {
        var k = b.dataset.appFilter;
        var n = k === 'all' ? apps.length : apps.filter(function (a) { return APP_GROUPS[k].indexOf(statusName(a.status_id)) !== -1; }).length;
        var base = tr(pillKeyMap[k], b.dataset.label || (b.dataset.label = b.textContent.replace(/\s*\(\d+\)$/, '')));
        b.innerHTML = E(base) + ' <span class="pill-count">' + n + '</span>';
      });
    }

    function renderFullApps() {
      if (!fullAppsEl) return;
      renderAppPills();
      var apps = getStudentApps();
      var q = globalSearchQuery;
      var filtered = apps.filter(function (a) {
        var matchGroup = activeAppFilter === 'all' || APP_GROUPS[activeAppFilter].indexOf(statusName(a.status_id)) !== -1;
        if (!matchGroup) return false;
        if (!q) return true;
        var j = jobOf(a), c = companyOf(j), stName = statusName(a.status_id), st = getAppLabelPair(stName);
        return matchText(j.title, q) || matchText(c.company_name, q) || matchText(st[0], q) || matchText(stName, q);
      });

      if (!apps.length) {
        fullAppsEl.innerHTML = HG.empty('file', tr('stu.apps_empty_title', 'Chưa có đơn ứng tuyển nào'), tr('stu.apps_empty_desc', 'Hãy tìm công việc phù hợp với lịch học của bạn và ứng tuyển chỉ với vài bước.'), '<a class="primary-btn small" href="jobs.html">' + E(tr('home.search_btn', 'Tìm việc ngay')) + '</a>');
        return;
      }
      if (!filtered.length) {
        if (q) {
          fullAppsEl.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), E(q));
        } else {
          fullAppsEl.innerHTML = HG.empty('file', tr('stu.apps_group_empty_title', 'Không có đơn nào ở nhóm này'), tr('stu.apps_group_empty_desc', 'Thử chọn tab khác để xem các đơn ứng tuyển còn lại.'));
        }
        return;
      }

      fullAppsEl.innerHTML = filtered.map(function (a) {
        var j = jobOf(a), c = companyOf(j), stName = statusName(a.status_id), st = getAppLabelPair(stName);
        var canCancel = stName === 'submitted';          /* nhà tuyển dụng chưa xử lý */
        var extra = '';
        if (stName === 'interview' && a.interview_at) extra = '<div class="app-note ok">' + I('calendar', 14) + ' ' + E(tr('stu.interview_at', 'Lịch phỏng vấn: ' + String(a.interview_at).replace('T', ' '), { time: String(a.interview_at).replace('T', ' ') })) + '</div>';
        if (stName === 'rejected' && a.status_reason) extra = '<div class="app-note bad">' + I('alert', 14) + ' ' + E(tr('stu.reason_prefix', 'Lý do: ' + a.status_reason, { reason: a.status_reason })) + '</div>';

        return '<div class="app-card-detailed">' +
          '<div class="app-detailed-main">' +
            HG.avatar(c.company_name, c.logo_url, { type: 'company', className: 'company-logo', style: 'width: 44px; height: 44px;' }) +
            '<div>' +
              '<h3 style="font-size: var(--fs-body); margin-bottom: 4px;"><a href="job-detail.html?id=' + j.id + '">' + E(j.title) + '</a></h3>' +
              '<p style="color: #6a748c; font-size: var(--fs-xs); margin: 0;">' + E(c.company_name) + ' · ' + E(tr('stu.applied_on', 'Ngày nộp: ' + HG.fmtDate(a.applied_at), { date: HG.fmtDate(a.applied_at) })) + '</p>' + extra +
            '</div>' +
          '</div>' +
          '<div class="app-detailed-status">' +
            '<span class="status ' + st[1] + '" style="font-size: 13px; padding: 4px 12px;">' + E(st[0]) + '</span>' +
            '<div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; justify-content: flex-end;">' +
              '<a class="cv-action-btn" href="job-detail.html?id=' + j.id + '">' + I('eye', 14) + ' ' + E(tr('stu.view_job_btn', 'Xem tin')) + '</a>' +
              (canCancel ? '<button type="button" class="cv-action-btn danger" data-withdraw-app="' + a.id + '">' + E(tr('stu.withdraw_btn', 'Hủy đơn')) + '</button>' : '') +
              /* [ST4-04] Đánh giá nhà tuyển dụng sau khi trúng tuyển + Khiếu nại (API thật) */
              (stName === 'accepted' && c.user_id
                ? (HG.hasReviewed && HG.hasReviewed(c.user_id, j.id)
                  ? '<span class="cv-action-btn" style="cursor:default; color:#2ba788;">' + I('check', 14) + ' ' + E(tr('stu.reviewed_badge', 'Đã đánh giá')) + '</span>'
                  : '<button type="button" class="cv-action-btn ok" data-review-emp="' + a.id + '">' + E(tr('stu.review_emp_btn', '★ Đánh giá NTD')) + '</button>')
                : '') +
              '<button type="button" class="cv-action-btn" data-report-app="' + a.id + '">' + I('shield', 14) + ' ' + E(tr('stu.report_btn', 'Khiếu nại')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    renderFullApps();

    var appFilterTabs = $('app-filter-tabs');
    if (appFilterTabs) {
      appFilterTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-app-filter]');
        if (b) {
          appFilterTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); });
          b.classList.add('active');
          activeAppFilter = b.dataset.appFilter;
          renderFullApps();
        }
      });
    }

    if (fullAppsEl) {
      fullAppsEl.addEventListener('click', function (e) {
        var rvBtn = e.target.closest('[data-review-emp]'), rpBtn = e.target.closest('[data-report-app]');
        if (rvBtn || rpBtn) {
          var ra = HG.applications().filter(function (x) { return x.id === Number((rvBtn || rpBtn).dataset[rvBtn ? 'reviewEmp' : 'reportApp']); })[0];
          if (!ra || !HG.rr) return;
          var rj = jobOf(ra), rc = companyOf(rj);
          if (rvBtn) {
            HG.rr.openReviewModal({ targetUserId: rc.user_id, targetName: rc.company_name, jobId: rj.id, jobTitle: rj.title, onDone: renderFullApps });
          } else {
            HG.rr.openReportModal({ targets: [
              { type: 'job', targetId: rj.id, label: rj.title },
              { type: 'employer', targetId: rc.id, label: rc.company_name }
            ] });
          }
          return;
        }
        var wBtn = e.target.closest('[data-withdraw-app]');
        if (!wBtn) return;
        var aid = Number(wBtn.dataset.withdrawApp);
        var cur = HG.applications().filter(function (x) { return x.id === aid; })[0];
        if (!cur || statusName(cur.status_id) !== 'submitted') {
          showToast(tr('stu.withdraw_processed_err', 'Nhà tuyển dụng đã xử lý đơn này nên không thể hủy nữa.'), 'error'); renderFullApps(); return;
        }
        HG.confirm({
          title: tr('stu.withdraw_title', 'Hủy đơn ứng tuyển?'),
          message: tr('stu.withdraw_msg', 'Bạn có chắc chắn muốn hủy hồ sơ ứng tuyển vị trí này không? Thao tác này không thể hoàn tác.'),
          confirmText: tr('stu.withdraw_btn', 'Hủy đơn'),
          cancelText: tr('stu.keep_btn', 'Giữ lại'),
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          var latest = HG.applications().filter(function (x) { return x.id === aid; })[0];
          if (!latest || statusName(latest.status_id) !== 'submitted') {
            showToast(tr('stu.withdraw_processed_err', 'Nhà tuyển dụng vừa xử lý đơn này nên không thể hủy nữa.'), 'error'); renderFullApps(); return;
          }
          HG.busy(wBtn, function () {
            HG.setAppStatus(aid, 6, { by: 'student' });
            updateStudentStats(); renderFullApps();
            showToast(tr('stu.withdrawn_toast', 'Đã hủy đơn ứng tuyển.'));
          }, 700);
        });
      });
    }

    /* Cập nhật gần thời gian thực khi nhà tuyển dụng đổi trạng thái (tab khác / cùng trình duyệt) */
    function refreshApps() { updateStudentStats(); renderFullApps(); }
    window.addEventListener('storage', function (e) { if (e.key === 'hg_app_patches' || e.key === 'hg_apps') refreshApps(); });
    document.addEventListener('hg:notify', refreshApps);

    /* TAB 5: LỊCH TUẦN & ĐĂNG KÝ CA RẢNH */
    var calWeekEl = $('calendar-week-grid');
    function renderCalendarWeek() {
      if (!calWeekEl) return;
      var q = globalSearchQuery;
      var dow = (now.getDay() + 6) % 7, mon = new Date(now);
      mon.setDate(now.getDate() - dow);
      var days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
      var studentScheds = schedules.filter(function (s) { return s.student_id === sid; });
      var totalMatched = 0;

      calWeekEl.innerHTML = days.map(function(dName, i) {
        var dObj = new Date(mon); dObj.setDate(mon.getDate() + i);
        var dStr = dObj.getFullYear() + '-' + pad(dObj.getMonth() + 1) + '-' + pad(dObj.getDate());
        var isToday = (i === dow);
        var dayEvents = studentScheds.filter(function(s) {
          var matchDay = (s.start_datetime || '').slice(0, 10) === dStr;
          if (!matchDay) return false;
          if (!q) return true;
          return matchText(s.title, q) || matchText(s.note || '', q);
        });
        totalMatched += dayEvents.length;

        var evHtml = dayEvents.map(function(s) {
          return '<div class="cal-shift-badge' + (s.job_id ? '' : ' interview') + '">' +
            '<strong>' + s.start_datetime.slice(11, 16) + '</strong> ' + E(s.title) +
            '</div>';
        }).join('');

        return '<div class="calendar-day-col' + (isToday ? ' is-today' : '') + '">' +
          '<div class="cal-day-head">' +
            '<strong>' + dName + '</strong>' +
            '<b>' + dObj.getDate() + '/' + (dObj.getMonth() + 1) + '</b>' +
          '</div>' +
          (evHtml || '<div style="color: #b0b8c9; font-size: 11px; text-align: center; margin-top: 18px;">Trống ca</div>') +
        '</div>';
      }).join('');

      var oldEmptyNote = $('cal-search-empty-note');
      if (oldEmptyNote) oldEmptyNote.remove();

      if (q && totalMatched === 0) {
        var note = document.createElement('div');
        note.id = 'cal-search-empty-note';
        note.style.background = '#fff8e6';
        note.style.color = '#9a6700';
        note.style.border = '1px solid #ffeaa7';
        note.style.borderRadius = '12px';
        note.style.padding = '12px 16px';
        note.style.marginBottom = '16px';
        note.style.fontSize = 'var(--fs-body-sm)';
        note.innerHTML = I('search', 16) + ' <span>Không tìm thấy ca làm việc hoặc lịch hẹn nào phù hợp với từ khóa "<strong>' + E(q) + '</strong>".</span>';
        calWeekEl.parentNode.insertBefore(note, calWeekEl);
      }
    }
    renderCalendarWeek();

    /* Định tuyến lọc theo Tab cho Sinh viên */
    dispatchRoleSearch = function (q) {
      if (q && [1, 2, 6].indexOf(currentActiveTab) !== -1) {
        showTab(3);
        return;
      }
      if (currentActiveTab === 0) {
        renderStudentOverview(q);
      } else if (currentActiveTab === 3) {
        renderSavedJobs();
      } else if (currentActiveTab === 4) {
        renderFullApps();
      } else if (currentActiveTab === 5) {
        renderCalendarWeek();
      }
    };

    /* Bảng ca rảnh – đọc/ghi bảng availabilities của Backend qua adapter.js */
    var availTbody = $('avail-tbody');
    var availDirty = false;   /* người dùng đang sửa dở -> không ghi đè khi đồng bộ */
    var AVAIL_ROWS = [
      { key: 'morning', i18n: 'stu.avail_morning', label: 'Ca sáng (08:00 – 12:00)' },
      { key: 'afternoon', i18n: 'stu.avail_afternoon', label: 'Ca chiều (13:00 – 17:00)' },
      { key: 'evening', i18n: 'stu.avail_evening', label: 'Ca tối (17:30 – 22:00)' }
    ];
    function currentAvailGrid() {
      return HG.availabilityGrid ? HG.availabilityGrid(sid) : HG.read('hg_avail_' + sid, {});
    }
    function renderAvailTable() {
      if (!availTbody) return;
      var studentAvail = currentAvailGrid() || {};
      availTbody.innerHTML = AVAIL_ROWS.map(function(shift) {
        var cells = [0, 1, 2, 3, 4, 5, 6].map(function(dIdx) {
          var checked = studentAvail[shift.key] && studentAvail[shift.key][dIdx];
          return '<td><input type="checkbox" class="avail-check-box" data-shift="' + shift.key + '" data-day="' + dIdx + '"' + (checked ? ' checked' : '') + '></td>';
        }).join('');
        return '<tr><td><strong data-i18n="' + shift.i18n + '">' + E(tr(shift.i18n, shift.label)) + '</strong></td>' + cells + '</tr>';
      }).join('');
    }
    renderAvailTable();
    if (availTbody) availTbody.addEventListener('change', function (e) { if (e.target.matches('.avail-check-box')) availDirty = true; });

    var saveAvailBtn = $('save-avail-btn');
    if (saveAvailBtn) {
      saveAvailBtn.addEventListener('click', function() {
        var newAvail = { morning: [], afternoon: [], evening: [] };
        ['morning', 'afternoon', 'evening'].forEach(function(key) {
          for (var i = 0; i < 7; i++) {
            var cb = document.querySelector('input.avail-check-box[data-shift="' + key + '"][data-day="' + i + '"]');
            newAvail[key].push(cb ? cb.checked : false);
          }
        });
        if (!HG.saveAvailability) { HG.write('hg_avail_' + sid, newAvail); showToast('Đã lưu thời gian rảnh thành công!'); return; }
        saveAvailBtn.disabled = true;
        HG.saveAvailability(sid, newAvail).then(function (res) {
          saveAvailBtn.disabled = false;
          if (res && res.error) { showToast(res.error, 'error'); return; }
          availDirty = false;
          showToast(res && res.offline
            ? 'Đã lưu tạm lịch rảnh trên trình duyệt. Hệ thống sẽ cần kết nối máy chủ để đồng bộ.'
            : 'Đã lưu thời gian rảnh thành công!', res && res.offline ? 'info' : 'success');
          if (!(res && res.offline)) renderAvailTable();
        });
      });
    }

    document.addEventListener('hg:synced', function () {
      if (!availDirty) renderAvailTable();
      updateStudentStats();
      renderSavedJobs();
      renderFullApps();
      renderCalendarWeek();
      renderStudentOverview();
    });
    window.addEventListener('languageChanged', function () {
      updateTodayHeading();
      updateStudentStats();
      renderStudentOverview();
      renderWeekOverview();
      updateProfileCompletion();
      if (!profDirty) syncProfileDisplay();
      renderSkills();
      renderCvList();
      renderSavedJobs();
      renderFullApps();
      if (!availDirty) renderAvailTable();
    });

    /* TAB 6: CÀI ĐẶT */
    var pwForm = $('pw-form');
    if (pwForm) {
      pwForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var ins = pwForm.querySelectorAll('input[type=password]');
        [].forEach.call(ins, function (i) { i.classList.remove('invalid'); });
        var r = HG.changePassword(ins[0].value, ins[1].value, ins[2].value);
        if (r.error) { ins[r.field].classList.add('invalid'); ins[r.field].focus(); showToast(r.error, 'error'); return; }
        showToast('Đã đổi mật khẩu thành công! Lần đăng nhập sau hãy dùng mật khẩu mới.');
        pwForm.reset();
      });
    }
    var prefForm = $('pref-form');
    if (prefForm) {
      prefForm.addEventListener('submit', function(e) {
        e.preventDefault();
        showToast('Đã lưu tùy chọn thông báo & bảo mật!');
      });
    }
  }

  /* =========================================================
     2. NHÀ TUYỂN DỤNG (EMPLOYER)
     ========================================================= */
  if (role === 'employer') {
    /* Không "mượn" hồ sơ doanh nghiệp đầu danh sách: tài khoản chưa có hồ sơ chỉ thấy dữ liệu trống của chính mình */
    emp = employer_profiles.filter(function (e) { return e.user_id === user.id; })[0] || { id: null, user_id: user.id, company_name: user.full_name || 'Doanh nghiệp' };
    var compEl = document.querySelector('[data-company]');
    if (compEl) compEl.textContent = emp.company_name;

    function getJobStatusPair(statusKey) {
      var map = {
        draft: [tr('emp.jst.draft', 'Bản nháp'), 'draft'],
        pending: [tr('emp.jst.pending', 'Chờ kiểm duyệt'), 'pending'],
        approved: [tr('emp.jst.approved', 'Đã đăng'), 'accepted'],
        expired: [tr('emp.jst.expired', 'Hết hạn'), 'expired'],
        rejected: [tr('emp.jst.rejected', 'Bị từ chối'), 'rejected'],
        locked: [tr('emp.jst.locked', 'Bị khóa'), 'rejected']
      };
      return map[statusKey] || map.approved;
    }

    var getOwnJobs = function () {
      if (!emp.id) return [];   /* chưa có hồ sơ doanh nghiệp -> không có tin nào (tránh khớp các tin employer_id = null) */
      return JOBS.filter(function (j) { return j.employer_id === emp.id; });
    };

    var getOwnApps = function () {
      var jobIds = getOwnJobs().map(function (j) { return j.id; });
      return HG.applications().filter(function (a) { return jobIds.indexOf(a.job_id) !== -1; })
        .sort(function (a, b) { return (b.applied_at || '').localeCompare(a.applied_at || ''); });
    };

    var renderEmployerOverview = function (q) {
      q = q || globalSearchQuery;
      var own = getOwnJobs();
      var apps = getOwnApps();

      setStat('jobs', own.length, tr('emp.stat_jobs_sub', 'Tin đã đăng'));
      setStat('applicants', apps.length, tr('emp.stat_applicants_sub', 'Tổng số đơn nhận được'));
      setStat('active', own.filter(function (j) { return j.status === 'approved'; }).length, tr('emp.stat_active_sub', 'Đang hiển thị'));
      setStat('new', apps.filter(function (a) { return statusName(a.status_id) === 'submitted'; }).length, tr('emp.stat_new_sub', 'Cần xem xét'));

      /* KPI thật: lấy từ API GET /api/employer/{id}/statistics (ghi đè số tính tạm từ bộ nhớ) */
      if (emp && HG.loadEmployerKpi) {
        HG.loadEmployerKpi(emp.id).then(function (k) {
          if (!k) return;
          setStat('jobs', k.jobs.total, tr('emp.stat_jobs_sub', 'Tin đã đăng'));
          setStat('applicants', k.applications.total, tr('emp.stat_applicants_sub', 'Tổng số đơn nhận được'));
          setStat('active', k.jobs.approved, tr('emp.stat_active_sub', 'Đang hiển thị'));
          setStat('new', k.applications.new, tr('emp.stat_new_sub', 'Cần xem xét'));
          var host = document.querySelector('[data-stat="jobs"]');
          if (host && host.closest('div')) host.closest('div').parentNode.setAttribute('data-kpi-source', 'api');
        });
      }

      /* Ứng viên mới ở Tab 0 */
      var secCands = $('employer-cands');
      if (secCands) {
        secCands.querySelectorAll('.candidate, .empty-note').forEach(function (n) { n.remove(); });
        var filteredApps = apps.filter(function (a) {
          if (!q) return true;
          var sp = byId(student_profiles, a.student_id) || { user_id: 1 }, u = byId(users, sp.user_id) || { full_name: 'Ứng viên' };
          var j = jobOf(a);
          return matchText(u.full_name, q) || matchText(j.title, q);
        });
        after('employer-cands', filteredApps.slice(0, 3).map(function (a) {
          var sp = byId(student_profiles, a.student_id) || { user_id: 1 }, u = byId(users, sp.user_id) || { full_name: 'Ứng viên' };
          return '<div class="candidate">' + HG.avatar(u.full_name, sp.avatar_url) +
            '<div><strong>' + E(u.full_name) + '</strong><small>' + E(jobOf(a).title) + '</small></div>' +
            '<button type="button" data-view-cand="' + a.id + '">' + E(tr('emp.view_profile_btn', 'Xem hồ sơ')) + '</button></div>';
        }).join('') || '<p class="empty-note">' + (q ? E(tr('emp.no_cands_match', 'Không tìm thấy ứng viên phù hợp với "' + q + '".', { q: q })) : E(tr('emp.no_cands_yet', 'Chưa có ứng viên nào.'))) + '</p>');
      }

      /* Bảng tóm tắt việc làm ở Tab 0 */
      var rowsEl = $('employer-rows');
      if (rowsEl) {
        var filteredJobs = own.filter(function (j) {
          if (!q) return true;
          return matchText(j.title, q) || matchText(j.location || '', q);
        });
        rowsEl.innerHTML = filteredJobs.map(function (j) {
          var n = apps.filter(function (a) { return a.job_id === j.id; }).length;
          var st = getJobStatusPair(j.status);
          var tLbl = HG.typeLabel ? HG.typeLabel(j.job_type) : j.job_type;
          if (HG.trVal) tLbl = HG.trVal('type', tLbl);
          return '<div class="table-row"><span><b>' + E(j.title) + '</b><small>' + E(tLbl) + '</small></span><span>' + n + '</span><span>—</span>' +
            '<span><i class="status ' + st[1] + '">' + E(st[0]) + '</i></span><span>' + (HG.fmtDate(j.end_date) || '—') + '</span></div>';
        }).join('') || '<div style="padding:15px; text-align:center; color:#889;">' + E(tr('emp.no_jobs_yet', 'Chưa có tin tuyển dụng nào.')) + '</div>';
      }
    };
    renderEmployerOverview();

    /* TAB 1: HỒ SƠ DOANH NGHIỆP */
    var empAvatar = $('emp-avatar'), empDispName = $('emp-display-name'), empDispSub = $('emp-display-sub');
    var inCompName = $('emp-company-name'), inRepName = $('emp-rep-name'), inIndustry = $('emp-industry');
    var inPhone = $('emp-phone'), inEmail = $('emp-email'), inAddress = $('emp-address'), inDesc = $('emp-desc');

    function syncEmployerProfile() {
      if (empAvatar) HG.setAvatar(empAvatar, emp.company_name, emp.logo_url, { type: 'company' });
      if (empDispName) empDispName.textContent = emp.company_name;
      if (empDispSub) empDispSub.textContent = (emp.industry || 'Doanh nghiệp') + ' · ' + (emp.company_address || 'Trụ sở chính');
      if (inCompName) inCompName.value = emp.company_name || '';
      if (inRepName) inRepName.value = emp.representative_name || user.full_name || '';
      if (inIndustry) inIndustry.value = emp.industry || '';
      if (inPhone) inPhone.value = emp.company_phone || user.phone || '';
      if (inEmail) inEmail.value = user.email || '';
      if (inAddress) inAddress.value = emp.company_address || '';
      if (inDesc) inDesc.value = emp.description || '';
    }
    syncEmployerProfile();

    var empForm = $('employer-profile-form');
    /* Đồng bộ Backend xong: cập nhật tham chiếu hồ sơ (adapter thay object mới); không ghi đè ô đang sửa dở */
    var empDirty = false;
    if (empForm) empForm.addEventListener('input', function () { empDirty = true; });
    document.addEventListener('hg:synced', function () {
      var freshU = users.find(function (x) { return x.id === user.id; }); if (freshU) user = freshU;
      /* Không tìm thấy hồ sơ trong DB thật -> bỏ dữ liệu mẫu/cũ, dùng hồ sơ trống của chính tài khoản */
      emp = employer_profiles.find(function (x) { return x.user_id === user.id; }) || { id: null, user_id: user.id, company_name: user.full_name || 'Doanh nghiệp' };
      var compName = document.querySelector('[data-company]'); if (compName) compName.textContent = emp.company_name;
      var hStrong = document.querySelector('.user-name strong'); if (hStrong) hStrong.textContent = emp.company_name;
      if (!empDirty) syncEmployerProfile();
    });
    if (empForm) {
      empForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var V = window.HGValidate, bad = null, msg = '';
        [[inCompName, 'required|min:2', 'tên công ty'], [inRepName, 'required|fullname', 'tên người đại diện'], [inPhone, 'phone', 'số điện thoại']].forEach(function (r) {
          var m = V ? V.check(r[0].value, r[1], { label: r[2] }) : '';
          r[0].classList.toggle('invalid', !!m);
          if (m && !bad) { bad = r[0]; msg = m; }
        });
        if (bad) { showToast(msg, 'error'); bad.focus(); return; }
        var newEmail = inEmail ? inEmail.value.trim().toLowerCase() : String(user.email || '').toLowerCase();
        if (inEmail && window.HGValidate) {
          var em = window.HGValidate.check(newEmail, 'required|email', { label: 'email' });
          inEmail.classList.toggle('invalid', !!em);
          if (em) { showToast(em, 'error'); inEmail.focus(); return; }
        }

        /* [ST4-04] Gửi thẳng lên Backend (PUT /api/recruiters/{id}); chỉ cập nhật giao diện khi API xác nhận */
        var payload = {
          company_name: inCompName.value.trim(),
          representative_name: inRepName.value.trim(),
          industry: inIndustry.value.trim(),
          company_phone: inPhone.value.trim(),
          email: newEmail,
          company_address: inAddress.value.trim(),
          description: inDesc.value.trim()
        };
        var emailChanged = newEmail !== String(user.email || '').toLowerCase();
        var submitBtn = empForm.querySelector('[type="submit"]');
        var go = emailChanged
          ? HG.confirm({ title: 'Đổi email đăng nhập?', message: 'Email mới (' + newEmail + ') sẽ dùng để đăng nhập. Sau khi lưu, bạn cần đăng nhập lại bằng email mới.', confirmText: 'Lưu & đăng nhập lại', icon: 'mail' })
          : Promise.resolve(true);
        go.then(function (ok) {
          if (!ok) return;
          HG.busyAsync(submitBtn, function () { return HG.saveEmployerProfile(emp.id, payload); }).then(function (res) {
            if (res && res.busy) return;
            if (!res || !res.ok) {
              if (res && res.status === 409 && inEmail) { inEmail.classList.add('invalid'); inEmail.focus(); }
              showToast((res && res.error) || 'Không lưu được hồ sơ doanh nghiệp.', 'error');
              return;
            }
            var freshE = employer_profiles.find(function (x) { return x.id === emp.id; });
            if (freshE) emp = freshE;
            var freshU = users.find(function (x) { return x.id === user.id; });
            if (freshU) user = freshU;
            empDirty = false;
            syncEmployerProfile();
            var hStrong = document.querySelector('.user-name strong');
            if (hStrong) hStrong.textContent = emp.company_name;
            if (HG.notify) HG.notify(user.id, 'Hồ sơ doanh nghiệp "' + emp.company_name + '" đã được cập nhật.', { link: 'employer.html?tab=1', kind: 'info' });
            if (emailChanged) {
              HG.flash('Đã đổi email đăng nhập thành ' + newEmail + '. Vui lòng đăng nhập lại.', 'info');
              if (window.HGApi) window.HGApi.clearTokens();
              try { localStorage.removeItem('hg_session'); } catch (x) {}
              HG.goAuth({ mode: 'signin', role: 'employer', next: 'employer.html?tab=1' });
              return;
            }
            showToast('Cập nhật hồ sơ doanh nghiệp thành công!');
          });
        });
      });
    }

    /* [ST4-04] Đánh giá uy tín nhận được + Khiếu nại đã gửi (dữ liệu thật từ API) */
    if (HG.rr && empForm) HG.rr.mountProfileExtras(empForm);

    /* TAB 2: QUẢN LÝ TIN TUYỂN DỤNG – trạng thái: Nháp / Chờ kiểm duyệt / Đã đăng / Hết hạn */
    var fullJobsListEl = $('employer-full-jobs-list');
    var activeJobFilter = 'all';
    var jobFilterSearch = $('emp-job-search');

    function jobMatchesFilter(j, f) {
      if (f === 'all') return true;
      if (f === 'rejected') return j.status === 'rejected' || j.status === 'locked';
      return j.status === f;
    }
    function renderJobPills() {
      var tabs = $('emp-job-filter-tabs'); if (!tabs) return;
      var own = getOwnJobs();
      var jfKeyMap = {
        all: 'emp.jf_all',
        draft: 'emp.jf_draft',
        pending: 'emp.jf_pending',
        approved: 'emp.jf_approved',
        expired: 'emp.jf_expired',
        rejected: 'emp.jf_rejected'
      };
      tabs.querySelectorAll('[data-job-filter]').forEach(function (b) {
        var k = b.dataset.jobFilter;
        var base = tr(jfKeyMap[k], b.dataset.label || (b.dataset.label = b.textContent.trim()));
        b.innerHTML = E(base) + ' <span class="pill-count">' + own.filter(function (j) { return jobMatchesFilter(j, k); }).length + '</span>';
      });
    }

    function renderFullJobsList() {
      if (!fullJobsListEl) return;
      renderJobPills();
      var own = getOwnJobs().slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id; });
      var apps = getOwnApps();
      var q = (globalSearchQuery || (jobFilterSearch ? jobFilterSearch.value : '')).trim();

      var filtered = own.filter(function (j) {
        var matchFilter = jobMatchesFilter(j, activeJobFilter);
        if (!matchFilter) return false;
        if (!q) return true;
        return matchText(j.title, q) ||
          matchText(j.location || '', q) ||
          matchText(j.district || '', q) ||
          matchText(j.city || '', q) ||
          matchText(j.address || '', q);
      });

      if (!own.length) {
        fullJobsListEl.innerHTML = HG.empty('briefcase', tr('emp.no_jobs_empty_title', 'Bạn chưa đăng tin tuyển dụng nào'), tr('emp.no_jobs_empty_desc', 'Tạo tin đầu tiên để tiếp cận sinh viên phù hợp. Bạn có thể lưu nháp và hoàn thiện sau.'), '<button type="button" class="primary-btn small" data-goto-tab="3">' + E(tr('emp.post_new_btn', 'Đăng tin mới')) + '</button>');
        return;
      }
      if (!filtered.length) {
        fullJobsListEl.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), q ? E(q) : '');
        return;
      }

      fullJobsListEl.innerHTML = filtered.map(function (j) {
        var n = apps.filter(function (a) { return a.job_id === j.id; }).length;
        var cat = byId(job_categories, j.category_id);
        var st = getJobStatusPair(j.status);
        var note = (j.status === 'rejected' || j.status === 'locked') && j.rejected_reason ? '<small class="reason-line">' + E(tr('stu.reason_prefix', 'Lý do: ' + j.rejected_reason, { reason: j.rejected_reason })) + '</small>' : '';
        var dl = j.end_date ? '<small>' + E(tr('emp.deadline_on', 'Hạn nộp: ' + HG.fmtDate(j.end_date), { date: HG.fmtDate(j.end_date) })) + '</small>' : '';
        var acts = '';
        if (j.status === 'approved') acts += '<a class="cv-action-btn" href="job-detail.html?id=' + j.id + '" title="View">' + I('eye', 14) + '</a>';
        acts += '<button type="button" class="cv-action-btn" data-edit-job="' + j.id + '" title="Edit">' + I('settings', 14) + '</button>';
        if (j.status === 'draft' || j.status === 'rejected') acts += '<button type="button" class="cv-action-btn" style="color:#2ba788;" data-submit-job="' + j.id + '" title="Submit">' + I('arrow', 14) + '</button>';
        acts += '<button type="button" class="cv-action-btn danger" data-del-own-job="' + j.id + '" title="Delete">' + I('trash', 14) + '</button>';
        var catTxt = cat ? (HG.trVal ? HG.trVal('cat', cat.name) : cat.name) : (j.job_type ? (HG.trVal ? HG.trVal('type', HG.typeLabel(j.job_type)) : HG.typeLabel(j.job_type)) : '—');
        return '<div class="table-row">' +
          '<span><b>' + E(j.title || '(Untitled)') + '</b><small>' + E(tr('emp.created_on', 'Tạo ngày: ' + HG.fmtDate(j.created_at), { date: HG.fmtDate(j.created_at) })) + '</small>' + dl + note + '</span>' +
          '<span>' + E(catTxt) + '</span>' +
          '<span>' + E(j.salary_min || j.salary_max || j.salary_text ? HG.jobSalary(j) : '—') + '</span>' +
          '<span>' + E(tr('emp.apps_unit', n + ' đơn', { n: n })) + '</span>' +
          '<span><i class="status ' + st[1] + '">' + E(st[0]) + '</i></span>' +
          '<span class="table-actions">' + acts + '</span>' +
        '</div>';
      }).join('');
    }
    renderFullJobsList();

    var jobFilterTabs = $('emp-job-filter-tabs');
    if (jobFilterTabs) {
      jobFilterTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-job-filter]');
        if (b) {
          jobFilterTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); });
          b.classList.add('active');
          activeJobFilter = b.dataset.jobFilter;
          renderFullJobsList();
        }
      });
    }
    if (jobFilterSearch) jobFilterSearch.addEventListener('input', renderFullJobsList);
    if (fullJobsListEl) {
      fullJobsListEl.addEventListener('click', function (e) {
        var ed = e.target.closest('[data-edit-job]');
        if (ed) { if (HG.openJobForm) HG.openJobForm(Number(ed.dataset.editJob)); return; }

        var sb = e.target.closest('[data-submit-job]');
        if (sb) {
          var sj = JOBS.filter(function (x) { return x.id === Number(sb.dataset.submitJob); })[0]; if (!sj) return;
          var miss = !sj.category_id || !sj.job_type || !sj.description || !sj.requirements || !sj.end_date || !(sj.location_text);
          if (miss) { showToast('Tin chưa đủ thông tin. Hãy bấm sửa và hoàn thiện trước khi gửi duyệt.', 'error'); return; }
          HG.busy(sb, function () {
            HG.submitJobForReview(sj.id).then(function (r) {
              if (!r || r.error || r.ok === false) { showToast((r && r.error) || 'Không gửi được tin đi kiểm duyệt.', 'error'); return; }
              notifyAdmins('Tin "' + sj.title + '" của ' + emp.company_name + ' đang chờ kiểm duyệt.');
              renderEmployerOverview(); renderFullJobsList(); showToast('Đã gửi tin đi kiểm duyệt.');
            });
          }, 700);
          return;
        }

        var delBtn = e.target.closest('[data-del-own-job]');
        if (delBtn) {
          var jid = Number(delBtn.dataset.delOwnJob);
          HG.confirm({
            title: 'Xóa tin tuyển dụng?',
            message: 'Tin tuyển dụng sẽ bị gỡ bỏ khỏi hệ thống và không thể khôi phục.',
            confirmText: 'Xóa tin',
            cancelText: 'Hủy',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            HG.busy(delBtn, function () {
              if (!HG.deleteJob(jid)) { showToast('Không xóa được tin, vui lòng thử lại.', 'error'); return; }
              renderEmployerOverview(); renderFullJobsList();
              showToast('Đã xóa tin tuyển dụng thành công.');
            }, 600);
          });
        }
      });
    }
    function notifyAdmins(text) {
      users.filter(function (u) { return u.role === 'admin' && u.status === 'active'; }).forEach(function (u) { HG.notify(u.id, text, { link: 'admin.html?tab=5', kind: 'job' }); });
    }

    /* TAB 3: ĐĂNG TIN TUYỂN DỤNG – validate + xem trước trực tiếp + upload ảnh */
    var form = $('post-form');
    if (form && emp) {
      var G = function (id) { return $(id); };
      var MAX_IMG = 5 * 1024 * 1024, imgData = '', imgFile = null;
      var RULES = {
        'pf-title':    { err: 'err-title',    check: function (v) { return !v.trim() ? tr('emp.err_title_req', 'Vui lòng nhập tên công việc.') : v.trim().length < 8 ? tr('emp.err_title_min', 'Tên công việc cần ít nhất 8 ký tự.') : v.length > 100 ? tr('emp.err_title_max', 'Tên công việc tối đa 100 ký tự.') : ''; } },
        'pf-cat':      { err: 'err-cat',      check: function (v) { return v ? '' : tr('emp.err_cat_req', 'Vui lòng chọn danh mục.'); } },
        'pf-type':     { err: 'err-type',     check: function (v) { return v ? '' : tr('emp.err_type_req', 'Vui lòng chọn hình thức làm việc.'); } },
        'pf-desc':     { err: 'err-desc',     check: function (v) { return !v.trim() ? tr('emp.err_desc_req', 'Vui lòng nhập mô tả công việc.') : v.trim().length < 30 ? tr('emp.err_desc_min', 'Mô tả cần ít nhất 30 ký tự (hiện ' + v.trim().length + ').', { n: v.trim().length }) : ''; } },
        'pf-reqs':     { err: 'err-reqs',     check: function (v) { return !v.trim() ? tr('emp.err_reqs_req', 'Vui lòng nhập yêu cầu ứng viên.') : v.trim().length < 15 ? tr('emp.err_reqs_min', 'Yêu cầu cần ít nhất 15 ký tự.') : ''; } },
        'pf-salary':   { err: 'err-salary',   check: function (v) {
            if (!v.trim()) return tr('emp.err_sal_req', 'Vui lòng nhập mức lương.');
            if (/thỏa thuận|thoả thuận|negotiable/i.test(v)) return '';
            var r = HG.parseSalary(v);
            if (!r) return tr('emp.err_sal_fmt', 'Mức lương chưa hợp lệ (ví dụ: 30–40K/giờ hoặc 4–5 triệu/tháng).');
            return r.min <= 0 ? tr('emp.err_sal_pos', 'Mức lương phải lớn hơn 0.') : r.min > r.max ? '' : (r.max < 1000 ? tr('emp.err_sal_low', 'Mức lương quá thấp, hãy kiểm tra lại đơn vị.') : '');
        } },
        'pf-area':     { err: 'err-area',     check: function (v) { return v ? '' : tr('emp.err_area_req', 'Vui lòng chọn khu vực làm việc.'); } },
        'pf-slots':    { err: null,           check: function (v) { return !v || (+v >= 1 && +v <= 999 && /^\d+$/.test(v)) ? '' : tr('emp.err_slots_fmt', 'Số lượng phải là số nguyên từ 1 đến 999.'); } },
        'pf-deadline': { err: 'err-deadline', check: function (v) {
            if (!v) return tr('emp.err_dl_req', 'Vui lòng chọn hạn ứng tuyển.');
            var t = new Date(); t.setHours(0, 0, 0, 0);
            return new Date(v + 'T00:00:00') < t ? tr('emp.err_dl_past', 'Hạn ứng tuyển không được ở quá khứ.') : '';
        } }
      };
      var todayISO = (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
      function populateCategorySelect() {
        var curVal = G('pf-cat').value;
        G('pf-cat').innerHTML = '<option value="" data-i18n="emp.opt_select_cat">' + E(tr('emp.opt_select_cat', '-- Chọn danh mục --')) + '</option>' + job_categories.map(function (c) {
          var lbl = HG.trVal ? HG.trVal('cat', c.name) : c.name;
          return '<option value="' + c.id + '">' + E(lbl) + '</option>';
        }).join('');
        if (curVal) G('pf-cat').value = curVal;
      }
      G('pf-deadline').min = todayISO;
      populateCategorySelect();
      G('pf-address').value = emp.company_address || '';

      function setErr(id, msg) {
        var r = RULES[id], el = G(id), box = r.err ? G(r.err) : null;
        if (!box && el) {                       // ô không có sẵn khung lỗi -> tạo thêm
          box = el.parentNode.querySelector('.field-err');
          if (!box) { box = document.createElement('small'); box.className = 'field-err'; el.parentNode.appendChild(box); }
        }
        if (box) box.textContent = msg;
        if (el) { el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
      }
      function validateField(id) { var msg = RULES[id].check(G(id).value); setErr(id, msg); return !msg; }
      function validateAll() {
        var firstBad = null;
        Object.keys(RULES).forEach(function (id) { if (!validateField(id) && !firstBad) firstBad = id; });
        if (!validateImage(true) && !firstBad) firstBad = 'img-drop-label';
        return firstBad;
      }
      var touched = {};
      Object.keys(RULES).forEach(function (id) {
        var el = G(id);
        el.addEventListener('blur', function () { touched[id] = true; validateField(id); });
        el.addEventListener('input', function () { if (touched[id]) validateField(id); });
        el.addEventListener('change', function () { if (touched[id]) validateField(id); });
      });

      /* ---- Xem trước trực tiếp ---- */
      var CAT_COLORS = ['#665CF6', '#FF8EC7', '#4F7DFF', '#A78BFA', '#22B8A7', '#3156C8'];
      function catName() { var c = job_categories.filter(function (x) { return x.id === Number(G('pf-cat').value); })[0]; return c ? (HG.trVal ? HG.trVal('cat', c.name) : c.name) : ''; }
      function areaText() { var a = G('pf-area').value, ad = G('pf-address').value.trim(); return a ? (ad ? ad + ', ' + a : a) : ''; }
      function renderPreview() {
        var T = function (id, v, ph) { G(id).textContent = v && v.trim() ? v : ph; };
        T('preview-title', G('pf-title').value, tr('emp.preview_title', 'Tên công việc'));
        T('preview-cat', catName(), tr('emp.preview_cat', 'Danh mục'));
        var typeVal = G('pf-type').value;
        T('preview-type-tag', HG.trVal ? HG.trVal('type', typeVal) : typeVal, tr('emp.preview_type', 'Hình thức'));
        T('preview-location', areaText(), tr('emp.preview_loc', 'Địa điểm'));
        T('preview-shift', G('pf-shift').value, tr('emp.preview_shift', 'Ca làm việc'));
        var sal = G('pf-salary').value.trim(), pr = HG.parseSalary(sal);
        G('preview-salary').textContent = !sal ? tr('emp.preview_salary', 'Mức lương') : (pr && !/thỏa thuận/i.test(sal) ? HG.formatSalaryRange(pr.min, pr.max) : sal);
        var dl = G('pf-deadline').value, days = dl ? Math.ceil((new Date(dl + 'T23:59:59') - new Date()) / 86400000) : null;
        G('preview-deadline').textContent = dl ? HG.fmtDate(dl) : '';
        G('preview-company').textContent = emp.company_name;
        G('preview-logo').textContent = emp.company_name.charAt(0);
        G('preview-logo').style.background = CAT_COLORS[(emp.id - 1) % CAT_COLORS.length];
        G('preview-img-area').hidden = !imgData;
        if (imgData) G('preview-img').src = imgData;
      }
      ['pf-title', 'pf-cat', 'pf-type', 'pf-salary', 'pf-area', 'pf-address', 'pf-shift', 'pf-deadline'].forEach(function (id) {
        G(id).addEventListener('input', renderPreview); G(id).addEventListener('change', renderPreview);
      });

      /* ---- Upload ảnh: kéo thả / chọn file, kiểm tra, nén nhỏ để lưu localStorage ---- */
      var imgInput = G('pf-img-input'), drop = G('img-drop-label'), chosenRow = G('img-chosen-row');
      function validateImage(silent) { var m = G('err-img').textContent; return !m; }
      function imgError(msg) { G('err-img').textContent = msg || ''; drop.classList.toggle('invalid', !!msg); }
      function clearImage() {
        imgData = ''; imgFile = null; imgInput.value = ''; chosenRow.hidden = true; chosenRow.style.display = 'none'; imgError(''); renderPreview();
      }
      function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
      function handleFile(file) {
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) { imgError('Chỉ chấp nhận ảnh PNG, JPG, WEBP hoặc GIF.'); HG.toast('Tệp không phải là ảnh hợp lệ.', 'error'); imgInput.value = ''; return; }
        if (file.size > MAX_IMG) { imgError('Ảnh quá lớn (' + fmtSize(file.size) + '). Tối đa 5MB.'); HG.toast('Ảnh vượt quá 5MB, vui lòng chọn ảnh khác.', 'error'); imgInput.value = ''; return; }
        imgFile = file;  /* lưu File object để upload lên API sau */
        var reader = new FileReader();
        reader.onerror = function () { imgError('Không đọc được tệp ảnh, hãy thử lại.'); };
        reader.onload = function () {
          var im = new Image();
          im.onload = function () {
            var max = 960, k = Math.min(1, max / Math.max(im.width, im.height));
            var c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            imgData = c.toDataURL('image/jpeg', 0.8);
            G('img-thumb').src = imgData; G('img-fname').textContent = file.name; G('img-fsize').textContent = fmtSize(file.size);
            chosenRow.hidden = false; chosenRow.style.display = 'flex'; imgError(''); renderPreview();
            HG.toast('Đã thêm ảnh banner.', 'success');
          };
          im.onerror = function () { imgError('Tệp ảnh bị lỗi hoặc không đọc được.'); };
          im.src = reader.result;
        };
        reader.readAsDataURL(file);
      }
      imgInput.addEventListener('change', function () { handleFile(imgInput.files[0]); });
      G('img-remove-btn').addEventListener('click', function () { clearImage(); HG.toast('Đã xóa ảnh banner.', 'info'); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('dragover'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('dragover'); }); });
      drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer && e.dataTransfer.files[0]); });

      /* ---- Chế độ sửa tin + lưu nháp + gửi duyệt ---- */
      var editId = null, openingEdit = false;
      var submitBtn = G('post-submit-btn'), draftBtn = G('post-draft-btn');
      var TYPE_BACK = { 'part-time': 'Part-time', 'full-time': 'Toàn thời gian', 'internship': 'Thực tập' };
      var TYPE_MAP = { 'Part-time': 'part-time', 'Toàn thời gian': 'full-time', 'Thực tập': 'internship', 'Remote': 'part-time' };
      function setEditMode(j) {
        editId = j ? j.id : null;
        var h1 = document.querySelector('[data-view="3"] h1'); if (h1) h1.textContent = j ? tr('emp.edit_title', 'Chỉnh sửa tin tuyển dụng') : tr('emp.post_title', 'Đăng tin tuyển dụng');
        var kick = document.querySelector('[data-view="3"] .dash-welcome span'); if (kick) kick.textContent = j ? tr('emp.edit_kicker', 'CẬP NHẬT TIN #' + j.id, { id: j.id }) : tr('emp.post_kicker', 'TẠO CƠ HỘI MỚI');
        var subSpan = submitBtn && submitBtn.querySelector('[data-i18n]');
        var btnText = j ? (j.status === 'draft' ? tr('emp.btn_submit_review', 'Gửi kiểm duyệt') : tr('emp.btn_save_resubmit', 'Lưu & gửi duyệt lại')) : tr('emp.btn_post_submit', 'Đăng tuyển ngay');
        if (subSpan) subSpan.textContent = btnText;
        else if (submitBtn && submitBtn.firstChild) submitBtn.firstChild.textContent = btnText + ' ';
        draftBtn.hidden = !!(j && j.status !== 'draft' && j.status !== 'rejected');
      }
      function fillSelect(sel, val) {
        if (!val) { sel.value = ''; return; }
        var has = [].some.call(sel.options, function (o) { return o.value === val; });
        if (!has) { var o = document.createElement('option'); o.value = o.textContent = val; sel.appendChild(o); }
        sel.value = val;
      }
      HG.openJobForm = function (id) {
        var j = JOBS.filter(function (x) { return x.id === id; })[0]; if (!j) return;
        form.reset(); touched = {}; Object.keys(RULES).forEach(function (k) { setErr(k, ''); }); imgError('');
        imgFile = null;  /* reset file object – không upload lại ảnh cũ */
        G('pf-title').value = j.title || ''; G('pf-cat').value = j.category_id || '';
        G('pf-type').value = TYPE_BACK[j.job_type] || ''; G('pf-desc').value = j.description || ''; G('pf-reqs').value = j.requirements || '';
        G('pf-salary').value = j.salary_text || (j.salary_min ? HG.formatSalaryRange(j.salary_min, j.salary_max) : '');
        var loc = j.location_text || HG.locationName(j.location_id) || '', area = '', addr = loc;
        [].forEach.call(G('pf-area').options, function (o) { if (o.value && loc.indexOf(o.value) !== -1) { area = o.value; addr = loc.replace(o.value, '').replace(/[,\s]+$/, '').replace(/^[,\s]+/, ''); } });
        if (!area && loc) { var parts = loc.split(','); area = parts[parts.length - 1].trim(); addr = parts.slice(0, -1).join(',').trim(); fillSelect(G('pf-area'), area); }
        G('pf-area').value = area; G('pf-address').value = addr || emp.company_address || '';
        fillSelect(G('pf-shift'), j.work_time && j.work_time !== 'Thỏa thuận' ? j.work_time : '');
        G('pf-slots').value = j.quantity || ''; G('pf-deadline').value = j.end_date || '';
        /* Hiển thị ảnh hiện tại (URL từ API hoặc base64 cũ) */
        var existingImg = j.image_url ? HG.resolveImageUrl(j.image_url) : '';
        imgData = existingImg;
        if (imgData) { G('img-thumb').src = imgData; G('img-fname').textContent = 'Ảnh hiện tại'; G('img-fsize').textContent = ''; chosenRow.hidden = false; chosenRow.style.display = 'flex'; } else { chosenRow.hidden = true; chosenRow.style.display = 'none'; }
        form.hidden = false; var succ = $('post-success'); if (succ) succ.hidden = true;
        var layout = document.querySelector('.post-form-layout'); if (layout) layout.classList.remove('done');
        setEditMode(j); renderPreview();
        var tabBtn = document.querySelector('[data-tab="3"]');
        openingEdit = true;
        try { if (tabBtn) tabBtn.click(); } finally { openingEdit = false; }
        if (j.status === 'expired') showToast('Hãy chọn hạn ứng tuyển mới để gia hạn tin này.', 'info');
        else if (j.status === 'rejected' && j.rejected_reason) showToast('Tin từng bị từ chối: ' + j.rejected_reason, 'info');
      };

      /* ---- collect: đọc form → object (image_url chứa URL đã upload hoặc URL cũ) ---- */
      function collect(status, resolvedImageUrl) {
        var sal = G('pf-salary').value.trim(), pr = !sal || /thỏa thuận|thoả thuận/i.test(sal) ? null : HG.parseSalary(sal);
        return {
          employer_id: emp.id, category_id: Number(G('pf-cat').value) || null, location_id: null,
          location_text: areaText(), title: G('pf-title').value.trim(), description: G('pf-desc').value.trim(), requirements: G('pf-reqs').value.trim(),
          salary_min: pr ? pr.min : 0, salary_max: pr ? pr.max : 0, salary_text: pr ? HG.formatSalaryRange(pr.min, pr.max) : (sal ? 'Thỏa thuận' : ''),
          job_type: TYPE_MAP[G('pf-type').value] || '', work_time: G('pf-shift').value || 'Thỏa thuận', quantity: Number(G('pf-slots').value) || 1,
          end_date: G('pf-deadline').value,
          image_url: resolvedImageUrl !== undefined ? resolvedImageUrl : (imgFile ? null : imgData) || null,
          status: status, rejected_reason: null
        };
      }
      /* persist: nháp lưu ở trình duyệt; gửi duyệt/sửa tin gọi API thật. Trả về Promise<{ok}|{error}> */
      function persist(fields) {
        return HG.saveJob(fields, editId);
      }
      function afterSave(status, title) {
        renderEmployerOverview(); renderFullJobsList();
        var wasEdit = !!editId; editId = null; setEditMode(null);
        if (status === 'draft') {
          showToast(tr('emp.toast_draft_saved', 'Đã lưu bản nháp "' + title + '".', { title: title }));
          form.reset(); touched = {}; clearImage(); G('pf-address').value = emp.company_address || ''; renderPreview();
          var t2 = document.querySelector('[data-tab="2"]'); if (t2) t2.click();
          return;
        }
        form.hidden = true;
        var layout = document.querySelector('.post-form-layout'); if (layout) layout.classList.add('done');
        var succ = $('post-success'); if (succ) { succ.hidden = false; succ.querySelector('h2').textContent = wasEdit ? tr('emp.post_updated_title', 'Đã cập nhật tin!') : tr('emp.post_succ_title', 'Đăng tin thành công!'); }
        showToast(wasEdit ? tr('emp.toast_post_updated', 'Đã lưu thay đổi. Tin được gửi kiểm duyệt lại.') : tr('emp.toast_post_created', 'Đăng tin thành công! Tin đang chờ kiểm duyệt.'));
        notifyAdmins('Tin "' + title + '" của ' + emp.company_name + ' đang chờ kiểm duyệt.');
      }

      /* ---- Upload ảnh lên API (nếu có file mới), rồi thực thi callback(imageUrl) ---- */
      function withUploadedImage(btn, callback) {
        if (imgFile && window.HGApi) {
          /* Có file mới → upload lên /api/jobs/upload-image trước */
          btn.disabled = true;
          G('err-img').textContent = '';
          window.HGApi.uploadJobImage(imgFile)
            .then(function (res) {
              /* Lưu đường dẫn tương đối "/uploads/jobs/..." vào DB; hiển thị qua HG.resolveImageUrl */
              var url = HG.toStoredUploadUrl((res && (res.relative_url || res.image_url || res.url)) || imgData || null);
              /* Cập nhật imgData để preview dùng URL thực từ server */
              if (url) { imgData = url; imgFile = null; if (G('preview-img')) G('preview-img').src = HG.resolveImageUrl(url); }
              callback(url);
            })
            .catch(function (err) {
              btn.disabled = false;
              var msg = (err && err.message) || 'Không thể tải ảnh lên máy chủ.';
              G('err-img').textContent = msg;
              showToast(msg, 'error');
            });
        } else {
          /* Không có file mới: dùng URL đang giữ (imgData) hoặc null */
          callback(HG.toStoredUploadUrl(imgData));
        }
      }

      /* Gửi kiểm duyệt (validate đầy đủ) */
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        Object.keys(RULES).forEach(function (id) { touched[id] = true; });
        var bad = validateAll();
        if (bad) {
          var el = G(bad); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el && el.focus && bad !== 'img-drop-label') el.focus();
          showToast(tr('emp.toast_check_fields', 'Vui lòng kiểm tra lại các trường được đánh dấu.'), 'error');
          return;
        }
        submitBtn.disabled = true;
        withUploadedImage(submitBtn, function (imageUrl) {
          submitBtn.disabled = false;
          HG.busy(submitBtn, function () {
            var f = collect('pending', imageUrl);
            submitBtn.disabled = true;
            persist(f).then(function (r) {
              submitBtn.disabled = false;
              if (!r || r.error || r.ok === false) { showToast((r && r.error) || 'Không lưu được tin tuyển dụng.', 'error'); return; }
              afterSave('pending', f.title);
            });
          }, 800);
        });
      });

      /* Lưu nháp: chỉ cần tiêu đề; các ô đã nhập phải đúng định dạng */
      draftBtn.addEventListener('click', function () {
        touched['pf-title'] = true;
        var t = G('pf-title').value.trim();
        if (t.length < 8) { setErr('pf-title', t ? 'Tên công việc cần ít nhất 8 ký tự để lưu nháp.' : 'Hãy nhập tên công việc để lưu nháp.'); G('pf-title').focus(); showToast('Cần có tên công việc (≥ 8 ký tự) để lưu nháp.', 'error'); return; }
        var badField = null;
        ['pf-salary', 'pf-slots'].forEach(function (id) { if (G(id).value.trim() && !validateField(id) && !badField) badField = id; });
        if (G('pf-deadline').value && !validateField('pf-deadline') && !badField) badField = 'pf-deadline';
        if (badField) { G(badField).focus(); showToast('Một số ô đã nhập chưa hợp lệ, hãy sửa trước khi lưu nháp.', 'error'); return; }
        draftBtn.disabled = true;
        withUploadedImage(draftBtn, function (imageUrl) {
          draftBtn.disabled = false;
          HG.busy(draftBtn, function () {
            var f = collect('draft', imageUrl);
            persist(f).then(function (r) {
              if (!r || r.error || r.ok === false) { showToast((r && r.error) || 'Không lưu được bản nháp (bộ nhớ đầy).', 'error'); return; }
              afterSave('draft', f.title);
            });
          }, 600);
        });
      });

      var cancelBtn = form.querySelector('.form-actions [data-goto-tab="2"]');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { editId = null; setEditMode(null); form.reset(); touched = {}; clearImage(); G('pf-address').value = emp.company_address || ''; renderPreview(); });

      /* Đưa form về trạng thái "Tạo tin mới" sạch: xóa dữ liệu, lỗi, ảnh và chế độ sửa của tin trước */
      function resetToNewJob() {
        editId = null; setEditMode(null);
        form.reset(); touched = {}; clearImage();
        Object.keys(RULES).forEach(function (id) { setErr(id, ''); });
        G('pf-address').value = emp.company_address || '';
        form.hidden = false; renderPreview();
        var layout = document.querySelector('.post-form-layout'); if (layout) layout.classList.remove('done');
        var succ = $('post-success'); if (succ) succ.hidden = true;
      }
      var postAnotherBtn = $('post-another-btn');
      if (postAnotherBtn) postAnotherBtn.addEventListener('click', resetToNewJob);

      /* Đang sửa tin A mà bấm "Đăng tin tuyển dụng" (sidebar) hoặc "Đăng tin mới" -> thoát chế độ sửa,
         tránh việc bấm gửi lại GHI ĐÈ tin A trong khi người dùng tưởng đang tạo tin mới */
      document.addEventListener('click', function (e) {
        if (openingEdit || editId === null) return;
        var t = e.target.closest('.dash-sidebar nav [data-tab="3"], [data-goto-tab="3"]');
        if (!t || form.contains(t)) return;
        var oldId = editId;
        resetToNewJob();
        showToast('Đã thoát chế độ sửa tin #' + oldId + ' – bạn đang tạo tin mới.', 'info');
      }, true);
      setEditMode(null);
      renderPreview();
      window.addEventListener('languageChanged', function () {
        var curEdit = editId ? JOBS.filter(function (x) { return x.id === editId; })[0] : null;
        setEditMode(curEdit || null);
        populateCategorySelect();
        renderPreview();
      });
    }

    /* TAB 4: QUẢN LÝ ỨNG VIÊN – Kanban / Danh sách, popup nhập lý do, cập nhật tức thời */
    var candFullEl = $('employer-candidates-full');
    var activeCandFilter = 'all', candView = 'kanban', candJob = 'all';
    function getKbCols() {
      return [
        { key: 'submitted', title: tr('emp.cf_submitted', 'Mới nộp'), sid: 1 },
        { key: 'reviewing', title: tr('emp.cf_reviewing', 'Đã tiếp nhận'), sid: 2 },
        { key: 'interview', title: tr('emp.cf_interview', 'Phỏng vấn'), sid: 3 },
        { key: 'accepted', title: tr('emp.kb_hired', 'Trúng tuyển'), sid: 4 },
        { key: 'rejected', title: tr('emp.cf_rejected', 'Từ chối'), sid: 5 }
      ];
    }
    function getCandLabel(stKey) {
      var map = {
        submitted: [tr('emp.cf_submitted', 'Mới nộp'), 'pending'],
        reviewing: [tr('emp.cf_reviewing', 'Đã tiếp nhận'), 'reviewing'],
        interview: [tr('emp.cf_interview', 'Phỏng vấn'), 'interview'],
        accepted: [tr('emp.kb_hired', 'Trúng tuyển'), 'accepted'],
        rejected: [tr('emp.cf_rejected', 'Từ chối'), 'rejected'],
        withdrawn: [tr('emp.kb_withdrawn', 'Ứng viên đã hủy'), 'rejected']
      };
      return map[stKey] || map.submitted;
    }
    var NEXT = { submitted: ['reviewing', 'interview', 'accepted', 'rejected'], reviewing: ['interview', 'accepted', 'rejected'], interview: ['accepted', 'rejected'], accepted: [], rejected: [], withdrawn: [] };
    var SID = { reviewing: 2, interview: 3, accepted: 4, rejected: 5 };

    function candInfo(a) {
      var sp = byId(student_profiles, a.student_id) || { user_id: 0, university: '', major: '' };
      var u = byId(users, sp.user_id) || { full_name: 'Ứng viên', email: '', phone: '' };
      return { sp: sp, u: u, j: jobOf(a), st: statusName(a.status_id) };
    }
    function candJobsSelectHtml() {
      return '<option value="all">' + E(tr('emp.all_positions', 'Tất cả vị trí')) + '</option>' + getOwnJobs().filter(function (j) { return j.status !== 'draft'; }).map(function (j) { return '<option value="' + j.id + '"' + (String(candJob) === String(j.id) ? ' selected' : '') + '>' + E(j.title) + '</option>'; }).join('');
    }
    function candActionBtns(a, st) {
      var next = NEXT[st] || [], out = '';
      out += '<button type="button" class="cv-action-btn" data-view-cand="' + a.id + '">' + I('eye', 14) + ' ' + E(tr('emp.act_view_cv', 'Xem CV')) + '</button>';
      if (next.indexOf('reviewing') !== -1) out += '<button type="button" class="cv-action-btn" data-cand-act="reviewing" data-id="' + a.id + '">' + I('check', 14) + ' ' + E(tr('emp.act_approve', 'Duyệt')) + '</button>';
      if (next.indexOf('interview') !== -1) out += '<button type="button" class="cv-action-btn" data-cand-act="interview" data-id="' + a.id + '">' + I('calendar', 14) + ' ' + E(tr('emp.act_interview', 'Phỏng vấn')) + '</button>';
      if (next.indexOf('accepted') !== -1) out += '<button type="button" class="cv-action-btn ok" data-cand-act="accepted" data-id="' + a.id + '">' + I('check', 14) + ' ' + E(tr('emp.act_hire', 'Nhận')) + '</button>';
      if (next.indexOf('rejected') !== -1) out += '<button type="button" class="cv-action-btn danger" data-cand-act="rejected" data-id="' + a.id + '">' + I('x', 14) + ' ' + E(tr('emp.act_reject', 'Từ chối')) + '</button>';
      return out;
    }

    function renderCandPills() {
      var tabs = $('cand-filter-tabs'); if (!tabs) return;
      var apps = candApps();
      var cfKeyMap = {
        all: 'emp.cf_all',
        submitted: 'emp.cf_submitted',
        reviewing: 'emp.cf_reviewing',
        interview: 'emp.cf_interview',
        accepted: 'emp.cf_accepted',
        rejected: 'emp.cf_rejected'
      };
      tabs.querySelectorAll('[data-cand-filter]').forEach(function (b) {
        var k = b.dataset.candFilter, base = tr(cfKeyMap[k], b.dataset.label || (b.dataset.label = b.textContent.trim()));
        b.innerHTML = E(base) + ' <span class="pill-count">' + (k === 'all' ? apps.length : apps.filter(function (a) { return statusName(a.status_id) === k; }).length) + '</span>';
      });
      tabs.hidden = candView === 'kanban';
    }
    function candApps() { return getOwnApps().filter(function (a) { return candJob === 'all' || String(a.job_id) === String(candJob); }); }

    function renderEmployerCandidates() {
      if (!candFullEl) return;
      renderCandPills();
      var all = candApps(), toolbar = $('cand-toolbar');
      var q = globalSearchQuery;
      var allMatched = all.filter(function (a) {
        if (!q) return true;
        var c = candInfo(a);
        return matchText(c.u.full_name, q) ||
          matchText(c.j.title, q) ||
          matchText(c.sp.university || '', q) ||
          matchText(c.u.email || '', q);
      });

      if (toolbar) {
        toolbar.querySelectorAll('[data-cv]').forEach(function (b) { b.classList.toggle('active', b.dataset.cv === candView); });
        var sel = $('cand-job-select'); if (sel) sel.innerHTML = candJobsSelectHtml();
      }
      if (!getOwnApps().length) {
        candFullEl.innerHTML = HG.empty('users', tr('emp.cand_empty_title', 'Chưa có ứng viên nào'), tr('emp.cand_empty_desc', 'Khi sinh viên ứng tuyển vào tin của bạn, hồ sơ sẽ hiển thị tại đây để bạn xử lý.'), '<button type="button" class="primary-btn small" data-goto-tab="3">' + E(tr('emp.tab_post', 'Đăng tin tuyển dụng')) + '</button>');
        return;
      }
      if (q && !allMatched.length) {
        candFullEl.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), E(q));
        return;
      }
      if (candView === 'kanban') {
        var KB_COLS = getKbCols();
        candFullEl.innerHTML = '<div class="kanban">' + KB_COLS.map(function (col) {
          var list = allMatched.filter(function (a) { return statusName(a.status_id) === col.key; });
          return '<div class="kb-col ' + col.key + '" data-col="' + col.key + '"><div class="kb-head"><strong>' + E(col.title) + '</strong><span>' + list.length + '</span></div><div class="kb-body">' +
            (list.map(function (a) {
              var c = candInfo(a), draggable = (NEXT[c.st] || []).length > 0;
              return '<div class="kb-card" data-aid="' + a.id + '"' + (draggable ? ' draggable="true"' : '') + '>' +
                '<div class="kb-who">' + HG.avatar(c.u.full_name, c.sp.avatar_url, { className: 'cand-avatar-img sm' }) + '<div><b>' + E(c.u.full_name) + '</b><small>' + E(c.sp.university || tr('nav.role.student', 'Sinh viên')) + '</small></div></div>' +
                '<div class="kb-job">' + E(c.j.title) + '</div><small class="kb-date">' + E(tr('emp.cand_submitted_on', 'Nộp ' + HG.fmtDate(a.applied_at), { date: HG.fmtDate(a.applied_at) })) + '</small>' +
                (c.st === 'interview' && a.interview_at ? '<small class="kb-meta">' + I('calendar', 12) + ' ' + E(String(a.interview_at).replace('T', ' ')) + '</small>' : '') +
                (c.st === 'rejected' && a.status_reason ? '<small class="kb-meta bad">' + E(tr('stu.reason_prefix', 'Lý do: ' + a.status_reason, { reason: a.status_reason })) + '</small>' : '') +
                '<div class="kb-actions">' + candActionBtns(a, c.st) + '</div></div>';
            }).join('') || '<div class="kb-empty">' + E(tr('emp.kb_empty', 'Chưa có hồ sơ')) + '</div>') + '</div></div>';
        }).join('') + '</div>';
        return;
      }
      var filtered = allMatched.filter(function (a) { return activeCandFilter === 'all' || statusName(a.status_id) === activeCandFilter; });
      if (!filtered.length) {
        candFullEl.innerHTML = HG.empty('users', tr('stu.apps_group_empty_title', 'Không có ứng viên ở trạng thái này'), tr('stu.apps_group_empty_desc', 'Chọn tab khác để xem các hồ sơ còn lại.'));
        return;
      }
      candFullEl.innerHTML = filtered.map(function (a) {
        var c = candInfo(a), st = getCandLabel(c.st);
        return '<div class="candidate-card-rich"><div class="cand-avatar-wrap">' + HG.avatar(c.u.full_name, c.sp.avatar_url, { className: 'cand-avatar-img' }) + '<div>' +
          '<h3 style="font-size: var(--fs-body); margin-bottom: 2px;">' + E(c.u.full_name) + '</h3>' +
          '<p style="color: #6a748c; font-size: var(--fs-xs); margin: 0;">' + E(tr('emp.cand_Applied_for', 'Ứng tuyển:')) + ' <strong>' + E(c.j.title) + '</strong> · ' + E(c.sp.university || tr('nav.role.student', 'Sinh viên')) + '</p>' +
          '<small style="color: #929bae; font-size: 11px;">' + E(tr('emp.cand_submitted_on', 'Nộp ' + HG.fmtDate(a.applied_at), { date: HG.fmtDate(a.applied_at) })) + ' · Email: ' + E(c.u.email) + ' · ' + E(c.u.phone) + '</small>' +
          (c.st === 'rejected' && a.status_reason ? '<small class="reason-line" style="display:block">' + E(tr('stu.reason_prefix', 'Lý do: ' + a.status_reason, { reason: a.status_reason })) + '</small>' : '') + '</div></div>' +
          '<div class="cand-actions-wrap"><span class="status ' + st[1] + '">' + E(st[0]) + '</span>' + candActionBtns(a, c.st) + '</div></div>';
      }).join('');
    }
    renderEmployerCandidates();

    /* Định tuyến lọc theo Tab cho Nhà tuyển dụng */
    dispatchRoleSearch = function (q) {
      if (q && [1, 3, 5].indexOf(currentActiveTab) !== -1) {
        showTab(2);
        return;
      }
      if (currentActiveTab === 0) {
        renderEmployerOverview(q);
      } else if (currentActiveTab === 2) {
        if (jobFilterSearch && jobFilterSearch.value !== q) {
          jobFilterSearch.value = q;
        }
        renderFullJobsList();
      } else if (currentActiveTab === 4) {
        renderEmployerCandidates();
      }
    };

    /* Popup nhập lý do / lịch phỏng vấn */
    function askStatus(kind, a) {
      var c = candInfo(a);
      var cfg = {
        reviewing: { title: tr('emp.ask_rev_title', 'Duyệt hồ sơ'), btn: tr('emp.ask_rev_btn', 'Duyệt hồ sơ'), field: false, hint: tr('emp.ask_rev_hint', 'Hồ sơ sẽ chuyển sang "Đã tiếp nhận" và sinh viên được thông báo.') },
        interview: { title: tr('emp.ask_int_title', 'Mời phỏng vấn'), btn: tr('emp.ask_int_btn', 'Gửi lời mời'), date: true, hint: tr('emp.ask_int_hint', 'Chọn thời gian phỏng vấn, sinh viên sẽ nhận thông báo ngay.') },
        accepted: { title: tr('emp.ask_acc_title', 'Xác nhận trúng tuyển'), btn: tr('emp.ask_acc_btn', 'Xác nhận nhận việc'), field: false, hint: tr('emp.ask_acc_hint', 'Sinh viên sẽ được thông báo đã trúng tuyển.') },
        rejected: { title: tr('emp.ask_rej_title', 'Từ chối hồ sơ'), btn: tr('emp.ask_rej_btn', 'Từ chối'), reason: true, danger: true, hint: tr('emp.ask_rej_hint', 'Lý do sẽ được gửi tới sinh viên.') }
      }[kind];
      return new Promise(function (resolve) {
        var done = false;
        var qrList = [
          tr('emp.ask_qr_1', 'Chưa phù hợp yêu cầu vị trí'),
          tr('emp.ask_qr_2', 'Lịch rảnh không khớp ca làm'),
          tr('emp.ask_qr_3', 'Đã tuyển đủ số lượng')
        ];
        HG.modal.open({
          className: 'modal-reason', dismissible: true, labelledBy: 'reason-title',
          html: '<h2 id="reason-title">' + E(cfg.title) + '</h2><p style="margin-bottom:14px"><strong>' + E(c.u.full_name) + '</strong> · ' + E(c.j.title) + '</p>' +
            '<form data-form novalidate>' +
            (cfg.date ? '<label>' + E(tr('emp.ask_int_time', 'Thời gian phỏng vấn')) + ' <span class="req-star">*</span><input type="datetime-local" name="when"></label>' : '') +
            (cfg.reason ? '<label>' + E(tr('emp.ask_rej_reason', 'Lý do từ chối')) + ' <span class="req-star">*</span><textarea name="reason" rows="4" maxlength="300" placeholder="' + E(tr('emp.ask_rej_ph', 'Ví dụ: Lịch rảnh của bạn chưa phù hợp với ca làm của vị trí này.')) + '"></textarea></label><div class="quick-reasons">' +
              qrList.map(function (r) { return '<button type="button" data-qr="' + E(r) + '">' + E(r) + '</button>'; }).join('') + '</div>' : '') +
            (!cfg.date && !cfg.reason ? '<label>' + E(tr('emp.ask_note_label', 'Ghi chú gửi ứng viên (không bắt buộc)')) + '<textarea name="note" rows="3" maxlength="300"></textarea></label>' : '') +
            '<p class="form-error" role="alert"></p><p class="hint-line">' + E(cfg.hint) + '</p>' +
            '<div class="modal-actions"><button type="button" class="secondary-btn" data-cancel>' + E(tr('common.cancel', 'Hủy')) + '</button><button type="submit" class="primary-btn' + (cfg.danger ? ' danger' : '') + '">' + E(cfg.btn) + '</button></div></form>',
          onMount: function (api) {
            var f = api.box.querySelector('form'), err = api.box.querySelector('.form-error');
            if (cfg.date) { var d = new Date(Date.now() + 2 * 86400000); d.setHours(9, 0, 0, 0); var p = function (n) { return ('0' + n).slice(-2); }; f.when.value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T09:00'; f.when.min = new Date().toISOString().slice(0, 16); }
            api.box.querySelector('[data-cancel]').addEventListener('click', function () { api.close(false); });
            api.box.addEventListener('click', function (e) { var q = e.target.closest('[data-qr]'); if (q && f.reason) { f.reason.value = q.dataset.qr; f.reason.focus(); } });
            f.addEventListener('submit', function (e) {
              e.preventDefault(); err.textContent = '';
              var meta = {};
              if (cfg.reason) { var r = f.reason.value.trim(); if (r.length < 10) { err.textContent = tr('emp.ask_err_reason', 'Vui lòng nhập lý do từ chối (ít nhất 10 ký tự).'); f.reason.focus(); return; } meta.reason = r; }
              if (cfg.date) { if (!f.when.value) { err.textContent = tr('emp.ask_err_time', 'Vui lòng chọn thời gian phỏng vấn.'); return; } if (new Date(f.when.value) < new Date()) { err.textContent = tr('emp.ask_err_future', 'Thời gian phỏng vấn phải ở tương lai.'); return; } meta.interview_at = f.when.value; }
              if (f.note && f.note.value.trim()) meta.reason = f.note.value.trim();
              var btn = f.querySelector('[type=submit]');
              HG.busy(btn, function () { done = true; api.close(true); resolve(meta); }, 650);
            });
          },
          onClose: function () { if (!done) resolve(null); }
        });
      });
    }

    function changeCandStatus(aid, kind) {
      var a = HG.applications().filter(function (x) { return x.id === aid; })[0]; if (!a) return;
      var cur = statusName(a.status_id);
      if ((NEXT[cur] || []).indexOf(kind) === -1) { showToast('Hồ sơ này không thể chuyển sang trạng thái đó.', 'error'); renderEmployerCandidates(); return; }
      askStatus(kind, a).then(function (meta) {
        if (!meta) return;
        var latest = HG.applications().filter(function (x) { return x.id === aid; })[0];
        if (!latest || (NEXT[statusName(latest.status_id)] || []).indexOf(kind) === -1) {
          showToast('Hồ sơ vừa thay đổi trạng thái (ứng viên có thể đã rút đơn). Danh sách đã được cập nhật.', 'error');
          renderEmployerCandidates(); return;
        }
        if (!HG.setAppStatus(aid, SID[kind], meta)) { showToast('Không cập nhật được trạng thái, vui lòng thử lại.', 'error'); return; }
        renderEmployerOverview(); renderEmployerCandidates();
        showToast({ reviewing: 'Đã duyệt hồ sơ ứng viên.', interview: 'Đã gửi lời mời phỏng vấn tới sinh viên!', accepted: 'Ứng viên đã trúng tuyển!', rejected: 'Đã từ chối hồ sơ và gửi lý do cho sinh viên.' }[kind]);
      });
    }

    function openCandidateModal(aid) {
      var a = HG.applications().filter(function (x) { return x.id === aid; })[0]; if (!a) return;
      var c = candInfo(a), st = getCandLabel(c.st);
      HG.modal.open({
        className: 'modal-candidate-detail',
        html: '<div style="padding: 10px;"><div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;">' + HG.avatar(c.u.full_name, c.sp.avatar_url, { className: 'cand-avatar-img', style: 'width:56px; height:56px; font-size:20px;' }) + '<div>' +
          '<h2 style="font-size: var(--fs-h4); margin:0 0 4px;">' + E(c.u.full_name) + '</h2><p style="color:#717b94; font-size:var(--fs-xs); margin:0;">' + E(tr('emp.cand_Applied_for', 'Ứng tuyển:')) + ' <strong>' + E(c.j.title) + '</strong></p></div></div>' +
          '<div style="background:#f8f9fe; border:1px solid #e2e6f4; border-radius:14px; padding:18px; margin-bottom:18px; font-size:var(--fs-body-sm); line-height:1.7;">' +
          '<div><strong>' + E(tr('emp.modal_cand_uni', 'Trường đại học:')) + '</strong> ' + E(c.sp.university || '—') + '</div><div><strong>' + E(tr('emp.modal_cand_major', 'Chuyên ngành:')) + '</strong> ' + E(c.sp.major || '—') + '</div>' +
          '<div><strong>' + E(tr('emp.modal_cand_email', 'Email liên hệ:')) + '</strong> ' + E(c.u.email) + '</div><div><strong>' + E(tr('emp.modal_cand_phone', 'Số điện thoại:')) + '</strong> ' + E(c.u.phone) + '</div><div><strong>' + E(tr('emp.modal_cand_date', 'Ngày nộp hồ sơ:')) + '</strong> ' + HG.fmtDate(a.applied_at) + '</div>' +
          /* File CV thật trên máy chủ (backend/uploads) */
          (function () {
            var cvRec = byId(cvs, a.cv_id), cvUrl = HG.resolveFileUrl((cvRec && cvRec.file_url) || a.cv_url || '');
            return '<div><strong>' + E(tr('emp.modal_cand_cv', 'CV đính kèm:')) + '</strong> ' + (cvUrl
              ? '<a href="' + E(cvUrl) + '" target="_blank" rel="noopener" style="font-weight:700;">' + I('file', 14) + ' ' + E((cvRec && cvRec.file_name) || 'CV') + '</a>'
              : '<span style="color:#d9485f;">' + E(tr('emp.modal_cand_no_cv', 'Không tìm thấy file CV')) + '</span>') + '</div>';
          })() +
          '<div style="margin-top:10px;"><strong>' + E(tr('emp.modal_cand_msg', 'Lời nhắn từ sinh viên:')) + '</strong><br><em style="color:#505c78;">"' + E(a.cover_letter || tr('emp.modal_cand_no_msg', 'Sinh viên không để lại lời nhắn.')) + '"</em></div></div>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;"><span>' + E(tr('emp.modal_cand_status', 'Trạng thái:')) + ' <i class="status ' + st[1] + '">' + E(st[0]) + '</i></span>' +
          '<div style="display:flex; gap:8px; flex-wrap:wrap;">' + candActionBtns(a, c.st).replace(/<button type="button" class="cv-action-btn" data-view-cand[^>]*>.*?<\/button>/, '') + '<button type="button" class="secondary-btn small" data-close>' + E(tr('common.close', 'Đóng')) + '</button></div></div>' +
          /* [ST4-04] Đánh giá ứng viên đã trúng tuyển + Khiếu nại ứng viên (API thật) */
          '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; padding-top:14px; border-top:1px dashed #e2e6f4;">' +
            (c.st === 'accepted' && c.u.id
              ? (HG.hasReviewed && HG.hasReviewed(c.u.id, c.j.id)
                ? '<span class="cv-action-btn" style="cursor:default; color:#2ba788;">' + I('check', 14) + ' ' + E(tr('emp.modal_cand_reviewed', 'Đã đánh giá ứng viên')) + '</span>'
                : '<button type="button" class="cv-action-btn ok" data-review-cand="' + a.id + '">' + E(tr('emp.modal_cand_review_btn', '★ Đánh giá ứng viên')) + '</button>')
              : '<span class="hint-line" style="margin:0;">' + E(tr('emp.modal_cand_review_hint', 'Có thể đánh giá ứng viên sau khi xác nhận trúng tuyển.')) + '</span>') +
            (c.u.id ? '<button type="button" class="cv-action-btn danger" data-report-cand="' + a.id + '">' + I('shield', 14) + ' ' + E(tr('emp.modal_cand_report_btn', 'Khiếu nại ứng viên')) + '</button>' : '') +
          '</div></div>',
        onMount: function (api) {
          api.box.addEventListener('click', function (e) {
            var b = e.target.closest('[data-cand-act]'); if (b) { api.close(); changeCandStatus(Number(b.dataset.id), b.dataset.candAct); return; }
            if (!HG.rr) return;
            if (e.target.closest('[data-review-cand]')) {
              api.close();
              HG.rr.openReviewModal({ targetUserId: c.u.id, targetName: c.u.full_name, jobId: c.j.id, jobTitle: c.j.title });
              return;
            }
            if (e.target.closest('[data-report-cand]')) {
              api.close();
              HG.rr.openReportModal({ targets: [
                { type: 'user', targetId: c.u.id, label: c.u.full_name },
                { type: 'application', targetId: a.id, label: 'Đơn ứng tuyển #' + a.id + ' – ' + c.j.title }
              ] });
            }
          });
        }
      });
    }

    var candToolbar = $('cand-toolbar');
    if (candToolbar) {
      candToolbar.addEventListener('click', function (e) { var b = e.target.closest('[data-cv]'); if (b) { candView = b.dataset.cv; renderEmployerCandidates(); } });
      candToolbar.addEventListener('change', function (e) { if (e.target.id === 'cand-job-select') { candJob = e.target.value; renderEmployerCandidates(); } });
    }
    var candFilterTabs = $('cand-filter-tabs');
    if (candFilterTabs) {
      candFilterTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cand-filter]');
        if (b) {
          candFilterTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); });
          b.classList.add('active'); activeCandFilter = b.dataset.candFilter; renderEmployerCandidates();
        }
      });
    }
    if (candFullEl) {
      candFullEl.addEventListener('click', function (e) {
        var v = e.target.closest('[data-view-cand]'); if (v) { openCandidateModal(Number(v.dataset.viewCand)); return; }
        var act = e.target.closest('[data-cand-act]'); if (act) changeCandStatus(Number(act.dataset.id), act.dataset.candAct);
      });
      /* Kéo thả thẻ giữa các cột Kanban */
      var dragId = null;
      candFullEl.addEventListener('dragstart', function (e) { var c = e.target.closest('.kb-card'); if (c) { dragId = Number(c.dataset.aid); c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (x) {} } });
      candFullEl.addEventListener('dragend', function (e) { dragId = null; var c = e.target.closest('.kb-card'); if (c) c.classList.remove('dragging'); candFullEl.querySelectorAll('.kb-col.over').forEach(function (x) { x.classList.remove('over'); }); });
      candFullEl.addEventListener('dragover', function (e) { var col = e.target.closest('.kb-col'); if (col && dragId) { e.preventDefault(); col.classList.add('over'); } });
      candFullEl.addEventListener('dragleave', function (e) { var col = e.target.closest('.kb-col'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
      candFullEl.addEventListener('drop', function (e) {
        var col = e.target.closest('.kb-col'); if (!col || !dragId) return; e.preventDefault(); col.classList.remove('over');
        var id = dragId; dragId = null;
        var a = HG.applications().filter(function (x) { return x.id === id; })[0]; if (!a) return;
        var to = col.dataset.col, cur = statusName(a.status_id);
        if (to === cur) return;
        if ((NEXT[cur] || []).indexOf(to) === -1) { showToast('Không thể chuyển hồ sơ từ "' + getCandLabel(cur)[0] + '" sang "' + getCandLabel(to)[0] + '".', 'error'); return; }
        changeCandStatus(id, to);
      });
    }
    /* Hồ sơ mới / ứng viên rút đơn: cập nhật ngay */
    function refreshCands() { renderEmployerOverview(); renderFullJobsList(); renderEmployerCandidates(); }
    window.addEventListener('storage', function (e) { if (e.key === 'hg_app_patches' || e.key === 'hg_apps') refreshCands(); });
    document.addEventListener('hg:notify', refreshCands);
    document.addEventListener('hg:synced', refreshCands);
    window.addEventListener('languageChanged', function () {
      refreshCands();
      if (!empDirty) syncEmployerProfile();
      if (typeof populateCategorySelect === 'function') populateCategorySelect();
      if (typeof renderPreview === 'function') renderPreview();
    });

    /* TAB 5: CÀI ĐẶT */
    var empPw = $('emp-pw-form'), empPref = $('emp-pref-form');
    if (empPw) {
      empPw.addEventListener('submit', function(e) {
        e.preventDefault();
        var ins = empPw.querySelectorAll('input[type=password]');
        [].forEach.call(ins, function (i) { i.classList.remove('invalid'); });
        var r = HG.changePassword(ins[0].value, ins[1].value, ins[2].value);
        if (r.error) { ins[r.field].classList.add('invalid'); ins[r.field].focus(); showToast(r.error, 'error'); return; }
        showToast('Đã đổi mật khẩu thành công! Lần đăng nhập sau hãy dùng mật khẩu mới.');
        empPw.reset();
      });
    }
    if (empPref) {
      empPref.addEventListener('submit', function(e) {
        e.preventDefault();
        showToast('Đã lưu tùy chọn thông báo tuyển dụng!');
      });
    }
  }

  /* =========================================================
     3. QUẢN TRỊ VIÊN (ADMIN)
     ========================================================= */
  if (role === 'admin') {
    var count = function (r) { return users.filter(function (u) { return u.role === r; }).length; };
    var updateAdminStats = function() {
      setStat('users', users.length, tr('adm.stat_users_sub', 'Toàn hệ thống'));
      setStat('students', count('student'), tr('adm.stat_students_sub', 'Tài khoản sinh viên'));
      setStat('employers', count('employer'), tr('adm.stat_employers_sub', 'Tài khoản nhà tuyển dụng'));
      setStat('jobs', JOBS.length, tr('adm.stat_jobs_sub', 'Tổng số tin'));
      var repStat = $('stat-report-count');
      if (repStat) repStat.textContent = reports.filter(function(r){ return r.status === 'pending'; }).length;
      var done = JOBS.filter(function (j) { return j.status === 'approved' || j.status === 'rejected' || j.status === 'locked' || j.status === 'expired'; });
      var rate = $('stat-approve-rate'); if (rate) rate.textContent = done.length ? Math.round(JOBS.filter(function (j) { return j.status === 'approved' || j.status === 'expired'; }).length / done.length * 100) + '%' : '—';
      var appsEl = $('stat-apps-total'); if (appsEl) appsEl.textContent = HG.applications().length;
      var tc = topCategory(); var hot = $('stat-hot-cat'); if (hot) { hot.textContent = tc ? tc.name : '—'; var hs = $('stat-hot-sub'); if (hs) hs.textContent = tc ? tr('adm.stat_hot_sub_fmt', tc.n + ' tin (' + Math.round(tc.n / Math.max(1, JOBS.length) * 100) + '%)', { n: tc.n, pct: Math.round(tc.n / Math.max(1, JOBS.length) * 100) }) : tr('adm.no_data', 'Chưa có dữ liệu'); }
      drawAdminCharts();

      /* KPI thật: GET /api/admin/statistics (ghi đè số tính tạm từ bộ nhớ).
         - Đang còn request ghi (duyệt tin, khóa TK, xử lý báo cáo...) chưa xong -> chưa gọi, vì server
           chưa cập nhật; adapter.js sẽ đồng bộ lại khi request xong (hg:synced -> gọi lại hàm này).
         - Nhiều lần gọi chồng nhau: chỉ áp dụng phản hồi của lần gọi MỚI NHẤT (tránh số cũ về sau ghi đè số mới). */
      if (HG.loadAdminKpi && !(HG.pendingRequests && HG.pendingRequests() > 0)) {
        var ticket = ++kpiTicket;
        HG.loadAdminKpi().then(function (k) {
          if (!k || ticket !== kpiTicket || (HG.pendingRequests && HG.pendingRequests() > 0)) return;
          var ku = k.users || {}, kj = k.jobs || {}, kr = k.reports || {}, ka = k.applications || {};
          setStat('users', ku.total || 0, tr('adm.stat_users_sub', 'Toàn hệ thống'));
          setStat('students', ku.students || 0, tr('adm.stat_students_sub', 'Tài khoản sinh viên'));
          setStat('employers', ku.employers || 0, tr('adm.stat_employers_sub', 'Tài khoản nhà tuyển dụng'));
          setStat('jobs', kj.total || 0, tr('adm.stat_jobs_sub', 'Tổng số tin'));
          var rp = $('stat-report-count'); if (rp) rp.textContent = kr.pending || 0;
          var ap = $('stat-apps-total'); if (ap) ap.textContent = ka.total || 0;
          var handled = (kj.approved || 0) + (kj.rejected || 0) + (kj.closed || 0);
          var ar = $('stat-approve-rate'); if (ar) ar.textContent = handled ? Math.round((kj.approved || 0) / handled * 100) + '%' : '—';
        });
      }
    };
    var kpiTicket = 0;

    function topCategory() {
      var cnt = {}; JOBS.forEach(function (j) { cnt[j.category_id] = (cnt[j.category_id] || 0) + 1; });
      var best = null; Object.keys(cnt).forEach(function (k) { var c = byId(job_categories, Number(k)); if (c && (!best || cnt[k] > best.n)) best = { name: c.name, n: cnt[k] }; });
      return best;
    }
    /* Biểu đồ thật: số người dùng (SV / NTD) tích lũy 6 tháng + tin theo ngành nghề */
    function drawAdminCharts() {
      var bars = document.querySelector('.admin-chart .bar-set');
      if (bars) {
        var now2 = new Date(), months = [], mPref = tr('adm.month_prefix', 'T');
        for (var i = 5; i >= 0; i--) { var d = new Date(now2.getFullYear(), now2.getMonth() - i + 1, 1); months.push({ label: mPref + (new Date(d.getFullYear(), d.getMonth() - 1, 1).getMonth() + 1), end: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01' }); }
        var series = months.map(function (m) {
          var f = function (r) { return users.filter(function (u) { return u.role === r || (u.orig_role === r); }).filter(function (u) { return (u.created_at || '').slice(0, 10) < m.end; }).length; };
          return { label: m.label, s: f('student'), e: f('employer') };
        });
        var max = Math.max.apply(null, series.map(function (x) { return Math.max(x.s, x.e); }).concat([1]));
        bars.innerHTML = series.map(function (x) {
          return '<span title="' + E(tr('adm.chart_bar_tip', x.label + ': ' + x.s + ' sinh viên, ' + x.e + ' nhà tuyển dụng', { label: x.label, s: x.s, e: x.e })) + '"><i style="height:' + Math.max(4, x.s / max * 100) + '%"></i><b style="height:' + Math.max(4, x.e / max * 100) + '%"></b><em class="bar-val">' + x.s + '/' + x.e + '</em><u class="bar-lab">' + E(x.label) + '</u></span>';
        }).join('');
      }
      var cc = $('admin-cat-chart');
      if (cc) {
        var rows = job_categories.map(function (c) { return { name: c.name, n: JOBS.filter(function (j) { return j.category_id === c.id && j.status !== 'draft'; }).length }; }).sort(function (a, b) { return b.n - a.n; });
        var mx = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
        cc.innerHTML = rows.length ? rows.map(function (r) { return '<div class="hbar"><span>' + E(r.name) + '</span><div><i style="width:' + (r.n / mx * 100) + '%"></i></div><b>' + r.n + '</b></div>'; }).join('') : HG.empty('chart', tr('adm.cat_empty_title', 'Chưa có danh mục nào'));
      }
    }
    updateAdminStats();

    /* Báo cáo gần đây ở Tab 0 */
    var secAct = $('admin-activity');
    function getRtypeMap() {
      return {
        job: tr('adm.rtype.job', 'tin tuyển dụng'),
        employer: tr('adm.rtype.employer', 'nhà tuyển dụng'),
        user: tr('adm.rtype.user', 'người dùng'),
        application: tr('adm.rtype.application', 'đơn ứng tuyển'),
        other: tr('adm.rtype.other', 'khác')
      };
    }
    function getRstMap() {
      return {
        pending: [tr('adm.rst.pending', 'Chờ xử lý'), 'pending'],
        resolved: [tr('adm.rst.resolved', 'Đã giải quyết'), 'resolved'],
        rejected: [tr('adm.rst.rejected', 'Đã bác bỏ'), 'rejected']
      };
    }
    function renderAdminActivity() {
      if (!secAct) return;
      [].slice.call(secAct.children).forEach(function (el) { if (!el.classList.contains('panel-title')) el.remove(); });
      var RTYPE = getRtypeMap();
      var RST = getRstMap();
      var recent = reports.slice().sort(function (a, b) {
        return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || String(b.created_at || '').localeCompare(String(a.created_at || ''));
      }).slice(0, 6);
      after('admin-activity', recent.map(function (r) {
        var rtypeText = RTYPE[r.report_type] || (r.report_type || '');
        var rtargetText = HG.reportTargetLabel ? HG.reportTargetLabel(r) : '#' + r.target_id;
        var rstText = RST[r.status] ? RST[r.status][0] : (r.status || '');
        return '<div><span>' + I('shield') + '</span><p><strong>' + E(tr('adm.act_report_prefix', 'Báo cáo ' + rtypeText + ': ' + rtargetText, { type: rtypeText, target: rtargetText })) + '</strong><small>' +
          E(r.reason) + ' · ' + E(rstText) + '</small></p></div>';
      }).join('') || '<p class="empty-note">' + E(tr('adm.rep_empty_note', 'Chưa có báo cáo vi phạm nào.')) + '</p>');
    }
    renderAdminActivity();

    /* TAB 0 & 5: KIỂM DUYỆT TIN ĐĂNG */
    var mod = $('moderation-rows'), pending = $('pending-count');
    var fullModEl = $('admin-full-mod-rows');
    var activeModFilter = 'pending';
    function getModStatusPair(status) {
      var map = {
        pending: [tr('adm.mod_st.pending', 'Chờ duyệt'), 'pending'],
        approved: [tr('adm.mod_st.approved', 'Đã duyệt'), 'accepted'],
        rejected: [tr('adm.mod_st.rejected', 'Từ chối'), 'rejected'],
        locked: [tr('adm.mod_st.locked', 'Đã khóa'), 'rejected'],
        expired: [tr('adm.mod_st.expired', 'Hết hạn'), 'expired'],
        draft: [tr('adm.mod_st.draft', 'Nháp'), 'draft']
      };
      return map[status] || map.pending;
    }
    var modJobs = function () { return JOBS.filter(function (j) { return j.status !== 'draft'; }); };   /* nháp chưa gửi duyệt -> admin không thấy */

    /* Nút thao tác theo trạng thái: chờ duyệt -> Duyệt / Từ chối; đã duyệt -> Khóa; từ chối/khóa -> Duyệt lại */
    function modButtons(j, withText) {
      var t = function (x) { return withText ? ' ' + E(x) : ''; };
      var ic = withText ? '' : ' icon-btn';   // bảng rút gọn ở Tổng quan: nút chỉ có icon
      var appTitle = tr('adm.act_approve_title', 'Phê duyệt tin tuyển dụng');
      var rejTitle = tr('adm.act_reject_title', 'Từ chối tin (cần nhập lý do)');
      var lockTitle = tr('adm.act_lock_title', 'Ẩn tin (khóa tin, cần nhập lý do)');
      var reappTitle = tr('adm.act_reapprove_title', 'Duyệt lại và hiển thị tin');
      if (j.status === 'pending') return '<button class="approve' + ic + ' ok" data-act="approved" data-id="' + j.id + '" title="' + E(appTitle) + '" aria-label="' + E(appTitle + ' ' + j.title) + '">' + I('check', 16) + t(tr('adm.act_approve', 'Duyệt')) + '</button>' +
        '<button class="cv-action-btn danger' + ic + '" data-act="rejected" data-id="' + j.id + '" title="' + E(rejTitle) + '" aria-label="' + E(rejTitle + ' ' + j.title) + '">' + I('x', 16) + t(tr('adm.act_reject', 'Từ chối')) + '</button>';
      if (j.status === 'approved') return '<button class="cv-action-btn danger' + ic + (withText ? '' : ' warn') + '" data-act="locked" data-id="' + j.id + '" title="' + E(lockTitle) + '" aria-label="' + E(lockTitle + ' ' + j.title) + '">' + I('shield', 16) + t(tr('adm.act_lock', 'Khóa')) + '</button>';
      if (j.status === 'rejected' || j.status === 'locked') return '<button class="approve' + ic + ' ok" data-act="approved" data-id="' + j.id + '" title="' + E(reappTitle) + '" aria-label="' + E(reappTitle + ' ' + j.title) + '">' + I('check', 16) + t(tr('adm.act_reapprove', 'Duyệt lại')) + '</button>';
      return '<span style="color:#9aa2b2">—</span>';
    }

    var drawModeration = function () {
      var order = { pending: 0, approved: 1, rejected: 2, locked: 3, expired: 4 };
      var q = globalSearchQuery;
      var sorted = modJobs().sort(function (a, b) { return (order[a.status] == null ? 9 : order[a.status]) - (order[b.status] == null ? 9 : order[b.status]) || b.id - a.id; });
      if (q) {
        sorted = sorted.filter(function (j) {
          var c = companyOf(j);
          return matchText(j.title, q) || matchText(c.company_name, q);
        });
      }

      if (mod) {
        mod.innerHTML = sorted.length ? sorted.slice(0, 5).map(function (j) {
          var c = companyOf(j), cat = byId(job_categories, j.category_id), st = getModStatusPair(j.status);
          return '<div class="table-row"><span class="company-cell">' + HG.avatar(c.company_name, c.logo_url, { tag: 'i', type: 'company', className: 'company-logo' }) + '' +
            '<span><b>' + E(j.title) + '</b><small>' + E(c.company_name) + '</small></span></span>' +
            '<span>' + HG.fmtDate(j.created_at) + '</span><span>' + E(cat ? cat.name : '') + '</span>' +
            '<span><i class="status ' + st[1] + '">' + E(st[0]) + '</i></span>' +
            '<span class="table-actions">' + modButtons(j, false) + '</span></div>';
        }).join('') : (q ? '<div style="padding: 20px; text-align: center; color: #889;">' + E(tr('adm.mod_no_match', 'Không tìm thấy tin chờ duyệt khớp với "' + q + '".', { q: q })) + '</div>' : HG.empty('shield', tr('adm.mod_empty_title', 'Chưa có tin nào cần kiểm duyệt'), tr('adm.mod_empty_desc', 'Khi nhà tuyển dụng gửi tin, chúng sẽ xuất hiện tại đây.')));
      }

      var pendCount = JOBS.filter(function (j) { return j.status === 'pending'; }).length;
      if (pending) pending.textContent = tr('adm.pending_count_unit', pendCount + ' tin đang chờ', { n: pendCount });

      if (fullModEl) {
        var filteredMod = sorted.filter(function (j) {
          return activeModFilter === 'all' || j.status === activeModFilter || (activeModFilter === 'rejected' && j.status === 'locked');
        });
        if (!filteredMod.length) {
          if (q) {
            fullModEl.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), tr('adm.mod_search_empty_desc', 'Không có tin kiểm duyệt nào khớp với từ khóa "' + q + '".', { q: q }));
          } else {
            fullModEl.innerHTML = HG.empty('shield', activeModFilter === 'pending' ? tr('adm.mod_done_title', 'Không còn tin nào chờ duyệt') : tr('adm.mod_group_empty_title', 'Không có tin nào trong mục này'), activeModFilter === 'pending' ? tr('adm.mod_done_desc', 'Tuyệt vời! Bạn đã xử lý hết các tin đang chờ.') : tr('adm.mod_group_empty_desc', 'Chọn tab khác để xem các tin còn lại.'));
          }
        } else {
          fullModEl.innerHTML = filteredMod.map(function (j) {
            var c = companyOf(j), cat = byId(job_categories, j.category_id), st = getModStatusPair(j.status);
            var reason = (j.status === 'rejected' || j.status === 'locked') && j.rejected_reason ? '<small class="reason-line">' + E(tr('stu.reason_prefix', 'Lý do: ' + j.rejected_reason, { reason: j.rejected_reason })) + '</small>' : '';
            return '<div class="table-row"><span class="company-cell">' + HG.avatar(c.company_name, c.logo_url, { tag: 'i', type: 'company', className: 'company-logo' }) + '' +
              '<span><b>' + E(j.title) + '</b><small>' + E(c.company_name) + '</small>' + reason + '</span></span>' +
              '<span>' + HG.fmtDate(j.created_at) + '</span><span>' + E(cat ? cat.name : '') + '</span>' +
              '<span>' + E(HG.jobSalary(j)) + '</span>' +
              '<span><i class="status ' + st[1] + '">' + E(st[0]) + '</i></span>' +
              '<span class="table-actions">' + modButtons(j, true) + '</span></div>';
          }).join('');
        }
      }
    };

    /* Duyệt / Từ chối / Khóa: từ chối & khóa bắt buộc nhập lý do */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var jid = Number(b.dataset.id), act = b.dataset.act, job = byId(JOBS, jid);
      if (!job) return;
      var finish = function (reason) {
        HG.busy(b, function () {
          if (!HG.setJobStatus(jid, act, reason)) { showToast(tr('adm.toast_mod_err', 'Không cập nhật được tin, vui lòng thử lại.'), 'error'); return; }
          drawModeration(); renderAdminAllJobs(); updateAdminStats();
          showToast({
            approved: tr('adm.toast_mod_approved', 'Đã phê duyệt tin "' + job.title + '".', { title: job.title }),
            rejected: tr('adm.toast_mod_rejected', 'Đã từ chối tin và gửi lý do cho nhà tuyển dụng.'),
            locked: tr('adm.toast_mod_locked', 'Đã khóa tin "' + job.title + '".', { title: job.title })
          }[act]);
        }, 650);
      };
      if (act === 'approved') { finish(); return; }
      HG.askReason({
        title: act === 'locked' ? tr('adm.ask_lock_title', 'Khóa tin tuyển dụng') : tr('adm.ask_rej_title', 'Từ chối tin tuyển dụng'),
        subtitle: '<strong>' + E(job.title) + '</strong> · ' + E(companyOf(job).company_name),
        label: act === 'locked' ? tr('adm.ask_lock_lbl', 'Lý do khóa tin') : tr('adm.ask_rej_lbl', 'Lý do từ chối'),
        placeholder: tr('adm.ask_reason_ph', 'Nêu rõ lý do để nhà tuyển dụng chỉnh sửa lại tin…'),
        quick: act === 'locked'
          ? [tr('adm.ask_lock_qr1', 'Có báo cáo vi phạm từ người dùng'), tr('adm.ask_lock_qr2', 'Thông tin tuyển dụng không chính xác'), tr('adm.ask_lock_qr3', 'Nghi ngờ lừa đảo / thu phí ứng viên')]
          : [tr('adm.ask_rej_qr1', 'Thông tin mô tả chưa rõ ràng'), tr('adm.ask_rej_qr2', 'Mức lương không hợp lý / thiếu thông tin'), tr('adm.ask_rej_qr3', 'Nội dung vi phạm quy định đăng tin')],
        confirmText: act === 'locked' ? tr('adm.ask_lock_btn', 'Khóa tin') : tr('adm.ask_rej_btn', 'Từ chối tin'), danger: true
      }).then(function (reason) { if (reason) finish(reason); });
    });

    var modFilterTabs = $('admin-mod-filter-tabs');
    if (modFilterTabs) {
      modFilterTabs.addEventListener('click', function(e) {
        var b = e.target.closest('[data-mod-filter]');
        if (b) {
          modFilterTabs.querySelectorAll('.dash-pill').forEach(function(p){ p.classList.remove('active'); });
          b.classList.add('active');
          activeModFilter = b.dataset.modFilter;
          drawModeration();
        }
      });
    }
    drawModeration();

    /* TAB 1: QUẢN LÝ SINH VIÊN */
    var stuTableEl = $('admin-students-table');
    var stuSearch = $('admin-student-search');

    function renderAdminStudents() {
      if (!stuTableEl) return;
      var q = (globalSearchQuery || (stuSearch ? stuSearch.value : '')).trim();
      var stus = users.filter(function(u) { return u.role === 'student'; });

      var filtered = stus.filter(function(u) {
        if (!q) return true;
        var p = student_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        return matchText(u.full_name, q) ||
          matchText(u.email, q) ||
          matchText(u.phone, q) ||
          matchText(p.university || '', q) ||
          matchText(p.major || '', q) ||
          matchText('sinh vien', q);
      });

      if (!filtered.length) {
        stuTableEl.innerHTML = '<div style="padding: 32px; text-align: center; color: #889;">' +
          '<div style="font-size: 24px; margin-bottom: 8px;">' + I('search', 28) + '</div>' +
          '<div style="font-weight: 600; color: #27314d; margin-bottom: 4px;">' + E(tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa')) + '</div>' +
          '<small style="color: #7b8599;">' + E(tr('adm.stu_search_empty_desc', 'Không có sinh viên nào khớp với từ khóa "' + q + '".', { q: q })) + '</small>' +
          '</div>';
        return;
      }

      var notUpd = tr('adm.not_updated', 'Chưa cập nhật');
      stuTableEl.innerHTML = filtered.map(function(u) {
        var p = student_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        var isActive = u.status === 'active';
        return '<div class="table-row">' +
          '<span><b>' + E(u.full_name) + '</b><small>' + E(tr('adm.stu_id_prefix', 'Mã SV: #' + u.id, { id: u.id })) + '</small></span>' +
          '<span>' + E(u.email) + '<br><small>' + E(u.phone) + '</small></span>' +
          '<span>' + E(p.university || notUpd) + '<br><small>' + E(p.major || notUpd) + '</small></span>' +
          '<span>' + HG.fmtDate(u.created_at) + '</span>' +
          '<span><i class="' + (isActive ? 'admin-badge-active' : 'admin-badge-locked') + '">' + E(isActive ? tr('adm.st_active', 'Hoạt động') : tr('adm.st_locked', 'Đang khóa')) + '</i></span>' +
          '<span class="table-actions">' +
            '<button type="button" class="cv-action-btn' + (isActive ? ' danger' : '') + '" data-toggle-user="' + u.id + '">' +
              E(isActive ? tr('adm.btn_lock_user', 'Khóa') : tr('adm.btn_unlock_user', 'Mở khóa')) +
            '</button>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminStudents();
    if (stuSearch) stuSearch.addEventListener('input', renderAdminStudents);

    /* TAB 2: QUẢN LÝ NHÀ TUYỂN DỤNG */
    var empTableEl = $('admin-employers-table');
    var empSearch = $('admin-employer-search');

    function renderAdminEmployers() {
      if (!empTableEl) return;
      var q = (globalSearchQuery || (empSearch ? empSearch.value : '')).trim();
      var emps = users.filter(function(u) { return u.role === 'employer'; });

      var filtered = emps.filter(function(u) {
        if (!q) return true;
        var ep = employer_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        return matchText(ep.company_name || '', q) ||
          matchText(u.full_name, q) ||
          matchText(ep.representative_name || '', q) ||
          matchText(u.email, q) ||
          matchText(ep.industry || '', q) ||
          matchText('nha tuyen dung', q);
      });

      if (!filtered.length) {
        empTableEl.innerHTML = '<div style="padding: 32px; text-align: center; color: #889;">' +
          '<div style="font-size: 24px; margin-bottom: 8px;">' + I('search', 28) + '</div>' +
          '<div style="font-weight: 600; color: #27314d; margin-bottom: 4px;">' + E(tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa')) + '</div>' +
          '<small style="color: #7b8599;">' + E(tr('adm.emp_search_empty_desc', 'Không có nhà tuyển dụng nào khớp với từ khóa "' + q + '".', { q: q })) + '</small>' +
          '</div>';
        return;
      }

      var defComp = tr('adm.default_company', 'Doanh nghiệp');
      var defInd = tr('adm.default_industry', 'Bán lẻ');
      empTableEl.innerHTML = filtered.map(function(u) {
        var ep = employer_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        var jCount = JOBS.filter(function(j){ return j.employer_id === ep.id; }).length;
        var isVer = ep.verified;
        return '<div class="table-row">' +
          '<span class="company-cell">' + HG.avatar(ep.company_name || defComp, ep.logo_url, { tag: 'i', type: 'company', className: 'company-logo' }) +
            '<span><b>' + E(ep.company_name || defComp) + '</b><small>' + E(ep.company_address || 'Hà Nội') + '</small></span></span>' +
          '<span>' + E(ep.representative_name || u.full_name) + '</span>' +
          '<span>' + E(ep.industry || defInd) + '<br><small>' + E(u.email) + '</small></span>' +
          '<span>' + E(tr('adm.jobs_unit', jCount + ' tin', { n: jCount })) + '</span>' +
          '<span><i class="' + (isVer ? 'admin-badge-active' : 'admin-badge-locked') + '">' + E(u.status !== 'active' ? tr('adm.st_locked', 'Đang khóa') : isVer ? tr('adm.st_verified', 'Đã xác minh') : tr('adm.st_unverified', 'Chưa xác minh')) + '</i></span>' +
          '<span class="table-actions">' +
            '<button type="button" class="cv-action-btn" data-verify-emp="' + ep.id + '">' + E(isVer ? tr('adm.btn_unverify', 'Hủy duyệt') : tr('adm.btn_verify', 'Xác minh')) + '</button>' +
            '<button type="button" class="cv-action-btn' + (u.status === 'active' ? ' danger' : '') + '" data-toggle-user="' + u.id + '">' + E(u.status === 'active' ? tr('adm.btn_lock_user', 'Khóa') : tr('adm.btn_unlock_user', 'Mở khóa')) + '</button>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminEmployers();
    if (empSearch) empSearch.addEventListener('input', renderAdminEmployers);

    /* Event delegation for admin tables */
    document.addEventListener('click', function (e) {
      var uBtn = e.target.closest('[data-toggle-user]');
      if (uBtn) {
        var uid = Number(uBtn.dataset.toggleUser);
        var targetUser = byId(users, uid);
        if (!targetUser) return;
        if (targetUser.id === HG.ROOT_ADMIN_ID) { showToast(tr('adm.toast_root_no_lock', 'Không thể khóa tài khoản Admin gốc.'), 'error'); return; }
        if (targetUser.id === user.id) { showToast(tr('adm.toast_self_no_lock', 'Bạn không thể tự khóa tài khoản đang đăng nhập.'), 'error'); return; }
        var lock = targetUser.status === 'active';
        HG.confirm({
          title: lock ? tr('adm.confirm_lock_title', 'Khóa tài khoản?') : tr('adm.confirm_unlock_title', 'Mở khóa tài khoản?'),
          message: lock ? tr('adm.confirm_lock_msg', 'Tài khoản "' + targetUser.full_name + '" sẽ không thể đăng nhập cho đến khi được mở khóa.', { name: targetUser.full_name }) : tr('adm.confirm_unlock_msg', 'Tài khoản "' + targetUser.full_name + '" sẽ có thể đăng nhập trở lại.', { name: targetUser.full_name }),
          confirmText: lock ? tr('adm.confirm_lock_btn', 'Khóa tài khoản') : tr('adm.confirm_unlock_btn', 'Mở khóa'), cancelText: tr('common.cancel', 'Hủy'), danger: lock
        }).then(function (ok) {
          if (!ok) return;
          HG.busy(uBtn, function () {
            if (HG.setUserStatus(uid, lock ? 'blocked' : 'active') === false) { showToast(tr('adm.toast_user_lock_err', 'Không cập nhật được trạng thái tài khoản.'), 'error'); return; }
            renderAdminStudents(); renderAdminEmployers(); updateAdminStats();
            document.dispatchEvent(new CustomEvent('hg:admin-changed', { detail: { kind: 'user', id: uid, source: 'dashboard' } }));
            showToast(lock ? tr('adm.toast_user_locked', 'Đã khóa tài khoản ' + targetUser.full_name + '.', { name: targetUser.full_name }) : tr('adm.toast_user_unlocked', 'Đã mở khóa tài khoản ' + targetUser.full_name + '.', { name: targetUser.full_name }));
          }, 600);
        });
        return;
      }

      var vBtn = e.target.closest('[data-verify-emp]');
      if (vBtn) {
        var epid = Number(vBtn.dataset.verifyEmp);
        var targetEmp = byId(employer_profiles, epid);
        if (targetEmp) {
          HG.busy(vBtn, function () {
            HG.setEmpVerified(epid, !targetEmp.verified);
            renderAdminEmployers(); updateAdminStats();
            showToast(targetEmp.verified ? tr('adm.toast_emp_verified', 'Đã xác minh doanh nghiệp ' + targetEmp.company_name + '.', { name: targetEmp.company_name }) : tr('adm.toast_emp_unverified', 'Đã hủy xác minh doanh nghiệp.'));
            HG.notify(targetEmp.user_id, targetEmp.verified ? 'Doanh nghiệp của bạn đã được xác minh.' : 'Xác minh doanh nghiệp của bạn đã bị hủy.', { link: 'employer.html?tab=1', kind: 'info' });
          }, 600);
        }
        return;
      }
    });

    /* TAB 3: QUẢN LÝ VIỆC LÀM */
    var ajTableEl = $('admin-all-jobs-table');
    var ajSearch = $('admin-job-search');
    var activeAjFilter = 'all';

    function renderAdminAllJobs() {
      if (!ajTableEl) return;
      var q = (globalSearchQuery || (ajSearch ? ajSearch.value : '')).trim();
      var filtered = modJobs().filter(function(j) {
        var c = companyOf(j);
        var cat = byId(job_categories, j.category_id);
        var matchStatus = activeAjFilter === 'all' || j.status === activeAjFilter || (activeAjFilter === 'rejected' && j.status === 'locked');
        if (!matchStatus) return false;
        if (!q) return true;
        return matchText(j.title, q) ||
          matchText(c.company_name, q) ||
          matchText(cat ? cat.name : '', q) ||
          matchText(HG.typeLabel(j.job_type), q);
      });

      if (!filtered.length) {
        if (q) {
          ajTableEl.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), tr('adm.jobs_search_empty_desc', 'Không có tin tuyển dụng nào khớp với từ khóa "' + q + '".', { q: q }));
        } else {
          ajTableEl.innerHTML = HG.empty('briefcase', tr('adm.jobs_empty_title', 'Không tìm thấy tin tuyển dụng nào'), tr('adm.jobs_empty_desc', 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'));
        }
        return;
      }

      var viewTitle = tr('adm.view_job_detail_title', 'Xem chi tiết tin tuyển dụng');
      var lockTitle = tr('adm.act_lock_title', 'Ẩn tin (khóa tin, cần nhập lý do)');
      var reappTitle = tr('adm.act_reapprove_title', 'Duyệt lại và hiển thị tin');
      var delTitle = tr('adm.del_job_title_attr', 'Xóa tin tuyển dụng');
      ajTableEl.innerHTML = filtered.map(function(j) {
        var c = companyOf(j), cat = byId(job_categories, j.category_id), st = getModStatusPair(j.status);
        var typeTxt = HG.trVal ? HG.trVal('type', HG.typeLabel(j.job_type)) : HG.typeLabel(j.job_type);
        var catTxt = cat ? (HG.trVal ? HG.trVal('cat', cat.name) : cat.name) : '';
        return '<div class="table-row">' +
          '<span><b>' + E(j.title) + '</b><small>' + E(tr('adm.job_id_prefix', 'Mã tin: #' + j.id, { id: j.id })) + ' · ' + E(typeTxt) + '</small></span>' +
          '<span>' + E(c.company_name) + '</span>' +
          '<span>' + E(catTxt) + '</span>' +
          '<span>' + E(HG.jobSalary(j)) + '</span>' +
          '<span><i class="status ' + st[1] + '">' + E(st[0]) + '</i></span>' +
          '<span class="table-actions">' +
            (j.status === 'approved' ? '<a class="cv-action-btn icon-btn" href="job-detail.html?id=' + j.id + '" title="' + E(viewTitle) + '" aria-label="' + E(viewTitle + ' ' + j.title) + '">' + I('eye', 16) + '</a>' : '') +
            (j.status === 'approved' ? '<button type="button" class="cv-action-btn icon-btn warn" data-act="locked" data-id="' + j.id + '" title="' + E(lockTitle) + '" aria-label="' + E(lockTitle + ' ' + j.title) + '">' + I('shield', 16) + '</button>' : '') +
            ((j.status === 'locked' || j.status === 'rejected') ? '<button type="button" class="cv-action-btn icon-btn ok" data-act="approved" data-id="' + j.id + '" title="' + E(reappTitle) + '" aria-label="' + E(reappTitle + ' ' + j.title) + '">' + I('check', 16) + '</button>' : '') +
            '<button type="button" class="cv-action-btn icon-btn danger" data-del-admin-job="' + j.id + '" title="' + E(delTitle) + '" aria-label="' + E(delTitle + ' ' + j.title) + '">' + I('trash', 16) + '</button>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminAllJobs();

    if (ajSearch) ajSearch.addEventListener('input', renderAdminAllJobs);
    /* Thay đổi từ tab trình duyệt khác: tải lại dữ liệu & vẽ lại bảng (không F5 cả trang, không mất vị trí đang xem) */
    window.addEventListener('storage', function (e) {
      if (!/^hg_(new_jobs|job_status|job_deleted|user_status|categories|role_overrides|api_bootstrap_cache)$/.test(e.key || '')) return;
      clearTimeout(adminStorageTimer);
      adminStorageTimer = setTimeout(function () { if (HG.syncFromBackend) HG.syncFromBackend(); refreshAdminAll(); }, 250);
    });
    var adminStorageTimer = null;
    var ajFilterTabs = $('admin-jobs-filter-tabs');
    if (ajFilterTabs) {
      ajFilterTabs.addEventListener('click', function(e) {
        var b = e.target.closest('[data-aj-filter]');
        if (b) {
          ajFilterTabs.querySelectorAll('.dash-pill').forEach(function(p){ p.classList.remove('active'); });
          b.classList.add('active');
          activeAjFilter = b.dataset.ajFilter;
          renderAdminAllJobs();
        }
      });
    }

    if (ajTableEl) {
      ajTableEl.addEventListener('click', function(e) {
        var delBtn = e.target.closest('[data-del-admin-job]');
        if (delBtn) {
          var jid = Number(delBtn.dataset.delAdminJob);
          HG.confirm({
            title: tr('adm.del_job_confirm_title', 'Xóa bài đăng tuyển dụng?'),
            message: tr('adm.del_job_confirm_msg', 'Bài đăng #' + jid + ' sẽ bị xóa khỏi toàn hệ thống.', { id: jid }),
            confirmText: tr('adm.del_job_confirm_btn', 'Xác nhận xóa'),
            cancelText: tr('common.cancel', 'Hủy bỏ'),
            danger: true
          }).then(function(ok) {
            if (!ok) return;
            var dj = byId(JOBS, jid), ep = dj && byId(employer_profiles, dj.employer_id);
            HG.busy(delBtn, function () {
              if (!HG.deleteJob(jid)) { showToast(tr('adm.toast_del_job_err', 'Không xóa được bài đăng.'), 'error'); return; }
              if (ep) HG.notify(ep.user_id, 'Tin "' + dj.title + '" đã bị quản trị viên xóa khỏi hệ thống.', { link: 'employer.html?tab=2', kind: 'job' });
              renderAdminAllJobs(); drawModeration(); updateAdminStats();
              showToast(tr('adm.toast_del_job_ok', 'Đã xóa bài đăng #' + jid, { id: jid }));
            }, 600);
          });
        }
      });
    }

    /* TAB 4: BÁO CÁO VI PHẠM – [ST4-04] dữ liệu & xử lý qua API thật (PATCH /api/admin/reports/{id}) */
    var repTableEl = $('admin-reports-table');
    function reporterName(r) { var u = byId(users, r.reporter_id); return u ? u.full_name : tr('adm.rep_user_fallback', 'Người dùng #' + r.reporter_id, { id: r.reporter_id }); }
    function renderAdminReports() {
      if (!repTableEl) return;
      var RTYPE = getRtypeMap();
      var RSTAT = getRstMap();
      var q = globalSearchQuery;
      if (!reports.length) { repTableEl.innerHTML = HG.empty('shield', tr('adm.rep_empty_note', 'Chưa có báo cáo vi phạm nào'), tr('adm.rep_empty_desc', 'Các phản ánh từ người dùng sẽ hiển thị tại đây.')); return; }

      var filtered = reports.filter(function(r) {
        if (!q) return true;
        return matchText(r.reason, q) ||
          matchText(r.report_type, q) ||
          matchText(RTYPE[r.report_type] || '', q) ||
          matchText(HG.reportTargetLabel ? HG.reportTargetLabel(r) : '', q) ||
          matchText(reporterName(r), q) ||
          matchText(String(r.target_id), q);
      }).sort(function (a, b) {
        var pa = a.status === 'pending' ? 0 : 1, pb = b.status === 'pending' ? 0 : 1;
        return pa - pb || String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });

      if (!filtered.length) {
        repTableEl.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), tr('adm.rep_search_empty_desc', 'Không có báo cáo vi phạm nào khớp với từ khóa "' + q + '".', { q: q }));
        return;
      }

      repTableEl.innerHTML = filtered.map(function(r) {
        var st = RSTAT[r.status] || [tr('adm.rst.pending', 'Chờ xử lý'), 'pending'];
        var badge = r.status === 'pending' ? 'admin-badge-locked' : 'admin-badge-active';
        var rTypeLbl = RTYPE[r.report_type] || r.report_type;
        rTypeLbl = rTypeLbl.charAt(0).toUpperCase() + rTypeLbl.slice(1);
        return '<div class="table-row">' +
          '<span><b>' + E(rTypeLbl) + '</b><small>' + E(tr('adm.rep_by_prefix', '#' + r.id + ' · bởi ' + reporterName(r), { id: r.id, name: reporterName(r) })) + '</small></span>' +
          '<span>' + E(r.reason) + (r.admin_note && r.status !== 'pending' ? '<small style="display:block; color:#5b4bd6; margin-top:4px;">' + E(tr('adm.rep_note_prefix', 'Ghi chú: ' + r.admin_note, { note: r.admin_note })) + '</small>' : '') + '</span>' +
          '<span>' + E(HG.reportTargetLabel ? HG.reportTargetLabel(r) : tr('adm.rep_target_fallback', 'Đối tượng #' + r.target_id, { id: r.target_id })) + '</span>' +
          '<span>' + HG.fmtDate(r.created_at) + '</span>' +
          '<span><i class="' + badge + '">' + E(st[0]) + '</i></span>' +
          '<span class="table-actions">' +
            (r.status === 'pending' ? '<button type="button" class="cv-action-btn" data-resolve-rep="' + r.id + '">' + I('check', 14) + ' ' + E(tr('adm.btn_process_rep', 'Xử lý')) + '</button>' : '<span style="color:#2ba788; font-size:12px;">' + E(tr('adm.rep_done_label', 'Xong')) + '</span>') +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminReports();

    function openProcessReportModal(r) {
      var isJob = r.report_type === 'job';
      var RTYPE = getRtypeMap();
      var rTypeLbl = RTYPE[r.report_type] || r.report_type;
      rTypeLbl = rTypeLbl.charAt(0).toUpperCase() + rTypeLbl.slice(1);
      HG.modal.open({
        className: 'modal-reason',
        labelledBy: 'rep-proc-title',
        html: '<h2 id="rep-proc-title">' + E(tr('adm.proc_modal_title', 'Xử lý khiếu nại #' + r.id, { id: r.id })) + '</h2>' +
          '<p class="hint-line" style="margin:4px 0 12px;">' + E(rTypeLbl) + ': <b>' + E(HG.reportTargetLabel(r)) + '</b> · ' + E(tr('adm.proc_sender', 'Người gửi: ' + reporterName(r), { name: reporterName(r) })) + '</p>' +
          '<div style="background:#f8f9fe; border:1px solid #e2e6f4; border-radius:12px; padding:10px 12px; font-size:var(--fs-xs); margin-bottom:12px;">' + E(r.reason) + '</div>' +
          '<form novalidate>' +
            '<label>' + E(tr('adm.proc_note_lbl', 'Ghi chú xử lý (gửi tới người khiếu nại)')) + '<textarea rows="3" maxlength="2000" data-note placeholder="' + E(tr('adm.proc_note_ph', 'Ví dụ: Đã xác minh vi phạm và yêu cầu doanh nghiệp điều chỉnh tin.')) + '"></textarea></label>' +
            (isJob ? '<label style="display:flex; align-items:center; gap:8px; font-weight:600; margin-top:10px;"><input type="checkbox" data-remove-job style="width:auto;"> ' + E(tr('adm.proc_remove_job_lbl', 'Gỡ tin tuyển dụng vi phạm (chỉ áp dụng khi Giải quyết)')) + '</label>' : '') +
            '<small class="field-err" data-err></small>' +
            '<div class="modal-actions"><button type="button" class="secondary-btn" data-decide="rejected">' + E(tr('adm.proc_btn_reject', 'Bác bỏ')) + '</button>' +
            '<button type="button" class="primary-btn" data-decide="resolved">' + E(tr('adm.proc_btn_resolve', 'Giải quyết')) + '</button></div>' +
          '</form>',
        onMount: function (api) {
          api.box.addEventListener('click', function (e) {
            var b = e.target.closest('[data-decide]'); if (!b) return;
            var note = api.box.querySelector('[data-note]').value.trim();
            var rm = api.box.querySelector('[data-remove-job]');
            var errEl = api.box.querySelector('[data-err]'); errEl.textContent = '';
            if (b.dataset.decide === 'rejected' && note.length < 5) { errEl.textContent = tr('adm.proc_err_note', 'Vui lòng ghi rõ lý do bác bỏ (tối thiểu 5 ký tự) để thông báo cho người khiếu nại.'); return; }
            api.box.querySelectorAll('[data-decide]').forEach(function (x) { if (x !== b) x.disabled = true; });
            HG.busyAsync(b, function () {
              return HG.processReport(r.id, b.dataset.decide, note, !!(rm && rm.checked));
            }).then(function (res) {
              api.box.querySelectorAll('[data-decide]').forEach(function (x) { x.disabled = false; });
              if (res && res.ok) {
                api.close(true);
                renderAdminReports(); renderAdminActivity(); updateAdminStats();
                if (res.job_removed) { renderAdminAllJobs(); drawModeration(); }
                showToast(b.dataset.decide === 'resolved'
                  ? (res.job_removed ? tr('adm.toast_rep_resolved_rm', 'Đã giải quyết khiếu nại #' + r.id + ' và gỡ tin vi phạm.', { id: r.id }) : tr('adm.toast_rep_resolved', 'Đã giải quyết khiếu nại #' + r.id + '.', { id: r.id }))
                  : tr('adm.toast_rep_rejected', 'Đã bác bỏ khiếu nại #' + r.id + '.', { id: r.id }));
                return;
              }
              if (res && res.busy) return;
              errEl.textContent = (res && res.error) || tr('adm.proc_err_fail', 'Không xử lý được khiếu nại.');
              showToast(errEl.textContent, 'error');
              if (res && res.status === 400) { HG.syncFromBackend(); }   /* đã được xử lý ở nơi khác -> tải lại */
            });
          });
        }
      });
    }

    if (repTableEl) {
      repTableEl.addEventListener('click', function(e) {
        var rBtn = e.target.closest('[data-resolve-rep]');
        if (!rBtn) return;
        var targetRep = byId(reports, Number(rBtn.dataset.resolveRep));
        if (targetRep) openProcessReportModal(targetRep);
      });
    }

    /* Định tuyến lọc theo Tab cho Quản trị viên */
    dispatchRoleSearch = function (q) {
      if (currentActiveTab === 0) {
        drawModeration();
      } else if (currentActiveTab === 1) {
        if (stuSearch && stuSearch.value !== q) stuSearch.value = q;
        renderAdminStudents();
      } else if (currentActiveTab === 2) {
        if (empSearch && empSearch.value !== q) empSearch.value = q;
        renderAdminEmployers();
      } else if (currentActiveTab === 3) {
        if (ajSearch && ajSearch.value !== q) ajSearch.value = q;
        renderAdminAllJobs();
      } else if (currentActiveTab === 4) {
        renderAdminReports();
      } else if (currentActiveTab === 5) {
        drawModeration();
      }
    };

    function refreshAdminAll() {
      updateAdminStats();
      drawModeration();
      renderAdminStudents();
      renderAdminEmployers();
      renderAdminAllJobs();
      renderAdminReports();
      renderAdminActivity();
    }
    document.addEventListener('hg:synced', refreshAdminAll);
    window.addEventListener('languageChanged', refreshAdminAll);
    /* Thao tác ở admin-extra.js (phân quyền, danh mục) -> cập nhật KPI, biểu đồ và các bảng liên quan ngay */
    document.addEventListener('hg:admin-changed', function (e) { if (e.detail && e.detail.source === 'extra') refreshAdminAll(); });
  }
})();
