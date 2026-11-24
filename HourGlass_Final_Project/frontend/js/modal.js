/* =========================================================
   modal.js – Component modal dùng chung toàn hệ thống

   API:
     HG.modal.open({ html, onMount, onClose, dismissible })  mở modal tuỳ biến
     HG.modal.close()                                         đóng modal đang mở
     HG.confirm({ title, message, confirmText, cancelText, danger, icon })
                                                              -> Promise<boolean> (true = Xác nhận)
     HG.openModal('apply')                                    modal ứng tuyển (dùng HG.modal bên dưới)

   Mở bằng HTML: <button data-modal="apply"> ...  (data-modal="auth" sẽ chuyển sang auth.html)
   Đóng: nút [data-close], click nền tối, hoặc phím Esc. Tự trả focus về nút đã mở.
   ========================================================= */
(function () {
  'use strict';
  var I = HG.icon, esc = HG.esc;
  var current = null; // { wrap, box, opener, opts }

  /* ---------- 1. Lõi modal ---------- */
  function close(result) {
    if (!current) return;
    var c = current; current = null;
    c.wrap.remove();
    document.body.classList.remove('modal-open');
    /* trả focus cho nút đã mở – chỉ khi nút đó vẫn còn trên trang (danh sách có thể đã render lại) */
    if (c.opener && c.opener.focus && document.contains(c.opener)) c.opener.focus();
    if (c.opts.onClose) c.opts.onClose(result);
  }

  /* opts.html: nội dung bên trong khung modal; opts.className: thêm class cho khung */
  function open(opts) {
    close();
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal' + (opts.className ? ' ' + opts.className : '') + '" role="dialog" aria-modal="true" tabindex="-1">' +
      (opts.dismissible === false ? '' : '<button class="modal-close" type="button" data-close aria-label="' + esc(tr('common.close', 'Đóng')) + '">' + I('x') + '</button>') +
      '<div class="modal-body"></div></div>';
    var box = wrap.firstChild, body = box.lastChild;
    var inst = { wrap: wrap, box: box, opener: document.activeElement, opts: opts };
    current = inst;

    /* api.close / api.render chỉ tác động lên ĐÚNG modal này: nếu người dùng đã đóng nó (Esc, nền tối, X)
       hoặc đã mở modal khác trong lúc chờ API trả về thì lời gọi muộn sẽ bị bỏ qua,
       tránh đóng nhầm / ghi đè nội dung modal đang hiển thị. */
    var api = {
      box: box,
      isOpen: function () { return current === inst; },
      close: function (result) { if (current === inst) close(result); },
      /* Vẽ lại phần nội dung (dùng cho modal nhiều bước) */
      render: function (html) { if (current !== inst) return; body.innerHTML = html; focusFirst(); }
    };
    body.innerHTML = opts.html;
    if (opts.labelledBy) box.setAttribute('aria-labelledby', opts.labelledBy);

    /* Click nền tối: chỉ đóng khi cả mousedown và click đều nằm trên nền
       (kéo bôi đen chữ trong ô nhập rồi thả chuột ra ngoài không làm mất form) */
    var downOnBackdrop = false;
    wrap.addEventListener('mousedown', function (e) { downOnBackdrop = e.target === wrap; });
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap && downOnBackdrop && opts.dismissible !== false) api.close(false);
      downOnBackdrop = false;
    });
    box.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) api.close(false); });

    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    function focusFirst() {
      var f = box.querySelector('[data-autofocus]') || box.querySelector('input,select,button:not(.modal-close)') || box;
      f.focus();
    }
    focusFirst();
    if (opts.onMount) opts.onMount(api);
    return api;
  }

  /* Phím Esc đóng modal; Tab quay vòng trong modal (focus trap) */
  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape' && !e.isComposing && !e.defaultPrevented && current.opts.dismissible !== false) { e.preventDefault(); close(false); return; }
    if (e.key === 'Tab') {
      var f = current.box.querySelectorAll('a[href],button:not([disabled]),input,select,textarea');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  HG.modal = { open: open, close: close };

  /* ---------- 2. Hộp thoại xác nhận (dùng cho Đăng xuất và mọi hành động cần hỏi lại) ---------- */
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }
  HG.confirm = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      open({
        className: 'modal-confirm',
        dismissible: true,
        labelledBy: 'confirm-title',
        html:
          '<div class="confirm-icon' + (o.danger ? ' danger' : '') + '">' + I(o.icon || 'logout', 28) + '</div>' +
          '<h2 id="confirm-title">' + esc(o.title || tr('modal.are_you_sure', 'Bạn có chắc chắn không?')) + '</h2>' +
          (o.message ? '<p>' + esc(o.message) + '</p>' : '') +
          '<div class="modal-actions">' +
          '<button type="button" class="secondary-btn" data-cancel data-autofocus>' + esc(o.cancelText || tr('common.cancel', 'Hủy bỏ')) + '</button>' +
          '<button type="button" class="primary-btn' + (o.danger ? ' danger' : '') + '" data-ok>' + esc(o.confirmText || tr('common.confirm', 'Xác nhận')) + '</button>' +
          '</div>',
        onMount: function (api) {
          api.box.querySelector('[data-ok]').addEventListener('click', function () { finish(true); api.close(true); });
          api.box.querySelector('[data-cancel]').addEventListener('click', function () { finish(false); api.close(false); });
        },
        onClose: function (r) { finish(r === true); }   // Esc / click nền / nút X => Hủy bỏ
      });
    });
  };

  /* Popup xác nhận đăng xuất: main.js gọi HG.requestLogout() khi bấm nút Đăng xuất */
  HG.requestLogout = function () {
    HG.confirm({
      title: tr('common.logout_title', 'Đăng xuất'),
      message: tr('common.logout_confirm', 'Bạn có chắc chắn muốn đăng xuất không?'),
      confirmText: tr('common.confirm', 'Xác nhận'),
      cancelText: tr('common.cancel', 'Hủy bỏ'),
      danger: true
    }).then(function (ok) { if (ok) HG.logout(); });
  };

  /* ---------- 3. Modal ứng tuyển (nộp CV qua API thật) ---------- */
  /* Tìm đúng tin theo id; KHÔNG lùi về tin khác (tránh nộp nhầm hồ sơ vào tin đầu danh sách) */
  function findJob(jobId) {
    var pub = window.HG_JOBS || [];
    if (jobId) {
      var hit = pub.find(function (x) { return x.id === jobId; });
      if (hit) return hit;
      var raw = typeof jobs !== 'undefined' ? jobs.find(function (x) { return x && x.id === jobId; }) : null;
      return raw && HG.toJob ? HG.toJob(raw) : null;
    }
    return HG.currentJob || null;   /* nút ứng tuyển trên trang chi tiết (không kèm data-job-id) */
  }

  function applyModal(jobId) {
    var me = HG.user();
    if (!me || me.role !== 'student') {   /* gọi trực tiếp HG.openModal('apply') khi chưa đăng nhập */
      HG.goAuth({ role: 'student', next: location.pathname.split('/').pop() + location.search, notice: tr('modal.login_to_apply', 'Hãy đăng nhập tài khoản sinh viên để ứng tuyển.') });
      return;
    }
    var job = findJob(jobId);
    if (!job) { HG.toast(tr('modal.job_not_found', 'Không tìm thấy tin tuyển dụng này – có thể tin đã hết hạn hoặc bị gỡ.'), 'error'); return; }
    var raw = job.raw || {};
    if (raw.status && raw.status !== 'approved') { HG.toast(tr('modal.job_closed', 'Tin tuyển dụng này hiện không nhận hồ sơ.'), 'error'); return; }
    var u = HG.user(), sid = HG.studentId(u);
    if (!sid) { HG.toast(tr('modal.no_student_profile', 'Không tìm thấy hồ sơ sinh viên của tài khoản này.'), 'error'); return; }
    /* CV thật từ Backend (bootstrap); danh sách được làm mới qua HG.fetchMyCvs() bên dưới */
    var studentCvs = cvs.filter(function (c) { return c.student_id === sid; });
    var submitting = false;

    function cvSelectHtml(selected) {
      var opts = studentCvs.map(function (c) {
        var on = selected != null ? String(c.id) === String(selected) : !!c.is_default;
        return '<option value="' + c.id + '"' + (on ? ' selected' : '') + '>' + esc(c.file_name) + '</option>';
      }).join('');
      return opts
        ? '<label><span data-i18n="modal.select_saved_cv">' + esc(tr('modal.select_saved_cv', 'Chọn CV đã lưu')) + '</span><select name="cv">' + opts + '</select></label>'
        : '<p class="muted" style="margin:0 0 8px;" data-i18n="modal.no_cv_yet">' + esc(tr('modal.no_cv_yet', 'Bạn chưa có CV nào trên hệ thống. Hãy tải lên file CV bên dưới.')) + '</p>';
    }
    function form() {
      var upKey = studentCvs.length ? 'modal.or_upload_new_cv' : 'modal.upload_cv';
      return '<span class="kicker" data-i18n="modal.apply_kicker">' + esc(tr('modal.apply_kicker', 'SẴN SÀNG TỎA SÁNG')) + '</span><h2 id="apply-title" data-i18n="modal.apply_title">' + esc(tr('modal.apply_title', 'Ứng tuyển công việc')) + '</h2>' +
        '<p style="margin-bottom:16px;"><strong>' + esc(job.title) + '</strong> · ' + esc(job.company) + '</p>' +
        '<form data-form><label><span data-i18n="modal.applicant_email">' + esc(tr('modal.applicant_email', 'Email ứng viên')) + '</span><input type="email" value="' + esc(u.email) + '" readonly></label>' +
        '<div data-cv-slot>' + cvSelectHtml(null) + '</div>' +
        '<label style="margin-top:10px;"><span data-file-label data-i18n="' + upKey + '">' + esc(tr(upKey, studentCvs.length ? 'Hoặc tải lên CV mới' : 'Tải lên CV')) + '</span> (.pdf, .doc, .docx – 5MB)' +
        '<input type="file" name="cvfile" accept=".pdf,.doc,.docx"></label>' +
        '<label style="margin-top:10px;"><span data-i18n="modal.cover_letter_lbl">' + esc(tr('modal.cover_letter_lbl', 'Lời nhắn gửi nhà tuyển dụng (không bắt buộc)')) + '</span><textarea name="cover" rows="3" maxlength="500" placeholder="' + esc(tr('modal.cover_letter_ph', 'Chia sẻ lý do bạn muốn ứng tuyển hoặc thời gian bạn có thể đi làm...')) + '" data-i18n-placeholder="modal.cover_letter_ph"></textarea></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<button class="primary-btn full" style="margin-top:14px;"><span data-i18n="modal.submit_app_btn">' + esc(tr('modal.submit_app_btn', 'Gửi hồ sơ ứng tuyển')) + '</span> ' + I('arrow') + '</button></form>';
    }
    open({
      labelledBy: 'apply-title',
      html: form(),
      onMount: function (api) {
        var box = api.box;
        /* Báo lỗi tại chỗ: KHÔNG vẽ lại form để giữ nguyên CV đã chọn, file đã chọn và lời nhắn */
        function showError(msg) {
          var el = box.querySelector('.form-error'); if (el) el.textContent = msg || '';
          if (msg) HG.toast(msg, 'error');
        }
        /* Làm mới danh sách CV thật từ API (GET /api/cvs?student_id=) – chỉ thay ô chọn CV, giữ lựa chọn hiện tại */
        HG.fetchMyCvs && HG.fetchMyCvs().then(function (list) {
          if (!list || submitting || !api.isOpen() || box.querySelector('.modal-success')) return;
          var slot = box.querySelector('[data-cv-slot]'); if (!slot) return;
          var curSel = box.querySelector('select[name=cv]');
          studentCvs = list;
          slot.innerHTML = cvSelectHtml(curSel ? curSel.value : null);
          var lbl = box.querySelector('[data-file-label]');
          if (lbl) {
            var k = studentCvs.length ? 'modal.or_upload_new_cv' : 'modal.upload_cv';
            lbl.setAttribute('data-i18n', k);
            lbl.textContent = tr(k, studentCvs.length ? 'Hoặc tải lên CV mới' : 'Tải lên CV');
          }
        });
        box.addEventListener('input', function (e) { if (e.target.name === 'cover' || e.target.name === 'cvfile') showError(''); });
        box.addEventListener('submit', function (e) {
          e.preventDefault();
          if (submitting) return;
          var f = e.target;
          var cvVal = Number(f.cv ? f.cv.value : 0) || null, cover = f.cover ? f.cover.value.trim() : '';
          var file = f.cvfile && f.cvfile.files && f.cvfile.files[0] ? f.cvfile.files[0] : null;
          if (cover.length > 500) { showError(tr('modal.err_cover_max', 'Lời nhắn tối đa 500 ký tự.')); return; }
          if (!file && !cvVal) { showError(tr('modal.err_cv_req', 'Vui lòng chọn một CV hoặc tải lên file CV (.pdf, .doc, .docx).')); return; }
          if (file) {
            var ext = file.name.split('.').pop().toLowerCase();
            if (['pdf', 'doc', 'docx'].indexOf(ext) === -1) { showError(tr('modal.err_cv_ext', 'CV chỉ hỗ trợ định dạng PDF, DOC hoặc DOCX.')); return; }
            if (file.size > 5 * 1024 * 1024) { showError(tr('modal.err_cv_size', 'File CV vượt quá 5MB.')); return; }
          }
          showError('');
          var btn = f.querySelector('button'), btnHtml = btn.innerHTML;
          submitting = true; btn.disabled = true; btn.textContent = tr('modal.sending', 'Đang gửi...');
          HG.applyRemote(job.id, { cvId: file ? null : cvVal, cover: cover, file: file }).then(function (r) {
            submitting = false;
            if (r.error) {
              if (!api.isOpen()) { HG.toast(r.error, 'error'); return; }
              btn.disabled = false; btn.innerHTML = btnHtml;
              showError(r.error);
              return;
            }
            HG.toast(tr('modal.apply_sent_toast', 'Đã gửi hồ sơ ứng tuyển tới ' + job.company + '.', { company: job.company }), 'success');
            api.render('<div class="modal-success"><span>' + I('check', 34) + '</span><h2 data-i18n="modal.apply_succ_title">' + esc(tr('modal.apply_succ_title', 'Ứng tuyển thành công!')) + '</h2>' +
              '<p>' + tr('modal.apply_succ_desc_html', 'Hồ sơ của bạn đã được gửi tới <strong>' + esc(job.company) + '</strong>. Bạn có thể theo dõi tiến độ trong mục "Đơn ứng tuyển" của Dashboard.', { company: esc(job.company) }) + '</p>' +
              '<div style="display:flex; justify-content:center; gap:10px;"><button class="secondary-btn" data-close data-i18n="common.close">' + esc(tr('common.close', 'Đóng')) + '</button><a class="primary-btn" href="student.html?tab=4"><span data-i18n="modal.view_my_apps">' + esc(tr('modal.view_my_apps', 'Xem đơn ứng tuyển')) + '</span> ' + I('arrow') + '</a></div></div>');
          });
        });
      }
    });
  }

  HG.openModal = function (type, extra) {
    if (type === 'auth') { HG.goAuth({ notice: extra }); return; }  // Đăng nhập/Đăng ký nay là trang auth.html
    if (type === 'apply') applyModal(typeof extra === 'number' ? extra : null);
  };

  /* Mở modal bằng thuộc tính data-modal="apply|auth" */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-modal]');
    if (!t) return;
    e.preventDefault();
    var type = t.dataset.modal, u = HG.user();
    if (type === 'apply' && (!u || u.role !== 'student')) {
      HG.goAuth({ role: 'student', next: location.pathname.split('/').pop() + location.search, notice: tr('modal.login_to_apply', 'Hãy đăng nhập tài khoản sinh viên để ứng tuyển.') });
    } else {
      var jid = t.dataset.jobId ? Number(t.dataset.jobId) : null;
      HG.openModal(type, jid);
    }
  });
})();
