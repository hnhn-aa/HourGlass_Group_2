/* Nhà tuyển dụng: nhân viên đang làm (xếp ca, hoàn thành ca, cho nghỉ việc, chuyển vị trí), hộp yêu cầu từ nhân viên,
   danh sách đen ứng viên, đánh giá sinh viên, khiếu nại. */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), E = HG.esc;
  if (!me || me.role !== 'employer') return;
  var emp = employer_profiles.filter(function (p) { return p.user_id === me.id; })[0]; if (!emp) return;
  var today = HG.now().slice(0, 10), $ = function (id) { return document.getElementById(id); };
  var ownJobs = function () { return jobs.filter(function (j) { return j.employer_id === emp.id; }); };
  var jobOf = function (id) { return jobs.filter(function (j) { return j.id === id; })[0]; };
  var changed = function () { document.dispatchEvent(new CustomEvent('hg:social')); };
  var ownApps = function () { var ids = ownJobs().map(function (j) { return j.id; }); return HG.applications().filter(function (a) { return ids.indexOf(a.job_id) !== -1; }); };
  var studentOf = function (a) { var sp = HG.studentProfile(a.student_id) || {}; var u = HG.userById(sp.user_id) || { full_name: 'Ứng viên', email: '', phone: '' }; return { sp: sp, u: u }; };

  /* ---------- Chặn ứng viên (dùng cả từ Kanban/danh sách) ---------- */
  HG.openBlacklistForm = function (studentId, name, after) {
    HG.formModal({
      title: 'Đưa vào danh sách đen', subtitle: '<strong>' + E(name) + '</strong> sẽ không thể ứng tuyển các tin của bạn nữa và các hồ sơ đang chờ sẽ bị từ chối. Bạn có thể gỡ chặn bất cứ lúc nào.',
      fields: [{ name: 'reason', label: 'Lý do', type: 'textarea', required: true, placeholder: 'Ví dụ: Từng nghỉ ngang không báo trước…' }],
      confirmText: 'Chặn ứng viên', danger: true,
      onSubmit: function (v) { var r = HG.blacklistAdd(emp.id, studentId, v.reason); if (r.error) return r; changed(); if (after) after(); return { ok: true, message: 'Đã đưa ' + name + ' vào danh sách đen.' }; }
    });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-block-cand]'); if (!b) return;
    var a = HG.applications().filter(function (x) { return x.id === +b.dataset.blockCand; })[0]; if (!a) return;
    HG.openBlacklistForm(a.student_id, studentOf(a).u.full_name);
  });

  /* ================= Tab 6: Nhân viên & yêu cầu ================= */
  var staffRoot = $('emp-staff'), tabS = 'staff';
  function staff() { return ownApps().filter(function (a) { return a.status_id === 4 && !a.ended; }); }
  function formerStaff() { return ownApps().filter(function (a) { return a.status_id === 4 && a.ended; }); }
  function reqs() { return HG.requests().filter(function (r) { return r.employer_id === emp.id; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }); }

  function shiftsFor(sid) { return HG.shiftsOf(sid).filter(function (s) { return !s.job_id || ownJobs().some(function (j) { return j.id === s.job_id; }); }); }
  function renderStaff() {
    var S = staff(), R = reqs(), pend = R.filter(function (r) { return r.status === 'pending'; }).length, html = '';
    html += '<div class="dash-pills hub-pills">' + [['staff', 'Nhân viên đang làm', S.length], ['requests', 'Yêu cầu từ nhân viên', pend], ['former', 'Đã nghỉ việc', formerStaff().length]].map(function (p) { return '<button class="dash-pill' + (tabS === p[0] ? ' active' : '') + '" data-st="' + p[0] + '">' + p[1] + ' <span class="pill-count">' + p[2] + '</span></button>'; }).join('') + '</div>';
    if (tabS === 'staff') {
      html += S.length ? S.map(function (a) {
        var c = studentOf(a), j = jobOf(a.job_id), up = shiftsFor(a.student_id).filter(function (s) { return s.date >= today && (s.status === 'accepted' || s.status === 'pending'); }).sort(function (x, y) { return x.date.localeCompare(y.date); }).slice(0, 3);
        var done = shiftsFor(a.student_id).filter(function (s) { return s.date <= today && s.status === 'accepted'; });
        var r = HG.avgRating(c.u.id);
        return '<div class="hub-card staff-card"><div><b>' + E(c.u.full_name) + '</b> · ' + E(j ? j.title : '') + '<small>' + E(c.sp.university || '') + ' · ' + E(c.u.phone) + (r.count ? ' · <span class="star-line">' + HG.stars(r.avg) + '</span>' : '') + '</small>' +
          '<small>Ca sắp tới: ' + (up.length ? up.map(function (s) { return HG.fmtDate(s.date).slice(0, 5) + ' ' + s.from + '–' + s.to; }).join(' · ') : 'chưa có ca nào') + '</small></div>' +
          '<div class="hub-side wrap"><button class="cv-action-btn" data-assign="' + a.id + '">+ Xếp ca</button>' + (done.length ? '<button class="cv-action-btn ok" data-done="' + a.id + '">Hoàn thành ca (' + done.length + ')</button>' : '') +
          '<button class="cv-action-btn" data-xfer="' + a.id + '">Chuyển vị trí</button><button class="cv-action-btn" data-rate-st="' + a.id + '">★ Đánh giá</button><button class="cv-action-btn danger" data-end="' + a.id + '">Cho nghỉ việc</button><button class="cv-action-btn" data-report-st="' + a.id + '">⚑ Khiếu nại</button></div></div>';
      }).join('') : HG.empty('users', 'Chưa có nhân viên nào đang làm', 'Khi bạn chuyển hồ sơ sang "Trúng tuyển", nhân viên sẽ xuất hiện tại đây để quản lý ca làm.');
    } else if (tabS === 'requests') {
      html += R.length ? R.map(function (r) {
        var u = HG.userById(r.student_uid) || {}, j = jobOf(r.job_id), p = r.payload || {}, st = HG.REQ_STATUS[r.status];
        var detail = r.kind === 'swap_shift' ? 'Đổi ca ' + HG.fmtDate(r.shift.date) + ' (' + r.shift.from + '–' + r.shift.to + ') → ' + HG.fmtDate(p.new_date) + ' (' + p.new_from + '–' + p.new_to + ')' : r.kind === 'leave_shift' ? 'Xin nghỉ ca ' + HG.fmtDate(r.shift.date) + ' (' + r.shift.from + '–' + r.shift.to + ')' : r.kind === 'quit_job' ? 'Xin nghỉ việc, làm đến hết ' + HG.fmtDate(p.last_day) : 'Xin chuyển sang: ' + E((jobOf(+p.to_job_id) || {}).title || '');
        return '<div class="hub-card"><div><b>' + E(u.full_name) + '</b> · ' + HG.REQ_KIND[r.kind] + '<small>' + E(j ? j.title : '') + ' — ' + detail + '</small><small>Lý do: ' + E(r.reason) + '</small>' + (r.response ? '<small class="reason-line">Phản hồi của bạn: ' + E(r.response) + '</small>' : '') + '</div>' +
          '<div class="hub-side"><span class="status ' + st[1] + '">' + st[0] + '</span>' + (r.status === 'pending' ? '<div class="hub-btns"><button class="cv-action-btn ok" data-req-ok="' + r.id + '">Đồng ý</button><button class="cv-action-btn danger" data-req-no="' + r.id + '">Từ chối</button></div>' : '') + '</div></div>';
      }).join('') : HG.empty('calendar', 'Chưa có yêu cầu nào', 'Yêu cầu xin nghỉ ca, đổi ca, nghỉ việc, chuyển vị trí của nhân viên sẽ hiển thị tại đây.');
    } else {
      html += formerStaff().length ? formerStaff().map(function (a) { var c = studentOf(a); return '<div class="hub-card"><div><b>' + E(c.u.full_name) + '</b> · ' + E((jobOf(a.job_id) || {}).title || '') + '<small>Nghỉ từ ' + HG.fmtDate(a.ended_at) + ' · ' + (a.ended_by === 'employer' ? 'Bạn chấm dứt' : 'Nhân viên xin nghỉ') + '</small><small>Lý do: ' + E(a.ended_reason || '') + '</small></div><div class="hub-side"><button class="cv-action-btn" data-rate-st="' + a.id + '">★ Đánh giá</button></div></div>'; }).join('') : HG.empty('users', 'Chưa có nhân viên nào đã nghỉ', '');
    }
    staffRoot.innerHTML = html;
  }
  function appOf(id) { return HG.applications().filter(function (x) { return x.id === id; })[0]; }
  if (staffRoot) {
    staffRoot.addEventListener('click', function (e) {
      var q = function (s) { return e.target.closest(s); }, b;
      if ((b = q('[data-st]'))) { tabS = b.dataset.st; renderStaff(); return; }
      if ((b = q('[data-assign]'))) {
        var a = appOf(+b.dataset.assign), c = studentOf(a), j = jobOf(a.job_id);
        HG.formModal({ title: 'Xếp ca cho ' + c.u.full_name, subtitle: 'Vị trí: <strong>' + E(j.title) + '</strong>', fields: [{ name: 'date', label: 'Ngày', type: 'date', required: true, min: today, half: true }, { name: 'from', label: 'Từ giờ', type: 'time', required: true, half: true, value: '17:00' }, { name: 'to', label: 'Đến giờ', type: 'time', required: true, half: true, value: '22:00' }, { name: 'note', label: 'Ghi chú (không bắt buộc)', type: 'text', max: 120 }], confirmText: 'Xếp ca',
          onSubmit: function (v) { var r = HG.assignShift(a.student_id, { date: v.date, from: v.from, to: v.to, company: emp.company_name, job_id: a.job_id, note: v.note }); if (r.error) return r; renderStaff(); return { ok: true, message: 'Đã xếp ca và thông báo cho ' + c.u.full_name + '.' }; } });
        return;
      }
      if ((b = q('[data-done]'))) {
        var a2 = appOf(+b.dataset.done); HG.busy(b, function () {
          var ids = shiftsFor(a2.student_id).filter(function (s) { return s.date <= today && s.status === 'accepted'; }).map(function (s) { return s.id; });
          ids.forEach(function (id) { HG.pushShiftOp(a2.student_id, { op: 'update', id: id, patch: { status: 'completed' } }); });
          var sp = HG.studentProfile(a2.student_id); if (sp) HG.notify(sp.user_id, emp.company_name + ' đã xác nhận hoàn thành ' + ids.length + ' ca làm của bạn.', { link: 'student.html?tab=5', kind: 'shift' });
          HG.toast('Đã xác nhận hoàn thành ' + ids.length + ' ca.'); renderStaff();
        }, 500); return;
      }
      if ((b = q('[data-xfer]'))) {
        var a3 = appOf(+b.dataset.xfer), j3 = jobOf(a3.job_id), opts = ownJobs().filter(function (x) { return x.status === 'approved' && x.id !== j3.id; });
        if (!opts.length) { HG.toast('Bạn chưa có vị trí nào khác đang tuyển để chuyển sang.', 'info'); return; }
        HG.formModal({ title: 'Chuyển nhân viên sang vị trí khác', subtitle: 'Hiện tại: <strong>' + E(j3.title) + '</strong>', fields: [{ name: 'to', label: 'Vị trí mới', type: 'select', required: true, options: opts.map(function (x) { return [x.id, x.title]; }) }, { name: 'note', label: 'Ghi chú gửi nhân viên', type: 'text', max: 120 }], confirmText: 'Chuyển vị trí',
          onSubmit: function (v) { var r = HG.transferApp(a3.id, v.to, v.note); if (r.error) return r; renderStaff(); return { ok: true, message: 'Đã chuyển vị trí và thông báo cho nhân viên.' }; } });
        return;
      }
      if ((b = q('[data-end]'))) {
        var a4 = appOf(+b.dataset.end), c4 = studentOf(a4);
        HG.formModal({ title: 'Cho nghỉ việc', subtitle: 'Chấm dứt hợp tác với <strong>' + E(c4.u.full_name) + '</strong>. Các ca sắp tới sẽ bị hủy.', fields: [{ name: 'reason', label: 'Lý do', type: 'textarea', required: true }], confirmText: 'Xác nhận', danger: true,
          onSubmit: function (v) { var r = HG.endEmployment(a4.id, v.reason); if (r.error) return r; renderStaff(); return { ok: true, message: 'Đã cho ' + c4.u.full_name + ' nghỉ việc.' }; } });
        return;
      }
      if ((b = q('[data-rate-st]'))) { var a5 = appOf(+b.dataset.rateSt), c5 = studentOf(a5), tg = HG.reviewTargets().filter(function (x) { return x.uid === c5.u.id && x.job_id === a5.job_id; })[0]; if (!tg) return; if (tg.done) { HG.toast('Bạn đã đánh giá nhân viên này cho vị trí đó.', 'info'); return; } HG.openReviewForm(tg); return; }
      if ((b = q('[data-report-st]'))) { var a6 = appOf(+b.dataset.reportSt); HG.openReportForm('student', a6.student_id, studentOf(a6).u.full_name); return; }
      if ((b = q('[data-req-ok]'))) { HG.busy(b, function () { var r = HG.resolveRequest(+b.dataset.reqOk, true, ''); if (r.error) { HG.toast(r.error, 'error'); return; } HG.toast('Đã đồng ý yêu cầu và thông báo cho sinh viên.'); renderStaff(); }, 500); return; }
      if ((b = q('[data-req-no]'))) { var rid = +b.dataset.reqNo; HG.askReason({ title: 'Từ chối yêu cầu', label: 'Lý do từ chối', min: 5, confirmText: 'Từ chối', danger: true }).then(function (note) { if (!note) return; var r = HG.resolveRequest(rid, false, note); if (r.error) HG.toast(r.error, 'error'); else { HG.toast('Đã từ chối yêu cầu.'); renderStaff(); } }); }
    });
    renderStaff();
  }

  /* ================= Tab 7: Danh sách đen ================= */
  var blRoot = $('emp-blacklist');
  function renderBl() {
    if (!blRoot) return;
    var list = HG.blacklist().filter(function (b) { return b.employer_id === emp.id; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    blRoot.innerHTML = '<div class="hub-note">Ứng viên trong danh sách đen không thể ứng tuyển các tin của bạn. Để chặn từ hồ sơ, bấm <b>Chặn</b> ở tab Quản lý ứng viên hoặc thêm trực tiếp tại đây.</div><div class="hub-actions"><button class="primary-btn small" id="bl-add">+ Thêm ứng viên</button></div>' +
      (list.length ? list.map(function (b) { var sp = HG.studentProfile(b.student_id) || {}, u = HG.userById(sp.user_id) || { full_name: 'Ứng viên #' + b.student_id, email: '' };
        return '<div class="hub-card"><div><b>' + E(u.full_name) + '</b><small>' + E(u.email) + ' · ' + E(sp.university || '') + '</small><small class="reason-line">Lý do: ' + E(b.reason) + '</small><small>Chặn ngày ' + HG.fmtDate(b.created_at.slice(0, 10)) + '</small></div><div class="hub-side"><button class="cv-action-btn" data-unblock="' + b.id + '">Gỡ chặn</button></div></div>'; }).join('')
        : HG.empty('shield', 'Danh sách đen đang trống', 'Những ứng viên bạn chặn sẽ xuất hiện tại đây.'));
  }
  if (blRoot) {
    blRoot.addEventListener('click', function (e) {
      var u = e.target.closest('[data-unblock]');
      if (u) { HG.confirm({ title: 'Gỡ chặn ứng viên?', message: 'Ứng viên này sẽ có thể ứng tuyển lại các tin của bạn.', confirmText: 'Gỡ chặn', cancelText: 'Hủy' }).then(function (ok) { if (ok) HG.busy(u, function () { HG.blacklistRemove(+u.dataset.unblock); renderBl(); HG.toast('Đã gỡ chặn ứng viên.'); }, 400); }); return; }
      if (e.target.closest('#bl-add')) {
        var seen = {}, opts = [];
        ownApps().forEach(function (a) { if (!seen[a.student_id] && !HG.isBlacklisted(emp.id, a.student_id)) { seen[a.student_id] = 1; opts.push([a.student_id, studentOf(a).u.full_name + ' – ' + studentOf(a).u.email]); } });
        if (!opts.length) { HG.toast('Chưa có ứng viên nào để thêm (chỉ chặn được người từng ứng tuyển).', 'info'); return; }
        HG.formModal({ title: 'Chọn ứng viên cần chặn', fields: [{ name: 'sid', label: 'Ứng viên', type: 'select', required: true, options: opts }], confirmText: 'Tiếp tục', onSubmit: function (v) { var o = opts.filter(function (x) { return String(x[0]) === v.sid; })[0]; setTimeout(function () { HG.openBlacklistForm(+v.sid, o[1].split(' – ')[0], renderBl); }, 350); return { ok: true }; } });
      }
    });
    renderBl();
  }

  /* ================= Tab 8: Đánh giá & khiếu nại ================= */
  var rvRoot = $('emp-reviews'), tabR = 'reviews';
  function renderRv() {
    if (!rvRoot) return;
    var recv = HG.visibleReviews(me.id), r0 = HG.avgRating(me.id), reps = reports.filter(function (r) { return r.reporter_id === me.id; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }), about = reports.filter(function (r) { return r.target_user_id === me.id && r.status === 'resolved'; });
    var html = '<div class="dash-pills hub-pills">' + [['reviews', 'Đánh giá', recv.length], ['reports', 'Khiếu nại của tôi', reps.length]].map(function (p) { return '<button class="dash-pill' + (tabR === p[0] ? ' active' : '') + '" data-rv="' + p[0] + '">' + p[1] + ' <span class="pill-count">' + p[2] + '</span></button>'; }).join('') + '</div>';
    if (tabR === 'reviews') {
      html += '<div class="hub-card"><div><b>Điểm đánh giá của công ty</b><small>' + (r0.count ? '<span class="star-line" style="font-size:18px">' + HG.stars(r0.avg) + '</span> ' + r0.avg.toFixed(1) + '/5 từ ' + r0.count + ' đánh giá' : 'Chưa có đánh giá nào') + '</small></div></div>';
      html += recv.length ? recv.map(function (r) { return '<div class="hub-card"><div><span class="star-line">' + HG.stars(r.rating) + '</span><small>' + E(r.comment) + '</small><small>— ' + E(HG.userName(r.from_uid)) + ' · ' + HG.fmtDate(r.created_at.slice(0, 10)) + '</small></div><div class="hub-side"><button class="link-btn" data-flag="' + r.id + '">⚑ Báo cáo đánh giá</button></div></div>'; }).join('') : '';
      var tg = HG.reviewTargets(); html += '<h4 class="hub-h">Đánh giá sinh viên</h4>' + (tg.length ? tg.map(function (t) { return '<div class="hub-card"><div><b>' + E(t.name) + '</b><small>Vị trí: ' + E(t.job) + '</small></div><div class="hub-side">' + (t.done ? '<span class="status accepted">Đã đánh giá</span>' : '<button class="primary-btn small" data-rate="' + t.job_id + '|' + t.uid + '">Viết đánh giá</button>') + '</div></div>'; }).join('') : '<p class="hub-none">Chưa có nhân viên nào để đánh giá.</p>');
    } else {
      html += reps.length ? reps.map(function (r) { var st = HG.REPORT_STATUS[r.status] || HG.REPORT_STATUS.pending; return '<div class="hub-card"><div><b>' + HG.REPORT_TYPES[r.report_type] + ': ' + E(HG.reportTargetLabel(r)) + '</b><small>' + E(r.reason) + '</small>' + (r.admin_note ? '<small class="reason-line" style="color:#2c5fc4!important">Phản hồi của quản trị viên: ' + E(r.admin_note) + '</small>' : '') + '</div><div class="hub-side"><span class="status ' + st[1] + '">' + st[0] + '</span></div></div>'; }).join('') : HG.empty('shield', 'Bạn chưa gửi khiếu nại nào', 'Khiếu nại về ứng viên/nhân viên được gửi từ tab Nhân viên đang làm.');
      if (about.length) html += '<h4 class="hub-h">Khiếu nại về công ty bạn đã được xử lý: ' + about.length + '</h4>';
    }
    rvRoot.innerHTML = html;
  }
  if (rvRoot) {
    rvRoot.addEventListener('click', function (e) {
      var h = e.target.closest('[data-rv]'); if (h) { tabR = h.dataset.rv; renderRv(); return; }
      var rt = e.target.closest('[data-rate]'); if (rt) { var p = rt.dataset.rate.split('|'), tg = HG.reviewTargets().filter(function (x) { return x.job_id === +p[0] && x.uid === +p[1]; })[0]; if (tg) HG.openReviewForm(tg); return; }
      var f = e.target.closest('[data-flag]'); if (f) { var rv = HG.reviews().filter(function (x) { return x.id === +f.dataset.flag; })[0]; if (rv) HG.formModal({ title: 'Báo cáo đánh giá vi phạm', fields: [{ name: 'detail', label: 'Lý do cho rằng đánh giá sai / vi phạm', type: 'textarea', required: true }], confirmText: 'Gửi quản trị viên', onSubmit: function (v) { if (v.detail.length < 15) return { error: 'Mô tả cần ít nhất 15 ký tự.' }; HG.notifyAdmins('NTD ' + emp.company_name + ' báo cáo đánh giá #' + rv.id + ': ' + v.detail.slice(0, 80), 'reviews', 'admin.html?tab=8'); return { ok: true, message: 'Đã gửi quản trị viên xem xét.' }; } }); }
    });
    renderRv();
  }

  /* Cập nhật khi có thay đổi */
  function refresh() { renderStaff(); renderBl(); renderRv(); }
  ['hg:social', 'hg:notify'].forEach(function (ev) { document.addEventListener(ev, refresh); });
  window.addEventListener('storage', function (e) { if (/^hg_(requests|reports2|reviews|review_status|blacklist|app_patches|apps|shifts_)/.test(e.key || '')) refresh(); });

  /* Nhắc tin sắp hết hạn / đã hết hạn (mỗi tin một lần) */
  ownJobs().forEach(function (j) {
    if (!j.end_date || (j.status !== 'approved' && j.status !== 'expired')) return;
    var days = Math.ceil((new Date(j.end_date + 'T23:59:59') - new Date()) / 86400000), k = 'hg_exp_notice_' + j.id + '_' + (days < 0 ? 'x' : 's');
    if ((days >= 0 && days <= 3) || days < 0) { if (!HG.read(k, false)) { HG.store.set(k, true); HG.notify(me.id, days < 0 ? 'Tin "' + j.title + '" đã hết hạn. Hãy gia hạn để tiếp tục nhận hồ sơ.' : 'Tin "' + j.title + '" sẽ hết hạn sau ' + days + ' ngày.', { link: 'employer.html?tab=2', kind: 'job' }); } }
  });
})();
