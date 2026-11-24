/* =========================================================
   reviews-reports.js – [ST4-04] Giao diện Đánh giá uy tín & Khiếu nại (dùng chung)
   - Dữ liệu 100% từ API thật qua adapter.js (HG.submitReview, HG.fetchReputation,
     HG.fetchReviewsOf, HG.submitReport, HG.fetchMyReports) – không dùng mock-data.
   - Lỗi hiển thị rõ ràng ngay trong form + toast; sự kiện quan trọng đẩy vào
     chuông thông báo (notify.js) thông qua HG.notify trong adapter.js.

   API:
     HG.rr.openReviewModal({ targetUserId, targetName, jobId, jobTitle, onDone })
     HG.rr.openReportModal({ targets: [{ type, targetId, label }], onDone })
     HG.rr.renderReputation(container, userId, { title, compact })
     HG.rr.renderMyReports(container)
     HG.rr.mountProfileExtras(afterEl)   // chèn 2 panel vào tab Hồ sơ của user hiện tại
   Nạp sau: main.js, common.js, adapter.js, modal.js
   ========================================================= */
(function () {
  'use strict';
  var HG = window.HG;
  if (!HG) return;
  var E = HG.esc, I = HG.icon;
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }

  function stars(n) {
    var full = Math.round(Number(n) || 0), out = '';
    for (var i = 1; i <= 5; i++) out += '<span class="rr-star' + (i <= full ? ' on' : '') + '">★</span>';
    return '<span class="rr-stars" aria-label="' + (Number(n) || 0) + ' / 5 ★">' + out + '</span>';
  }
  function userName(uid) {
    var u = users.find(function (x) { return x.id === uid; });
    if (!u) return tr('rep.target.user_fmt', 'Người dùng #' + uid, { id: uid });
    if (u.role === 'employer') {
      var ep = employer_profiles.find(function (x) { return x.user_id === uid; });
      if (ep) return ep.company_name;
    }
    return u.full_name;
  }
  function jobTitle(jid) {
    var j = jid && jobs.find(function (x) { return x.id === jid; });
    return j ? j.title : '';
  }
  function fmt(dt) { return dt ? HG.fmtDate(String(dt).replace('T', ' ').slice(0, 10)) : ''; }
  function loading(text) { return '<div class="rr-loading"><span class="spinner" aria-hidden="true"></span> ' + E(text || tr('rr.loading_rep', 'Đang tải dữ liệu…')) + '</div>'; }
  function errorBox(msg) {
    return '<div class="rr-error" role="alert">' + I('alert', 16) + '<span>' + E(msg) + '</span>' +
      '<button type="button" class="rr-retry" data-rr-retry data-i18n="rr.retry">' + E(tr('rr.retry', 'Thử lại')) + '</button></div>';
  }
  function setErr(el, msg) { if (el) el.textContent = msg || ''; }

  /* ───────────── 1. Modal gửi đánh giá ───────────── */
  function openReviewModal(o) {
    o = o || {};
    if (!HG.user()) { HG.toast('Vui lòng đăng nhập để gửi đánh giá.', 'info'); return; }
    var rating = 0;
    HG.modal.open({
      className: 'rr-modal',
      labelledBy: 'rr-review-title',
      html:
        '<h2 id="rr-review-title">' + E(tr('rr.review_modal_title', 'Đánh giá ' + (o.targetName || 'người dùng'), { name: o.targetName || 'người dùng' })) + '</h2>' +
        (o.jobTitle ? '<p class="rr-sub"><span data-i18n="rr.job_label">' + E(tr('rr.job_label', 'Công việc:')) + '</span> <strong>' + E(o.jobTitle) + '</strong></p>' : '') +
        '<form class="rr-form" novalidate>' +
          '<label><span data-i18n="rr.satisfaction_lbl">' + E(tr('rr.satisfaction_lbl', 'Mức độ hài lòng')) + '</span> <em>*</em></label>' +
          '<div class="rr-star-input" role="radiogroup" aria-label="Chọn số sao">' +
            [1, 2, 3, 4, 5].map(function (n) {
              return '<button type="button" role="radio" aria-checked="false" data-star="' + n + '" aria-label="' + n + ' ★">★</button>';
            }).join('') +
            '<span class="rr-star-text" data-star-text data-i18n="rr.not_selected">' + E(tr('rr.not_selected', 'Chưa chọn')) + '</span>' +
          '</div>' +
          '<small class="rr-field-err" data-err="rating"></small>' +
          '<label for="rr-review-comment" data-i18n="rr.comment_lbl">' + E(tr('rr.comment_lbl', 'Nhận xét (không bắt buộc)')) + '</label>' +
          '<textarea id="rr-review-comment" rows="4" maxlength="1000" placeholder="' + E(tr('rr.comment_ph', 'Chia sẻ trải nghiệm làm việc thực tế: đúng giờ, thái độ, trả lương, môi trường...')) + '" data-i18n-placeholder="rr.comment_ph"></textarea>' +
          '<div class="rr-counter"><span data-count>0</span>/1000</div>' +
          '<small class="rr-field-err" data-err="comment"></small>' +
          '<div class="rr-form-err" data-err="form" role="alert"></div>' +
          '<div class="modal-actions"><button type="button" class="secondary-btn" data-close data-i18n="common.cancel">' + E(tr('common.cancel', 'Hủy')) + '</button>' +
          '<button type="submit" class="primary-btn" data-submit data-i18n="rr.submit_review_btn">' + E(tr('rr.submit_review_btn', 'Gửi đánh giá')) + '</button></div>' +
        '</form>',
      onMount: function (api) {
        var box = api.box, form = box.querySelector('form'), ta = box.querySelector('textarea');
        var LABEL = [
          tr('rr.star_0', 'Chưa chọn'),
          tr('rr.star_1', 'Rất không hài lòng'),
          tr('rr.star_2', 'Chưa hài lòng'),
          tr('rr.star_3', 'Bình thường'),
          tr('rr.star_4', 'Hài lòng'),
          tr('rr.star_5', 'Rất hài lòng')
        ];
        function paint() {
          box.querySelectorAll('[data-star]').forEach(function (b) {
            var on = Number(b.dataset.star) <= rating;
            b.classList.toggle('on', on);
            b.setAttribute('aria-checked', String(Number(b.dataset.star) === rating));
          });
          box.querySelector('[data-star-text]').textContent = LABEL[rating];
        }
        box.querySelector('.rr-star-input').addEventListener('click', function (e) {
          var b = e.target.closest('[data-star]'); if (!b) return;
          rating = Number(b.dataset.star); paint(); setErr(box.querySelector('[data-err="rating"]'), '');
        });
        ta.addEventListener('input', function () { box.querySelector('[data-count]').textContent = ta.value.length; });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          ['rating', 'comment', 'form'].forEach(function (k) { setErr(box.querySelector('[data-err="' + k + '"]'), ''); });
          if (!rating) { setErr(box.querySelector('[data-err="rating"]'), tr('rr.err_pick_star', 'Vui lòng chọn số sao từ 1 đến 5.')); return; }
          var btn = box.querySelector('[data-submit]');
          HG.busyAsync(btn, function () {
            return HG.submitReview({ target_id: o.targetUserId, job_id: o.jobId || null, rating: rating, comment: ta.value });
          }).then(function (res) {
            if (res && res.ok) {
              api.close(true);
              HG.toast(tr('rr.toast_review_ok', 'Cảm ơn bạn! Đánh giá đã được ghi nhận.'));
              if (o.onDone) o.onDone(res.review);
              return;
            }
            if (res && res.busy) return;
            var msg = (res && res.error) || tr('rr.err_review_fail', 'Không gửi được đánh giá.');
            setErr(box.querySelector('[data-err="' + (res && res.field ? res.field : 'form') + '"]'), msg);
            HG.toast(msg, 'error');
          });
        });
      }
    });
  }

  /* ───────────── 2. Modal gửi khiếu nại ───────────── */
  function getQuickReasons(type) {
    var map = {
      job: [
        tr('rr.qr_job_1', 'Thông tin lương không đúng thực tế'),
        tr('rr.qr_job_2', 'Yêu cầu đặt cọc / thu phí'),
        tr('rr.qr_job_3', 'Nội dung lừa đảo, không có thật'),
        tr('rr.qr_job_4', 'Tin trùng lặp / spam')
      ],
      employer: [
        tr('rr.qr_emp_1', 'Không trả lương đúng hạn'),
        tr('rr.qr_emp_2', 'Thái độ thiếu tôn trọng'),
        tr('rr.qr_emp_3', 'Thông tin doanh nghiệp sai lệch')
      ],
      user: [
        tr('rr.qr_user_1', 'Không đến làm như đã hẹn'),
        tr('rr.qr_user_2', 'Thông tin hồ sơ sai sự thật'),
        tr('rr.qr_user_3', 'Hành vi thiếu chuẩn mực')
      ],
      application: [
        tr('rr.qr_app_1', 'Hồ sơ giả mạo'),
        tr('rr.qr_app_2', 'Nội dung không phù hợp')
      ],
      other: []
    };
    return map[type] || [];
  }
  function openReportModal(o) {
    o = o || {};
    var targets = (o.targets || []).filter(function (t) { return t && t.targetId; });
    if (!HG.user()) { HG.toast('Vui lòng đăng nhập để gửi khiếu nại.', 'info'); return; }
    if (!targets.length) { HG.toast('Không xác định được đối tượng cần khiếu nại.', 'error'); return; }
    var picked = targets[0];
    HG.modal.open({
      className: 'rr-modal',
      labelledBy: 'rr-report-title',
      html:
        '<h2 id="rr-report-title">' + I('shield', 20) + ' <span data-i18n="rr.report_modal_title">' + E(tr('rr.report_modal_title', 'Gửi khiếu nại vi phạm')) + '</span></h2>' +
        '<p class="rr-sub" data-i18n="rr.report_modal_sub">' + E(tr('rr.report_modal_sub', 'Khiếu nại sẽ được gửi tới Quản trị viên HourGlass. Bạn sẽ nhận thông báo khi có kết quả xử lý.')) + '</p>' +
        '<form class="rr-form" novalidate>' +
          (targets.length > 1
            ? '<label for="rr-report-type" data-i18n="rr.report_target_lbl">' + E(tr('rr.report_target_lbl', 'Đối tượng khiếu nại')) + '</label><select id="rr-report-type">' +
              targets.map(function (t, i) { return '<option value="' + i + '">' + E((HG.REPORT_TYPE_LABEL[t.type] || t.type) + ': ' + t.label) + '</option>'; }).join('') + '</select>'
            : '<p class="rr-target">' + E((HG.REPORT_TYPE_LABEL[picked.type] || picked.type) + ': ' + picked.label) + '</p>') +
          '<label for="rr-report-reason"><span data-i18n="rr.report_reason_lbl">' + E(tr('rr.report_reason_lbl', 'Lý do khiếu nại')) + '</span> <em>*</em></label>' +
          '<div class="rr-quick" data-quick></div>' +
          '<textarea id="rr-report-reason" rows="4" maxlength="2000" placeholder="' + E(tr('rr.report_reason_ph', 'Mô tả cụ thể vấn đề bạn gặp phải (tối thiểu 5 ký tự)...')) + '" data-i18n-placeholder="rr.report_reason_ph"></textarea>' +
          '<div class="rr-counter"><span data-count>0</span>/2000</div>' +
          '<small class="rr-field-err" data-err="reason"></small>' +
          '<div class="rr-form-err" data-err="form" role="alert"></div>' +
          '<div class="modal-actions"><button type="button" class="secondary-btn" data-close data-i18n="common.cancel">' + E(tr('common.cancel', 'Hủy')) + '</button>' +
          '<button type="submit" class="primary-btn danger" data-submit data-i18n="rr.submit_report_btn">' + E(tr('rr.submit_report_btn', 'Gửi khiếu nại')) + '</button></div>' +
        '</form>',
      onMount: function (api) {
        var box = api.box, form = box.querySelector('form'), ta = box.querySelector('textarea'), sel = box.querySelector('#rr-report-type');
        function paintQuick() {
          box.querySelector('[data-quick]').innerHTML = getQuickReasons(picked.type).map(function (r) {
            return '<button type="button" data-q="' + E(r) + '">' + E(r) + '</button>';
          }).join('');
        }
        paintQuick();
        if (sel) sel.addEventListener('change', function () { picked = targets[Number(sel.value)] || targets[0]; paintQuick(); });
        box.querySelector('[data-quick]').addEventListener('click', function (e) {
          var b = e.target.closest('[data-q]'); if (!b) return;
          ta.value = ta.value.trim() ? ta.value.trim() + '. ' + b.dataset.q : b.dataset.q;
          ta.dispatchEvent(new Event('input')); ta.focus();
        });
        ta.addEventListener('input', function () { box.querySelector('[data-count]').textContent = ta.value.length; setErr(box.querySelector('[data-err="reason"]'), ''); });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          setErr(box.querySelector('[data-err="reason"]'), ''); setErr(box.querySelector('[data-err="form"]'), '');
          if (ta.value.trim().length < 5) { setErr(box.querySelector('[data-err="reason"]'), tr('rr.err_reason_min', 'Lý do khiếu nại cần ít nhất 5 ký tự.')); ta.focus(); return; }
          var btn = box.querySelector('[data-submit]');
          HG.busyAsync(btn, function () {
            return HG.submitReport({ report_type: picked.type, target_id: picked.targetId, reason: ta.value });
          }).then(function (res) {
            if (res && res.ok) {
              api.close(true);
              HG.toast(tr('rr.toast_report_ok', 'Đã gửi khiếu nại #' + (res.report ? res.report.id : '') + '. Quản trị viên sẽ xem xét sớm.', { id: res.report ? res.report.id : '' }));
              if (o.onDone) o.onDone(res.report);
              return;
            }
            if (res && res.busy) return;
            var msg = (res && res.error) || tr('rr.err_report_fail', 'Không gửi được khiếu nại.');
            setErr(box.querySelector('[data-err="' + (res && res.field ? res.field : 'form') + '"]'), msg);
            HG.toast(msg, 'error');
          });
        });
      }
    });
  }

  /* ───────────── 3. Khối điểm uy tín + danh sách đánh giá ───────────── */
  function renderReputation(container, userId, opts) {
    if (!container) return;
    opts = opts || {};
    container.innerHTML = loading(tr('rr.loading_rep', 'Đang tải đánh giá uy tín…'));
    Promise.all([HG.fetchReputation(userId), HG.fetchReviewsOf(userId, opts.limit || 10)]).then(function (r) {
      var rep = r[0], list = r[1];
      if (rep.error || list.error) { container.innerHTML = errorBox(rep.error || list.error); return; }
      var d = rep.data || {}, total = d.total_reviews || 0, bd = d.rating_breakdown || {};
      var summary =
        '<div class="rr-summary">' +
          '<div class="rr-score"><strong>' + (total ? Number(d.average_rating).toFixed(1) : '—') + '</strong>' + stars(d.average_rating) +
          '<small>' + E(tr('rr.reviews_count', total + ' đánh giá', { total: total })) + '</small></div>' +
          '<div class="rr-bars">' + [5, 4, 3, 2, 1].map(function (s) {
            var n = Number(bd[String(s)] || 0), pct = total ? Math.round(n * 100 / total) : 0;
            return '<div class="rr-bar"><span>' + s + '★</span><i><b style="width:' + pct + '%"></b></i><em>' + n + '</em></div>';
          }).join('') + '</div>' +
          (d.reputation_badge ? '<span class="rr-badge' + (/Cảnh báo/.test(d.reputation_badge) ? ' warn' : '') + '">' + I('shield', 14) + ' ' + E(d.reputation_badge) + '</span>' : '') +
        '</div>';
      var items = (list.reviews || []).map(function (rv) {
        var jt = jobTitle(rv.job_id);
        return '<div class="rr-review">' +
          '<div class="rr-review-head"><strong>' + E(userName(rv.reviewer_id)) + '</strong>' + stars(rv.rating) + '<small>' + fmt(rv.created_at) + '</small></div>' +
          (jt ? '<small class="rr-review-job">' + I('briefcase', 12) + ' ' + E(jt) + '</small>' : '') +
          (rv.comment ? '<p>' + E(rv.comment) + '</p>' : '<p class="rr-muted" data-i18n="rr.no_comment">' + E(tr('rr.no_comment', 'Không có nhận xét.')) + '</p>') +
        '</div>';
      }).join('');
      container.innerHTML = summary + (items
        ? '<div class="rr-review-list">' + items + '</div>'
        : '<p class="rr-muted rr-empty" data-i18n="rr.no_reviews">' + E(tr('rr.no_reviews', 'Chưa có đánh giá nào.')) + '</p>');
    });
  }

  /* ───────────── 4. Danh sách khiếu nại đã gửi ───────────── */
  function renderMyReports(container) {
    if (!container) return;
    container.innerHTML = loading(tr('rr.loading_reports', 'Đang tải khiếu nại của bạn…'));
    HG.fetchMyReports().then(function (res) {
      if (res.error) { container.innerHTML = errorBox(res.error); return; }
      if (!res.reports.length) { container.innerHTML = '<p class="rr-muted rr-empty" data-i18n="rr.no_reports">' + E(tr('rr.no_reports', 'Bạn chưa gửi khiếu nại nào.')) + '</p>'; return; }
      container.innerHTML = '<div class="rr-report-list">' + res.reports.map(function (r) {
        var st = HG.REPORT_STATUS_LABEL[r.status] || [r.status, 'pending'];
        return '<div class="rr-report">' +
          '<div class="rr-report-head"><strong>#' + r.id + ' · ' + E(HG.REPORT_TYPE_LABEL[r.report_type] || r.report_type) + ': ' + E(HG.reportTargetLabel(r)) + '</strong>' +
          '<span class="rr-chip ' + st[1] + '">' + E(st[0]) + '</span></div>' +
          '<p>' + E(r.reason) + '</p>' +
          '<small class="rr-muted">' + E(tr('rr.sent_on', 'Gửi ngày ' + fmt(r.created_at), { date: fmt(r.created_at) })) + (r.status !== 'pending' && r.updated_at ? E(tr('rr.processed_on', ' · Xử lý ngày ' + fmt(r.updated_at), { date: fmt(r.updated_at) })) : '') + '</small>' +
          (r.admin_note ? '<div class="rr-admin-note">' + I('info', 14) + ' <span><b data-i18n="rr.admin_reply">' + E(tr('rr.admin_reply', 'Phản hồi của Quản trị viên:')) + '</b> ' + E(r.admin_note) + '</span></div>' : '') +
        '</div>';
      }).join('') + '</div>';
    });
  }

  /* ───────────── 5. Gắn vào tab Hồ sơ (student.html / employer.html) ───────────── */
  function mountProfileExtras(afterEl) {
    var me = HG.user();
    if (!afterEl || !me || document.getElementById('rr-profile-extras')) return;
    var wrap = document.createElement('div');
    wrap.id = 'rr-profile-extras';
    wrap.className = 'rr-profile-extras';
    wrap.innerHTML =
      '<section class="panel rr-panel"><div class="panel-title"><h3>' + I('sparkle', 18) + ' <span data-i18n="rr.panel_rep_title">' + E(tr('rr.panel_rep_title', 'Đánh giá & uy tín của bạn')) + '</span></h3></div><div data-rr-rep></div></section>' +
      '<section class="panel rr-panel"><div class="panel-title"><h3>' + I('shield', 18) + ' <span data-i18n="rr.panel_reports_title">' + E(tr('rr.panel_reports_title', 'Khiếu nại đã gửi')) + '</span></h3></div><div data-rr-reports></div></section>';
    afterEl.parentNode.insertBefore(wrap, afterEl.nextSibling);
    var repEl = wrap.querySelector('[data-rr-rep]'), myEl = wrap.querySelector('[data-rr-reports]');
    function refresh() { renderReputation(repEl, me.id); renderMyReports(myEl); }
    wrap.addEventListener('click', function (e) {
      if (!e.target.closest('[data-rr-retry]')) return;
      if (repEl.contains(e.target)) renderReputation(repEl, me.id); else renderMyReports(myEl);
    });
    refresh();
    /* Làm mới khi có thay đổi (đánh giá mới / admin xử lý khiếu nại) – gộp nhiều sự kiện liên tiếp */
    var t = null;
    document.addEventListener('hg:notify', function () { clearTimeout(t); t = setTimeout(refresh, 400); });
    window.addEventListener('languageChanged', refresh);
  }

  HG.rr = {
    openReviewModal: openReviewModal,
    openReportModal: openReportModal,
    renderReputation: renderReputation,
    renderMyReports: renderMyReports,
    mountProfileExtras: mountProfileExtras,
    stars: stars
  };
})();
