/* Lớp nghiệp vụ "xã hội": khiếu nại, đánh giá, danh sách đen, xin nghỉ / đổi ca / chuyển việc,
   quyền hạn admin, nhật ký thao tác, tùy chọn người dùng, hộp thư hỗ trợ. Mọi dữ liệu lưu bền trong localStorage. */
(function () {
  'use strict';
  var HG = window.HG, R = function (k, d) { return HG.read(k, d); }, W = function (k, v) { return HG.store.set(k, v); };
  var nid = function (l) { return l.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1; };
  var today = function () { return HG.now().slice(0, 10); };

  /* ---------- Tra cứu người dùng / hồ sơ ---------- */
  HG.userById = function (id) { return users.find(function (u) { return u.id === id; }); };
  HG.userName = function (id) { var u = HG.userById(id); return u ? u.full_name : 'Người dùng #' + id; };
  HG.studentProfile = function (sid) { return student_profiles.find(function (p) { return p.id === sid; }); };
  HG.employerProfile = function (eid) { return employer_profiles.find(function (p) { return p.id === eid; }); };
  HG.employerOfJob = function (jobId) { var j = jobs.find(function (x) { return x.id === jobId; }); return j ? HG.employerProfile(j.employer_id) : null; };
  HG.activeAdmins = function (perm) { return users.filter(function (u) { return u.role === 'admin' && u.status === 'active' && (!perm || HG.can(perm, u)); }); };
  HG.notifyAdmins = function (text, perm, link) { HG.activeAdmins(perm).forEach(function (u) { HG.notify(u.id, text, { link: link || 'admin.html?tab=4', kind: 'job' }); }); };

  /* ---------- Nhật ký thao tác ---------- */
  HG.audit = function (action, detail) {
    var u = HG.user(), l = R('hg_audit', []);
    l.unshift({ id: Date.now() + '-' + Math.floor(Math.random() * 1e4), at: HG.now(), uid: u ? u.id : 0, name: u ? u.full_name : '—', role: u ? u.role : '', action: action, detail: detail || '' });
    W('hg_audit', l.slice(0, 500));
  };

  /* ---------- Tùy chọn người dùng ---------- */
  HG.prefs = function (uid) { return R('hg_prefs_' + uid, {}); };
  HG.pref = function (uid, key) { var p = HG.prefs(uid); return p[key] !== false; };
  HG.setPrefs = function (uid, obj) { W('hg_prefs_' + uid, Object.assign(HG.prefs(uid), obj)); };

  /* ---------- Khiếu nại / báo cáo ---------- */
  HG.REPORT_TYPES = { job: 'Tin tuyển dụng', employer: 'Nhà tuyển dụng', student: 'Sinh viên' };
  HG.REPORT_STATUS = { pending: ['Chờ xử lý', 'pending'], investigating: ['Đang xem xét', 'reviewing'], resolved: ['Đã giải quyết', 'accepted'], dismissed: ['Đã bác bỏ', 'draft'] };
  function targetUserOf(type, id) {
    if (type === 'job') { var ep = HG.employerOfJob(id); return ep ? ep.user_id : null; }
    if (type === 'employer') { var e = HG.employerProfile(id); return e ? e.user_id : null; }
    var s = HG.studentProfile(id); return s ? s.user_id : null;
  }
  HG.reportTargetLabel = function (r) {
    if (r.report_type === 'job') { var j = jobs.find(function (x) { return x.id === r.target_id; }); return j ? 'Tin "' + j.title + '"' : 'Tin #' + r.target_id; }
    if (r.report_type === 'employer') { var e = HG.employerProfile(r.target_id); return e ? e.company_name : 'Doanh nghiệp #' + r.target_id; }
    var s = HG.studentProfile(r.target_id); return s ? HG.userName(s.user_id) : 'Sinh viên #' + r.target_id;
  };
  HG.fileReport = function (o) {
    var u = HG.user(); if (!u) return { error: 'Vui lòng đăng nhập để gửi khiếu nại.' };
    var reason = (o.reason || '').trim(), detail = (o.detail || '').trim();
    if (reason.length < 5) return { error: 'Vui lòng chọn hoặc nhập lý do khiếu nại.' };
    if (detail.length < 15) return { error: 'Mô tả chi tiết cần ít nhất 15 ký tự để quản trị viên xử lý.' };
    if (detail.length > 600) return { error: 'Mô tả tối đa 600 ký tự.' };
    var tuid = targetUserOf(o.type, o.targetId);
    if (tuid === u.id) return { error: 'Bạn không thể tự khiếu nại chính mình.' };
    if (reports.some(function (r) { return r.reporter_id === u.id && r.report_type === o.type && r.target_id === o.targetId && (r.status === 'pending' || r.status === 'investigating'); }))
      return { error: 'Bạn đã gửi khiếu nại về đối tượng này và đang được xử lý.' };
    var l = R('hg_reports2', []), id = Math.max(100, nid(reports), nid(l));
    var rep = { id: id, report_type: o.type, target_id: o.targetId, target_user_id: tuid, reporter_id: u.id, reporter_role: u.role, reason: reason, detail: detail, status: 'pending', admin_note: '', created_at: HG.now() };
    l.push(rep); W('hg_reports2', l); reports.push(rep);
    HG.notifyAdmins('Khiếu nại mới #' + id + ' về ' + HG.reportTargetLabel(rep) + ': ' + reason, 'reports', 'admin.html?tab=4');
    return { ok: true, report: rep };
  };
  /* act: none | warn | lock_job | lock_user | blacklist */
  HG.resolveReport = function (id, o) {
    var r = reports.find(function (x) { return x.id === id; }); if (!r) return { error: 'Không tìm thấy khiếu nại.' };
    var note = (o.note || '').trim();
    if ((o.status === 'resolved' || o.status === 'dismissed') && note.length < 5) return { error: 'Vui lòng nhập ghi chú kết luận.' };
    var tuid = r.target_user_id || targetUserOf(r.report_type, r.target_id), applied = [];
    if (o.status === 'resolved') {
      if (o.act === 'warn' && tuid) { HG.notify(tuid, 'Bạn nhận được cảnh cáo từ quản trị viên: ' + note, { link: '', kind: 'info' }); applied.push('Cảnh cáo'); }
      if (o.act === 'lock_job' && r.report_type === 'job') { HG.setJobStatus(r.target_id, 'locked', note); applied.push('Khóa tin'); }
      if (o.act === 'lock_user' && tuid) { HG.setUserStatus(tuid, 'blocked'); applied.push('Khóa tài khoản'); }
      if (o.act === 'blacklist' && tuid) { HG.globalBlock(tuid, note); applied.push('Danh sách đen toàn hệ thống'); }
    }
    var patch = { status: o.status, admin_note: note, action_taken: applied.join(', '), resolved_by: HG.user().id, resolved_at: HG.now() };
    HG.setReportStatus(id, patch);
    var l = R('hg_reports2', []); l.forEach(function (x) { if (x.id === id) Object.assign(x, patch); }); W('hg_reports2', l);
    if (r.reporter_id && (o.status === 'resolved' || o.status === 'dismissed'))
      HG.notify(r.reporter_id, 'Khiếu nại #' + id + ' của bạn ' + (o.status === 'resolved' ? 'đã được giải quyết' : 'đã được xem xét và bác bỏ') + '. Phản hồi: ' + note, { link: '', kind: 'info' });
    HG.audit('Khiếu nại #' + id, HG.REPORT_STATUS[o.status][0] + (applied.length ? ' · ' + applied.join(', ') : '') + ' · ' + note);
    return { ok: true };
  };

  /* ---------- Đánh giá hai chiều ---------- */
  var SEED = [
    { id: 1, from_uid: 1, to_uid: 4, to_role: 'employer', job_id: 1, rating: 5, comment: 'Môi trường thân thiện, quản lý hỗ trợ nhiệt tình và trả lương đúng hạn.', created_at: '2026-10-20 10:00:00' },
    { id: 2, from_uid: 2, to_uid: 4, to_role: 'employer', job_id: 2, rating: 4, comment: 'Ca làm rõ ràng, tuy giờ cao điểm hơi đông khách.', created_at: '2026-10-28 09:30:00' }
  ];
  HG.reviews = function () {
    var st = R('hg_review_status', {});
    return SEED.concat(R('hg_reviews', [])).map(function (r) { return Object.assign({ status: 'visible' }, r, st[r.id] || {}); });
  };
  HG.visibleReviews = function (uid) { return HG.reviews().filter(function (r) { return r.to_uid === uid && r.status === 'visible'; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }); };
  HG.avgRating = function (uid) { var l = HG.visibleReviews(uid); return { count: l.length, avg: l.length ? l.reduce(function (s, r) { return s + r.rating; }, 0) / l.length : 0 }; };
  /* Chỉ đánh giá được người đã có quan hệ làm việc (đơn được nhận) với mình ở đúng tin đó */
  HG.reviewTargets = function () {
    var u = HG.user(), out = [], seen = {};
    HG.applications().filter(function (a) { return a.status_id === 4; }).forEach(function (a) {
      var j = jobs.find(function (x) { return x.id === a.job_id; }); if (!j) return;
      var ep = HG.employerProfile(j.employer_id), sp = HG.studentProfile(a.student_id); if (!ep || !sp) return;
      var to = null;
      if (u.role === 'student' && sp.user_id === u.id) to = { uid: ep.user_id, name: ep.company_name };
      if (u.role === 'employer' && ep.user_id === u.id) to = { uid: sp.user_id, name: HG.userName(sp.user_id) };
      if (!to) return;
      var key = to.uid + '-' + j.id; if (seen[key]) return; seen[key] = 1;
      out.push({ uid: to.uid, name: to.name, job_id: j.id, job: j.title, done: HG.reviews().some(function (r) { return r.from_uid === u.id && r.to_uid === to.uid && r.job_id === j.id; }) });
    });
    return out;
  };
  HG.addReview = function (o) {
    var u = HG.user(); if (!u) return { error: 'Vui lòng đăng nhập.' };
    var t = HG.reviewTargets().filter(function (x) { return x.uid === o.to_uid && x.job_id === o.job_id; })[0];
    if (!t) return { error: 'Bạn chỉ có thể đánh giá người đã làm việc cùng bạn ở vị trí này.' };
    if (t.done) return { error: 'Bạn đã đánh giá cho vị trí này rồi.' };
    var rating = Number(o.rating), c = (o.comment || '').trim();
    if (!(rating >= 1 && rating <= 5)) return { error: 'Vui lòng chọn số sao từ 1 đến 5.' };
    if (c.length < 10) return { error: 'Nhận xét cần ít nhất 10 ký tự.' }; if (c.length > 500) return { error: 'Nhận xét tối đa 500 ký tự.' };
    var l = R('hg_reviews', []);
    l.push({ id: Math.max(100, nid(l)), from_uid: u.id, to_uid: o.to_uid, to_role: u.role === 'student' ? 'employer' : 'student', job_id: o.job_id, rating: rating, comment: c, created_at: HG.now() });
    W('hg_reviews', l);
    HG.notify(o.to_uid, u.full_name + ' vừa gửi cho bạn một đánh giá ' + rating + ' sao.', { link: '', kind: 'info' });
    return { ok: true };
  };
  HG.setReviewStatus = function (id, status, note) {
    var st = R('hg_review_status', {}); st[id] = { status: status, mod_note: note || '' }; W('hg_review_status', st);
    var r = HG.reviews().filter(function (x) { return x.id === id; })[0];
    if (r && status === 'hidden') HG.notify(r.from_uid, 'Đánh giá của bạn đã bị ẩn vì vi phạm quy định: ' + (note || '—'), { link: '', kind: 'info' });
    HG.audit('Đánh giá #' + id, (status === 'hidden' ? 'Ẩn' : 'Hiện lại') + (note ? ' · ' + note : ''));
  };
  HG.stars = function (n) { n = Math.round(n); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); };

  /* ---------- Danh sách đen ---------- */
  HG.blacklist = function () { return R('hg_blacklist', []); };
  HG.isBlacklisted = function (epId, sid) { return HG.blacklist().some(function (b) { return b.employer_id === epId && b.student_id === sid; }); };
  HG.blacklistAdd = function (epId, sid, reason) {
    reason = (reason || '').trim(); if (reason.length < 5) return { error: 'Vui lòng nhập lý do (ít nhất 5 ký tự).' };
    if (HG.isBlacklisted(epId, sid)) return { error: 'Ứng viên này đã nằm trong danh sách đen.' };
    var l = HG.blacklist(); l.push({ id: nid(l), employer_id: epId, student_id: sid, reason: reason, created_at: HG.now() }); W('hg_blacklist', l);
    HG.applications().filter(function (a) { return a.student_id === sid && (a.status_id === 1 || a.status_id === 2 || a.status_id === 3); }).forEach(function (a) {
      var j = jobs.find(function (x) { return x.id === a.job_id; }); if (j && j.employer_id === epId) HG.setAppStatus(a.id, 5, { reason: 'Nhà tuyển dụng không tiếp nhận hồ sơ của bạn.' });
    });
    return { ok: true };
  };
  HG.blacklistRemove = function (id) { W('hg_blacklist', HG.blacklist().filter(function (b) { return b.id !== id; })); };
  HG.globalBlocks = function () { return R('hg_gblock', {}); };
  HG.isGloballyBlocked = function (uid) { return !!HG.globalBlocks()[uid]; };
  HG.globalBlock = function (uid, reason) { var g = HG.globalBlocks(); g[uid] = { reason: reason, by: HG.user() ? HG.user().id : 0, at: HG.now() }; W('hg_gblock', g); HG.notify(uid, 'Tài khoản của bạn bị đưa vào danh sách hạn chế: ' + reason, { link: '', kind: 'info' }); HG.audit('Danh sách đen toàn hệ thống', HG.userName(uid) + ' · ' + reason); };
  HG.globalUnblock = function (uid) { var g = HG.globalBlocks(); delete g[uid]; W('hg_gblock', g); HG.audit('Gỡ danh sách đen', HG.userName(uid)); };
  HG.canApply = function (sid, jobId) {
    var j = jobs.find(function (x) { return x.id === jobId; }), sp = HG.studentProfile(sid);
    if (sp && HG.isGloballyBlocked(sp.user_id)) return { error: 'Tài khoản của bạn đang bị hạn chế ứng tuyển. Vui lòng liên hệ hỗ trợ.' };
    if (j && HG.isBlacklisted(j.employer_id, sid)) return { error: 'Nhà tuyển dụng này hiện không nhận hồ sơ của bạn.' };
    return { ok: true };
  };

  /* ---------- Ca làm: hộp thư lệnh nhà tuyển dụng → lịch của sinh viên ---------- */
  HG.pushShiftOp = function (sid, op) { var k = 'hg_shift_inbox_' + sid, l = R(k, []); l.push(op); W(k, l); };
  HG.shiftsOf = function (sid) { return R('hg_shifts_' + sid, []); };

  /* ---------- Yêu cầu: xin nghỉ ca / đổi ca / xin nghỉ việc / xin chuyển vị trí ---------- */
  HG.REQ_KIND = { leave_shift: 'Xin nghỉ ca', swap_shift: 'Xin đổi ca', quit_job: 'Xin nghỉ việc', transfer: 'Xin chuyển vị trí' };
  HG.REQ_STATUS = { pending: ['Chờ phản hồi', 'pending'], approved: ['Đã đồng ý', 'accepted'], rejected: ['Bị từ chối', 'rejected'], cancelled: ['Đã rút', 'draft'] };
  HG.requests = function () { return R('hg_requests', []); };
  HG.addRequest = function (o) {
    var u = HG.user(); if (!u || u.role !== 'student') return { error: 'Cần đăng nhập tài khoản sinh viên.' };
    var reason = (o.reason || '').trim(), p = o.payload || {};
    if (reason.length < 10) return { error: 'Vui lòng nhập lý do (ít nhất 10 ký tự).' };
    var app = HG.applications().filter(function (a) { return a.id === o.app_id; })[0];
    var job = jobs.find(function (x) { return x.id === (app ? app.job_id : o.job_id); }); if (!job) return { error: 'Không tìm thấy công việc.' };
    if (o.kind === 'quit_job') { if (!p.last_day || p.last_day < today()) return { error: 'Ngày làm việc cuối cùng phải từ hôm nay trở đi.' }; }
    if (o.kind === 'swap_shift') {
      if (!p.new_date || p.new_date < today()) return { error: 'Ngày mới phải từ hôm nay trở đi.' };
      if (!p.new_from || !p.new_to || p.new_from >= p.new_to) return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' };
    }
    if (o.kind === 'transfer') {
      var tj = jobs.find(function (x) { return x.id === Number(p.to_job_id); });
      if (!tj || tj.employer_id !== job.employer_id || tj.status !== 'approved' || tj.id === job.id) return { error: 'Vui lòng chọn vị trí khác đang tuyển của cùng nhà tuyển dụng.' };
    }
    if (HG.requests().some(function (r) { return r.status === 'pending' && r.kind === o.kind && r.student_uid === u.id && r.job_id === job.id && (!o.shift || (r.shift && r.shift.id === o.shift.id)); }))
      return { error: 'Bạn đã gửi yêu cầu tương tự và đang chờ phản hồi.' };
    var l = HG.requests(), id = nid(l);
    l.push({ id: id, kind: o.kind, student_uid: u.id, student_id: HG.studentId(u), employer_id: job.employer_id, job_id: job.id, app_id: o.app_id || null, shift: o.shift || null, payload: p, reason: reason, status: 'pending', response: '', created_at: HG.now() });
    W('hg_requests', l);
    var ep = HG.employerProfile(job.employer_id);
    if (ep) HG.notify(ep.user_id, u.full_name + ' gửi yêu cầu: ' + HG.REQ_KIND[o.kind].toLowerCase() + ' (vị trí "' + job.title + '").', { link: 'employer.html?tab=6', kind: 'shift' });
    return { ok: true };
  };
  HG.cancelRequest = function (id) {
    var l = HG.requests(); l.forEach(function (r) { if (r.id === id && r.status === 'pending') r.status = 'cancelled'; }); W('hg_requests', l);
  };
  function cancelFuture(sid, fromDate, jobId, note) { HG.pushShiftOp(sid, { op: 'cancelFrom', date: fromDate, job_id: jobId, note: note }); }
  HG.resolveRequest = function (id, approve, note) {
    var l = HG.requests(), r = l.filter(function (x) { return x.id === id; })[0]; if (!r || r.status !== 'pending') return { error: 'Yêu cầu đã được xử lý.' };
    note = (note || '').trim(); if (!approve && note.length < 5) return { error: 'Vui lòng nhập lý do từ chối.' };
    var p = r.payload || {}, job = jobs.find(function (x) { return x.id === r.job_id; });
    if (approve) {
      if (r.kind === 'leave_shift' && r.shift) HG.pushShiftOp(r.student_id, { op: 'update', id: r.shift.id, patch: { status: 'cancelled', note: 'Nghỉ có phép (đã được nhà tuyển dụng đồng ý).' } });
      if (r.kind === 'swap_shift' && r.shift) HG.pushShiftOp(r.student_id, { op: 'update', id: r.shift.id, patch: { date: p.new_date, from: p.new_from, to: p.new_to, status: 'accepted', note: 'Đã đổi ca theo yêu cầu.' } });
      if (r.kind === 'quit_job') { HG.patchApp(r.app_id, { ended: true, ended_at: p.last_day, ended_reason: r.reason, ended_by: 'student' }); cancelFuture(r.student_id, p.last_day, r.job_id, 'Sinh viên đã nghỉ việc.'); }
      if (r.kind === 'transfer') HG.patchApp(r.app_id, { job_id: Number(p.to_job_id), transferred_from: r.job_id });
    }
    r.status = approve ? 'approved' : 'rejected'; r.response = note; r.resolved_at = HG.now(); W('hg_requests', l);
    HG.notify(r.student_uid, 'Yêu cầu "' + HG.REQ_KIND[r.kind].toLowerCase() + '" (vị trí "' + (job ? job.title : '') + '") ' + (approve ? 'đã được đồng ý.' : 'bị từ chối.') + (note ? ' Phản hồi: ' + note : ''), { link: 'student.html?tab=7', kind: 'shift' });
    return { ok: true };
  };
  /* Nhà tuyển dụng chủ động: cho nghỉ việc / chuyển vị trí / xếp ca / hoàn thành ca */
  HG.endEmployment = function (appId, reason) {
    reason = (reason || '').trim(); if (reason.length < 5) return { error: 'Vui lòng nhập lý do (ít nhất 5 ký tự).' };
    var a = HG.applications().filter(function (x) { return x.id === appId; })[0]; if (!a) return { error: 'Không tìm thấy hồ sơ.' };
    var j = jobs.find(function (x) { return x.id === a.job_id; }), sp = HG.studentProfile(a.student_id);
    HG.patchApp(appId, { ended: true, ended_at: today(), ended_reason: reason, ended_by: 'employer' }); cancelFuture(a.student_id, today(), a.job_id, 'Nhà tuyển dụng đã chấm dứt hợp tác.');
    if (sp) HG.notify(sp.user_id, 'Nhà tuyển dụng đã chấm dứt hợp tác ở vị trí "' + (j ? j.title : '') + '". Lý do: ' + reason, { link: 'student.html?tab=4', kind: 'app' });
    return { ok: true };
  };
  HG.transferApp = function (appId, toJobId, note) {
    var a = HG.applications().filter(function (x) { return x.id === appId; })[0], to = jobs.find(function (x) { return x.id === Number(toJobId); }), from = a && jobs.find(function (x) { return x.id === a.job_id; });
    if (!a || !to || !from || to.employer_id !== from.employer_id || to.id === from.id) return { error: 'Vui lòng chọn vị trí khác của công ty bạn.' };
    HG.patchApp(appId, { job_id: to.id, transferred_from: from.id });
    var sp = HG.studentProfile(a.student_id); if (sp) HG.notify(sp.user_id, 'Bạn được chuyển từ vị trí "' + from.title + '" sang "' + to.title + '".' + (note ? ' Ghi chú: ' + note : ''), { link: 'student.html?tab=4', kind: 'app' });
    return { ok: true };
  };
  HG.assignShift = function (sid, o) {
    if (!o.date || o.date < today()) return { error: 'Ngày làm phải từ hôm nay trở đi.' };
    if (!o.from || !o.to || o.from >= o.to) return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' };
    HG.pushShiftOp(sid, { op: 'add', shift: { date: o.date, from: o.from, to: o.to, title: 'Ca làm việc tại ' + o.company, company: o.company, job_id: o.job_id, status: 'accepted', note: o.note || '' } });
    var sp = HG.studentProfile(sid); if (sp) HG.notify(sp.user_id, o.company + ' đã xếp cho bạn ca làm ngày ' + HG.fmtDate(o.date) + ' (' + o.from + '–' + o.to + ').', { link: 'student.html?tab=5', kind: 'shift' });
    return { ok: true };
  };

  /* ---------- Hộp thư hỗ trợ + bản tin + thông báo hệ thống ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  HG.contacts = function () { return R('hg_contacts', []); };
  HG.addContact = function (o) {
    var u = HG.user(), name = (o.name || (u ? u.full_name : '')).trim(), email = (o.email || (u ? u.email : '')).trim(), msg = (o.message || '').trim();
    if (name.length < 2) return { error: 'Vui lòng nhập họ tên.' }; if (!EMAIL.test(email)) return { error: 'Email chưa hợp lệ.' };
    if (msg.length < 10) return { error: 'Nội dung cần ít nhất 10 ký tự.' }; if (msg.length > 800) return { error: 'Nội dung tối đa 800 ký tự.' };
    var l = HG.contacts(); l.push({ id: nid(l), uid: u ? u.id : null, name: name, email: email, subject: o.subject || 'Hỗ trợ', message: msg, status: 'new', reply: '', created_at: HG.now() }); W('hg_contacts', l);
    HG.notifyAdmins('Tin nhắn hỗ trợ mới từ ' + name + ': ' + msg.slice(0, 60), 'support', 'admin.html?tab=9');
    return { ok: true };
  };
  HG.replyContact = function (id, reply) {
    reply = (reply || '').trim(); if (reply.length < 5) return { error: 'Vui lòng nhập nội dung phản hồi.' };
    var l = HG.contacts(), c = l.filter(function (x) { return x.id === id; })[0]; if (!c) return { error: 'Không tìm thấy tin nhắn.' };
    c.status = 'done'; c.reply = reply; c.replied_at = HG.now(); W('hg_contacts', l);
    if (c.uid) HG.notify(c.uid, 'Đội ngũ hỗ trợ đã phản hồi: ' + reply, { link: '', kind: 'info' });
    HG.audit('Phản hồi hỗ trợ #' + id, c.name); return { ok: true };
  };
  HG.subscribe = function (email) {
    email = (email || '').trim().toLowerCase(); if (!EMAIL.test(email)) return { error: 'Email chưa hợp lệ.' };
    var l = R('hg_subs', []); if (l.some(function (x) { return x.email === email; })) return { error: 'Email này đã đăng ký nhận tin.' };
    l.push({ email: email, at: HG.now() }); W('hg_subs', l); return { ok: true };
  };
  HG.broadcast = function (text, audience) {
    text = (text || '').trim(); if (text.length < 10) return { error: 'Nội dung thông báo cần ít nhất 10 ký tự.' };
    var n = 0; users.forEach(function (u) { if (u.status === 'active' && (audience === 'all' || u.role === audience)) { HG.notify(u.id, '📢 ' + text, { link: '', kind: 'info' }); n++; } });
    HG.audit('Thông báo hệ thống', '(' + n + ' người nhận) ' + text.slice(0, 80)); return { ok: true, n: n };
  };
})();
