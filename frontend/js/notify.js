/* Chuông thông báo dùng chung (header công khai + 3 dashboard).
   - Thông báo sự kiện: HG.notify(...) khi người dùng thao tác (lưu trong localStorage "hg_notifs").
   - Thông báo từ DỮ LIỆU THẬT (đồng bộ mỗi lần /api/bootstrap trả về – sự kiện hg:synced):
       Sinh viên      : hồ sơ được tiếp nhận / mời phỏng vấn / trúng tuyển / bị từ chối
       Nhà tuyển dụng : ứng viên mới nộp hồ sơ, tin được duyệt / bị từ chối
       Admin          : tin tuyển dụng mới chờ duyệt, khiếu nại chưa xử lý
     Mỗi thông báo có id cố định (VD "d-app-12-3") nên trạng thái ĐÃ ĐỌC được giữ nguyên trong
     localStorage, không bị reset khi tải lại trang.
   - Cập nhật gần thời gian thực: sự kiện nội bộ + sự kiện storage giữa các tab + quét định kỳ. */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user();
  if (!me) return;
  HG.seedNotifs(me);

  var KIND_ICON = { app: 'file', job: 'briefcase', shift: 'calendar', role: 'shield', report: 'alert', ok: 'check', info: 'bell' };
  var DAY = 864e5, FRESH_MS = 30 * DAY;   // sự kiện cũ hơn 30 ngày được coi là đã đọc ngay từ đầu
  var mounts = [], lastUnread = null;
  var esc = HG.esc;
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }

  /* ---------- Thông báo từ dữ liệu thật ---------- */
  function ts(v) { var t = v ? Date.parse(String(v).replace(' ', 'T')) : NaN; return isNaN(t) ? 0 : t; }
  /* Các mảng dữ liệu toàn cục (khởi tạo rỗng trong main.js, được adapter.js nạp từ /api/bootstrap) */
  var DATA = {
    jobs: function () { return typeof jobs !== 'undefined' ? jobs : []; },
    users: function () { return typeof users !== 'undefined' ? users : []; },
    applications: function () { return typeof applications !== 'undefined' ? applications : []; },
    student_profiles: function () { return typeof student_profiles !== 'undefined' ? student_profiles : []; },
    employer_profiles: function () { return typeof employer_profiles !== 'undefined' ? employer_profiles : []; },
    reports: function () { return typeof reports !== 'undefined' ? reports : []; }
  };
  function list(name) { var arr = DATA[name] ? DATA[name]() : []; return Array.isArray(arr) ? arr : []; }
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function fmtWhen(v) {
    var t = ts(String(v).replace('T', ' ')); if (!t) return '';
    var d = new Date(t), p = function (n) { return ('0' + n).slice(-2); };
    var isEn = typeof window.getCurrentLang === 'function' && window.getCurrentLang() === 'en';
    return p(d.getHours()) + ':' + p(d.getMinutes()) + (isEn ? ', ' : ' ngày ') + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function company(job) {
    var eps = list('employer_profiles'), e = job && (find(eps, job.employer_id) || find(eps, job.recruiter_id));
    return e ? e.company_name : tr('common.suggest_employer', 'Nhà tuyển dụng');
  }

  function derive() {
    var out = [], role = me.role === 'recruiter' ? 'employer' : me.role;
    var jobs = list('jobs'), apps = HG.applications ? HG.applications() : list('applications');
    if (role === 'student') {
      var sid = HG.studentId(me);
      apps.forEach(function (a) {
        if (a.student_id !== sid) return;
        var j = find(jobs, a.job_id) || { title: tr('detail.bc_jobs', 'Việc làm') }, c = company(j), when = ts(a.reviewed_at || a.updated_at || a.applied_at), text = '';
        switch (a.status_id) {
          case 2: text = tr('notif.stu_accepted_app', c + ' đã tiếp nhận hồ sơ ứng tuyển "' + j.title + '" của bạn.', { company: c, title: j.title }); break;
          case 3:
            text = a.interview_at
              ? tr('notif.stu_interview_at', 'Bạn được mời phỏng vấn vị trí "' + j.title + '" tại ' + c + ' lúc ' + fmtWhen(a.interview_at) + '.', { title: j.title, company: c, when: fmtWhen(a.interview_at) })
              : tr('notif.stu_interview', 'Bạn được mời phỏng vấn vị trí "' + j.title + '" tại ' + c + '.', { title: j.title, company: c, when: '' });
            break;
          case 4: text = tr('notif.stu_hired', 'Chúc mừng! Bạn đã trúng tuyển vị trí "' + j.title + '" tại ' + c + '.', { title: j.title, company: c }); break;
          case 5:
            text = a.status_reason
              ? tr('notif.stu_rejected_reason', 'Hồ sơ "' + j.title + '" chưa phù hợp với ' + c + '. Lý do: ' + a.status_reason, { title: j.title, company: c, reason: a.status_reason })
              : tr('notif.stu_rejected', 'Hồ sơ "' + j.title + '" chưa phù hợp với ' + c + '.', { title: j.title, company: c, reason: '' });
            break;
          default: return;
        }
        out.push({ id: 'd-app-' + a.id + '-' + a.status_id, text: text, ts: when, link: 'student.html?tab=4', kind: a.status_id === 4 ? 'ok' : 'app' });
      });
    } else if (role === 'employer') {
      var ep = list('employer_profiles').filter(function (e) { return e.user_id === me.id; })[0];
      if (!ep) return out;
      var own = jobs.filter(function (j) { return j.employer_id === ep.id; }), ownIds = own.map(function (j) { return j.id; });
      var sps = list('student_profiles'), us = list('users');
      apps.forEach(function (a) {
        if (a.status_id !== 1 || ownIds.indexOf(a.job_id) === -1) return;
        var sp = find(sps, a.student_id) || {}, u = find(us, sp.user_id) || { full_name: tr('notif.a_candidate', 'Một ứng viên') }, j = find(jobs, a.job_id) || {};
        out.push({ id: 'd-newapp-' + a.id, text: tr('notif.emp_new_app', u.full_name + ' vừa nộp hồ sơ vào vị trí "' + j.title + '".', { name: u.full_name, title: j.title }), ts: ts(a.applied_at), link: 'employer.html?tab=4', kind: 'app' });
      });
      own.forEach(function (j) {
        if (j.status === 'approved') out.push({ id: 'd-job-' + j.id + '-approved', text: tr('notif.emp_job_approved', 'Tin "' + j.title + '" đã được duyệt và đang hiển thị với sinh viên.', { title: j.title }), ts: ts(j.approved_at || j.updated_at), link: 'employer.html?tab=2', kind: 'ok' });
        else if (j.status === 'rejected') {
          var rText = j.rejected_reason ? (': ' + j.rejected_reason) : '.';
          out.push({ id: 'd-job-' + j.id + '-rejected', text: tr('notif.emp_job_rejected', 'Tin "' + j.title + '" bị từ chối' + rText, { title: j.title, reason: rText }), ts: ts(j.updated_at || j.created_at), link: 'employer.html?tab=2', kind: 'job' });
        }
      });
    } else if (role === 'admin') {
      jobs.forEach(function (j) {
        if (j.status === 'pending') out.push({ id: 'd-pend-' + j.id, text: tr('notif.adm_pending_job', 'Tin tuyển dụng mới chờ duyệt: "' + j.title + '" – ' + company(j) + '.', { title: j.title, company: company(j) }), ts: ts(j.updated_at || j.created_at), link: 'admin.html?tab=5', kind: 'job' });
      });
      list('reports').forEach(function (r) {
        if (r.status === 'pending') out.push({ id: 'd-rep-' + r.id, text: tr('notif.adm_pending_report', 'Khiếu nại mới cần xử lý: ' + r.reason, { reason: r.reason }), ts: ts(r.created_at), link: 'admin.html?tab=4', kind: 'report' });
      });
    }
    return out;
  }

  /* Gộp thông báo dữ liệu vào kho chung: thêm mới, cập nhật nội dung, gỡ mục không còn đúng
     (VD tin đã được duyệt thì bỏ "chờ duyệt"); GIỮ NGUYÊN cờ đã đọc. Chỉ ghi khi có thay đổi. */
  function syncDerived() {
    var fresh;
    try { fresh = derive(); } catch (e) { return; }
    var all = HG.read('hg_notifs', []), changed = false, now = Date.now(), byId = {};
    var eventTexts = {};
    all.forEach(function (n) { if (n.uid === me.id && String(n.id).indexOf('d-') !== 0) eventTexts[n.text] = true; });
    fresh.forEach(function (n) { if (!eventTexts[n.text]) byId[n.id] = n; });   // tránh trùng với thông báo sự kiện cùng nội dung
    all = all.filter(function (n) {
      if (n.uid !== me.id || String(n.id).indexOf('d-') !== 0) return true;
      var f = byId[n.id];
      if (!f) { changed = true; return false; }
      if (n.text !== f.text || n.link !== f.link) { n.text = f.text; n.link = f.link; changed = true; }
      delete byId[n.id];
      return true;
    });
    Object.keys(byId).forEach(function (id) {
      var f = byId[id], t = f.ts || now;
      all.push({ id: id, uid: me.id, text: f.text, ts: t, read: now - t > FRESH_MS, link: f.link, kind: f.kind });
      changed = true;
    });
    if (changed) HG.store.set('hg_notifs', all.slice(-160));
    return changed;
  }

  /* ---------- Giao diện ---------- */
  function unreadCount() { return HG.notifs(me.id).filter(function (n) { return !n.read; }).length; }

  function listHtml() {
    var items = HG.notifs(me.id).slice(0, 15);
    if (!items.length) return '<div class="notify-empty">' + HG.icon('bell', 22) + '<strong data-i18n="notif.empty_title">' + esc(tr('notif.empty_title', 'Chưa có thông báo nào')) + '</strong><small data-i18n="notif.empty_desc">' + esc(tr('notif.empty_desc', 'Thông báo về hồ sơ, lịch làm việc và tin tuyển dụng sẽ hiện ở đây.')) + '</small></div>';
    return items.map(function (n) {
      var unreadPrefix = tr('notif.unread_prefix', 'Chưa đọc: ');
      return '<div class="notify-item' + (n.read ? '' : ' unread') + '" data-nid="' + esc(n.id) + '" data-link="' + esc(n.link || '') + '" role="button" tabindex="0"' +
        ' aria-label="' + esc((n.read ? '' : unreadPrefix) + n.text) + '">' +
        '<span class="notify-item-icon kind-' + esc(n.kind || 'info') + '">' + HG.icon(KIND_ICON[n.kind] || 'bell', 16) + '</span>' +
        '<div class="notify-item-content"><strong>' + esc(n.text) + '</strong><small>' + HG.timeAgo(n.ts) + '</small></div>' +
        (n.read ? '' : '<span class="notify-unread-dot" aria-hidden="true"></span>') + '</div>';
    }).join('');
  }

  function paint(m) {
    var c = unreadCount();
    var titleTxt = tr('notif.title', 'Thông báo');
    var newChipTxt = c ? tr('notif.new_chip', c + ' mới', { count: c }) : '';
    var markAllTxt = tr('notif.mark_all', 'Đánh dấu tất cả đã đọc');
    var head = '<div class="notify-popover-head"><strong>' + esc(titleTxt) + (c ? ' <span class="notify-count-chip">' + esc(newChipTxt) + '</span>' : '') + '</strong>' +
      '<button type="button" data-readall' + (c ? '' : ' disabled') + '>' + HG.icon('check', 14) + ' ' + esc(markAllTxt) + '</button></div>';
    var html = head + '<div class="notify-popover-list">' + listHtml() + '</div>';
    if (m.lastHtml !== html) {                       // chỉ vẽ lại khi nội dung đổi (không làm mất focus / vị trí cuộn)
      var listEl = m.panel.querySelector('.notify-popover-list'), scroll = listEl ? listEl.scrollTop : 0;
      var focusId = document.activeElement && m.panel.contains(document.activeElement) ? document.activeElement.getAttribute('data-nid') : null;
      m.panel.innerHTML = html; m.lastHtml = html;
      listEl = m.panel.querySelector('.notify-popover-list'); if (listEl) listEl.scrollTop = scroll;
      if (focusId) { var f = m.panel.querySelector('[data-nid="' + focusId.replace(/"/g, '') + '"]'); if (f) f.focus(); }
    }
    var badge = m.btn.querySelector('.notif-count');
    if (!badge) { badge = document.createElement('b'); badge.className = 'notif-count'; m.btn.appendChild(badge); }
    badge.textContent = c > 9 ? '9+' : c; badge.hidden = !c;
    m.btn.setAttribute('aria-label', c ? tr('notif.aria_unread', 'Thông báo – ' + c + ' chưa đọc', { count: c }) : titleTxt);
    var old = m.btn.querySelector('i, .badge-dot'); if (old) old.style.display = 'none';
  }

  function setOpen(m, open) {
    m.panel.classList.toggle('show', open);
    m.btn.setAttribute('aria-expanded', String(open));
    if (open) paint(m);
  }

  /* Liên kết cùng trang dashboard + ?tab=N → chuyển tab ngay, không tải lại trang */
  function go(link) {
    if (!link) return;
    var a = document.createElement('a'); a.href = link;
    var samePage = a.pathname.split('/').pop() === location.pathname.split('/').pop();
    var tab = new URLSearchParams(a.search).get('tab');
    var tabBtn = samePage && tab !== null && document.querySelector('.dash-sidebar nav [data-tab="' + tab + '"]');
    if (tabBtn) tabBtn.click(); else location.href = link;
  }

  function mount(btn, panel) {
    var fresh = btn.cloneNode(true); btn.parentNode.replaceChild(fresh, btn);   // gỡ listener cũ
    var m = { btn: fresh, panel: panel }; mounts.push(m);
    fresh.setAttribute('aria-haspopup', 'true');
    fresh.setAttribute('aria-expanded', 'false');
    if (!panel.id) panel.id = 'notify-panel-' + mounts.length;
    fresh.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Thông báo');
    fresh.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(m, !panel.classList.contains('show'));
    });
    function openItem(it) {
      HG.markNotifsRead(me.id, it.dataset.nid);      // lưu đã đọc vào localStorage → badge giảm ngay
      setOpen(m, false);
      go(it.dataset.link);
    }
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('[data-readall]')) {
        if (!unreadCount()) return;
        HG.markNotifsRead(me.id);
        HG.toast(tr('notif.marked_all_toast', 'Đã đánh dấu tất cả thông báo là đã đọc.'), 'info');
        return;
      }
      var it = e.target.closest('[data-nid]'); if (it) openItem(it);
    });
    panel.addEventListener('keydown', function (e) {
      var it = e.target.closest && e.target.closest('[data-nid]');
      if (it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(it); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('show')) { setOpen(m, false); fresh.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('show') && !panel.contains(e.target)) setOpen(m, false);
    });
    paint(m);
  }

  function refresh(fromOtherSource) {
    var c = unreadCount();
    if (fromOtherSource && lastUnread !== null && c > lastUnread) {
      var latest = HG.notifs(me.id).filter(function (n) { return !n.read; })[0];
      if (latest) HG.toast(latest.text, 'info');
    }
    lastUnread = c;
    mounts.forEach(paint);
  }

  syncDerived();

  /* Header công khai */
  var hb = document.getElementById('header-notify-btn'), hp = document.getElementById('header-notify-popover');
  if (hb && hp) mount(hb, hp);
  /* Dashboard */
  var db = document.querySelector('.dash-header .notify');
  if (db) {
    var old = document.getElementById('dash-notify-dropdown'); if (old) old.remove();
    var dp = document.createElement('div'); dp.className = 'dash-notify-dropdown'; dp.id = 'dash-notify-dropdown';
    document.querySelector('.dash-header').appendChild(dp);
    mount(db, dp);
  }
  if (!mounts.length) return;
  lastUnread = unreadCount();

  document.addEventListener('hg:notify', function () { refresh(false); });
  document.addEventListener('hg:synced', function () { syncDerived(); refresh(true); });   // dữ liệu mới từ Backend
  window.addEventListener('storage', function (e) { if (e.key === 'hg_notifs') refresh(true); });
  window.addEventListener('languageChanged', function () {
    syncDerived();
    mounts.forEach(function (m) { m.lastHtml = ''; paint(m); });
  });
  setInterval(function () { refresh(true); }, 6000);          // cập nhật "x phút trước" + thông báo mới
})();
