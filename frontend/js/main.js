/* =========================================================
   [ST4-04] Kho dữ liệu khởi tạo rỗng trên bộ nhớ (đã gỡ bỏ hoàn toàn mock-data.js).
   Toàn bộ dữ liệu được adapter.js nạp trực tiếp từ Backend FastAPI (/api/bootstrap).
   Riêng application_statuses là danh mục trạng thái chuẩn của hệ thống.
   ========================================================= */
var users = window.users = [];
var password_resets = window.password_resets = [];
var student_profiles = window.student_profiles = [];
var employer_profiles = window.employer_profiles = [];
var admin_profiles = window.admin_profiles = [];
var job_categories = window.job_categories = [];
var job_locations = window.job_locations = [];
var jobs = window.jobs = [];
var job_saves = window.job_saves = [];
var application_statuses = window.application_statuses = [
  { id: 1, name: 'submitted', description: 'Sinh viên đã gửi hồ sơ ứng tuyển.', display_order: 1 },
  { id: 2, name: 'reviewing', description: 'Nhà tuyển dụng đang xem xét hồ sơ.', display_order: 2 },
  { id: 3, name: 'interview', description: 'Sinh viên được mời phỏng vấn.', display_order: 3 },
  { id: 4, name: 'accepted', description: 'Hồ sơ ứng tuyển được chấp nhận.', display_order: 4 },
  { id: 5, name: 'rejected', description: 'Hồ sơ ứng tuyển bị từ chối.', display_order: 5 },
  { id: 6, name: 'withdrawn', description: 'Sinh viên đã rút hồ sơ ứng tuyển.', display_order: 6 }
];
var cvs = window.cvs = [];
var applications = window.applications = [];
var application_status_logs = window.application_status_logs = [];
var availabilities = window.availabilities = [];
var schedules = window.schedules = [];
var reports = window.reports = [];

/* Tiện ích dùng chung: icon, đăng nhập (session), việc đã lưu, ứng tuyển, thẻ việc làm, header */
(function () {
  'use strict';
  var HG = (window.HG = {});
  var memUid = null, savedMem = {}, appsMem = null;

  function read(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  HG.read = read; HG.write = write;

  /* ---- Tài khoản đăng ký mới: đồng bộ cùng Backend API (/api/bootstrap) ---- */
  read('hg_new_accounts', []).forEach(function (a) {
    users.push(a.user);
    (a.user.role === 'student' ? student_profiles : employer_profiles).push(a.profile);
  });

  /* Mật khẩu đã đổi trong Cài đặt tài khoản (demo) */
  var pwo = read('hg_pw_overrides', {});
  users.forEach(function (u) { if (pwo[u.id]) u.password = pwo[u.id]; });

  /* Phân quyền quản trị: admin gốc cấp / thu hồi quyền QTV cho tài khoản khác (lưu localStorage) */
  HG.ROOT_ADMIN_ID = 6;
  var roleOv = read('hg_role_overrides', {});
  users.forEach(function (u) { if (roleOv[u.id]) { u.orig_role = roleOv[u.id].orig; u.role = roleOv[u.id].role; u.granted_by = roleOv[u.id].by; } });
  HG.isRootAdmin = function (u) { u = u || HG.user(); return !!u && u.id === HG.ROOT_ADMIN_ID; };
  HG.setRole = function (uid, role) {
    var u = users.find(function (x) { return x.id === uid; }); if (!u || uid === HG.ROOT_ADMIN_ID) return false;
    var o = read('hg_role_overrides', {});
    if (role === 'admin') { o[uid] = { role: 'admin', orig: u.orig_role || u.role, by: HG.ROOT_ADMIN_ID }; u.orig_role = o[uid].orig; u.role = 'admin'; u.granted_by = HG.ROOT_ADMIN_ID; }
    else { var back = (o[uid] && o[uid].orig) || u.orig_role || 'student'; delete o[uid]; u.role = back; delete u.orig_role; delete u.granted_by; }
    write('hg_role_overrides', o); return true;
  };

  /* Khóa/mở khóa tài khoản, xác minh doanh nghiệp: lưu bền (admin) */
  var us = read('hg_user_status', {}); users.forEach(function (u) { if (us[u.id]) u.status = us[u.id]; });
  HG.setUserStatus = function (uid, status) {
    var u = users.find(function (x) { return x.id === uid; }); if (!u || uid === HG.ROOT_ADMIN_ID) return false;
    var o = read('hg_user_status', {}); o[uid] = status; write('hg_user_status', o); u.status = status; return true;
  };
  var ev = read('hg_emp_verified', {}); employer_profiles.forEach(function (ep) { if (ev[ep.id] != null) ep.verified = ev[ep.id]; });
  HG.setEmpVerified = function (epid, v) {
    var ep = employer_profiles.find(function (x) { return x.id === epid; }); if (!ep) return false;
    var o = read('hg_emp_verified', {}); o[epid] = !!v; write('hg_emp_verified', o); ep.verified = !!v; return true;
  };
  /* Xử lý khiếu nại: HG.setReportStatus / HG.processReport được định nghĩa trong adapter.js và gọi API thật
     (PATCH /api/admin/reports/{id}) – không còn lưu trạng thái khiếu nại ở localStorage. */

  /* Danh mục ngành nghề do admin chỉnh sửa (thay thế danh sách mặc định) */
  var catStore = read('hg_categories', null);
  if (catStore && catStore.length) { job_categories.length = 0; catStore.forEach(function (c) { job_categories.push(c); }); }
  HG.saveCategories = function () { write('hg_categories', job_categories.slice()); };

  HG.icon = function (name, size) {
    size = size || 20;
    return '<svg class="icon" width="' + size + '" height="' + size + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  };
  HG.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  HG.fmtDate = function (s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; };

  /* ---- Đăng nhập (so khớp với bảng users đồng bộ từ Backend API) ---- */
  HG.dashUrl = { student: 'student.html', employer: 'employer.html', admin: 'admin.html' };
  HG.user = function () {
    var id = read('hg_session', null) || memUid;
    return id ? users.find(function (u) { return u.id === id; }) || null : null;
  };
  var ROLE_NAME = { student: 'Ứng viên / Sinh viên', employer: 'Nhà tuyển dụng', admin: 'Quản trị viên' };
  HG.roleName = ROLE_NAME;
  /* role (tuỳ chọn): vai trò người dùng chọn trên form; tài khoản phải đúng vai trò đó */
  HG.login = function (email, password, role) {
    var tr = function (k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; };
    var u = users.find(function (x) { return x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password; });
    if (!u) return { error: tr('auth.err_wrong_cred', 'Email hoặc mật khẩu không đúng.') };
    if (u.status !== 'active') return { error: tr('auth.err_locked', 'Tài khoản đang bị khóa.') };
    if (role && u.role !== role && u.role !== 'admin') {
      var rName = tr('nav.role_full.' + u.role, ROLE_NAME[u.role]);
      return { error: tr('auth.err_wrong_role', 'Đây là tài khoản ' + rName + '. Hãy chọn đúng loại tài khoản ở trên.', { role: rName }) };
    }
    memUid = u.id; write('hg_session', u.id);
    return { user: u };
  };
  HG.emailExists = function (email) {
    return users.some(function (x) { return x.email.toLowerCase() === email.trim().toLowerCase(); });
  };
  /* Đăng ký: d = { role, full_name, email, phone, password, university?, company_name? } (demo – không mã hoá mật khẩu) */
  HG.register = function (d) {
    var tr = function (k, fb) { return typeof window.t === 'function' ? window.t(k) : fb; };
    if (HG.emailExists(d.email)) return { error: tr('auth.err_email_taken', 'Email này đã được đăng ký.') };
    var now = HG.now ? HG.now() : new Date().toISOString().slice(0, 19).replace('T', ' ');
    var nextId = function (list) { return list.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1; };
    var user = { id: nextId(users), email: d.email.trim(), password: d.password, full_name: d.full_name.trim(), phone: d.phone.trim(),
      role: d.role, status: 'active', created_at: now, updated_at: now };
    var profile = d.role === 'student'
      ? { id: nextId(student_profiles), user_id: user.id, university: d.university || '', major: '', bio: '', address: '', date_of_birth: null, avatar_url: '', created_at: now, updated_at: now }
      : { id: nextId(employer_profiles), user_id: user.id, company_name: d.company_name, representative_name: user.full_name, company_address: '', company_phone: user.phone,
          industry: '', description: '', logo_url: '', verified: false, created_at: now, updated_at: now };
    var list = read('hg_new_accounts', []); list.push({ user: user, profile: profile }); write('hg_new_accounts', list);
    users.push(user); (d.role === 'student' ? student_profiles : employer_profiles).push(profile);
    memUid = user.id; write('hg_session', user.id);           // đăng ký xong tự đăng nhập
    return { user: user };
  };
  /* Chuyển tới trang đăng nhập/đăng ký: o = { mode:'signin|signup', role, next, notice } */
  HG.goAuth = function (o) {
    o = o || {};
    var q = [];
    ['mode', 'role', 'next', 'notice'].forEach(function (k) { if (o[k]) q.push(k + '=' + encodeURIComponent(o[k])); });
    location.href = 'auth.html' + (q.length ? '?' + q.join('&') : '');
  };
  HG.logout = function () {
    memUid = null;
    var msg = typeof window.t === 'function' ? window.t('common.logged_out') : 'Bạn đã đăng xuất.';
    try { localStorage.removeItem('hg_session'); sessionStorage.setItem('hg_flash', JSON.stringify({ msg: msg, type: 'info' })); } catch (e) {}
    location.href = 'index.html';
  };
  /* id trong student_profiles / employer_profiles của user đang đăng nhập */
  HG.studentId = function (u) { var p = student_profiles.find(function (x) { return x.user_id === u.id; }); return p ? p.id : null; };
  HG.employerId = function (u) { var p = employer_profiles.find(function (x) { return x.user_id === u.id; }); return p ? p.id : null; };

  /* ---- Việc đã lưu (mỗi tài khoản một danh sách, khởi tạo từ job_saves) ---- */
  function savedKey() { var u = HG.user(); return 'hg_saved_' + (u ? u.id : 0); }
  HG.getSaved = function () {
    var k = savedKey();
    if (savedMem[k]) return savedMem[k];
    var v = read(k, null);
    if (!Array.isArray(v)) {
      var u = HG.user(), sid = u && u.role === 'student' ? HG.studentId(u) : null;
      v = job_saves.filter(function (s) { return s.student_id === sid; }).map(function (s) { return s.job_id; });
    }
    return (savedMem[k] = v);
  };
  HG.isSaved = function (id) { return HG.getSaved().indexOf(id) !== -1; };
  HG.toggleSaved = function (id) {
    var s = HG.getSaved(), k = savedKey();
    savedMem[k] = s.indexOf(id) !== -1 ? s.filter(function (x) { return x !== id; }) : s.concat(id);
    write(k, savedMem[k]);
    return HG.isSaved(id);
  };

  /* ---- Đơn ứng tuyển (mock + đơn mới) – mọi thay đổi trạng thái được lưu bền trong hg_app_patches ---- */
  HG.applications = function () {
    var patches = read('hg_app_patches', {});
    var list = applications.concat(read('hg_apps', []));
    list.forEach(function (a) { var p = patches[a.id]; if (p) Object.assign(a, p); });
    return list;
  };
  function userIdOfStudent(sid) { var sp = student_profiles.find(function (x) { return x.id === sid; }); return sp ? sp.user_id : null; }
  function jobAndOwner(jobId) {
    var j = jobs.find(function (x) { return x.id === jobId; }) || { title: 'Việc làm #' + jobId };
    var ep = employer_profiles.find(function (x) { return x.id === j.employer_id; });
    return { job: j, uid: ep ? ep.user_id : null, company: ep ? ep.company_name : 'Nhà tuyển dụng' };
  }
  var APP_MSG = {
    2: function (t, c) { return c + ' đã tiếp nhận hồ sơ của bạn cho vị trí "' + t + '".'; },
    3: function (t, c) { return c + ' mời bạn phỏng vấn vị trí "' + t + '".'; },
    4: function (t, c) { return 'Chúc mừng! Bạn đã trúng tuyển vị trí "' + t + '" tại ' + c + '.'; },
    5: function (t, c) { return c + ' đã từ chối hồ sơ của bạn cho vị trí "' + t + '".'; }
  };
  /* meta: { reason, interview_at, by: 'employer' | 'student' } */
  HG.setAppStatus = function (appId, statusId, meta) {
    meta = meta || {};
    var a = HG.applications().find(function (x) { return x.id === appId; }); if (!a) return false;
    var patches = read('hg_app_patches', {});
    var patch = { status_id: statusId, status_reason: meta.reason || '', interview_at: meta.interview_at || a.interview_at || '', reviewed_at: HG.now(), updated_at: HG.now() };
    patches[appId] = Object.assign(patches[appId] || {}, patch); write('hg_app_patches', patches); Object.assign(a, patch);
    var info = jobAndOwner(a.job_id);
    if (statusId === 6) { if (info.uid && HG.notify) HG.notify(info.uid, 'Ứng viên đã rút đơn ứng tuyển vị trí "' + info.job.title + '".', { link: 'employer.html?tab=4', kind: 'app' }); }
    else if (APP_MSG[statusId] && HG.notify) {
      var sUid = userIdOfStudent(a.student_id), txt = APP_MSG[statusId](info.job.title, info.company);
      if (statusId === 5 && meta.reason) txt += ' Lý do: ' + meta.reason;
      if (statusId === 3 && meta.interview_at) txt += ' Lịch hẹn: ' + meta.interview_at.replace('T', ' ') + '.';
      if (sUid) HG.notify(sUid, txt, { link: 'student.html?tab=4', kind: 'app' });
    }
    return true;
  };
  HG.apply = function (jobId, cvId, cover) {
    var u = HG.user();
    if (!u || u.role !== 'student') return { error: 'Cần đăng nhập tài khoản sinh viên.' };
    var sid = HG.studentId(u);
    if (HG.applications().some(function (a) { return a.student_id === sid && a.job_id === jobId && a.status_id !== 6; })) return { error: 'Bạn đã ứng tuyển việc này rồi.' };
    var list = read('hg_apps', []);
    list.push({ id: 1000 + list.length + 1, student_id: sid, job_id: jobId, cv_id: cvId || null, status_id: 1, cover_letter: cover || '', applied_at: HG.now(), reviewed_at: null, created_at: HG.now(), updated_at: HG.now() });
    write('hg_apps', list);
    var info = jobAndOwner(jobId);
    if (info.uid && HG.notify) HG.notify(info.uid, u.full_name + ' vừa ứng tuyển vị trí "' + info.job.title + '".', { link: 'employer.html?tab=4', kind: 'app' });
    return { ok: true };
  };

  /* ---- Ảnh minh họa mặc định khi tin chưa có ảnh / ảnh lỗi (dùng chung: thẻ việc làm, Tuyển gấp, trang chi tiết) ---- */
  var SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;
  HG.imgFallback = function (color, logo, extraClass, hidden) {
    var c = SAFE_COLOR.test(color || '') ? color : '#4f7dff';
    var alt = typeof window.t === 'function' ? window.t('detail.banner_alt') : 'Ảnh minh họa công việc';
    return '<div class="hg-img-fallback' + (extraClass ? ' ' + extraClass : '') + '" style="--c:' + c + (hidden ? ';display:none' : '') + '" role="img" aria-label="' + HG.esc(alt) + '">' +
      '<span class="hg-img-fallback-badge">' + HG.icon('briefcase', 26) + '</span>' +
      '<span class="thumb-watermark hg-img-fallback-mark">' + HG.esc(String(logo || 'H').charAt(0)) + '</span>' +
    '</div>';
  };
  /* onerror cho <img>: ẩn ảnh lỗi và hiện khối fallback ngay sau nó */
  HG.IMG_ONERROR = "this.onerror=null;this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';";

  /* Ảnh minh họa mặc định (SVG nhúng – không cần file, không bao giờ lỗi tải) */
  HG.IMG_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#eef1fa"/>' +
    '<g fill="none" stroke="#a9b3cc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="58" y="27" width="44" height="36" rx="5"/><circle cx="71" cy="39" r="4"/><path d="m60 60 13-13 9 9 7-7 11 11"/></g></svg>');
  /* Lưới an toàn cho MỌI <img> trên trang: ảnh lỗi (404, URL rác, mất mạng) mà chưa có xử lý riêng
     (onerror) sẽ được thay bằng ảnh minh họa mặc định -> không bao giờ hiện icon ảnh vỡ.
     Chạy ở pha capture vì sự kiện "error" của ảnh không nổi bọt (bubble). */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || img.onerror || img.hasAttribute('onerror')) return;
      if (img.src === HG.IMG_PLACEHOLDER) return;   /* ảnh SVG nhúng không thể lỗi -> không lặp vô hạn */
      img.src = HG.IMG_PLACEHOLDER;
    }, true);
  }

  /* ---- Thẻ việc làm (Ảnh bìa 16:9, object-fit: cover & fallback mặc định) ---- */
  function trVal(prefix, val) {
    if (!val || typeof window.t !== 'function') return val || '';
    var k = prefix + '.' + val;
    var res = window.t(k);
    return res !== k ? res : val;
  }
  HG.trVal = trVal;
  HG.jobCard = function (job) {
    var tr = function (k, fb) { return typeof window.t === 'function' ? window.t(k) : fb; };
    var tags = (job.tags || []).map(function (t, i) {
      var lbl = i === 0 ? trVal('cat', t) : trVal('type', t);
      return '<span' + (i ? ' class="pink-tag"' : '') + '>' + HG.esc(lbl) + '</span>';
    }).join('');
    var imgUrl = job.image_url ? (HG.resolveImageUrl ? HG.resolveImageUrl(job.image_url) : job.image_url) : '';
    var color = job.color || '#4f7dff';
    var logo = job.logo || (job.company ? job.company.charAt(0) : 'C');
    var thumbHtml = imgUrl
      ? '<div class="job-card-thumb">' +
          '<img src="' + HG.esc(imgUrl) + '" alt="' + HG.esc(job.title) + '" class="job-thumb-img" loading="lazy" decoding="async" onerror="' + HG.IMG_ONERROR + '">' +
          HG.imgFallback(color, logo, 'job-thumb-fallback', true) +
        '</div>'
      : '<div class="job-card-thumb thumb-fallback">' + HG.imgFallback(color, logo, 'job-thumb-fallback') + '</div>';
    var isS = HG.isSaved(job.id);
    var saveAria = isS ? tr('common.unsave_job', 'Bỏ lưu việc làm') : tr('common.save_job', 'Lưu việc làm');
    var locText = trVal('area', job.location);
    var typeText = trVal('type', job.type);
    return '<article class="job-card" data-id="' + job.id + '" data-href="job-detail.html?id=' + job.id + '">' +
      thumbHtml +
      '<div class="job-top">' + (HG.avatar ? HG.avatar(job.company, job.logo_url, { type: 'company', className: 'company-logo' }) : '<span class="company-logo" style="background:' + color + '">' + HG.esc(logo) + '</span>') +
      '<button type="button" class="save-btn' + (isS ? ' saved' : '') + '" aria-label="' + HG.esc(saveAria) + '" title="' + HG.esc(saveAria) + '">' + HG.icon('bookmark', 19) + '</button></div>' +
      '<div class="job-tags">' + tags + '</div>' +
      '<h3 title="' + HG.esc(job.title) + '">' + HG.esc(job.title) + '</h3><p class="company-name">' + HG.esc(job.company) + '</p>' +
      '<div class="job-meta"><span>' + HG.icon('pin', 16) + HG.esc(locText) + '</span><span>' + HG.icon('clock', 16) + HG.esc(typeText) + '</span></div>' +
      '<div class="job-bottom"><strong>' + HG.esc(job.salary) + '</strong><button type="button"><span data-i18n="common.view_detail">' + tr('common.view_detail', 'Xem chi tiết') + '</span> ' + HG.icon('arrow', 16) + '</button></div></article>';
  };
  HG.renderJobs = function (el, list) { el.innerHTML = list.map(HG.jobCard).join(''); };

  document.addEventListener('click', function (e) {
    if (e.target.closest('#logout-btn, [data-logout]')) { HG.requestLogout ? HG.requestLogout() : HG.logout(); return; }
    var save = e.target.closest('.job-card .save-btn');
    if (save) {
      e.stopPropagation();
      var tr = function (k, fb) { return typeof window.t === 'function' ? window.t(k) : fb; };
      var who = HG.user();
      if (!who) { HG.toast ? HG.toast(tr('common.login_to_save', 'Hãy đăng nhập tài khoản sinh viên để lưu việc làm.'), 'info') : 0; return; }
      if (who.role !== 'student') { HG.toast && HG.toast(tr('common.only_student_save', 'Chỉ tài khoản sinh viên mới lưu được việc làm.'), 'info'); return; }
      var jid = Number(save.closest('.job-card').dataset.id);
      HG.busy(save, function () {
        var nowSaved = HG.toggleSaved(jid);
        save.classList.toggle('saved', nowSaved);
        HG.toast(nowSaved ? tr('common.job_saved_toast', 'Đã lưu tin. Xem lại trong mục "Việc đã lưu" của bạn.') : tr('common.job_unsaved_toast', 'Đã bỏ lưu tin.'), nowSaved ? 'success' : 'info');
      }, 350);
      return;
    }
    var card = e.target.closest('.job-card[data-href]');
    if (card) location.href = card.dataset.href;
  });

  /* ---- Tự động kích hoạt class .active trên menu tương ứng với trang hiện tại ---- */
  var pagePath = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.header-inner nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href) {
      var targetPath = href.split('#')[0];
      if (targetPath === pagePath || (pagePath === '' && targetPath === 'index.html')) {
        a.classList.add('active');
      } else if (!href.startsWith('#')) {
        a.classList.remove('active');
      }
    }
  });

  /* ---- Header: đã đăng nhập thì hiện Avatar, Menu thả xuống & Thông báo ---- */
  function getInitials(name) {
    if (!name) return 'U';
    var p = name.trim().split(/\s+/);
    return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }

  var actions = document.getElementById('header-actions'), me = HG.user();
  if (actions && me) {
    var tr = function (k, fb) { return typeof window.t === 'function' ? window.t(k) : fb; };
    var roleKey = 'nav.role.' + me.role;
    var roleLabel = tr(roleKey, { student: 'Sinh viên', employer: 'Nhà tuyển dụng', admin: 'Quản trị viên' }[me.role] || me.role);
    var userInitial = getInitials(me.full_name);
    var dashUrl = HG.dashUrl[me.role];

    var roleLinks = {
      student: [
        { key: 'nav.stu.overview', label: 'Tổng quan không gian', href: dashUrl + '?tab=0', icon: 'home' },
        { key: 'nav.stu.profile', label: 'Hồ sơ cá nhân', href: dashUrl + '?tab=1', icon: 'user' },
        { key: 'nav.stu.cv', label: 'CV của tôi', href: dashUrl + '?tab=2', icon: 'file' },
        { key: 'nav.stu.saved', label: 'Việc làm yêu thích', href: dashUrl + '?tab=3', icon: 'bookmark' },
        { key: 'nav.stu.apps', label: 'Đơn ứng tuyển của tôi', href: dashUrl + '?tab=4', icon: 'briefcase' },
        { key: 'nav.stu.schedule', label: 'Lịch làm việc & Lịch rảnh', href: dashUrl + '?tab=5', icon: 'calendar' },
        { key: 'nav.stu.settings', label: 'Cài đặt tài khoản', href: dashUrl + '?tab=6', icon: 'settings' }
      ],
      employer: [
        { key: 'nav.emp.overview', label: 'Tổng quan tuyển dụng', href: dashUrl + '?tab=0', icon: 'home' },
        { key: 'nav.emp.profile', label: 'Hồ sơ doanh nghiệp', href: dashUrl + '?tab=1', icon: 'building' },
        { key: 'nav.emp.jobs', label: 'Quản lý tin tuyển dụng', href: dashUrl + '?tab=2', icon: 'file' },
        { key: 'nav.emp.post', label: 'Đăng tin tuyển dụng mới', href: dashUrl + '?tab=3', icon: 'plus' },
        { key: 'nav.emp.candidates', label: 'Quản lý ứng viên', href: dashUrl + '?tab=4', icon: 'users' },
        { key: 'nav.emp.settings', label: 'Cài đặt tài khoản', href: dashUrl + '?tab=5', icon: 'settings' }
      ],
      admin: [
        { key: 'nav.adm.overview', label: 'Tổng quan hệ thống', href: dashUrl + '?tab=0', icon: 'home' },
        { key: 'nav.adm.students', label: 'Quản lý sinh viên', href: dashUrl + '?tab=1', icon: 'users' },
        { key: 'nav.adm.employers', label: 'Quản lý nhà tuyển dụng', href: dashUrl + '?tab=2', icon: 'briefcase' },
        { key: 'nav.adm.jobs', label: 'Quản lý việc làm', href: dashUrl + '?tab=3', icon: 'file' },
        { key: 'nav.adm.reports', label: 'Thống kê & báo cáo', href: dashUrl + '?tab=4', icon: 'chart' },
        { key: 'nav.adm.moderation', label: 'Kiểm duyệt tin đăng', href: dashUrl + '?tab=5', icon: 'shield' }
      ]
    }[me.role] || [];

    var notifications = {
      student: [
        { title: 'Lumos Studio đã xem hồ sơ của bạn', time: '10 phút trước', unread: true, icon: 'file' },
        { title: 'Highlands Coffee tuyển 5 nhân viên phục vụ mới', time: '2 giờ trước', unread: true, icon: 'briefcase' },
        { title: 'Lịch làm việc sắp tới: Ca làm việc tại Highlands', time: 'Hôm nay 17:00', unread: false, icon: 'calendar' }
      ],
      employer: [
        { title: 'Có 2 ứng viên mới vừa nộp đơn ứng tuyển', time: '15 phút trước', unread: true, icon: 'users' },
        { title: 'Tin tuyển dụng "Nhân viên pha chế" đã được duyệt', time: '1 giờ trước', unread: true, icon: 'check' },
        { title: 'Báo cáo hiệu quả tuần: 24 lượt xem mới', time: 'Hôm qua', unread: false, icon: 'chart' }
      ],
      admin: [
        { title: 'Có 1 tin tuyển dụng mới đang chờ bạn kiểm duyệt', time: '5 phút trước', unread: true, icon: 'shield' },
        { title: '1 báo cáo mới cần xử lý từ sinh viên', time: '30 phút trước', unread: true, icon: 'alert' },
        { title: '12 tài khoản mới đăng ký thành công', time: 'Hôm nay', unread: false, icon: 'users' }
      ]
    }[me.role] || [];

    var notifyItemsHtml = notifications.map(function (n) {
      return '<div class="notify-item' + (n.unread ? ' unread' : '') + '">' +
        '<span class="notify-item-icon">' + HG.icon(n.icon, 16) + '</span>' +
        '<div class="notify-item-content"><strong>' + HG.esc(n.title) + '</strong><small>' + HG.esc(n.time) + '</small></div>' +
        '</div>';
    }).join('');

    var linksHtml = roleLinks.map(function (l) {
      return '<a class="dropdown-menu-item" href="' + l.href + '">' + HG.icon(l.icon, 16) + ' <span data-i18n="' + l.key + '">' + HG.esc(tr(l.key, l.label)) + '</span></a>';
    }).join('');

    actions.innerHTML =
      '<div class="header-user-wrapper">' +
        '<button class="header-notify-btn" id="header-notify-btn" type="button" aria-label="' + HG.esc(tr('nav.notifications', 'Thông báo')) + '" data-i18n-title="nav.notifications">' +
          HG.icon('bell', 18) +
          '<span class="badge-dot" id="header-badge-dot"></span>' +
        '</button>' +
        '<div class="header-notify-popover" id="header-notify-popover">' +
          '<div class="notify-popover-head"><strong>' + HG.esc(tr('nav.notifications', 'Thông báo')) + ' (' + notifications.filter(function(x){return x.unread;}).length + ')</strong><button type="button" id="mark-read-btn" data-i18n="nav.mark_all_read">' + HG.esc(tr('nav.mark_all_read', 'Đã đọc tất cả')) + '</button></div>' +
          '<div class="notify-popover-list">' + notifyItemsHtml + '</div>' +
        '</div>' +

        '<button class="header-user-btn" id="header-user-btn" type="button">' +
          '<span class="header-user-avatar">' + HG.esc(userInitial) + '</span>' +
          '<span>' + HG.esc(me.full_name) + '</span>' +
          '<span class="header-user-role-badge" data-i18n="' + roleKey + '">' + HG.esc(roleLabel) + '</span>' +
          HG.icon('chevron', 14) +
        '</button>' +
        '<div class="header-dropdown-menu" id="header-dropdown-menu">' +
          '<div class="dropdown-user-head">' +
            '<strong>' + HG.esc(me.full_name) + '</strong>' +
            '<small>' + HG.esc(me.email) + ' · <span data-i18n="' + roleKey + '">' + HG.esc(roleLabel) + '</span></small>' +
          '</div>' +
          '<div class="dropdown-menu-list">' +
            linksHtml +
            '<button class="dropdown-menu-item logout-item" id="logout-btn" type="button">' + HG.icon('logout', 16) + ' <span data-i18n="nav.logout">' + HG.esc(tr('nav.logout', 'Đăng xuất')) + '</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var userBtn = document.getElementById('header-user-btn');
    var userDropdown = document.getElementById('header-dropdown-menu');
    var notifyBtn = document.getElementById('header-notify-btn');
    var notifyPopover = document.getElementById('header-notify-popover');

    if (userBtn && userDropdown) {
      userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (notifyPopover) notifyPopover.classList.remove('show');
        userDropdown.classList.toggle('show');
      });
    }

    if (notifyBtn && notifyPopover) {
      notifyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (userDropdown) userDropdown.classList.remove('show');
        notifyPopover.classList.toggle('show');
      });
      var markRead = document.getElementById('mark-read-btn');
      if (markRead) {
        markRead.addEventListener('click', function (e) {
          e.stopPropagation();
          notifyPopover.querySelectorAll('.notify-item.unread').forEach(function(i){ i.classList.remove('unread'); });
          var dot = document.getElementById('header-badge-dot');
          if (dot) dot.remove();
          notifyPopover.querySelector('.notify-popover-head strong').textContent = tr('nav.notifications', 'Thông báo') + ' (0)';
        });
      }
    }

    document.addEventListener('click', function (e) {
      if (userDropdown && !userDropdown.contains(e.target) && userBtn && !userBtn.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
      if (notifyPopover && !notifyPopover.contains(e.target) && notifyBtn && !notifyBtn.contains(e.target)) {
        notifyPopover.classList.remove('show');
      }
    });

    /* Menu mobile: hiển thị hồ sơ cá nhân và nút đăng xuất - chỉ thêm 1 lần */
    document.querySelectorAll('.nav-auth').forEach(function (n) { n.remove(); });
    var mobileUserBlock = document.querySelector('.header-inner nav .nav-mobile-user');
    if (!mobileUserBlock) {
      var navEl = document.querySelector('.header-inner nav');
      var langMob = navEl && navEl.querySelector('.nav-lang-mobile');
      var mobileUserHtml =
        '<div class="nav-mobile-user" style="padding: 10px 12px; margin-top: 8px; border-top: 1px solid #edf0f8; display: flex; align-items: center; gap: 10px;">' +
          '<span class="header-user-avatar" style="width: 32px; height: 32px; font-size: 13px;">' + HG.esc(userInitial) + '</span>' +
          '<div><strong style="display:block; font-size: 13px;">' + HG.esc(me.full_name) + '</strong><small style="color:#7a8499; font-size: 11px;" data-i18n="' + roleKey + '">' + HG.esc(roleLabel) + '</small></div>' +
        '</div>' +
        '<a class="nav-auth" href="' + dashUrl + '">' + HG.icon('home', 16) + ' <span data-i18n="nav.dashboard">' + HG.esc(tr('nav.dashboard', 'Vào Dashboard')) + '</span></a>' +
        '<button class="nav-auth" style="color: #e54d6e;" type="button" data-logout>' + HG.icon('logout', 16) + ' <span data-i18n="nav.logout">' + HG.esc(tr('nav.logout', 'Đăng xuất')) + '</span></button>';
      if (langMob) {
        langMob.insertAdjacentHTML('beforebegin', mobileUserHtml);
      } else if (navEl) {
        navEl.insertAdjacentHTML('beforeend', mobileUserHtml);
      }
    }
  }
  /* ---- Hamburger menu (≤768px): mở/đóng mượt, đóng khi chọn link, chạm ra ngoài, nhấn Esc hoặc xoay ngang màn hình ---- */
  var toggle = document.getElementById('menu-toggle');
  var mainNav = document.querySelector('.header-inner nav');
  if (toggle && mainNav) {
    if (!mainNav.id) mainNav.id = 'site-nav';
    toggle.setAttribute('aria-controls', mainNav.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', typeof window.t === 'function' ? window.t('nav.menu') : 'Mở menu');
    var setMenu = function (open) {
      mainNav.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      var lbl = typeof window.t === 'function' ? window.t(open ? 'nav.close_menu' : 'nav.menu') : (open ? 'Đóng menu' : 'Mở menu');
      toggle.setAttribute('aria-label', lbl);
      var use = toggle.querySelector('use'); if (use) use.setAttribute('href', open ? '#i-x' : '#i-menu');
    };
    toggle.addEventListener('click', function (e) { e.stopPropagation(); setMenu(!mainNav.classList.contains('open')); });
    mainNav.addEventListener('click', function (e) { if (e.target.closest('a, button')) setMenu(false); });
    document.addEventListener('click', function (e) {
      if (mainNav.classList.contains('open') && !mainNav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mainNav.classList.contains('open')) { setMenu(false); toggle.focus(); }
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 769px)');
      var onMq = function () { if (mq.matches) setMenu(false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
  }
})();
