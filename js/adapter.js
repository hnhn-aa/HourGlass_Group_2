/* Cầu nối mock-data.js -> giao diện: ghép dữ liệu, định dạng, và lưu thay đổi khi test (localStorage) */
(function () {
  'use strict';
  var HG = window.HG;
  var COLORS = ['#665CF6', '#FF8EC7', '#4F7DFF', '#A78BFA', '#22B8A7', '#3156C8'];
  var TYPES = { 'part-time': 'Part-time', 'full-time': 'Toàn thời gian', 'internship': 'Thực tập' };

  /* Tin do nhà tuyển dụng đăng thêm + trạng thái do admin duyệt (lưu trong trình duyệt) */
  HG.read('hg_new_jobs', []).forEach(function (j) { jobs.push(j); });
  var overrides = HG.read('hg_job_status', {});            // trạng thái / chỉnh sửa tin (mock + tin mới)
  jobs.forEach(function (j) { if (overrides[j.id]) Object.assign(j, overrides[j.id]); });
  var deleted = HG.read('hg_job_deleted', []);              // tin đã xóa
  for (var di = jobs.length - 1; di >= 0; di--) if (deleted.indexOf(jobs[di].id) !== -1) jobs.splice(di, 1);
  /* Tin đã duyệt nhưng quá hạn nộp -> "Hết hạn" (không lưu, tính theo ngày hiện tại) */
  (function () {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    jobs.forEach(function (j) { if (j.status === 'approved' && j.end_date && new Date(j.end_date + 'T23:59:59') < t) j.status = 'expired'; });
  })();

  HG.now = function () {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  HG.typeLabel = function (t) { return TYPES[t] || t; };
  HG.addJob = function (j) { var l = HG.read('hg_new_jobs', []); l.push(j); if (HG.write('hg_new_jobs', l) === false) return false; jobs.push(j); return true; };
  /* Cập nhật bất kỳ trường nào của tin và lưu bền */
  HG.updateJob = function (id, patch) {
    var j = jobs.find(function (x) { return x.id === id; }); if (!j) return false;
    patch = Object.assign({}, patch, { updated_at: HG.now() });
    overrides[id] = Object.assign(overrides[id] || {}, patch);
    if (HG.write('hg_job_status', overrides) === false) return false;
    Object.assign(j, patch); return true;
  };
  /* Admin: status = approved | rejected | locked | pending ; reason = lý do (bắt buộc với rejected/locked) */
  HG.setJobStatus = function (id, status, reason) {
    var ok = HG.updateJob(id, {
      status: status,
      approved_by: status === 'approved' ? (HG.user() ? HG.user().id : 6) : null,
      approved_at: status === 'approved' ? HG.now() : null,
      rejected_reason: (status === 'rejected' || status === 'locked') ? (reason || 'Không đáp ứng tiêu chí đăng tin.') : null
    });
    var j = jobs.find(function (x) { return x.id === id; }), ep = j && employer_profiles.find(function (x) { return x.id === j.employer_id; });
    if (ok && j && HG.audit) HG.audit({ approved: 'Duyệt tin', rejected: 'Từ chối tin', locked: 'Khóa tin', pending: 'Đặt lại chờ duyệt' }[status] || 'Đổi trạng thái tin', '#' + id + ' ' + j.title + (reason ? ' · ' + reason : ''));
    if (ok && j && status === 'approved' && HG.notify) users.filter(function (u) { return u.role === 'student' && u.status === 'active'; }).forEach(function (u) { HG.notify(u.id, 'Có việc làm mới: "' + j.title + '" tại ' + (ep ? ep.company_name : '') + '.', { link: 'job-detail.html?id=' + j.id, kind: 'job', pref: 'jobAlert' }); });
    if (ok && ep && HG.notify) {
      var msg = { approved: 'Tin "' + j.title + '" đã được duyệt và hiển thị công khai.', rejected: 'Tin "' + j.title + '" bị từ chối. Lý do: ' + (reason || 'Không đáp ứng tiêu chí đăng tin.'), locked: 'Tin "' + j.title + '" đã bị khóa. Lý do: ' + (reason || '—') }[status];
      if (msg) HG.notify(ep.user_id, msg, { link: 'employer.html?tab=2', kind: 'job' });
    }
    return ok;
  };
  HG.deleteJob = function (id) {
    var i = jobs.findIndex(function (x) { return x.id === id; }); if (i === -1) return false;
    var del = HG.read('hg_job_deleted', []); del.push(id); if (HG.write('hg_job_deleted', del) === false) return false;
    HG.audit && HG.audit('Xóa tin', '#' + id + ' ' + jobs[i].title); jobs.splice(i, 1); return true;
  };

  HG.locationName = function (id) {
    var parts = [], l = job_locations.find(function (x) { return x.id === id; });
    while (l) { parts.push(l.name); l = l.parent_id ? job_locations.find(function (x) { return x.id === l.parent_id; }) : null; }
    return parts.join(', ');
  };
  function salary(j) {
    if (j.salary_text) return j.salary_text;
    var a = j.salary_min, b = j.salary_max;
    return b >= 1e6 ? a / 1e6 + '–' + b / 1e6 + ' triệu' : a / 1e3 + '–' + b / 1e3 + 'K/giờ';
  }
  /* 1 bản ghi jobs  ->  object cho thẻ việc làm */
  HG.toJob = function (j) {
    var e = employer_profiles.find(function (x) { return x.id === j.employer_id; }) || { company_name: '?' };
    var c = job_categories.find(function (x) { return x.id === j.category_id; });
    return {
      id: j.id, title: j.title, company: e.company_name,
      location: j.location_text || HG.locationName(j.location_id),
      salary: salary(j), type: HG.typeLabel(j.job_type),
      logo: e.company_name.charAt(0), color: COLORS[(j.employer_id - 1) % COLORS.length],
      tags: [c ? c.name : 'Khác', HG.typeLabel(j.job_type)], desc: j.description, raw: j, verified: !!e.verified, emp_uid: e.user_id
    };
  };
  HG.jobSalary = function (j) { return j.salary_text || HG.formatSalaryRange(j.salary_min, j.salary_max); };
  HG.employerColor = function (id) { return COLORS[(id - 1) % COLORS.length]; };

  /* Trang công khai chỉ hiện tin đã được duyệt */
  window.HG_JOBS = jobs.filter(function (j) { return j.status === 'approved'; }).map(HG.toJob);
})();
