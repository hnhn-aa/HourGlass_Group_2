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
    if (c.opener && c.opener.focus) c.opener.focus();   // trả focus cho nút đã mở
    if (c.opts.onClose) c.opts.onClose(result);
  }

  /* opts.html: nội dung bên trong khung modal; opts.className: thêm class cho khung */
  function open(opts) {
    close();
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = '<div class="modal' + (opts.className ? ' ' + opts.className : '') + '" role="dialog" aria-modal="true" tabindex="-1">' +
      (opts.dismissible === false ? '' : '<button class="modal-close" type="button" data-close aria-label="Đóng">' + I('x') + '</button>') +
      '<div class="modal-body"></div></div>';
    var box = wrap.firstChild, body = box.lastChild;
    current = { wrap: wrap, box: box, opener: document.activeElement, opts: opts };

    var api = {
      box: box,
      close: close,
      /* Vẽ lại phần nội dung (dùng cho modal nhiều bước) */
      render: function (html) { body.innerHTML = html; focusFirst(); }
    };
    body.innerHTML = opts.html;
    if (opts.labelledBy) box.setAttribute('aria-labelledby', opts.labelledBy);

    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && opts.dismissible !== false) close(false); });
    box.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(false); });

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
    if (e.key === 'Escape' && current.opts.dismissible !== false) { close(false); return; }
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
          '<h2 id="confirm-title">' + esc(o.title || 'Bạn có chắc chắn không?') + '</h2>' +
          (o.message ? '<p>' + esc(o.message) + '</p>' : '') +
          '<div class="modal-actions">' +
          '<button type="button" class="secondary-btn" data-cancel data-autofocus>' + esc(o.cancelText || 'Hủy bỏ') + '</button>' +
          '<button type="button" class="primary-btn' + (o.danger ? ' danger' : '') + '" data-ok>' + esc(o.confirmText || 'Xác nhận') + '</button>' +
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
      title: 'Đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất không?',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy bỏ',
      danger: true
    }).then(function (ok) { if (ok) HG.logout(); });
  };

  /* ---------- 3. Modal ứng tuyển ---------- */
  function applyModal(jobId) {
    var allJ = window.HG_JOBS || jobs.map(HG.toJob);
    var job = (jobId ? allJ.find(function(x) { return x.id === jobId; }) : null) || HG.currentJob || allJ[0];
    var u = HG.user(), sid = HG.studentId(u);
    var studentCvs = sid ? HG.read('hg_cvs_' + sid, cvs.filter(function (c) { return c.student_id === sid; })) : [];
    if (!studentCvs.length && sid) {
      studentCvs = [{ id: 1, file_name: 'CV_' + u.full_name.replace(/\s+/g, '') + '.pdf' }];
    }
    var opts = studentCvs.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.file_name) + '</option>';
    }).join('') || '<option value="">(Chưa có CV - sẽ dùng thông tin hồ sơ)</option>';

    function form(error) {
      return '<span class="kicker">SẴN SÀNG TỎA SÁNG</span><h2 id="apply-title">Ứng tuyển công việc</h2>' +
        '<p style="margin-bottom:16px;"><strong>' + esc(job.title) + '</strong> · ' + esc(job.company) + '</p>' +
        '<form data-form><label>Email ứng viên<input type="email" value="' + esc(u.email) + '" readonly></label>' +
        '<label>Chọn CV ứng tuyển<select name="cv">' + opts + '</select></label>' +
        '<label style="margin-top:10px;">Lời nhắn gửi nhà tuyển dụng (không bắt buộc)<textarea name="cover" rows="3" placeholder="Chia sẻ lý do bạn muốn ứng tuyển hoặc thời gian bạn có thể đi làm..."></textarea></label>' +
        '<p class="form-error" role="alert">' + esc(error || '') + '</p>' +
        '<button class="primary-btn full" style="margin-top:14px;">Gửi hồ sơ ứng tuyển ' + I('arrow') + '</button></form>';
    }
    open({
      labelledBy: 'apply-title',
      html: form(),
      onMount: function (api) {
        api.box.addEventListener('submit', function (e) {
          e.preventDefault();
          var cvVal = Number(e.target.cv ? e.target.cv.value : 0) || null, cover = e.target.cover ? e.target.cover.value.trim() : '';
          if (cover.length > 500) { api.render(form('Lời nhắn tối đa 500 ký tự.')); return; }
          HG.busy(e.target.querySelector('button'), function () {
          var r = HG.apply(job.id, cvVal, cover);
          if (r.error) { api.render(form(r.error)); HG.toast(r.error, 'error'); return; }
          HG.toast('Đã gửi hồ sơ ứng tuyển tới ' + job.company + '.', 'success');
          api.render('<div class="modal-success"><span>' + I('check', 34) + '</span><h2>Ứng tuyển thành công!</h2>' +
            '<p>Hồ sơ của bạn đã được gửi tới <strong>' + esc(job.company) + '</strong>. Bạn có thể theo dõi tiến độ trong mục "Đơn ứng tuyển" của Dashboard.</p>' +
            '<div style="display:flex; justify-content:center; gap:10px;"><button class="secondary-btn" data-close>Đóng</button><a class="primary-btn" href="student.html?tab=4">Xem đơn ứng tuyển ' + I('arrow') + '</a></div></div>');
          }, 800);
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
      HG.goAuth({ role: 'student', next: location.pathname.split('/').pop() + location.search, notice: 'Hãy đăng nhập tài khoản sinh viên để ứng tuyển.' });
    } else {
      var jid = t.dataset.jobId ? Number(t.dataset.jobId) : null;
      HG.openModal(type, jid);
    }
  });
})();
