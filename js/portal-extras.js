/* Không gian cá nhân: tìm kiếm nhanh thật, tùy chọn thông báo có tác dụng, % hoàn thiện hồ sơ, nhắc ca làm, báo cáo tuần */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), E = HG.esc;
  if (!me) return;
  var role = me.role, tabBtn = function (n) { var b = document.querySelector('[data-tab="' + n + '"]'); if (b) b.click(); };

  /* ================= Tìm kiếm nhanh ================= */
  var old = document.querySelector('.dash-search');
  if (old) {
    var wrap = document.createElement('div'); wrap.className = 'dash-search live';
    wrap.innerHTML = HG.icon('search', 20) + '<input type="search" id="dash-q" placeholder="Tìm kiếm nhanh…  ( / )" autocomplete="off" aria-label="Tìm kiếm nhanh"><div class="dash-q-box" hidden></div>';
    old.replaceWith(wrap);
    var input = wrap.querySelector('input'), box = wrap.querySelector('.dash-q-box'), cur = [], idx = -1;
    var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'); };
    var uName = function (id) { return HG.userName(id); };
    function index() {
      var out = [], add = function (g, title, sub, fn) { out.push({ g: g, title: title, sub: sub || '', fn: fn, hay: norm(title + ' ' + (sub || '')) }); };
      var apps = HG.applications();
      if (role === 'student') {
        var sid = HG.studentId(me);
        (window.HG_JOBS || []).forEach(function (j) { add('Việc làm', j.title, j.company + ' · ' + j.salary, function () { location.href = 'job-detail.html?id=' + j.id; }); });
        apps.filter(function (a) { return a.student_id === sid; }).forEach(function (a) { var j = jobs.filter(function (x) { return x.id === a.job_id; })[0]; if (j) add('Đơn ứng tuyển của tôi', j.title, (HG.employerProfile(j.employer_id) || {}).company_name, function () { tabBtn(4); }); });
        HG.shiftsOf(sid).forEach(function (s) { add('Lịch làm việc', s.title, HG.fmtDate(s.date) + ' ' + s.from + '–' + s.to, function () { tabBtn(5); }); });
        [['Hồ sơ cá nhân', 1], ['CV của tôi', 2], ['Việc làm yêu thích', 3], ['Đơn ứng tuyển', 4], ['Lịch làm việc', 5], ['Yêu cầu & Đánh giá', 7], ['Cài đặt tài khoản', 6]].forEach(function (p) { add('Chuyển nhanh', p[0], '', function () { tabBtn(p[1]); }); });
      } else if (role === 'employer') {
        var ep = employer_profiles.filter(function (p) { return p.user_id === me.id; })[0] || {};
        jobs.filter(function (j) { return j.employer_id === ep.id; }).forEach(function (j) { add('Tin của tôi', j.title || '(Nháp)', j.status, function () { tabBtn(2); if (HG.openJobForm && j.status !== 'approved') HG.openJobForm(j.id); }); });
        var ids = jobs.filter(function (j) { return j.employer_id === ep.id; }).map(function (j) { return j.id; });
        apps.filter(function (a) { return ids.indexOf(a.job_id) !== -1; }).forEach(function (a) { var sp = HG.studentProfile(a.student_id) || {}; var j = jobs.filter(function (x) { return x.id === a.job_id; })[0]; add(a.status_id === 4 ? 'Nhân viên' : 'Ứng viên', uName(sp.user_id), (j ? j.title : '') + ' · ' + (sp.university || ''), function () { tabBtn(a.status_id === 4 ? 6 : 4); }); });
        [['Tổng quan', 0], ['Hồ sơ công ty', 1], ['Quản lý tin tuyển dụng', 2], ['Đăng tin mới', 3], ['Quản lý ứng viên', 4], ['Nhân viên & yêu cầu', 6], ['Danh sách đen', 7], ['Đánh giá & khiếu nại', 8], ['Cài đặt', 5]].forEach(function (p) { add('Chuyển nhanh', p[0], '', function () { tabBtn(p[1]); }); });
      } else {
        users.filter(function (u) { return u.status !== 'deleted' && u.role !== 'admin'; }).forEach(function (u) { add('Người dùng', u.full_name, u.email + ' · ' + (u.role === 'student' ? 'Sinh viên' : 'Nhà tuyển dụng'), function () { tabBtn(u.role === 'student' ? 1 : 2); setTimeout(function () { var q = document.querySelector(u.role === 'student' ? '#admin-student-search, [data-view="1"] .dash-search-input' : '#admin-employer-search, [data-view="2"] .dash-search-input'); if (q) { q.value = u.full_name; q.dispatchEvent(new Event('input', { bubbles: true })); } }, 150); }); });
        jobs.filter(function (j) { return j.status !== 'draft'; }).forEach(function (j) { add('Tin tuyển dụng', j.title, (HG.employerProfile(j.employer_id) || {}).company_name + ' · ' + j.status, function () { tabBtn(j.status === 'pending' ? 5 : 3); }); });
        reports.forEach(function (r) { add('Khiếu nại', '#' + r.id + ' ' + r.reason, HG.reportTargetLabel(r), function () { tabBtn(4); }); });
        job_categories.forEach(function (c) { add('Danh mục', c.name, '', function () { tabBtn(6); }); });
        [['Tổng quan', 0], ['Kiểm duyệt tin', 5], ['Trung tâm khiếu nại', 4], ['Đánh giá & danh sách đen', 8], ['Hộp thư & thông báo', 9], ['Nhật ký', 10], ['Phân quyền', 7]].forEach(function (p) { add('Chuyển nhanh', p[0], '', function () { tabBtn(p[1]); }); });
      }
      return out;
    }
    function run() {
      var q = norm(input.value).trim();
      if (!q) { box.hidden = true; cur = []; return; }
      var seen = {}; cur = index().filter(function (it) { return it.hay.indexOf(q) !== -1; }).slice(0, 30);
      idx = cur.length ? 0 : -1;
      box.innerHTML = cur.length ? cur.map(function (it, i) { var head = seen[it.g] ? '' : '<div class="dq-group">' + E(it.g) + '</div>'; seen[it.g] = 1; return head + '<div class="dq-item' + (i === idx ? ' active' : '') + '" data-i="' + i + '"><b>' + E(it.title) + '</b>' + (it.sub ? '<small>' + E(it.sub) + '</small>' : '') + '</div>'; }).join('') : '<div class="dq-empty">Không tìm thấy kết quả cho "' + E(input.value) + '"</div>';
      box.hidden = false;
    }
    function pick(i) { var it = cur[i]; if (!it) return; box.hidden = true; input.value = ''; input.blur(); it.fn(); }
    input.addEventListener('input', run); input.addEventListener('focus', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { box.hidden = true; input.blur(); return; }
      if (!cur.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + cur.length) % cur.length; [].forEach.call(box.querySelectorAll('.dq-item'), function (el, i) { el.classList.toggle('active', i === idx); }); var a = box.querySelector('.dq-item.active'); if (a) a.scrollIntoView({ block: 'nearest' }); e.preventDefault(); }
      if (e.key === 'Enter') { pick(idx); e.preventDefault(); }
    });
    box.addEventListener('mousedown', function (e) { var it = e.target.closest('[data-i]'); if (it) { e.preventDefault(); pick(+it.dataset.i); } });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) box.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); input.focus(); } });
  }

  /* ================= Tùy chọn thông báo (lưu thật + có tác dụng) ================= */
  var PREFS = {
    'pref-form': [['jobAlert', 'Nhận thông báo khi có việc làm mới được đăng'], ['viewed', 'Nhận thông báo khi nhà tuyển dụng xem hồ sơ của bạn'], ['shiftRemind', 'Nhắc nhở ca làm việc sắp tới (trước 1 ngày)']],
    'emp-pref-form': [['instant', 'Thông báo ngay khi có ứng viên mới nộp hồ sơ'], ['weekly', 'Nhận tóm tắt tuyển dụng hằng tuần (trong thông báo)'], ['autoConfirm', 'Tự động gửi xác nhận cho ứng viên khi nhận hồ sơ']]
  };
  Object.keys(PREFS).forEach(function (fid) {
    var f = document.getElementById(fid); if (!f) return;
    var labels = f.querySelectorAll('label'), cfg = PREFS[fid], p = HG.prefs(me.id);
    [].forEach.call(labels, function (l, i) {
      if (!cfg[i]) { l.remove(); return; }                      // bỏ tùy chọn không có tác dụng thật
      var cb = l.querySelector('input'); cb.dataset.key = cfg[i][0]; cb.checked = p[cfg[i][0]] !== false; l.querySelector('span').textContent = cfg[i][1];
    });
    f.addEventListener('submit', function () {
      var o = {}; f.querySelectorAll('input[data-key]').forEach(function (cb) { o[cb.dataset.key] = cb.checked; }); HG.setPrefs(me.id, o);
    });
  });

  /* ================= Hồ sơ sinh viên: % hoàn thiện thật ================= */
  var badge = document.querySelector('.prof-badge[style*="ff6fae"]');
  if (badge && role === 'student') {
    var calc = function () {
      var f = document.getElementById('student-profile-form'); if (!f) return;
      var fields = [].slice.call(f.querySelectorAll('input:not([type=checkbox]):not([type=file]), textarea')).filter(function (i) { return !/exp-|skill/.test(i.id) && i.type !== 'password'; });
      var filled = fields.filter(function (i) { return i.value.trim(); }).length, total = fields.length;
      var extra = [document.querySelectorAll('#student-skills-container > *').length > 0, document.querySelectorAll('#student-exp-list .exp-item').length > 0, document.querySelectorAll('.cv-card-item').length > 0];
      var score = Math.round((filled + extra.filter(Boolean).length) / (total + extra.length) * 100);
      badge.textContent = 'Hồ sơ hoàn thiện ' + score + '%';
    };
    setTimeout(calc, 300); document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('#student-profile-form')) calc(); }); document.addEventListener('click', function () { setTimeout(calc, 200); }); setInterval(calc, 4000);
  }

  /* ================= Nhắc nhở định kỳ ================= */
  var today = HG.now().slice(0, 10), tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (role === 'student') {
    HG.shiftsOf(HG.studentId(me)).filter(function (s) { return (s.date === today || s.date === tomorrow) && s.status === 'accepted'; }).forEach(function (s) {
      var k = 'hg_remind_' + me.id + '_' + s.id + '_' + s.date; if (HG.read(k, false)) return; HG.store.set(k, true);
      HG.notify(me.id, 'Nhắc lịch: ' + s.title + ' ' + (s.date === today ? 'hôm nay' : 'ngày mai') + ' lúc ' + s.from + '.', { link: 'student.html?tab=5', kind: 'shift', pref: 'shiftRemind' });
    });
  }
  if (role === 'employer') {
    var wk = 'hg_weekly_' + me.id, last = HG.read(wk, '');
    if (!last || (Date.now() - new Date(last).getTime()) > 7 * 86400000) {
      var ep2 = employer_profiles.filter(function (p) { return p.user_id === me.id; })[0] || {}, mine = jobs.filter(function (j) { return j.employer_id === ep2.id; }), ids2 = mine.map(function (j) { return j.id; });
      HG.store.set(wk, today);
      HG.notify(me.id, 'Tóm tắt tuần: ' + mine.filter(function (j) { return j.status === 'approved'; }).length + ' tin đang hiển thị, ' + HG.applications().filter(function (a) { return ids2.indexOf(a.job_id) !== -1; }).length + ' hồ sơ nhận được.', { link: 'employer.html', kind: 'info', pref: 'weekly' });
    }
  }
})();
