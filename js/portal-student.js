/* Sinh viên: xin nghỉ ca / đổi ca / xin nghỉ việc / xin chuyển vị trí, đánh giá nhà tuyển dụng, khiếu nại */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), E = HG.esc;
  if (!me || me.role !== 'student') return;
  var sid = HG.studentId(me), today = HG.now().slice(0, 10);
  var statusName = function (id) { var s = application_statuses.filter(function (x) { return x.id === id; })[0]; return s ? s.name : 'submitted'; };
  var jobOf = function (id) { return jobs.filter(function (j) { return j.id === id; })[0]; };
  var myApps = function () { return HG.applications().filter(function (a) { return a.student_id === sid; }); };
  var changed = function () { document.dispatchEvent(new CustomEvent('hg:social')); };

  /* ---------- Xin nghỉ ca / đổi ca (gọi từ lịch) ---------- */
  HG.openShiftRequest = function (shiftId, shifts, kind) {
    var s = shifts.filter(function (x) { return x.id === shiftId; })[0]; if (!s) return;
    var app = myApps().filter(function (a) { return a.job_id === s.job_id && a.status_id === 4 && !a.ended; })[0];
    if (!s.job_id || !app) { HG.toast('Ca này chưa gắn với công việc đã trúng tuyển nên không gửi yêu cầu được. Bạn có thể bấm "Hủy ca".', 'info'); return; }
    var swap = kind === 'swap_shift';
    HG.formModal({
      title: swap ? 'Xin đổi ca làm' : 'Xin nghỉ ca làm', subtitle: 'Ca hiện tại: <strong>' + HG.fmtDate(s.date) + ' · ' + E(s.from) + '–' + E(s.to) + '</strong> (' + E(s.title) + ')',
      fields: (swap ? [
        { name: 'new_date', label: 'Ngày mới', type: 'date', required: true, half: true, min: today },
        { name: 'new_from', label: 'Từ giờ', type: 'time', required: true, half: true, value: s.from },
        { name: 'new_to', label: 'Đến giờ', type: 'time', required: true, half: true, value: s.to }] : []).concat([
        { name: 'reason', label: 'Lý do', type: 'textarea', required: true, placeholder: 'Ví dụ: Trùng lịch thi cuối kỳ…', hint: 'Nhà tuyển dụng sẽ xem và phản hồi.' }]),
      confirmText: 'Gửi yêu cầu',
      onSubmit: function (v) {
        var r = HG.addRequest({ kind: kind, app_id: app.id, job_id: s.job_id, shift: { id: s.id, date: s.date, from: s.from, to: s.to }, payload: swap ? { new_date: v.new_date, new_from: v.new_from, new_to: v.new_to } : {}, reason: v.reason });
        if (r.error) return r; changed(); return { ok: true, message: 'Đã gửi yêu cầu tới nhà tuyển dụng.' };
      }
    });
  };

  /* ---------- Xin nghỉ việc / xin chuyển vị trí / đánh giá / báo cáo (từ thẻ đơn ứng tuyển) ---------- */
  document.addEventListener('click', function (e) {
    var q = e.target.closest('[data-req-quit]'), t = e.target.closest('[data-req-transfer]'), r = e.target.closest('[data-rate-emp]'), rp = e.target.closest('[data-report-emp]'), h = e.target.closest('[data-hist-toggle]');
    if (h) { var box = document.getElementById('hist-' + h.dataset.histToggle); if (box) { box.hidden = !box.hidden; h.textContent = box.hidden ? 'Lịch sử' : 'Ẩn lịch sử'; } return; }
    if (q) {
      var a = myApps().filter(function (x) { return x.id === +q.dataset.reqQuit; })[0], j = a && jobOf(a.job_id); if (!a) return;
      HG.formModal({
        title: 'Xin nghỉ việc', subtitle: 'Vị trí: <strong>' + E(j ? j.title : '') + '</strong>. Sau khi nhà tuyển dụng đồng ý, các ca sau ngày làm cuối sẽ được hủy.',
        fields: [{ name: 'last_day', label: 'Ngày làm việc cuối cùng', type: 'date', required: true, min: today }, { name: 'reason', label: 'Lý do xin nghỉ', type: 'textarea', required: true, placeholder: 'Ví dụ: Cần tập trung cho kỳ thi / chuyển nơi ở…' }],
        confirmText: 'Gửi đơn xin nghỉ', danger: true,
        onSubmit: function (v) { var x = HG.addRequest({ kind: 'quit_job', app_id: a.id, job_id: a.job_id, payload: { last_day: v.last_day }, reason: v.reason }); if (x.error) return x; changed(); return { ok: true, message: 'Đã gửi đơn xin nghỉ việc.' }; }
      });
    }
    if (t) {
      var a2 = myApps().filter(function (x) { return x.id === +t.dataset.reqTransfer; })[0], j2 = a2 && jobOf(a2.job_id); if (!a2 || !j2) return;
      var opts = jobs.filter(function (x) { return x.employer_id === j2.employer_id && x.status === 'approved' && x.id !== j2.id; });
      if (!opts.length) { HG.toast('Nhà tuyển dụng này hiện chưa có vị trí nào khác đang tuyển.', 'info'); return; }
      HG.formModal({
        title: 'Xin chuyển vị trí', subtitle: 'Đang làm: <strong>' + E(j2.title) + '</strong>',
        fields: [{ name: 'to_job_id', label: 'Vị trí muốn chuyển sang', type: 'select', required: true, options: opts.map(function (x) { return [x.id, x.title + ' (' + HG.jobSalary(x) + ')']; }) }, { name: 'reason', label: 'Lý do', type: 'textarea', required: true, placeholder: 'Vì sao bạn muốn chuyển vị trí?' }],
        confirmText: 'Gửi yêu cầu',
        onSubmit: function (v) { var x = HG.addRequest({ kind: 'transfer', app_id: a2.id, job_id: a2.job_id, payload: { to_job_id: v.to_job_id }, reason: v.reason }); if (x.error) return x; changed(); return { ok: true, message: 'Đã gửi yêu cầu chuyển vị trí.' }; }
      });
    }
    if (r) { var tg = HG.reviewTargets().filter(function (x) { return x.job_id === +r.dataset.rateEmp; })[0]; if (!tg) return; if (tg.done) { HG.toast('Bạn đã đánh giá nhà tuyển dụng này rồi.', 'info'); return; } HG.openReviewForm(tg); }
    if (rp) { var ep = HG.employerProfile(+rp.dataset.reportEmp); if (ep) HG.openReportForm('employer', ep.id, ep.company_name); }
  });

  /* ---------- Tab 7: Yêu cầu · Đánh giá · Khiếu nại ---------- */
  var root = document.getElementById('stu-hub'); if (!root) return;
  var tab = 'requests';
  function pending() { return HG.requests().filter(function (r) { return r.student_uid === me.id; }); }
  function render() {
    var reqs = pending().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    var targets = HG.reviewTargets(), mine = HG.reviews().filter(function (r) { return r.from_uid === me.id; }), recv = HG.visibleReviews(me.id);
    var reps = reports.filter(function (r) { return r.reporter_id === me.id; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    var pills = [['requests', 'Yêu cầu của tôi', reqs.length], ['reviews', 'Đánh giá', targets.filter(function (t) { return !t.done; }).length], ['reports', 'Khiếu nại', reps.length]];
    var html = '<div class="dash-pills hub-pills">' + pills.map(function (p) { return '<button class="dash-pill' + (tab === p[0] ? ' active' : '') + '" data-hub="' + p[0] + '">' + p[1] + ' <span class="pill-count">' + p[2] + '</span></button>'; }).join('') + '</div>';
    if (tab === 'requests') {
      html += '<div class="hub-note">Gửi yêu cầu xin nghỉ ca, đổi ca ở tab <b>Lịch làm việc</b>; xin nghỉ việc hoặc chuyển vị trí ở tab <b>Đơn ứng tuyển</b> (với việc đã trúng tuyển).</div>';
      html += reqs.length ? reqs.map(function (r) {
        var j = jobOf(r.job_id), st = HG.REQ_STATUS[r.status], p = r.payload || {};
        var detail = r.kind === 'swap_shift' ? 'Đổi ca ' + HG.fmtDate(r.shift.date) + ' → ' + HG.fmtDate(p.new_date) + ' (' + p.new_from + '–' + p.new_to + ')' : r.kind === 'leave_shift' ? 'Nghỉ ca ' + HG.fmtDate(r.shift.date) + ' (' + r.shift.from + '–' + r.shift.to + ')' : r.kind === 'quit_job' ? 'Làm đến hết ngày ' + HG.fmtDate(p.last_day) : 'Chuyển sang: ' + E((jobOf(+p.to_job_id) || {}).title || '');
        return '<div class="hub-card"><div><b>' + HG.REQ_KIND[r.kind] + '</b> · ' + E(j ? j.title : '') + '<small>' + detail + '</small><small>Lý do: ' + E(r.reason) + '</small>' +
          (r.response ? '<small class="reason-line">Phản hồi: ' + E(r.response) + '</small>' : '') + '<small>Gửi ' + HG.fmtDate(r.created_at.slice(0, 10)) + '</small></div>' +
          '<div class="hub-side"><span class="status ' + st[1] + '">' + st[0] + '</span>' + (r.status === 'pending' ? '<button class="cv-action-btn danger" data-cancel-req="' + r.id + '">Rút yêu cầu</button>' : '') + '</div></div>';
      }).join('') : HG.empty('calendar', 'Chưa có yêu cầu nào', 'Các yêu cầu xin nghỉ, đổi ca, chuyển vị trí của bạn sẽ hiển thị tại đây cùng phản hồi của nhà tuyển dụng.');
    } else if (tab === 'reviews') {
      html += '<h4 class="hub-h">Đánh giá nhà tuyển dụng sau khi làm việc</h4>' + (targets.length ? targets.map(function (t) {
        return '<div class="hub-card"><div><b>' + E(t.name) + '</b><small>Vị trí: ' + E(t.job) + '</small></div><div class="hub-side">' + (t.done ? '<span class="status accepted">Đã đánh giá</span>' : '<button class="primary-btn small" data-rate="' + t.job_id + '|' + t.uid + '">Viết đánh giá</button>') + '</div></div>';
      }).join('') : HG.empty('sparkle', 'Chưa có công việc nào để đánh giá', 'Khi bạn trúng tuyển và làm việc, bạn có thể đánh giá nhà tuyển dụng tại đây.'));
      html += '<h4 class="hub-h">Đánh giá về bạn từ nhà tuyển dụng</h4>' + (recv.length ? recv.map(function (r) { return '<div class="hub-card"><div><span class="star-line">' + HG.stars(r.rating) + '</span><small>' + E(r.comment) + '</small><small>— ' + E(HG.userName(r.from_uid)) + ' · ' + HG.fmtDate(r.created_at.slice(0, 10)) + '</small></div></div>'; }).join('') : '<p class="hub-none">Bạn chưa nhận được đánh giá nào.</p>');
      if (mine.length) html += '<h4 class="hub-h">Đánh giá bạn đã gửi</h4>' + mine.map(function (r) { return '<div class="hub-card"><div><span class="star-line">' + HG.stars(r.rating) + '</span> · ' + E(HG.userName(r.to_uid)) + '<small>' + E(r.comment) + '</small>' + (r.status === 'hidden' ? '<small class="reason-line">Đã bị ẩn bởi quản trị viên.</small>' : '') + '</div></div>'; }).join('');
    } else {
      html += '<div class="hub-actions"><button class="primary-btn small" id="new-report">+ Gửi khiếu nại mới</button></div>';
      html += reps.length ? reps.map(function (r) {
        var st = HG.REPORT_STATUS[r.status] || HG.REPORT_STATUS.pending;
        return '<div class="hub-card"><div><b>' + HG.REPORT_TYPES[r.report_type] + ': ' + E(HG.reportTargetLabel(r)) + '</b><small>' + E(r.reason) + '</small><small>' + E(r.detail || '') + '</small>' +
          (r.admin_note ? '<small class="reason-line" style="color:#2c5fc4!important">Phản hồi của quản trị viên: ' + E(r.admin_note) + '</small>' : '') + '<small>Gửi ' + HG.fmtDate(r.created_at.slice(0, 10)) + '</small></div><div class="hub-side"><span class="status ' + st[1] + '">' + st[0] + '</span></div></div>';
      }).join('') : HG.empty('shield', 'Bạn chưa gửi khiếu nại nào', 'Nếu gặp tin tuyển dụng sai sự thật hoặc nhà tuyển dụng có hành vi không phù hợp, hãy gửi khiếu nại để được hỗ trợ.');
    }
    root.innerHTML = html;
  }
  root.addEventListener('click', function (e) {
    var h = e.target.closest('[data-hub]'); if (h) { tab = h.dataset.hub; render(); return; }
    var c = e.target.closest('[data-cancel-req]'); if (c) { HG.busy(c, function () { HG.cancelRequest(+c.dataset.cancelReq); render(); HG.toast('Đã rút yêu cầu.', 'info'); }, 400); return; }
    var rt = e.target.closest('[data-rate]'); if (rt) { var p = rt.dataset.rate.split('|'); var tg = HG.reviewTargets().filter(function (x) { return x.job_id === +p[0] && x.uid === +p[1]; })[0]; if (tg) HG.openReviewForm(tg); return; }
    if (e.target.closest('#new-report')) {
      var emps = {}, opts = [];
      myApps().forEach(function (a) { var j = jobOf(a.job_id), ep = j && HG.employerProfile(j.employer_id); if (ep && !emps['e' + ep.id]) { emps['e' + ep.id] = 1; opts.push(['employer:' + ep.id, 'Nhà tuyển dụng: ' + ep.company_name]); } if (j && !emps['j' + j.id]) { emps['j' + j.id] = 1; opts.push(['job:' + j.id, 'Tin: ' + j.title]); } });
      if (!opts.length) { HG.toast('Bạn cần ứng tuyển hoặc làm việc với một nhà tuyển dụng để khiếu nại. Với tin đăng sai phạm, hãy dùng nút "Báo cáo tin này" ở trang chi tiết việc làm.', 'info'); return; }
      HG.formModal({ title: 'Chọn đối tượng khiếu nại', fields: [{ name: 'who', label: 'Đối tượng', type: 'select', required: true, options: opts }], confirmText: 'Tiếp tục', onSubmit: function (v) { var p = v.who.split(':'), label = opts.filter(function (o) { return o[0] === v.who; })[0][1]; setTimeout(function () { HG.openReportForm(p[0], +p[1], label); }, 350); return { ok: true }; } });
    }
  });
  render();
  ['hg:social', 'hg:notify'].forEach(function (ev) { document.addEventListener(ev, render); });
  window.addEventListener('storage', function (e) { if (/^hg_(requests|reports2|reviews|review_status|report_status|app_patches)$/.test(e.key || '')) render(); });
})();
