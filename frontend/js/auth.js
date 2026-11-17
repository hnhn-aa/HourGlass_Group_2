/* =========================================================
   auth.js – Trang Đăng nhập / Đăng ký (auth.html)
   Kết nối trực tiếp với Backend FastAPI qua HGApi & adapter.js
   ========================================================= */
(function () {
  'use strict';
  var V = window.HGValidate, qs = new URLSearchParams(location.search);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Đã đăng nhập sẵn thì vào thẳng dashboard */
  var me = HG.user();
  if (me && !qs.get('stay')) { location.replace(HG.dashUrl[me.role]); return; }

  /* ---------- 1. Nội dung theo vai trò ---------- */
  var COPY = {
    student: {
      title: 'Tìm việc phù hợp,<br>làm chủ thời gian của bạn.',
      text: 'Hàng ngàn công việc làm thêm linh hoạt, uy tín và phù hợp với lịch học.',
      points: ['Việc làm đã được xác minh', 'Lịch làm linh hoạt theo thời khoá biểu', 'Ứng tuyển nhanh chỉ với một CV'],
      demo: 'student1@gmail.com'
    },
    employer: {
      title: 'Tiếp cận tài năng trẻ<br>nhanh hơn mỗi ngày.',
      text: 'Đăng tin, quản lý ứng viên và tuyển dụng sinh viên năng động ngay trên HourGlass.',
      points: ['Đăng tin tuyển dụng trong vài phút', 'Quản lý hồ sơ ứng viên tập trung', 'Cộng đồng 12.000+ sinh viên'],
      demo: 'employer1@gmail.com'
    },
    admin: {
      title: 'Cổng quản trị<br>HourGlass.',
      text: 'Khu vực dành riêng cho quản trị viên: kiểm duyệt tin, theo dõi hoạt động nền tảng.',
      points: ['Kiểm duyệt tin tuyển dụng', 'Quản lý người dùng', 'Theo dõi báo cáo hệ thống'],
      demo: 'admin@gmail.com'
    }
  };

  /* ---------- 2. Trạng thái ---------- */
  var state = {
    mode: qs.get('mode') === 'signup' ? 'signup' : 'signin',
    role: ['student', 'employer', 'admin'].indexOf(qs.get('role')) !== -1 ? qs.get('role') : 'student'
  };
  if (state.role === 'admin') state.mode = 'signin';

  function safeNext() {
    var n = qs.get('next') || '';
    return /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(n) ? n : '';
  }
  function afterAuthUrl(user) {
    var n = safeNext(), dash = HG.dashUrl[user.role];
    var isDash = /^(student|employer|admin)\.html/.test(n);
    return n && (!isDash || n.indexOf(dash) === 0) ? n : dash;
  }

  /* ---------- 3. Vẽ giao diện theo trạng thái ---------- */
  function render() {
    var signup = state.mode === 'signup', c = COPY[state.role], admin = state.role === 'admin';

    $('#form-signin').hidden = signup;
    $('#form-signup').hidden = !signup;
    $('#auth-success').hidden = true;
    $('#mode-tabs').hidden = admin;
    $('#role-seg').hidden = admin;
    $$('#mode-tabs button').forEach(function (b) {
      var on = b.dataset.mode === state.mode;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    });
    $$('#role-seg input').forEach(function (r) { r.checked = r.value === state.role; });

    $('#auth-title').textContent = admin ? 'Đăng nhập quản trị' : signup ? 'Tạo tài khoản mới' : 'Chào mừng trở lại';
    $('#auth-sub').textContent = signup
      ? (state.role === 'employer' ? 'Đăng ký tài khoản nhà tuyển dụng để đăng tin và tìm ứng viên.' : 'Đăng ký tài khoản ứng viên / sinh viên để bắt đầu ứng tuyển.')
      : (admin ? 'Dành cho quản trị viên hệ thống.' : 'Đăng nhập để vào không gian của bạn.');

    $('#aside-title').innerHTML = c.title;
    $('#aside-text').textContent = c.text;
    $('#aside-points').innerHTML = c.points.map(function (p) { return '<li>' + HG.icon('check', 18) + '<span>' + p + '</span></li>'; }).join('');

    $$('#form-signup [data-for]').forEach(function (f) { f.hidden = f.dataset.for !== state.role; });

    var demo = $('#demo-fill');
    demo.textContent = c.demo; demo.dataset.email = c.demo;

    var notice = qs.get('notice');
    $('#auth-notice').hidden = !notice || signup;
    $('#auth-notice').textContent = notice || '';

    clearErrors();
    var u = new URLSearchParams(location.search); u.set('mode', state.mode); u.set('role', state.role);
    history.replaceState(null, '', '?' + u.toString());
  }

  /* ---------- 4. Hiển thị lỗi theo từng ô ---------- */
  function fieldOf(input) { return input.closest('.field'); }
  function setError(input, msg) {
    var f = fieldOf(input), p = $('.field-error', f);
    f.classList.toggle('has-error', !!msg);
    p.textContent = msg || '';
    if (msg) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', (p.id = p.id || input.id + '-err')); }
    else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
  }
  function validateInput(input) {
    if (input.closest('[hidden]')) return '';
    var msg = V.check(input.value, input.dataset.rules, { label: input.dataset.label || 'thông tin này', form: input.form, checked: input.checked });
    setError(input, msg);
    return msg;
  }
  function clearErrors() {
    $$('.auth-form input').forEach(function (i) { setError(i, ''); });
    $$('[data-alert]').forEach(function (a) { a.hidden = true; a.textContent = ''; });
  }
  function showAlert(form, msg) {
    var a = $('[data-alert]', form);
    a.textContent = msg;
    a.hidden = !msg;
    if (msg && HG.toast) HG.toast(msg, 'error');
  }

  function validateForm(form) {
    var firstBad = null;
    $$('input[data-rules]', form).forEach(function (i) { if (validateInput(i) && !firstBad) firstBad = i; });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /* ---------- 5. Sự kiện ---------- */
  var touched = new WeakSet();
  document.addEventListener('focusout', function (e) {
    var i = e.target;
    if (i.matches && i.matches('.auth-form input[data-rules]')) { touched.add(i); validateInput(i); }
  });
  document.addEventListener('input', function (e) {
    var i = e.target;
    if (!i.matches || !i.matches('.auth-form input[data-rules]')) return;
    if (touched.has(i) || fieldOf(i).classList.contains('has-error')) validateInput(i);
    if (i.id === 'su-password') {
      meter(i.value);
      var conf = $('#su-confirm'); if (conf.value) validateInput(conf);
    }
    showAlert(i.form, '');
  });
  document.addEventListener('change', function (e) { if (e.target.type === 'checkbox' && e.target.dataset.rules) validateInput(e.target); });

  $('#mode-tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { state.mode = b.dataset.mode; render(); } });
  document.addEventListener('click', function (e) {
    var sw = e.target.closest('[data-switch]');
    if (sw) { state.mode = sw.dataset.switch; render(); return; }
    var pw = e.target.closest('[data-toggle-pw]');
    if (pw) {
      var inp = $('input', pw.parentNode), show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      pw.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
      $('use', pw).setAttribute('href', show ? '#i-eye-off' : '#i-eye');
    }
  });
  $('#role-seg').addEventListener('change', function (e) {
    state.role = e.target.value; render();
  });
  $('#demo-fill').addEventListener('click', function (e) {
    $('#si-email').value = e.target.dataset.email; $('#si-password').value = '123456'; clearErrors();
  });

  function meter(pw) {
    var s = V.strength(pw), m = $('#pw-meter');
    m.dataset.score = s.score; $('span', m).textContent = s.label;
  }

  /* ---------- 6. Gửi form (Gọi API Backend + Fallback đồng bộ) ---------- */
  $('#form-signin').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (!validateForm(f)) return;
    var email = f.email.value.trim(), password = f.password.value;

    if (window.HGApi) {
      window.HGApi.login(email, password)
        .then(function (apiRes) {
          var apiUser = apiRes && apiRes.user;
          if (apiUser) {
            var normRole = apiUser.role === 'recruiter' ? 'employer' : apiUser.role;
            if (state.role && normRole !== state.role && normRole !== 'admin') {
              window.HGApi.clearTokens();
              showAlert(f, 'Đây là tài khoản ' + (HG.roleName[normRole] || normRole) + '. Hãy chọn đúng loại tài khoản ở trên.');
              return;
            }
            var existing = users.find(function (u) { return u.id === apiUser.id; });
            if (existing) {
              Object.assign(existing, apiUser, { role: normRole, password: password });
            } else {
              users.push(Object.assign({}, apiUser, { role: normRole, password: password }));
            }
            HG.write('hg_session', apiUser.id);
            return HG.syncFromBackend().then(function () {
              HG.flash('Chào mừng trở lại, ' + apiUser.full_name.trim().split(/\s+/).pop() + '!', 'success');
              location.href = afterAuthUrl({ role: normRole });
            });
          }
        })
        .catch(function (err) {
          /* Nếu lỗi mạng (server chưa bật), fallback sang HG.login nội bộ; nếu lỗi 401/403 từ API thì báo lỗi */
          if (err && (err.status === 401 || err.status === 403)) {
            showAlert(f, err.message || 'Email hoặc mật khẩu không đúng.');
            return;
          }
          var r = HG.login(email, password, state.role);
          if (r.error) { showAlert(f, r.error); return; }
          HG.flash('Chào mừng trở lại, ' + r.user.full_name.trim().split(/\s+/).pop() + '!', 'success');
          location.href = afterAuthUrl(r.user);
        });
      return;
    }

    var r = HG.login(email, password, state.role);
    if (r.error) { showAlert(f, r.error); return; }
    HG.flash('Chào mừng trở lại, ' + r.user.full_name.trim().split(/\s+/).pop() + '!', 'success');
    location.href = afterAuthUrl(r.user);
  });

  $('#form-signup').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (!validateForm(f)) return;

    var payload = {
      role: state.role,
      full_name: f.full_name.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.replace(/[\s.-]/g, ''),
      password: f.password.value,
      university: f.university ? f.university.value.trim() : '',
      company_name: f.company_name ? f.company_name.value.trim() : ''
    };

    function finishSignup(userObj) {
      f.hidden = true;
      $('#mode-tabs').hidden = $('#role-seg').hidden = true;
      $('#auth-notice').hidden = true;
      $('#auth-title').textContent = '';
      $('#auth-sub').textContent = '';
      $('#auth-success').hidden = false;
      HG.flash('Tạo tài khoản thành công! Hãy hoàn thiện hồ sơ của bạn.', 'success');
      setTimeout(function () {
        location.href = afterAuthUrl(userObj);
      }, 1200);
    }

    if (window.HGApi) {
      window.HGApi.register(payload)
        .then(function (apiRes) {
          var createdUser = (apiRes && apiRes.user) || { id: Date.now(), role: state.role, full_name: payload.full_name, email: payload.email };
          var normRole = createdUser.role === 'recruiter' ? 'employer' : (createdUser.role || state.role);
          createdUser.role = normRole;
          HG.write('hg_session', createdUser.id);
          return HG.syncFromBackend().then(function () {
            finishSignup(createdUser);
          });
        })
        .catch(function (err) {
          if (err && (err.status === 400 || err.status === 409 || err.status === 422)) {
            var msg = err.message || 'Thông tin đăng ký đã tồn tại hoặc không hợp lệ.';
            setError(f.email, msg);
            if (HG.toast) HG.toast(msg, 'error');
            f.email.focus();
            return;
          }
          var r = HG.register(payload);
          if (r.error) {
            setError(f.email, r.error);
            if (HG.toast) HG.toast(r.error, 'error');
            f.email.focus();
            return;
          }
          finishSignup(r.user);
        });
      return;
    }

    var r = HG.register(payload);
    if (r.error) {
      setError(f.email, r.error);
      if (HG.toast) HG.toast(r.error, 'error');
      f.email.focus();
      return;
    }
    finishSignup(r.user);
  });

  $('#form-signin').insertAdjacentHTML('beforeend', '<p class="admin-hint">' + HG.icon('shield', 14) + ' Quản trị viên (Admin gốc hoặc tài khoản được cấp quyền) đăng nhập ở đây bằng email &amp; mật khẩu được cấp, hệ thống sẽ tự chuyển tới không gian quản trị.</p>');
  render();
})();
