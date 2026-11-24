/* Trang chi tiết: đọc ?id=<id việc làm> và đồng bộ trực tiếp với Backend API */
(function () {
  'use strict';
  var id = Number(new URLSearchParams(location.search).get('id'));
  var E = HG.esc;
  var $ = function (i) { return document.getElementById(i); };
  function items(s) { return String(s || '').split(/[.;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }

  var btn = $('detail-save'), label = $('detail-save-label');
  var currentJobId = id || 0;

  function paintSaveBtn() {
    if (!btn || !label) return;
    var s = HG.isSaved(currentJobId);
    btn.classList.toggle('saved', s);
    btn.setAttribute('aria-pressed', String(s));
    var key = s ? 'detail.saved' : 'detail.save';
    label.setAttribute('data-i18n', key);
    label.textContent = typeof window.t === 'function' ? window.t(key) : (s ? 'Đã lưu tin' : 'Lưu tin');
  }

  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }

  /* Tin không tồn tại (sai ?id=, tin đã bị xóa/gỡ): báo rõ thay vì hiện nhầm một tin khác */
  var grid = document.querySelector('.detail-grid'), notFoundEl = null;
  function showNotFound() {
    if (!grid) return;
    grid.hidden = true;
    if (!notFoundEl) {
      notFoundEl = document.createElement('div');
      notFoundEl.className = 'container';
      notFoundEl.id = 'd-not-found';
      notFoundEl.style.padding = '24px 0 8px';
      grid.parentNode.insertBefore(notFoundEl, grid.nextSibling);
    }
    var offline = HG.syncState === 'offline' && !HG.apiLive;
    notFoundEl.innerHTML = HG.empty('briefcase',
      offline ? tr('detail.offline_title', 'Chưa tải được tin tuyển dụng') : tr('detail.not_found_title', 'Không tìm thấy tin tuyển dụng'),
      offline ? tr('detail.offline_desc', 'Không kết nối được máy chủ. Hãy kiểm tra Backend rồi tải lại trang.')
              : tr('detail.not_found_desc', 'Tin này không tồn tại, đã hết hạn hoặc đã bị gỡ. Hãy xem các việc làm khác đang tuyển nhé.'),
      '<a class="primary-btn small" href="jobs.html" data-i18n="detail.view_other_jobs">' + E(tr('detail.view_other_jobs', 'Xem việc làm khác')) + '</a>');
    $('d-crumb').textContent = tr('detail.not_found_crumb', 'Không tìm thấy');
    document.title = tr('detail.not_found_page_title', 'Không tìm thấy tin tuyển dụng | HourGlass');
    var relatedEl = $('related-jobs');
    if (relatedEl) HG.renderJobs(relatedEl, (window.HG_JOBS || []).slice(0, 3));
  }

  function renderJobDetail() {
    var raw = id ? jobs.find(function (j) { return j && j.id === id; }) : null;
    if (!raw) {
      /* Chưa đồng bộ xong lần đầu: chờ dữ liệu thật rồi mới kết luận "không tìm thấy" */
      if (HG.syncState !== 'pending') showNotFound();
      return;
    }
    if (grid) grid.hidden = false;
    if (notFoundEl) { notFoundEl.remove(); notFoundEl = null; }
    var job = HG.toJob(raw);
    HG.currentJob = job;
    currentJobId = job.id;
    var emp = employer_profiles.find(function (e) { return e.id === (raw.employer_id || raw.recruiter_id); });

    document.title = job.title + ' – ' + job.company + ' | HourGlass';
    $('d-crumb').textContent = job.title;

    /* Hiển thị hình ảnh công việc sắc nét ở đầu phần chi tiết công việc nếu có image_url */
    var bannerWrap = $('d-banner-wrap'), bannerImg = $('d-banner-img');
    var imgUrl = job.image_url ? (HG.resolveImageUrl ? HG.resolveImageUrl(job.image_url) : job.image_url) : '';
    var bannerFb = $('d-banner-fallback');
    if (bannerWrap && bannerImg) {
      /* Khung 16:9 luôn hiển thị: ảnh thật (object-fit: cover) hoặc ảnh minh họa mặc định */
      var showFallback = function () {
        bannerImg.style.display = 'none';
        if (bannerFb) bannerFb.outerHTML = '<div id="d-banner-fallback">' + HG.imgFallback(job.color, job.logo, 'is-large') + '</div>';
      };
      bannerWrap.style.display = 'block';
      if (imgUrl) {
        bannerImg.alt = job.title;
        bannerImg.style.display = 'block';
        bannerImg.onerror = function () { bannerImg.onerror = null; showFallback(); };
        bannerImg.src = imgUrl;
        if (bannerFb) bannerFb.innerHTML = '';
      } else {
        showFallback();
      }
    }

    HG.setAvatar($('d-logo'), job.company, job.logo_url, { type: 'company' });
    $('d-tags').innerHTML = job.tags.map(function (t, i) {
      var lbl = HG.trVal ? (i === 0 ? HG.trVal('cat', t) : HG.trVal('type', t)) : t;
      return '<span' + (i ? ' class="pink-tag"' : '') + '>' + E(lbl) + '</span>';
    }).join('');
    $('d-title').textContent = job.title;
    var locTxt = HG.trVal ? HG.trVal('area', job.location) : job.location;
    $('d-sub').textContent = job.company + ' · ' + locTxt;
    $('d-salary').textContent = job.salary;
    $('d-time').textContent = raw.work_time || '—';
    $('d-deadline').textContent = HG.fmtDate(raw.end_date) || '—';
    $('d-desc').textContent = raw.description;
    var expVal = raw.experience_level || tr('detail.no_exp', 'Không yêu cầu');
    $('d-extra').innerHTML = [
      tr('detail.quantity_line', 'Số lượng tuyển: ' + (raw.quantity || 1), { qty: raw.quantity || 1 }),
      tr('detail.exp_line', 'Kinh nghiệm: ' + expVal, { exp: expVal }),
      tr('detail.start_date_line', 'Bắt đầu từ: ' + (HG.fmtDate(raw.start_date) || '—'), { date: HG.fmtDate(raw.start_date) || '—' })
    ].map(function (x) { return '<li>' + E(x) + '</li>'; }).join('');
    $('d-reqs').innerHTML = items(raw.requirements).map(function (x) { return '<li>' + E(x) + '.</li>'; }).join('');
    $('d-perks').innerHTML = items(raw.benefits).map(function (x) { return '<span>' + HG.icon('check', 16) + E(x) + '</span>'; }).join('');
    $('d-company-h').textContent = tr('detail.about_company', 'Về ' + job.company, { company: job.company });
    HG.setAvatar($('d-company-logo'), job.company, job.logo_url, { type: 'company' });
    $('d-company-name').textContent = job.company;
    $('d-company-industry').textContent = emp ? emp.industry : '';
    $('d-company-desc').textContent = emp ? emp.description : '';

    paintSaveBtn();
    renderReviewsAndReports(raw, emp);

    /* Ghi vào "Đã xem gần đây" (localStorage hourglass_recent_jobs, tối đa 10 tin).
       Chỉ ghi khi đúng tin được mở theo ?id=; lần render sau (đồng bộ API) chỉ cập nhật thông tin. */
    if (HG.savedJobs && raw.id === id) HG.savedJobs.addRecent(job);

    var relatedEl = $('related-jobs');
    if (relatedEl) {
      var related = (window.HG_JOBS || []).filter(function (j) { return j.id !== job.id; }).slice(0, 3);
      HG.renderJobs(relatedEl, related);
    }
  }

  /* [ST4-04] Uy tín nhà tuyển dụng + Gửi đánh giá / khiếu nại – dữ liệu thật từ API */
  var lastRepUserId = null;
  function renderReviewsAndReports(raw, emp) {
    if (!HG.rr) return;
    var repSec = $('d-reputation'), repBody = $('d-reputation-body'), actions = $('d-rr-actions');
    if (repSec && repBody && emp && emp.user_id) {
      repSec.hidden = false;
      if (lastRepUserId !== emp.user_id) {          /* tránh gọi API lặp lại mỗi lần đồng bộ */
        lastRepUserId = emp.user_id;
        HG.rr.renderReputation(repBody, emp.user_id, { limit: 5 });
      }
    }
    if (!actions) return;
    var me = HG.user(), html = '';
    if (me && me.role === 'student' && emp && emp.user_id) {
      var sid = HG.studentId(me);
      var accepted = applications.some(function (a) { return a.student_id === sid && a.job_id === raw.id && a.status_id === 4; });
      if (accepted) {
        html += HG.hasReviewed(emp.user_id, raw.id)
          ? '<button type="button" class="rr-action-btn review" disabled>' + HG.icon('check', 16) + ' <span data-i18n="detail.reviewed_btn">' + E(tr('detail.reviewed_btn', 'Bạn đã đánh giá nhà tuyển dụng này')) + '</span></button>'
          : '<button type="button" class="rr-action-btn review" data-rr-review data-i18n="detail.review_btn">' + E(tr('detail.review_btn', '★ Đánh giá nhà tuyển dụng')) + '</button>';
      }
    }
    if (!me || me.role !== 'admin') {
      html += '<button type="button" class="rr-action-btn" data-rr-report>' + HG.icon('shield', 16) + ' <span data-i18n="detail.report_btn">' + E(tr('detail.report_btn', 'Báo cáo tin tuyển dụng vi phạm')) + '</span></button>';
    }
    actions.innerHTML = html;
    actions.onclick = function (e) {
      if (e.target.closest('[data-rr-review]')) {
        HG.rr.openReviewModal({
          targetUserId: emp.user_id, targetName: emp.company_name, jobId: raw.id, jobTitle: raw.title,
          onDone: function () { lastRepUserId = null; renderJobDetail(); }
        });
      } else if (e.target.closest('[data-rr-report]')) {
        if (!HG.user()) {
          HG.toast(tr('detail.login_to_report', 'Hãy đăng nhập để gửi khiếu nại.'), 'info');
          if (HG.goAuth) HG.goAuth({ mode: 'signin', next: 'job-detail.html?id=' + raw.id });
          return;
        }
        var targets = [{ type: 'job', targetId: raw.id, label: raw.title }];
        if (emp) targets.push({ type: 'employer', targetId: emp.id, label: emp.company_name });
        HG.rr.openReportModal({ targets: targets });
      }
    };
    if (repBody && !repBody.dataset.rrBound) {
      repBody.dataset.rrBound = '1';
      repBody.addEventListener('click', function (e) {
        if (e.target.closest('[data-rr-retry]') && lastRepUserId) HG.rr.renderReputation(repBody, lastRepUserId, { limit: 5 });
      });
    }
  }

  if (btn) {
    btn.addEventListener('click', function () {
      var who = HG.user();
      if (!currentJobId) return;
      if (!who || who.role !== 'student') {
        HG.toast(who ? tr('common.only_student_save', 'Chỉ tài khoản sinh viên mới lưu được việc làm.') : tr('common.login_to_save', 'Hãy đăng nhập tài khoản sinh viên để lưu việc làm.'), 'info');
        return;
      }
      HG.busy(btn, function () {
        var isS = HG.toggleSaved(currentJobId);
        paintSaveBtn();
        HG.toast(isS ? tr('common.job_saved_toast', 'Đã lưu tin. Xem lại trong mục "Việc đã lưu" của bạn.') : tr('common.job_unsaved_toast', 'Đã bỏ lưu tin.'), isS ? 'success' : 'info');
      }, 400);
    });
  }

  renderJobDetail();
  document.addEventListener('hg:synced', renderJobDetail);
  window.addEventListener('languageChanged', renderJobDetail);
  /* Lần đồng bộ đầu tiên kết thúc (kể cả khi Backend tắt) -> chốt trạng thái hiển thị */
  if (HG.ready) HG.ready().then(renderJobDetail);
  /* Lưu / bỏ lưu ở nơi khác (thẻ việc liên quan, tab khác) -> nút ở đây cập nhật theo */
  document.addEventListener('hg:saved-change', function (e) { if (!e.detail || e.detail.kind === 'saved') paintSaveBtn(); });

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
