/* Admin: Trung tâm khiếu nại, đánh giá & danh sách đen, hộp thư/thông báo hệ thống, nhật ký & xuất dữ liệu,
   chi tiết/đặt lại mật khẩu/xóa tài khoản, phân quyền theo từng nhóm chức năng. */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), E = HG.esc, $ = function (id) { return document.getElementById(id); };
  if (!me || me.role !== 'admin') return;
  var need = function (p) { if (HG.can(p)) return true; HG.toast('Bạn không có quyền "' + HG.PERMS[p] + '". Liên hệ Admin gốc để được cấp.', 'error'); return false; };
  var d10 = function (s) { return HG.fmtDate(String(s || '').slice(0, 10)); };

  /* ---------- Ẩn tab theo quyền ---------- */
  var TAB_PERM = { 1: 'users', 2: 'users', 3: 'moderate', 5: 'moderate', 4: 'reports', 6: 'categories', 8: 'reviews', 9: 'support' };
  Object.keys(TAB_PERM).forEach(function (t) { var b = document.querySelector('.dash-sidebar [data-tab="' + t + '"], [data-tab="' + t + '"]'); if (b && !HG.can(TAB_PERM[t])) b.style.display = 'none'; });
  var role7 = document.querySelector('[data-tab="7"]'); if (role7 && !HG.isRootAdmin()) role7.querySelector('span').textContent = 'Xem phân quyền';

  /* ---------- CSV ---------- */
  function csv(name, rows) {
    var body = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c).replace(/"/g, '""'); return /[",\n]/.test(c) ? '"' + c + '"' : c; }).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    HG.audit('Xuất dữ liệu', name + '.csv (' + (rows.length - 1) + ' dòng)'); HG.toast('Đã xuất ' + name + '.csv (' + (rows.length - 1) + ' dòng).');
  }

  /* ================= Trung tâm khiếu nại (tab 4) ================= */
  var rep = $('adm-reports'), rf = 'all', rq = '';
  function repRow(r) {
    var st = HG.REPORT_STATUS[r.status] || HG.REPORT_STATUS.pending, who = r.reporter_id ? HG.userName(r.reporter_id) + ({ student: ' (SV)', employer: ' (NTD)' }[r.reporter_role] || '') : 'Người dùng ẩn danh';
    return '<div class="hub-card"><div><b>#' + r.id + ' · ' + HG.REPORT_TYPES[r.report_type] + ': ' + E(HG.reportTargetLabel(r)) + '</b><small>Lý do: ' + E(r.reason) + (r.detail ? ' — ' + E(r.detail) : '') + '</small><small>Người gửi: ' + E(who) + ' · ' + d10(r.created_at) + '</small>' +
      (r.admin_note ? '<small class="reason-line" style="color:#2c5fc4!important">Kết luận: ' + E(r.admin_note) + (r.action_taken ? ' · Đã áp dụng: ' + E(r.action_taken) : '') + '</small>' : '') + '</div>' +
      '<div class="hub-side"><span class="status ' + st[1] + '">' + st[0] + '</span><button class="cv-action-btn" data-handle="' + r.id + '">' + (r.status === 'pending' || r.status === 'investigating' ? 'Xử lý' : 'Xem lại') + '</button></div></div>';
  }
  function renderReports() {
    if (!rep) return;
    var all = reports.slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    var cnt = function (s) { return s === 'all' ? all.length : all.filter(function (r) { return r.status === s; }).length; };
    var list = all.filter(function (r) { return (rf === 'all' || r.status === rf) && (!rq || (r.reason + ' ' + HG.reportTargetLabel(r) + ' ' + (r.detail || '')).toLowerCase().indexOf(rq) !== -1); });
    rep.innerHTML = '<div class="dash-filter-bar"><div class="dash-pills">' + [['all', 'Tất cả'], ['pending', 'Chờ xử lý'], ['investigating', 'Đang xem xét'], ['resolved', 'Đã giải quyết'], ['dismissed', 'Đã bác bỏ']].map(function (p) { return '<button class="dash-pill' + (rf === p[0] ? ' active' : '') + '" data-rf="' + p[0] + '">' + p[1] + ' <span class="pill-count">' + cnt(p[0]) + '</span></button>'; }).join('') + '</div><input class="dash-search-input" id="rep-q" placeholder="Tìm trong khiếu nại…" value="' + E(rq) + '"></div>' +
      (list.length ? list.map(repRow).join('') : HG.empty('shield', 'Không có khiếu nại nào', 'Khiếu nại do sinh viên và nhà tuyển dụng gửi sẽ hiển thị tại đây.'));
    var sc = $('stat-report-count'); if (sc) sc.textContent = all.filter(function (r) { return r.status === 'pending'; }).length;
    var q = $('rep-q'); if (q) q.addEventListener('input', function () { rq = q.value.trim().toLowerCase(); var pos = q.selectionStart; renderReports(); var n = $('rep-q'); n.focus(); n.setSelectionRange(pos, pos); });
  }
  function handleReport(id) {
    if (!need('reports')) return;
    var r = reports.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var who = r.reporter_id ? E(HG.userName(r.reporter_id)) : 'ẩn danh', done = r.status === 'resolved' || r.status === 'dismissed';
    var acts = [['none', 'Không áp dụng biện pháp']].concat([['warn', 'Gửi cảnh cáo cho đối tượng']], r.report_type === 'job' ? [['lock_job', 'Khóa tin tuyển dụng']] : [], [['lock_user', 'Khóa tài khoản đối tượng'], ['blacklist', 'Đưa vào danh sách đen toàn hệ thống']]);
    HG.formModal({
      title: 'Khiếu nại #' + r.id, subtitle: '<b>' + HG.REPORT_TYPES[r.report_type] + ':</b> ' + E(HG.reportTargetLabel(r)) + '<br><b>Người gửi:</b> ' + who + ' · ' + d10(r.created_at) + '<br><b>Lý do:</b> ' + E(r.reason) + '<br><b>Chi tiết:</b> ' + E(r.detail || '—') + (done ? '<br><b>Kết luận trước đó:</b> ' + E(r.admin_note) + (r.action_taken ? ' (' + E(r.action_taken) + ')' : '') : ''),
      fields: [{ name: 'status', label: 'Cập nhật trạng thái', type: 'select', required: true, options: [['investigating', 'Đang xem xét'], ['resolved', 'Đã giải quyết (báo cho người gửi)'], ['dismissed', 'Bác bỏ (không vi phạm)']], value: done ? r.status : 'investigating' },
        { name: 'act', label: 'Biện pháp xử lý (khi giải quyết)', type: 'select', options: acts }, { name: 'note', label: 'Ghi chú / kết luận', type: 'textarea', placeholder: 'Bắt buộc khi giải quyết hoặc bác bỏ. Nội dung này được gửi cho người khiếu nại.' }],
      confirmText: 'Lưu xử lý',
      onSubmit: function (v) { var x = HG.resolveReport(id, { status: v.status, act: v.act, note: v.note }); if (x.error) return x; renderReports(); return { ok: true, message: 'Đã cập nhật khiếu nại #' + id + '.' }; }
    });
  }
  if (rep) rep.addEventListener('click', function (e) { var f = e.target.closest('[data-rf]'); if (f) { rf = f.dataset.rf; renderReports(); return; } var h = e.target.closest('[data-handle]'); if (h) handleReport(+h.dataset.handle); });

  /* ================= Tab 8: đánh giá & danh sách đen ================= */
  var tr = $('adm-trust'), tt = 'reviews';
  function renderTrust() {
    if (!tr) return;
    var rv = HG.reviews().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }), bl = HG.blacklist(), gb = HG.globalBlocks();
    var html = '<div class="dash-pills hub-pills">' + [['reviews', 'Đánh giá', rv.length], ['bl', 'Danh sách đen của NTD', bl.length], ['gb', 'Hạn chế toàn hệ thống', Object.keys(gb).length]].map(function (p) { return '<button class="dash-pill' + (tt === p[0] ? ' active' : '') + '" data-tt="' + p[0] + '">' + p[1] + ' <span class="pill-count">' + p[2] + '</span></button>'; }).join('') + '</div>';
    if (tt === 'reviews') html += rv.length ? rv.map(function (r) {
      return '<div class="hub-card"><div><span class="star-line">' + HG.stars(r.rating) + '</span> <b>' + E(HG.userName(r.from_uid)) + ' → ' + E(HG.userName(r.to_uid)) + '</b><small>' + E(r.comment) + '</small><small>' + d10(r.created_at) + (r.status === 'hidden' ? ' · <b class="reason-line">Đã ẩn: ' + E(r.mod_note || '') + '</b>' : '') + '</small></div>' +
        '<div class="hub-side">' + (r.status === 'hidden' ? '<button class="cv-action-btn" data-show="' + r.id + '">Hiện lại</button>' : '<button class="cv-action-btn danger" data-hide="' + r.id + '">Ẩn đánh giá</button>') + '</div></div>'; }).join('') : HG.empty('sparkle', 'Chưa có đánh giá nào', '');
    else if (tt === 'bl') html += bl.length ? bl.map(function (b) { var sp = HG.studentProfile(b.student_id) || {}, ep = HG.employerProfile(b.employer_id) || {};
      return '<div class="hub-card"><div><b>' + E(ep.company_name || '') + ' chặn ' + E(HG.userName(sp.user_id)) + '</b><small class="reason-line">Lý do: ' + E(b.reason) + '</small><small>' + d10(b.created_at) + '</small></div><div class="hub-side"><button class="cv-action-btn" data-unbl="' + b.id + '">Gỡ chặn</button></div></div>'; }).join('') : HG.empty('shield', 'Chưa có ứng viên nào bị nhà tuyển dụng chặn', '');
    else {
      html += '<div class="hub-actions"><button class="primary-btn small" id="gb-add">+ Thêm tài khoản hạn chế</button></div><div class="hub-note">Tài khoản trong danh sách này: sinh viên không thể ứng tuyển ở bất kỳ nhà tuyển dụng nào; nhà tuyển dụng không thể đăng tin.</div>';
      html += Object.keys(gb).length ? Object.keys(gb).map(function (uid) { return '<div class="hub-card"><div><b>' + E(HG.userName(+uid)) + '</b><small class="reason-line">Lý do: ' + E(gb[uid].reason) + '</small><small>Bởi ' + E(HG.userName(gb[uid].by)) + ' · ' + d10(gb[uid].at) + '</small></div><div class="hub-side"><button class="cv-action-btn" data-ungb="' + uid + '">Gỡ hạn chế</button></div></div>'; }).join('') : HG.empty('shield', 'Chưa có tài khoản nào bị hạn chế', '');
    }
    tr.innerHTML = html;
  }
  if (tr) tr.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-tt]'))) { tt = b.dataset.tt; renderTrust(); return; }
    if ((b = e.target.closest('[data-hide]'))) { if (!need('reviews')) return; var id = +b.dataset.hide; HG.askReason({ title: 'Ẩn đánh giá', label: 'Lý do ẩn', min: 5, confirmText: 'Ẩn đánh giá', danger: true, quick: ['Ngôn từ xúc phạm', 'Nội dung sai sự thật', 'Spam / quảng cáo'] }).then(function (n) { if (n) { HG.setReviewStatus(id, 'hidden', n); renderTrust(); HG.toast('Đã ẩn đánh giá.'); } }); return; }
    if ((b = e.target.closest('[data-show]'))) { if (!need('reviews')) return; HG.setReviewStatus(+b.dataset.show, 'visible'); renderTrust(); HG.toast('Đã hiện lại đánh giá.'); return; }
    if ((b = e.target.closest('[data-unbl]'))) { if (!need('reports')) return; HG.blacklistRemove(+b.dataset.unbl); HG.audit('Gỡ chặn ứng viên (admin)', '#' + b.dataset.unbl); renderTrust(); HG.toast('Đã gỡ chặn.'); return; }
    if ((b = e.target.closest('[data-ungb]'))) { if (!need('reports')) return; HG.globalUnblock(+b.dataset.ungb); renderTrust(); HG.toast('Đã gỡ hạn chế.'); return; }
    if (e.target.closest('#gb-add')) {
      if (!need('reports')) return;
      var opts = users.filter(function (u) { return u.role !== 'admin' && u.status === 'active' && !HG.isGloballyBlocked(u.id); }).map(function (u) { return [u.id, u.full_name + ' (' + (u.role === 'student' ? 'SV' : 'NTD') + ')']; });
      HG.formModal({ title: 'Thêm tài khoản hạn chế', fields: [{ name: 'uid', label: 'Tài khoản', type: 'select', required: true, options: opts }, { name: 'reason', label: 'Lý do', type: 'textarea', required: true }], confirmText: 'Hạn chế', danger: true,
        onSubmit: function (v) { if (v.reason.length < 5) return { error: 'Lý do cần ít nhất 5 ký tự.' }; HG.globalBlock(+v.uid, v.reason); renderTrust(); return { ok: true, message: 'Đã thêm vào danh sách hạn chế.' }; } });
    }
  });

  /* ================= Tab 9: hộp thư & thông báo ================= */
  var ib = $('adm-inbox'), it = 'inbox';
  function renderInbox() {
    if (!ib) return;
    var cs = HG.contacts().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }), subs = HG.read('hg_subs', []);
    var html = '<div class="dash-pills hub-pills">' + [['inbox', 'Tin nhắn hỗ trợ', cs.filter(function (c) { return c.status === 'new'; }).length], ['bc', 'Gửi thông báo hệ thống', ''], ['subs', 'Đăng ký bản tin', subs.length]].map(function (p) { return '<button class="dash-pill' + (it === p[0] ? ' active' : '') + '" data-it="' + p[0] + '">' + p[1] + (p[2] !== '' ? ' <span class="pill-count">' + p[2] + '</span>' : '') + '</button>'; }).join('') + '</div>';
    if (it === 'inbox') html += cs.length ? cs.map(function (c) { return '<div class="hub-card"><div><b>' + E(c.name) + '</b> · ' + E(c.email) + '<small>' + E(c.message) + '</small>' + (c.reply ? '<small class="reason-line" style="color:#2c5fc4!important">Đã phản hồi: ' + E(c.reply) + '</small>' : '') + '<small>' + d10(c.created_at) + '</small></div><div class="hub-side"><span class="status ' + (c.status === 'new' ? 'pending' : 'accepted') + '">' + (c.status === 'new' ? 'Mới' : 'Đã phản hồi') + '</span>' + (c.status === 'new' ? '<button class="cv-action-btn" data-reply="' + c.id + '">Phản hồi</button>' : '') + '</div></div>'; }).join('') : HG.empty('file', 'Chưa có tin nhắn hỗ trợ', 'Tin nhắn từ form liên hệ và nút "Liên hệ hỗ trợ" sẽ hiển thị tại đây.');
    else if (it === 'bc') html += '<div class="panel" style="max-width:640px"><h3 style="margin-bottom:10px">Gửi thông báo tới người dùng</h3><div class="fm-grid"><label class="fm-field"><span class="fm-lab">Đối tượng nhận</span><select id="bc-aud"><option value="all">Tất cả người dùng</option><option value="student">Chỉ sinh viên</option><option value="employer">Chỉ nhà tuyển dụng</option></select></label><label class="fm-field"><span class="fm-lab">Nội dung</span><textarea id="bc-text" rows="4" maxlength="300" placeholder="Ví dụ: Hệ thống sẽ bảo trì lúc 23:00 tối nay."></textarea></label></div><p class="form-error" id="bc-err"></p><button class="primary-btn" id="bc-send" style="margin-top:12px">Gửi thông báo</button></div>';
    else html += '<div class="hub-actions"><button class="secondary-btn small" id="subs-csv">Xuất CSV</button></div>' + (subs.length ? subs.map(function (s) { return '<div class="hub-card"><div><b>' + E(s.email) + '</b><small>Đăng ký ' + d10(s.at) + '</small></div></div>'; }).join('') : HG.empty('file', 'Chưa có ai đăng ký nhận tin', ''));
    ib.innerHTML = html;
  }
  if (ib) ib.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-it]'))) { it = b.dataset.it; renderInbox(); return; }
    if (!need('support')) return;
    if ((b = e.target.closest('[data-reply]'))) { var id = +b.dataset.reply, c = HG.contacts().filter(function (x) { return x.id === id; })[0]; HG.formModal({ title: 'Phản hồi ' + c.name, subtitle: E(c.message), fields: [{ name: 'reply', label: 'Nội dung phản hồi', type: 'textarea', required: true }], confirmText: 'Gửi phản hồi', onSubmit: function (v) { var r = HG.replyContact(id, v.reply); if (r.error) return r; renderInbox(); return { ok: true, message: 'Đã gửi phản hồi.' }; } }); return; }
    if (e.target.closest('#bc-send')) { var s = $('bc-send'); HG.busy(s, function () { var r = HG.broadcast($('bc-text').value, $('bc-aud').value); if (r.error) { $('bc-err').textContent = r.error; return; } $('bc-err').textContent = ''; $('bc-text').value = ''; HG.toast('Đã gửi thông báo tới ' + r.n + ' người dùng.'); }, 700); return; }
    if (e.target.closest('#subs-csv')) csv('dang-ky-ban-tin', [['Email', 'Ngày đăng ký']].concat(HG.read('hg_subs', []).map(function (s) { return [s.email, s.at]; })));
  });

  /* ================= Tab 10: nhật ký & xuất dữ liệu ================= */
  var au = $('adm-audit'), aq = '';
  function renderAudit() {
    if (!au) return;
    var l = R_audit().filter(function (a) { return !aq || (a.action + ' ' + a.detail + ' ' + a.name).toLowerCase().indexOf(aq) !== -1; });
    au.innerHTML = '<div class="hub-actions export-row"><span class="hub-note" style="margin:0">Xuất dữ liệu (CSV):</span>' + [['users', 'Người dùng'], ['jobs', 'Tin tuyển dụng'], ['apps', 'Đơn ứng tuyển'], ['reports', 'Khiếu nại'], ['audit', 'Nhật ký']].map(function (x) { return '<button class="secondary-btn small" data-exp="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="dash-filter-bar"><input class="dash-search-input" id="aud-q" placeholder="Tìm trong nhật ký…" value="' + E(aq) + '"></div>' +
      (l.length ? l.slice(0, 120).map(function (a) { return '<div class="hub-card audit-row"><div><b>' + E(a.action) + '</b><small>' + E(a.detail) + '</small></div><div class="hub-side"><small>' + E(a.name) + (a.role === 'admin' ? '' : '') + '</small><small>' + String(a.at).slice(0, 16) + '</small></div></div>'; }).join('') : HG.empty('file', 'Chưa có thao tác nào được ghi lại', 'Mọi thao tác duyệt, khóa, phân quyền, xử lý khiếu nại… của quản trị viên sẽ được lưu tại đây.'));
    var q = $('aud-q'); if (q) q.addEventListener('input', function () { aq = q.value.trim().toLowerCase(); var p = q.selectionStart; renderAudit(); var n = $('aud-q'); n.focus(); n.setSelectionRange(p, p); });
  }
  function R_audit() { return HG.read('hg_audit', []); }
  if (au) au.addEventListener('click', function (e) {
    var b = e.target.closest('[data-exp]'); if (!b) return;
    var k = b.dataset.exp;
    if (k === 'users') csv('nguoi-dung', [['ID', 'Họ tên', 'Email', 'SĐT', 'Vai trò', 'Trạng thái', 'Ngày tạo']].concat(users.map(function (u) { return [u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at]; })));
    if (k === 'jobs') csv('tin-tuyen-dung', [['ID', 'Tiêu đề', 'Công ty', 'Lương', 'Địa điểm', 'Trạng thái', 'Hạn nộp']].concat(jobs.map(function (j) { var ep = HG.employerProfile(j.employer_id) || {}; return [j.id, j.title, ep.company_name, HG.jobSalary(j), j.location_text, j.status, j.end_date]; })));
    if (k === 'apps') csv('don-ung-tuyen', [['ID', 'Sinh viên', 'Tin', 'Trạng thái', 'Ngày nộp']].concat(HG.applications().map(function (a) { var sp = HG.studentProfile(a.student_id) || {}, j = jobs.filter(function (x) { return x.id === a.job_id; })[0] || {}; return [a.id, HG.userName(sp.user_id), j.title, (application_statuses.filter(function (s) { return s.id === a.status_id; })[0] || {}).name, a.applied_at]; })));
    if (k === 'reports') csv('khieu-nai', [['ID', 'Loại', 'Đối tượng', 'Lý do', 'Trạng thái', 'Kết luận', 'Ngày']].concat(reports.map(function (r) { return [r.id, r.report_type, HG.reportTargetLabel(r), r.reason, r.status, r.admin_note, r.created_at]; })));
    if (k === 'audit') csv('nhat-ky', [['Thời gian', 'Người thao tác', 'Thao tác', 'Chi tiết']].concat(R_audit().map(function (a) { return [a.at, a.name, a.action, a.detail]; })));
  });

  /* ================= Quản lý tài khoản: chi tiết / đặt lại mật khẩu / xóa ================= */
  function pw() { var A = 'abcdefghjkmnpqrstuvwxyz', N = '23456789', s = ''; for (var i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s + N[Math.floor(Math.random() * N.length)] + N[Math.floor(Math.random() * N.length)]; }
  document.addEventListener('click', function (e) {
    var det = e.target.closest('[data-user-detail]'), rs = e.target.closest('[data-reset-pw]'), del = e.target.closest('[data-del-user]');
    if (!det && !rs && !del) return;
    var id = +(det || rs || del).dataset[det ? 'userDetail' : rs ? 'resetPw' : 'delUser'], u = HG.userById(id); if (!u) return;
    if (det) {
      var apps = HG.applications(), rows = [['Email', u.email], ['SĐT', u.phone], ['Vai trò', u.role === 'student' ? 'Sinh viên' : 'Nhà tuyển dụng'], ['Trạng thái', u.status === 'active' ? 'Hoạt động' : 'Đang khóa'], ['Ngày tạo', d10(u.created_at)]];
      var against = reports.filter(function (r) { return r.target_user_id === id || (r.report_type === 'student' && (HG.studentProfile(r.target_id) || {}).user_id === id) || (r.report_type === 'employer' && (HG.employerProfile(r.target_id) || {}).user_id === id); });
      if (u.role === 'student') { var sp = student_profiles.filter(function (p) { return p.user_id === id; })[0] || {}, mine = apps.filter(function (a) { return a.student_id === sp.id; }); rows.push(['Trường / ngành', (sp.university || '—') + ' · ' + (sp.major || '—')], ['Số đơn ứng tuyển', mine.length + ' (trúng tuyển: ' + mine.filter(function (a) { return a.status_id === 4; }).length + ')'], ['Bị NTD chặn', HG.blacklist().filter(function (b) { return b.student_id === sp.id; }).length + ' lần']); }
      else { var ep = employer_profiles.filter(function (p) { return p.user_id === id; })[0] || {}, mj = jobs.filter(function (j) { return j.employer_id === ep.id; }), r = HG.avgRating(id); rows.push(['Doanh nghiệp', (ep.company_name || '—') + (ep.verified ? ' (đã xác minh)' : '')], ['Tin đã đăng', mj.length + ' (đang hiển thị: ' + mj.filter(function (j) { return j.status === 'approved'; }).length + ')'], ['Điểm đánh giá', r.count ? r.avg.toFixed(1) + '/5 · ' + r.count + ' đánh giá' : 'Chưa có']); }
      rows.push(['Khiếu nại liên quan', against.length], ['Hạn chế toàn hệ thống', HG.isGloballyBlocked(id) ? 'Có – ' + HG.globalBlocks()[id].reason : 'Không']);
      HG.modal.open({ className: 'modal-reason', dismissible: true, html: '<h2>' + E(u.full_name) + '</h2><div class="detail-rows">' + rows.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + E(r[1]) + '</b></div>'; }).join('') + '</div><div class="modal-actions"><button type="button" class="secondary-btn" data-close>Đóng</button></div>', onMount: function (api) { api.box.querySelector('[data-close]').addEventListener('click', function () { api.close(); }); } });
      return;
    }
    if (!need('users')) return;
    if (rs) {
      HG.confirm({ title: 'Đặt lại mật khẩu?', message: 'Hệ thống tạo mật khẩu tạm cho "' + u.full_name + '" và hiển thị một lần. Mật khẩu cũ sẽ không dùng được nữa.', confirmText: 'Đặt lại', cancelText: 'Hủy', danger: true }).then(function (ok) {
        if (!ok) return;
        HG.busy(rs, function () {
          var p = pw(), o = HG.read('hg_pw_overrides', {}); o[id] = p; HG.store.set('hg_pw_overrides', o); u.password = p; HG.audit('Đặt lại mật khẩu', u.full_name);
          HG.notify(id, 'Mật khẩu của bạn đã được quản trị viên đặt lại. Vui lòng đăng nhập và đổi mật khẩu mới.', { link: '', kind: 'info' });
          HG.modal.open({ className: 'modal-reason', dismissible: true, html: '<h2>Mật khẩu tạm</h2><p class="fm-sub">Gửi mật khẩu này cho <strong>' + E(u.full_name) + '</strong> (chỉ hiển thị một lần):</p><div class="pw-box">' + E(p) + '</div><div class="modal-actions"><button type="button" class="secondary-btn" data-copy>Sao chép</button><button type="button" class="primary-btn" data-close>Xong</button></div>', onMount: function (api) { api.box.querySelector('[data-close]').addEventListener('click', function () { api.close(); }); api.box.querySelector('[data-copy]').addEventListener('click', function () { try { navigator.clipboard.writeText(p); HG.toast('Đã sao chép mật khẩu.'); } catch (x) { HG.toast('Hãy tự chép mật khẩu hiển thị.', 'info'); } }); } });
        }, 500);
      });
      return;
    }
    if (del) {
      if (id === HG.ROOT_ADMIN_ID) { HG.toast('Không thể xóa Admin gốc.', 'error'); return; }
      HG.confirm({ title: 'Xóa tài khoản?', message: 'Tài khoản "' + u.full_name + '" sẽ bị xóa và không thể đăng nhập. ' + (u.role === 'employer' ? 'Các tin tuyển dụng của họ sẽ bị khóa. ' : '') + 'Thao tác được ghi vào nhật ký.', confirmText: 'Xóa tài khoản', cancelText: 'Hủy', danger: true }).then(function (ok) {
        if (!ok) return;
        HG.busy(del, function () {
          if (u.role === 'employer') { var ep = employer_profiles.filter(function (p) { return p.user_id === id; })[0]; if (ep) jobs.filter(function (j) { return j.employer_id === ep.id && j.status !== 'draft'; }).forEach(function (j) { HG.setJobStatus(j.id, 'locked', 'Tài khoản nhà tuyển dụng đã bị xóa.'); }); }
          HG.deleteUser(id); HG.toast('Đã xóa tài khoản ' + u.full_name + '.'); setTimeout(function () { location.reload(); }, 600);
        }, 600);
      });
    }
  });

  /* ================= Khoảng thời gian ở Tổng quan ================= */
  var btn = document.querySelector('[data-view="0"] .dash-welcome .secondary-btn');
  if (btn) {
    var sel = document.createElement('select'); sel.className = 'range-select'; sel.setAttribute('aria-label', 'Khoảng thời gian');
    sel.innerHTML = [[7, '7 ngày qua'], [30, '30 ngày qua'], [90, '90 ngày qua'], [365, '12 tháng qua']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === 30 ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    btn.replaceWith(sel);
    var apply = function () {
      var n = +sel.value, since = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10), fresh = function (arr) { return arr.filter(function (x) { return String(x.created_at || x.applied_at || '').slice(0, 10) >= since; }).length; };
      var ems = document.querySelectorAll('[data-view="0"] .stat-card em'), vals = [fresh(users), fresh(users.filter(function (u) { return u.role === 'student'; })), fresh(users.filter(function (u) { return u.role === 'employer'; })), fresh(jobs)];
      [].slice.call(ems, 0, 4).forEach(function (em, i) { em.textContent = '+' + vals[i] + ' mới trong ' + sel.options[sel.selectedIndex].text.replace(' qua', ''); });
    };
    sel.addEventListener('change', function () { apply(); HG.toast('Đã cập nhật số liệu: ' + sel.options[sel.selectedIndex].text + '.', 'info'); }); apply();
  }

  function all() { renderReports(); renderTrust(); renderInbox(); renderAudit(); }
  all();
  ['hg:social', 'hg:notify'].forEach(function (ev) { document.addEventListener(ev, all); });
  window.addEventListener('storage', function (e) { if (/^hg_(reports2|report_status|reviews|review_status|blacklist|gblock|contacts|subs|audit)$/.test(e.key || '')) all(); });
})();
