/* Trang chi tiết: đọc ?id=<id việc làm> và đồng bộ trực tiếp với Backend API */
(function () {
  'use strict';
  var id = Number(new URLSearchParams(location.search).get('id'));
  var E = HG.esc;
  var $ = function (i) { return document.getElementById(i); };
  function items(s) { return String(s || '').split(/[.;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  var btn = $('detail-save'), label = $('detail-save-label');
  var currentJobId = id || 1;

  function paintSaveBtn() {
    if (!btn || !label) return;
    var s = HG.isSaved(currentJobId);
    btn.classList.toggle('saved', s);
    label.textContent = s ? 'Đã lưu việc làm' : 'Lưu việc làm';
  }

  function renderJobDetail() {
    var raw = jobs.find(function (j) { return j.id === id; }) || jobs.find(function (j) { return j.status === 'approved'; }) || jobs[0];
    if (!raw) return;
    var job = HG.toJob(raw);
    HG.currentJob = job;
    currentJobId = job.id;
    var emp = employer_profiles.find(function (e) { return e.id === (raw.employer_id || raw.recruiter_id); });

    document.title = job.title + ' – ' + job.company + ' | HourGlass';
    $('d-crumb').textContent = job.title;
    $('d-logo').style.background = job.color; $('d-logo').textContent = job.logo;
    $('d-tags').innerHTML = job.tags.map(function (t, i) { return '<span' + (i ? ' class="pink-tag"' : '') + '>' + E(t) + '</span>'; }).join('');
    $('d-title').textContent = job.title;
    $('d-sub').textContent = job.company + ' · ' + job.location;
    $('d-salary').textContent = job.salary;
    $('d-time').textContent = raw.work_time || '—';
    $('d-deadline').textContent = HG.fmtDate(raw.end_date) || '—';
    $('d-desc').textContent = raw.description;
    $('d-extra').innerHTML = ['Số lượng tuyển: ' + (raw.quantity || 1), 'Kinh nghiệm: ' + (raw.experience_level || 'Không yêu cầu'), 'Bắt đầu từ: ' + (HG.fmtDate(raw.start_date) || '—')]
      .map(function (x) { return '<li>' + E(x) + '</li>'; }).join('');
    $('d-reqs').innerHTML = items(raw.requirements).map(function (x) { return '<li>' + E(x) + '.</li>'; }).join('');
    $('d-perks').innerHTML = items(raw.benefits).map(function (x) { return '<span>' + HG.icon('check', 16) + E(x) + '</span>'; }).join('');
    $('d-company-h').textContent = 'Về ' + job.company;
    $('d-company-logo').style.background = job.color; $('d-company-logo').textContent = job.logo;
    $('d-company-name').textContent = job.company;
    $('d-company-industry').textContent = emp ? emp.industry : '';
    $('d-company-desc').textContent = emp ? emp.description : '';

    paintSaveBtn();

    var relatedEl = $('related-jobs');
    if (relatedEl) {
      var related = (window.HG_JOBS || []).filter(function (j) { return j.id !== job.id; }).slice(0, 3);
      HG.renderJobs(relatedEl, related);
    }
  }

  if (btn) {
    btn.addEventListener('click', function () {
      var who = HG.user();
      if (!who || who.role !== 'student') { HG.toast(who ? 'Chỉ tài khoản sinh viên mới lưu được việc làm.' : 'Hãy đăng nhập tài khoản sinh viên để lưu việc làm.', 'info'); return; }
      HG.busy(btn, function () {
        var isS = HG.toggleSaved(currentJobId);
        paintSaveBtn();
        HG.toast(isS ? 'Đã lưu việc làm vào mục yêu thích.' : 'Đã bỏ lưu việc làm.', isS ? 'success' : 'info');
      }, 400);
    });
  }

  renderJobDetail();
  document.addEventListener('hg:synced', renderJobDetail);

  /* Gọi trực tiếp API chi tiết công việc GET /api/jobs/{id} qua api.js */
  if (id && window.HGApi && typeof window.HGApi.getJobDetail === 'function') {
    window.HGApi.getJobDetail(id)
      .then(function (res) {
        var apiJob = res && (res.job || (res.id ? res : null));
        if (apiJob && apiJob.id) {
          if (!apiJob.employer_id && apiJob.recruiter_id) apiJob.employer_id = apiJob.recruiter_id;
          var idx = jobs.findIndex(function (j) { return j.id === apiJob.id; });
          if (idx !== -1) {
            Object.assign(jobs[idx], apiJob);
          } else {
            jobs.push(apiJob);
          }
          renderJobDetail();
        }
      })
      .catch(function () {});
  }
})();
