/* Dashboard sinh viên / nhà tuyển dụng / admin - đầy đủ tính năng cho mọi vai trò */
(function () {
  'use strict';
  var I = HG.icon, E = HG.esc, JOBS = jobs;
  var role = document.body.dataset.role, user = HG.user();

  /* Chưa đăng nhập hoặc sai vai trò -> chuyển về auth.html */
  if (!user || user.role !== role) {
    location.replace('auth.html?role=' + role + '&next=' + location.pathname.split('/').pop() + '&notice=' + encodeURIComponent('Vui lòng đăng nhập để vào trang này.'));
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  function initials(n) {
    if (!n) return 'U';
    var p = n.trim().split(/\s+/);
    return (p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function jobOf(a) { return byId(JOBS, a.job_id) || { title: 'Việc làm #' + a.job_id, employer_id: 1 }; }
  function companyOf(j) { return byId(employer_profiles, j.employer_id) || { company_name: 'Doanh nghiệp', id: 1 }; }
  function statusName(id) {
    var st = byId(application_statuses, id);
    return st ? st.name : 'submitted';
  }
  var STATUS = {
    submitted: ['Đã nộp', 'pending'],
    reviewing: ['Đang xem xét', 'reviewing'],
    interview: ['Mời phỏng vấn', 'interview'],
    accepted: ['Đã trúng tuyển', 'accepted'],
    rejected: ['Từ chối', ''],
    withdrawn: ['Đã rút đơn', '']
  };

  function setStat(key, value, sub) {
    var el = document.querySelector('[data-stat="' + key + '"]');
    if (!el) return;
    el.textContent = value;
    var em = el.parentNode.querySelector('em');
    if (em) em.textContent = sub || '';
  }

  function after(sectionId, html) {
    var el = $(sectionId);
    if (el) el.insertAdjacentHTML('beforeend', html);
  }

  /* ---- Toast thông báo nổi ---- */
  function showToast(msg, type) { HG.toast(msg, type || 'success'); }

  /* ---- Header thông tin người dùng ---- */
  var display = user.full_name, emp = null;
  if (role === 'employer') {
    emp = employer_profiles.filter(function (e) { return e.user_id === user.id; })[0];
    if (emp) display = emp.company_name;
  }
  var avatarEl = document.querySelector('.dash-avatar');
  if (avatarEl) avatarEl.textContent = initials(display);
  var nameStrong = document.querySelector('.user-name strong');
  if (nameStrong) nameStrong.textContent = display;

  /* Nút đăng xuất ở header */
  var headerRight = document.querySelector('.dash-header > div:last-child');
  if (headerRight && !$('logout-btn')) {
    headerRight.insertAdjacentHTML('beforeend', '<button class="logout-btn" id="logout-btn" type="button" aria-label="Đăng xuất">' + I('logout', 18) + '<span>Đăng xuất</span></button>');
  }

  /* Thông báo ở header dashboard */
  var notifyBtn = document.querySelector('.dash-header .notify');
  if (notifyBtn) {
    var notifs = {
      student: [
        { text: 'Lumos Studio vừa phản hồi đơn ứng tuyển của bạn', time: '10 phút trước', unread: true },
        { text: 'Lịch phỏng vấn sắp tới: Ca làm việc tại Highlands Coffee', time: 'Hôm nay 17:00', unread: true },
        { text: 'Có 3 việc làm mới ngành Marketing phù hợp với ca rảnh của bạn', time: 'Hôm qua', unread: false }
      ],
      employer: [
        { text: 'Có 2 ứng viên mới nộp đơn vào vị trí Trợ lý Marketing', time: '15 phút trước', unread: true },
        { text: 'Tin tuyển dụng "Nhân viên pha chế" đã được duyệt', time: '1 giờ trước', unread: true },
        { text: 'Báo cáo: 45 lượt xem tin trong 24 giờ qua', time: 'Hôm qua', unread: false }
      ],
      admin: [
        { text: 'Có 1 tin tuyển dụng mới đang chờ duyệt từ Highlands Coffee', time: '5 phút trước', unread: true },
        { text: '1 báo cáo vi phạm mới từ sinh viên cần xử lý', time: '30 phút trước', unread: true },
        { text: 'Hệ thống ghi nhận 15 lượt đăng ký tài khoản mới hôm nay', time: 'Hôm nay', unread: false }
      ]
    }[role] || [];

    var dropHtml = '<div class="dash-notify-dropdown" id="dash-notify-dropdown">' +
      '<div class="notify-popover-head"><strong>Thông báo (' + notifs.filter(function(x){return x.unread;}).length + ')</strong><button type="button" id="dash-mark-read">Đã đọc</button></div>' +
      '<div class="notify-popover-list">' +
      notifs.map(function(n) {
        return '<div class="notify-item' + (n.unread ? ' unread' : '') + '">' +
          '<span class="notify-item-icon">' + I('bell', 16) + '</span>' +
          '<div class="notify-item-content"><strong>' + E(n.text) + '</strong><small>' + E(n.time) + '</small></div>' +
          '</div>';
      }).join('') +
      '</div></div>';

    document.querySelector('.dash-header').insertAdjacentHTML('beforeend', dropHtml);
    var notifyDropdown = $('dash-notify-dropdown');

    notifyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notifyDropdown.classList.toggle('show');
    });

    var markBtn = $('dash-mark-read');
    if (markBtn) {
      markBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        notifyDropdown.querySelectorAll('.notify-item.unread').forEach(function(el){ el.classList.remove('unread'); });
        var dot = notifyBtn.querySelector('i');
        if (dot) dot.remove();
        notifyDropdown.querySelector('.notify-popover-head strong').textContent = 'Thông báo (0)';
      });
    }

    document.addEventListener('click', function(e) {
      if (notifyDropdown && !notifyDropdown.contains(e.target) && e.target !== notifyBtn && !notifyBtn.contains(e.target)) {
        notifyDropdown.classList.remove('show');
      }
    });
  }

  /* Nút tìm kiếm nhanh */
  var dashSearch = document.querySelector('.dash-search');
  if (dashSearch) {
    dashSearch.addEventListener('click', function() {
      if (role === 'student') showTab(3);
      else if (role === 'employer') showTab(2);
      else showTab(3);
    });
  }

  /* ---- Sidebar drawer trên mobile ---- */
  var sidebar = $('dash-sidebar'), backdrop = $('dash-backdrop'), menuBtn = $('dash-menu');
  function toggleDrawer(open) {
    if (sidebar) sidebar.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { toggleDrawer(!sidebar.classList.contains('open')); });
  if (backdrop) backdrop.addEventListener('click', function () { toggleDrawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleDrawer(false); });

  /* ---- Chuyển tab sidebar ---- */
  var tabs = document.querySelectorAll('.dash-sidebar nav [data-tab]');
  var views = document.querySelectorAll('.dash-view');
  var placeholder = $('dash-placeholder');

  function showTab(n) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === String(n)); });
    var found = false;
    views.forEach(function (v) {
      var on = v.dataset.view === String(n);
      v.hidden = !on;
      if (on) found = true;
    });
    if (placeholder) placeholder.hidden = found;
    if (!found && placeholder) {
      var title = (tabs[n] && tabs[n].querySelector('span')) ? tabs[n].querySelector('span').textContent : 'Mục quản lý';
      placeholder.innerHTML = '<div class="placeholder-panel"><span>' + I('sparkle', 30) + '</span><h1>' + title + '</h1>' +
        '<p>Khu vực quản lý ' + title.toLowerCase() + ' của bạn. Dữ liệu đã sẵn sàng để trải nghiệm.</p>' +
        '<button class="primary-btn" onclick="location.reload()">Làm mới trang ' + I('arrow') + '</button></div>';
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      showTab(Number(t.dataset.tab));
      toggleDrawer(false);
    });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto-tab]');
    if (b) {
      e.preventDefault();
      showTab(Number(b.dataset.gotoTab));
    }
  });

  /* Mở tab theo URL query parameter ?tab=X */
  var params = new URLSearchParams(location.search);
  if (params.get('tab') !== null) {
    showTab(Number(params.get('tab')));
  }

  /* =========================================================
     1. SINH VIÊN (STUDENT)
     ========================================================= */
  if (role === 'student') {
    var sid = HG.studentId(user) || 1;
    var profile = student_profiles.filter(function (p) { return p.user_id === user.id; })[0] || student_profiles[0];
    var now = new Date();

    var firstName = (user.full_name || '').split(' ').pop();
    var fnEl = document.querySelector('[data-first-name]');
    if (fnEl) fnEl.textContent = firstName;

    var todayEl = $('today');
    if (todayEl) {
      todayEl.textContent = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'][now.getDay()] + ', ' + now.getDate() + ' THÁNG ' + (now.getMonth() + 1);
    }

    /* Đơn ứng tuyển */
    var getStudentApps = function() {
      return HG.applications().filter(function (a) { return a.student_id === sid; })
        .sort(function (a, b) { return (b.applied_at || '').localeCompare(a.applied_at || ''); });
    };

    var updateStudentStats = function() {
      var apps = getStudentApps();
      var interviews = apps.filter(function (a) { return statusName(a.status_id) === 'interview'; }).length;
      setStat('apps', apps.length, 'Tổng số đơn đã nộp');
      setStat('saved', HG.getSaved().length, 'Việc yêu thích');
      setStat('interviews', interviews, 'Đang chờ phỏng vấn');

      var appBadge = document.querySelector('.dash-sidebar nav button[data-tab="4"] b');
      if (appBadge) appBadge.textContent = apps.length;
    };
    updateStudentStats();

    /* Tab 0: Đơn gần đây */
    var secApps = $('student-apps');
    if (secApps) {
      secApps.querySelectorAll('.app-row, .empty-note').forEach(function(el){ el.remove(); });
      var apps = getStudentApps();
      secApps.insertAdjacentHTML('beforeend', apps.slice(0, 5).map(function (a) {
        var j = jobOf(a), c = companyOf(j), st = STATUS[statusName(a.status_id)] || ['Đã nộp', 'pending'];
        return '<div class="app-row"><span class="company-logo" style="background:' + HG.employerColor(c.id) + '">' + E(c.company_name.charAt(0)) + '</span>' +
          '<div><strong>' + E(j.title) + '</strong><small>' + E(c.company_name) + '</small></div>' +
          '<span class="status ' + st[1] + '">' + st[0] + '</span><small>' + HG.fmtDate(a.applied_at) + '</small></div>';
      }).join('') || '<p class="empty-note">Chưa có đơn ứng tuyển nào.</p>');
    }

    /* Tab 0: Lịch tuần này */
    var weekDaysEl = $('week-days');
    if (weekDaysEl) {
      var dow = (now.getDay() + 6) % 7, mon = new Date(now);
      mon.setDate(now.getDate() - dow);
      weekDaysEl.innerHTML = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(function (d, i) {
        var day = new Date(mon); day.setDate(mon.getDate() + i);
        return '<span' + (i === dow ? ' class="today"' : '') + '><small>' + d + '</small><b>' + day.getDate() + '</b></span>';
      }).join('');
    }

    var secWeek = $('student-week');
    if (secWeek) {
      var todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      var ev = schedules.filter(function (s) { return s.student_id === sid && (s.start_datetime || '').slice(0, 10) >= todayStr; })
        .sort(function (a, b) { return (a.start_datetime || '').localeCompare(b.start_datetime || ''); }).slice(0, 3);
      secWeek.querySelectorAll('.event-card, .empty-note').forEach(function(el){ el.remove(); });
      after('student-week', ev.map(function (s, i) {
        return '<div class="event-card' + (i % 2 ? ' pink' : '') + '"><i></i><span><small>' + s.start_datetime.slice(8, 10) + '/' + s.start_datetime.slice(5, 7) + ' · ' +
          s.start_datetime.slice(11, 16) + ' – ' + s.end_datetime.slice(11, 16) + '</small><strong>' + E(s.title) + '</strong></span></div>';
      }).join('') || '<p class="empty-note">Chưa có lịch sắp tới.</p>');
    }

    /* Tab 0: Gợi ý dành riêng */
    var recEl = $('recommended');
    if (recEl) {
      var appliedIds = getStudentApps().map(function (a) { return a.job_id; });
      recEl.innerHTML = (window.HG_JOBS || []).filter(function (j) { return appliedIds.indexOf(j.id) === -1; }).slice(0, 3).map(function (j) {
        var isSaved = HG.isSaved(j.id);
        return '<div style="cursor:pointer;" onclick="location.href=\'job-detail.html?id=' + j.id + '\'">' +
          '<span class="company-logo" style="background:' + j.color + '">' + E(j.logo) + '</span>' +
          '<div><strong>' + E(j.title) + '</strong><small>' + E(j.company) + ' · ' + E(j.location) + '</small></div>' +
          '<b>' + E(j.salary) + '</b>' +
          '<button type="button" class="dash-save-btn' + (isSaved ? ' saved' : '') + '" data-rec-job="' + j.id + '" onclick="event.stopPropagation();">' +
            I('bookmark', 18) +
          '</button>' +
          '</div>';
      }).join('') || '<p class="empty-note">Bạn đã ứng tuyển tất cả việc làm hiện có.</p>';

      recEl.addEventListener('click', function(e) {
        var b = e.target.closest('[data-rec-job]');
        if (b) {
          e.stopPropagation();
          var jid = Number(b.dataset.recJob);
          var saved = HG.toggleSaved(jid);
          b.classList.toggle('saved', saved);
          updateStudentStats();
          renderSavedJobs();
          showToast(saved ? 'Đã lưu việc làm vào mục yêu thích!' : 'Đã bỏ lưu việc làm.');
        }
      });
    }

    /* TAB 1: HỒ SƠ CÁ NHÂN */
    var profAvatar = $('prof-avatar'), profDispName = $('prof-display-name'), profDispSub = $('prof-display-sub');
    var inName = $('prof-fullname'), inEmail = $('prof-email'), inPhone = $('prof-phone'), inDob = $('prof-dob'), inAddress = $('prof-address');
    var inUni = $('prof-uni'), inMajor = $('prof-major'), inBio = $('prof-bio');

    function syncProfileDisplay() {
      if (profAvatar) profAvatar.textContent = initials(user.full_name);
      if (profDispName) profDispName.textContent = user.full_name;
      if (profDispSub) profDispSub.textContent = (profile.major || 'Sinh viên') + ' · ' + (profile.university || 'Chưa cập nhật trường');
      if (inName) inName.value = user.full_name || '';
      if (inEmail) inEmail.value = user.email || '';
      if (inPhone) inPhone.value = user.phone || '';
      if (inDob) inDob.value = profile.date_of_birth || '';
      if (inAddress) inAddress.value = profile.address || '';
      if (inUni) inUni.value = profile.university || '';
      if (inMajor) inMajor.value = profile.major || '';
      if (inBio) inBio.value = profile.bio || '';
    }
    syncProfileDisplay();

    /* Kỹ năng */
    var studentSkills = HG.read('hg_skills_' + sid, ['Giao tiếp tốt', 'Tiếng Anh', 'Tin học văn phòng', 'Làm việc nhóm', 'Pha chế']);
    var skillsWrap = $('student-skills-container');
    function renderSkills() {
      if (!skillsWrap) return;
      skillsWrap.innerHTML = studentSkills.map(function(s, i) {
        return '<span class="skill-tag">' + E(s) + '<button type="button" data-del-skill="' + i + '" title="Xóa">&times;</button></span>';
      }).join('');
    }
    renderSkills();

    if (skillsWrap) {
      skillsWrap.addEventListener('click', function(e) {
        var b = e.target.closest('[data-del-skill]');
        if (b) {
          studentSkills.splice(Number(b.dataset.delSkill), 1);
          HG.write('hg_skills_' + sid, studentSkills);
          showToast('Đã xóa kỹ năng.', 'info');
          renderSkills();
        }
      });
    }

    var addSkillBtn = $('add-skill-btn'), skillIn = $('new-skill-input');
    if (addSkillBtn && skillIn) {
      addSkillBtn.addEventListener('click', function() {
        var val = skillIn.value.trim();
        if (!val) { showToast('Hãy nhập tên kỹ năng trước khi thêm.', 'error'); skillIn.focus(); return; }
        if (val.length > 40) { showToast('Tên kỹ năng tối đa 40 ký tự.', 'error'); return; }
        if (studentSkills.some(function (x) { return x.toLowerCase() === val.toLowerCase(); })) { showToast('Kỹ năng "' + val + '" đã có trong danh sách.', 'info'); return; }
        studentSkills.push(val);
        HG.write('hg_skills_' + sid, studentSkills);
        renderSkills();
        skillIn.value = '';
        showToast('Đã thêm kỹ năng "' + val + '".');
      });
    }

    var profForm = $('student-profile-form');
    if (profForm) {
      profForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var V = window.HGValidate, bad = null, msg = '';
        [[inName, 'required|fullname', 'họ và tên'], [inEmail, 'required|email', 'email'], [inPhone, 'phone', 'số điện thoại']].forEach(function (r) {
          var m = V ? V.check(r[0].value, r[1], { label: r[2] }) : '';
          r[0].classList.toggle('invalid', !!m);
          if (m && !bad) { bad = r[0]; msg = m; }
        });
        if (bad) { showToast(msg, 'error'); bad.focus(); return; }
        user.full_name = inName.value.trim();
        user.email = inEmail.value.trim();
        user.phone = inPhone.value.trim();
        profile.university = inUni.value.trim();
        profile.major = inMajor.value.trim();
        profile.date_of_birth = inDob.value;
        profile.address = inAddress.value.trim();
        profile.bio = inBio.value.trim();
        profile.updated_at = HG.now();

        HG.write('hg_profile_' + user.id, profile);
        if (window.HGApi) {
          window.HGApi.updateStudentProfile(sid, {
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            university: profile.university,
            major: profile.major,
            date_of_birth: profile.date_of_birth || null,
            address: profile.address,
            bio: profile.bio
          }).catch(function () {});
        }
        syncProfileDisplay();
        var userHeaderName = document.querySelector('.user-name strong');
        if (userHeaderName) userHeaderName.textContent = user.full_name;
        showToast('Cập nhật hồ sơ sinh viên thành công!');
      });
    }

    /* TAB 2: CV CỦA TÔI */
    var studentCvs = HG.read('hg_cvs_' + sid, cvs.filter(function(c) { return c.student_id === sid; }));
    if (!studentCvs.length) {
      studentCvs = [{ id: 1, student_id: sid, file_name: 'CV_' + user.full_name.replace(/\s+/g, '') + '.pdf', file_type: 'pdf', is_default: true, uploaded_at: HG.now() }];
    }

    var cvListEl = $('student-cv-list');
    function renderCvList() {
      if (!cvListEl) return;
      cvListEl.innerHTML = studentCvs.map(function(c) {
        var isDoc = c.file_type === 'docx' || c.file_name.endsWith('.docx');
        return '<div class="cv-card-item">' +
          '<div class="cv-info-left">' +
            '<span class="cv-file-icon' + (isDoc ? ' docx' : '') + '">' + I('file', 22) + '</span>' +
            '<div>' +
              '<strong>' + E(c.file_name) + (c.is_default ? ' <span class="prof-badge" style="font-size:10px;padding:1px 6px;">Mặc định</span>' : '') + '</strong>' +
              '<small>Đã tải lên: ' + HG.fmtDate(c.uploaded_at) + ' · ' + (isDoc ? 'Word Document' : 'PDF') + '</small>' +
            '</div>' +
          '</div>' +
          '<div class="cv-actions-right">' +
            '<button type="button" class="cv-action-btn" data-preview-cv="' + c.id + '">' + I('eye', 14) + ' Xem</button>' +
            (!c.is_default ? '<button type="button" class="cv-action-btn" data-default-cv="' + c.id + '">Đặt mặc định</button>' : '') +
            '<button type="button" class="cv-action-btn danger" data-del-cv="' + c.id + '" title="Xóa">' + I('trash', 14) + '</button>' +
          '</div>' +
        '</div>';
      }).join('') || '<p class="empty-note">Bạn chưa tải lên CV nào.</p>';
    }
    renderCvList();

    if (cvListEl) {
      cvListEl.addEventListener('click', function(e) {
        var defBtn = e.target.closest('[data-default-cv]');
        if (defBtn) {
          var cid = Number(defBtn.dataset.defaultCv);
          studentCvs.forEach(function(c) { c.is_default = (c.id === cid); });
          HG.write('hg_cvs_' + sid, studentCvs);
          if (window.HGApi) window.HGApi.setDefaultCv(cid).catch(function () {});
          renderCvList();
          showToast('Đã đặt làm CV ứng tuyển mặc định.');
          return;
        }

        var delBtn = e.target.closest('[data-del-cv]');
        if (delBtn) {
          var did = Number(delBtn.dataset.delCv);
          studentCvs = studentCvs.filter(function(c) { return c.id !== did; });
          if (studentCvs.length && !studentCvs.some(function(c) { return c.is_default; })) studentCvs[0].is_default = true;
          HG.write('hg_cvs_' + sid, studentCvs);
          if (window.HGApi) window.HGApi.deleteCv(did).catch(function () {});
          renderCvList();
          showToast('Đã xóa CV thành công.');
          return;
        }

        var prevBtn = e.target.closest('[data-preview-cv]');
        if (prevBtn) {
          var pid = Number(prevBtn.dataset.previewCv);
          var cvItem = studentCvs.filter(function(x){return x.id === pid;})[0];
          HG.modal.open({
            className: 'modal-preview-cv',
            html: '<div style="padding: 10px;">' +
              '<h2 style="font-size: var(--fs-h4); margin-bottom: 8px;">Xem trước CV: ' + E(cvItem.file_name) + '</h2>' +
              '<p style="color:#7a8599; font-size: var(--fs-xs); margin-bottom: 16px;">Ứng viên: ' + E(user.full_name) + ' · Trường: ' + E(profile.university || 'Đại học') + '</p>' +
              '<div style="background:#f8f9fe; border: 1px solid #e2e6f4; border-radius: 12px; padding: 24px; min-height: 220px; font-size: var(--fs-body-sm); line-height: 1.7;">' +
                '<strong>MỤC TIÊU NGHỀ NGHIỆP:</strong><br>' + E(profile.bio || 'Tìm kiếm công việc part-time để trau dồi kỹ năng và tích lũy kinh nghiệm.') + '<br><br>' +
                '<strong>KỸ NĂNG:</strong><br>' + studentSkills.join(', ') + '<br><br>' +
                '<strong>HỌC VẤN:</strong><br>' + E(profile.university) + ' - Chuyên ngành ' + E(profile.major) + '<br><br>' +
                '<strong>LIÊN HỆ:</strong><br>Email: ' + E(user.email) + ' · SĐT: ' + E(user.phone) +
              '</div>' +
              '<div style="margin-top: 18px; text-align: right;">' +
                '<button type="button" class="primary-btn" data-close>Đóng xem trước</button>' +
              '</div>' +
            '</div>'
          });
        }
      });
    }

    var cvPicker = $('cv-file-picker');
    if (cvPicker) {
      cvPicker.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) {
          var ext = file.name.split('.').pop().toLowerCase();
          if (['pdf', 'doc', 'docx'].indexOf(ext) === -1) { showToast('CV chỉ hỗ trợ định dạng PDF hoặc DOCX.', 'error'); cvPicker.value = ''; return; }
          if (file.size > 5 * 1024 * 1024) { showToast('File CV vượt quá 5MB, hãy chọn file nhỏ hơn.', 'error'); cvPicker.value = ''; return; }
          if (studentCvs.length >= 5) { showToast('Bạn chỉ có thể lưu tối đa 5 CV. Hãy xóa bớt CV cũ.', 'error'); cvPicker.value = ''; return; }
          var newCv = {
            id: Date.now(),
            student_id: sid,
            file_name: file.name,
            file_type: ext,
            is_default: studentCvs.length === 0,
            uploaded_at: HG.now()
          };
          studentCvs.push(newCv);
          HG.write('hg_cvs_' + sid, studentCvs);
          if (window.HGApi) {
            window.HGApi.uploadCv(sid, file, file.name).then(function (res) {
              if (res && res.cv && res.cv.id) {
                newCv.id = res.cv.id;
                newCv.file_url = res.cv.file_url;
                HG.write('hg_cvs_' + sid, studentCvs);
                renderCvList();
              }
            }).catch(function () {});
          }
          renderCvList();
          showToast('Đã tải lên CV: ' + file.name);
          cvPicker.value = '';
        }
      });
    }

    /* TAB 3: VIỆC LÀM YÊU THÍCH */
    var savedContainer = $('saved-jobs-container');
    function renderSavedJobs() {
      if (!savedContainer) return;
      var savedIds = HG.getSaved();
      var allJ = window.HG_JOBS || jobs.map(HG.toJob);
      var savedList = allJ.filter(function (j) { return savedIds.indexOf(j.id) !== -1; });

      if (!savedList.length) {
        savedContainer.innerHTML = '<div style="background: #fff; border: 1px solid #e9edf8; border-radius: 18px; padding: 40px; text-align: center;">' +
          '<span style="width: 54px; height: 54px; border-radius: 50%; background: #fff0f7; color: #ff6fae; display: grid; place-items: center; margin: 0 auto 14px;">' + I('bookmark', 26) + '</span>' +
          '<h3>Chưa có việc làm nào trong danh sách yêu thích</h3>' +
          '<p style="color: #7b8599; font-size: var(--fs-body-sm); margin: 6px auto 18px; max-width: 420px;">Hãy lưu những công việc phù hợp với bạn khi duyệt danh sách việc làm để xem lại và ứng tuyển bất cứ lúc nào.</p>' +
          '<a class="primary-btn" href="jobs.html">Khám phá việc làm ngay ' + I('arrow') + '</a>' +
          '</div>';
        return;
      }

      savedContainer.innerHTML = savedList.map(function(j) {
        return '<div class="saved-job-card">' +
          '<div class="saved-job-info">' +
            '<span class="company-logo" style="background:' + j.color + '; width: 44px; height: 44px; font-size: 16px;">' + E(j.logo) + '</span>' +
            '<div>' +
              '<h3 style="font-size: var(--fs-body); margin-bottom: 4px;"><a href="job-detail.html?id=' + j.id + '">' + E(j.title) + '</a></h3>' +
              '<p style="color: #707a92; font-size: var(--fs-xs); margin: 0;">' + E(j.company) + ' · ' + E(j.location) + ' · <strong>' + E(j.salary) + '</strong></p>' +
            '</div>' +
          '</div>' +
          '<div class="saved-job-actions">' +
            '<button type="button" class="primary-btn small" onclick="HG.openModal(\'apply\', ' + j.id + ')">Ứng tuyển</button>' +
            '<button type="button" class="secondary-btn small" data-unsave-job="' + j.id + '">' + I('trash', 14) + ' Bỏ lưu</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    renderSavedJobs();

    if (savedContainer) {
      savedContainer.addEventListener('click', function(e) {
        var b = e.target.closest('[data-unsave-job]');
        if (b) {
          var jid = Number(b.dataset.unsaveJob);
          HG.toggleSaved(jid);
          updateStudentStats();
          renderSavedJobs();
          showToast('Đã xóa việc làm khỏi danh sách yêu thích.');
        }
      });
    }

    /* TAB 4: ĐƠN ỨNG TUYỂN – tab theo nhóm trạng thái, hủy đơn khi nhà tuyển dụng chưa xử lý, cập nhật tức thời */
    var fullAppsEl = $('student-apps-full');
    var activeAppFilter = 'all';
    var APP_GROUPS = {
      pending: ['submitted'], received: ['reviewing', 'interview'], accepted: ['accepted'], rejected: ['rejected']
    };
    var APP_LABEL = {
      submitted: ['Đang chờ duyệt', 'pending'], reviewing: ['Đã tiếp nhận', 'reviewing'], interview: ['Mời phỏng vấn', 'interview'],
      accepted: ['Đã trúng tuyển', 'accepted'], rejected: ['Bị từ chối', 'rejected'], withdrawn: ['Bạn đã hủy đơn', 'rejected']
    };

    function renderAppPills() {
      var apps = getStudentApps(), tabs = $('app-filter-tabs'); if (!tabs) return;
      tabs.querySelectorAll('[data-app-filter]').forEach(function (b) {
        var k = b.dataset.appFilter;
        var n = k === 'all' ? apps.length : apps.filter(function (a) { return APP_GROUPS[k].indexOf(statusName(a.status_id)) !== -1; }).length;
        var base = b.dataset.label || (b.dataset.label = b.textContent.replace(/\s*\(\d+\)$/, ''));
        b.innerHTML = E(base) + ' <span class="pill-count">' + n + '</span>';
      });
    }

    function renderFullApps() {
      if (!fullAppsEl) return;
      renderAppPills();
      var apps = getStudentApps();
      var filtered = apps.filter(function (a) {
        return activeAppFilter === 'all' || APP_GROUPS[activeAppFilter].indexOf(statusName(a.status_id)) !== -1;
      });

      if (!apps.length) {
        fullAppsEl.innerHTML = HG.empty('file', 'Chưa có đơn ứng tuyển nào', 'Hãy tìm công việc phù hợp với lịch học của bạn và ứng tuyển chỉ với vài bước.', '<a class="primary-btn small" href="jobs.html">Tìm việc ngay</a>');
        return;
      }
      if (!filtered.length) {
        fullAppsEl.innerHTML = HG.empty('file', 'Không có đơn nào ở nhóm này', 'Thử chọn tab khác để xem các đơn ứng tuyển còn lại.');
        return;
      }

      fullAppsEl.innerHTML = filtered.map(function (a) {
        var j = jobOf(a), c = companyOf(j), stName = statusName(a.status_id), st = APP_LABEL[stName] || ['Đang chờ duyệt', 'pending'];
        var canCancel = stName === 'submitted';          /* nhà tuyển dụng chưa xử lý */
        var extra = '';
        if (stName === 'interview' && a.interview_at) extra = '<div class="app-note ok">' + I('calendar', 14) + ' Lịch phỏng vấn: ' + E(String(a.interview_at).replace('T', ' ')) + '</div>';
        if (stName === 'rejected' && a.status_reason) extra = '<div class="app-note bad">' + I('alert', 14) + ' Lý do: ' + E(a.status_reason) + '</div>';

        return '<div class="app-card-detailed">' +
          '<div class="app-detailed-main">' +
            '<span class="company-logo" style="background:' + HG.employerColor(c.id) + '; width: 44px; height: 44px;">' + E(c.company_name.charAt(0)) + '</span>' +
            '<div>' +
              '<h3 style="font-size: var(--fs-body); margin-bottom: 4px;"><a href="job-detail.html?id=' + j.id + '">' + E(j.title) + '</a></h3>' +
              '<p style="color: #6a748c; font-size: var(--fs-xs); margin: 0;">' + E(c.company_name) + ' · Ngày nộp: ' + HG.fmtDate(a.applied_at) + '</p>' + extra +
            '</div>' +
          '</div>' +
          '<div class="app-detailed-status">' +
            '<span class="status ' + st[1] + '" style="font-size: 13px; padding: 4px 12px;">' + st[0] + '</span>' +
            '<div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; justify-content: flex-end;">' +
              '<a class="cv-action-btn" href="job-detail.html?id=' + j.id + '">' + I('eye', 14) + ' Xem tin</a>' +
              (canCancel ? '<button type="button" class="cv-action-btn danger" data-withdraw-app="' + a.id + '">Hủy đơn</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    renderFullApps();

    var appFilterTabs = $('app-filter-tabs');
    if (appFilterTabs) {
      appFilterTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-app-filter]');
        if (b) {
          appFilterTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); });
          b.classList.add('active');
          activeAppFilter = b.dataset.appFilter;
          renderFullApps();
        }
      });
    }

    if (fullAppsEl) {
      fullAppsEl.addEventListener('click', function (e) {
        var wBtn = e.target.closest('[data-withdraw-app]');
        if (!wBtn) return;
        var aid = Number(wBtn.dataset.withdrawApp);
        var cur = HG.applications().filter(function (x) { return x.id === aid; })[0];
        if (!cur || statusName(cur.status_id) !== 'submitted') {
          showToast('Nhà tuyển dụng đã xử lý đơn này nên không thể hủy nữa.', 'error'); renderFullApps(); return;
        }
        HG.confirm({
          title: 'Hủy đơn ứng tuyển?',
          message: 'Bạn có chắc chắn muốn hủy hồ sơ ứng tuyển vị trí này không? Thao tác này không thể hoàn tác.',
          confirmText: 'Hủy đơn',
          cancelText: 'Giữ lại',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          HG.busy(wBtn, function () {
            HG.setAppStatus(aid, 6, { by: 'student' });
            updateStudentStats(); renderFullApps();
            showToast('Đã hủy đơn ứng tuyển.');
          }, 700);
        });
      });
    }

    /* Cập nhật gần thời gian thực khi nhà tuyển dụng đổi trạng thái (tab khác / cùng trình duyệt) */
    function refreshApps() { updateStudentStats(); renderFullApps(); }
    window.addEventListener('storage', function (e) { if (e.key === 'hg_app_patches' || e.key === 'hg_apps') refreshApps(); });
    document.addEventListener('hg:notify', refreshApps);

    /* TAB 5: LỊCH TUẦN & ĐĂNG KÝ CA RẢNH */
    var calWeekEl = $('calendar-week-grid');
    if (calWeekEl) {
      var dow = (now.getDay() + 6) % 7, mon = new Date(now);
      mon.setDate(now.getDate() - dow);
      var days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
      var studentScheds = schedules.filter(function (s) { return s.student_id === sid; });

      calWeekEl.innerHTML = days.map(function(dName, i) {
        var dObj = new Date(mon); dObj.setDate(mon.getDate() + i);
        var dStr = dObj.getFullYear() + '-' + pad(dObj.getMonth() + 1) + '-' + pad(dObj.getDate());
        var isToday = (i === dow);
        var dayEvents = studentScheds.filter(function(s) { return (s.start_datetime || '').slice(0, 10) === dStr; });

        var evHtml = dayEvents.map(function(s) {
          return '<div class="cal-shift-badge' + (s.job_id ? '' : ' interview') + '">' +
            '<strong>' + s.start_datetime.slice(11, 16) + '</strong> ' + E(s.title) +
            '</div>';
        }).join('');

        return '<div class="calendar-day-col' + (isToday ? ' is-today' : '') + '">' +
          '<div class="cal-day-head">' +
            '<strong>' + dName + '</strong>' +
            '<b>' + dObj.getDate() + '/' + (dObj.getMonth() + 1) + '</b>' +
          '</div>' +
          (evHtml || '<div style="color: #b0b8c9; font-size: 11px; text-align: center; margin-top: 18px;">Trống ca</div>') +
        '</div>';
      }).join('');
    }

    /* Bảng ca rảnh */
    var availTbody = $('avail-tbody');
    var studentAvail = HG.read('hg_avail_' + sid, {
      morning: [false, true, false, true, false, true, false],
      afternoon: [false, false, true, false, true, false, false],
      evening: [true, true, true, true, true, false, false]
    });

    if (availTbody) {
      var shifts = [
        { key: 'morning', label: 'Ca sáng (08:00 – 12:00)' },
        { key: 'afternoon', label: 'Ca chiều (13:00 – 17:00)' },
        { key: 'evening', label: 'Ca tối (17:30 – 22:00)' }
      ];

      availTbody.innerHTML = shifts.map(function(shift) {
        var cells = [0, 1, 2, 3, 4, 5, 6].map(function(dIdx) {
          var checked = studentAvail[shift.key] && studentAvail[shift.key][dIdx];
          return '<td><input type="checkbox" class="avail-check-box" data-shift="' + shift.key + '" data-day="' + dIdx + '"' + (checked ? ' checked' : '') + '></td>';
        }).join('');
        return '<tr><td><strong>' + shift.label + '</strong></td>' + cells + '</tr>';
      }).join('');
    }

    var saveAvailBtn = $('save-avail-btn');
    if (saveAvailBtn) {
      saveAvailBtn.addEventListener('click', function() {
        var newAvail = { morning: [], afternoon: [], evening: [] };
        ['morning', 'afternoon', 'evening'].forEach(function(key) {
          for (var i = 0; i < 7; i++) {
            var cb = document.querySelector('input.avail-check-box[data-shift="' + key + '"][data-day="' + i + '"]');
            newAvail[key].push(cb ? cb.checked : false);
          }
        });
        HG.write('hg_avail_' + sid, newAvail);
        showToast('Đã lưu thời gian rảnh thành công!');
      });
    }

    document.addEventListener('hg:synced', function () {
      updateStudentStats();
      renderSavedJobs();
      renderFullApps();
    });

    /* TAB 6: CÀI ĐẶT */
    var pwForm = $('pw-form');
    if (pwForm) {
      pwForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var ins = pwForm.querySelectorAll('input[type=password]');
        [].forEach.call(ins, function (i) { i.classList.remove('invalid'); });
        var r = HG.changePassword(ins[0].value, ins[1].value, ins[2].value);
        if (r.error) { ins[r.field].classList.add('invalid'); ins[r.field].focus(); showToast(r.error, 'error'); return; }
        showToast('Đã đổi mật khẩu thành công! Lần đăng nhập sau hãy dùng mật khẩu mới.');
        pwForm.reset();
      });
    }
    var prefForm = $('pref-form');
    if (prefForm) {
      prefForm.addEventListener('submit', function(e) {
        e.preventDefault();
        showToast('Đã lưu tùy chọn thông báo & bảo mật!');
      });
    }
  }

  /* =========================================================
     2. NHÀ TUYỂN DỤNG (EMPLOYER)
     ========================================================= */
  if (role === 'employer') {
    emp = employer_profiles.filter(function (e) { return e.user_id === user.id; })[0] || employer_profiles[0];
    var compEl = document.querySelector('[data-company]');
    if (compEl) compEl.textContent = emp.company_name;

    var JOB_STATUS = {
      draft: ['Bản nháp', 'draft'],
      pending: ['Chờ kiểm duyệt', 'pending'],
      approved: ['Đã đăng', 'accepted'],
      expired: ['Hết hạn', 'expired'],
      rejected: ['Bị từ chối', 'rejected'],
      locked: ['Bị khóa', 'rejected']
    };

    var getOwnJobs = function () {
      return JOBS.filter(function (j) { return j.employer_id === emp.id; });
    };

    var getOwnApps = function () {
      var jobIds = getOwnJobs().map(function (j) { return j.id; });
      return HG.applications().filter(function (a) { return jobIds.indexOf(a.job_id) !== -1; })
        .sort(function (a, b) { return (b.applied_at || '').localeCompare(a.applied_at || ''); });
    };

    var renderEmployerOverview = function () {
      var own = getOwnJobs();
      var apps = getOwnApps();

      setStat('jobs', own.length, 'Tin đã đăng');
      setStat('applicants', apps.length, 'Tổng số đơn nhận được');
      setStat('active', own.filter(function (j) { return j.status === 'approved'; }).length, 'Đang hiển thị');
      setStat('new', apps.filter(function (a) { return statusName(a.status_id) === 'submitted'; }).length, 'Cần xem xét');

      /* Ứng viên mới ở Tab 0 */
      var secCands = $('employer-cands');
      if (secCands) {
        secCands.querySelectorAll('.candidate, .empty-note').forEach(function (n) { n.remove(); });
        var bg = ['#E0C7FF', '#FFD3E8', '#A9D8FF'];
        after('employer-cands', apps.slice(0, 3).map(function (a, i) {
          var sp = byId(student_profiles, a.student_id) || { user_id: 1 }, u = byId(users, sp.user_id) || { full_name: 'Ứng viên' };
          return '<div class="candidate"><span style="background:' + bg[i % 3] + '">' + initials(u.full_name) + '</span>' +
            '<div><strong>' + E(u.full_name) + '</strong><small>' + E(jobOf(a).title) + '</small></div>' +
            '<button type="button" data-view-cand="' + a.id + '">Xem hồ sơ</button></div>';
        }).join('') || '<p class="empty-note">Chưa có ứng viên nào.</p>');
      }

      /* Bảng tóm tắt việc làm ở Tab 0 */
      var rowsEl = $('employer-rows');
      if (rowsEl) {
        rowsEl.innerHTML = own.map(function (j) {
          var n = apps.filter(function (a) { return a.job_id === j.id; }).length;
          var st = JOB_STATUS[j.status] || ['Đang hoạt động', 'accepted'];
          return '<div class="table-row"><span><b>' + E(j.title) + '</b><small>' + E(HG.typeLabel(j.job_type)) + '</small></span><span>' + n + '</span><span>—</span>' +
            '<span><i class="status ' + st[1] + '">' + st[0] + '</i></span><span>' + (HG.fmtDate(j.end_date) || '—') + '</span></div>';
        }).join('') || '<div style="padding:15px; text-align:center; color:#889;">Chưa có tin tuyển dụng nào.</div>';
      }
    };
    renderEmployerOverview();

    /* TAB 1: HỒ SƠ DOANH NGHIỆP */
    var empAvatar = $('emp-avatar'), empDispName = $('emp-display-name'), empDispSub = $('emp-display-sub');
    var inCompName = $('emp-company-name'), inRepName = $('emp-rep-name'), inIndustry = $('emp-industry');
    var inPhone = $('emp-phone'), inEmail = $('emp-email'), inAddress = $('emp-address'), inDesc = $('emp-desc');

    function syncEmployerProfile() {
      if (empAvatar) empAvatar.textContent = initials(emp.company_name);
      if (empDispName) empDispName.textContent = emp.company_name;
      if (empDispSub) empDispSub.textContent = (emp.industry || 'Doanh nghiệp') + ' · ' + (emp.company_address || 'Trụ sở chính');
      if (inCompName) inCompName.value = emp.company_name || '';
      if (inRepName) inRepName.value = emp.representative_name || user.full_name || '';
      if (inIndustry) inIndustry.value = emp.industry || '';
      if (inPhone) inPhone.value = emp.company_phone || user.phone || '';
      if (inEmail) inEmail.value = user.email || '';
      if (inAddress) inAddress.value = emp.company_address || '';
      if (inDesc) inDesc.value = emp.description || '';
    }
    syncEmployerProfile();

    var empForm = $('employer-profile-form');
    if (empForm) {
      empForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var V = window.HGValidate, bad = null, msg = '';
        [[inCompName, 'required|min:2', 'tên công ty'], [inRepName, 'required|fullname', 'tên người đại diện'], [inPhone, 'phone', 'số điện thoại']].forEach(function (r) {
          var m = V ? V.check(r[0].value, r[1], { label: r[2] }) : '';
          r[0].classList.toggle('invalid', !!m);
          if (m && !bad) { bad = r[0]; msg = m; }
        });
        if (bad) { showToast(msg, 'error'); bad.focus(); return; }
        emp.company_name = inCompName.value.trim();
        emp.representative_name = inRepName.value.trim();
        emp.industry = inIndustry.value.trim();
        emp.company_phone = inPhone.value.trim();
        emp.company_address = inAddress.value.trim();
        emp.description = inDesc.value.trim();
        emp.updated_at = HG.now();

        HG.write('hg_emp_profile_' + user.id, emp);
        if (window.HGApi) {
          window.HGApi.updateEmployerProfile(emp.id, {
            company_name: emp.company_name,
            representative_name: emp.representative_name,
            industry: emp.industry,
            company_phone: emp.company_phone,
            email: inEmail ? inEmail.value.trim() : user.email,
            company_address: emp.company_address,
            description: emp.description
          }).catch(function () {});
        }
        syncEmployerProfile();
        var hStrong = document.querySelector('.user-name strong');
        if (hStrong) hStrong.textContent = emp.company_name;
        showToast('Cập nhật hồ sơ doanh nghiệp thành công!');
      });
    }

    /* TAB 2: QUẢN LÝ TIN TUYỂN DỤNG – trạng thái: Nháp / Chờ kiểm duyệt / Đã đăng / Hết hạn */
    var fullJobsListEl = $('employer-full-jobs-list');
    var activeJobFilter = 'all';
    var jobFilterSearch = $('emp-job-search');

    function jobMatchesFilter(j, f) {
      if (f === 'all') return true;
      if (f === 'rejected') return j.status === 'rejected' || j.status === 'locked';
      return j.status === f;
    }
    function renderJobPills() {
      var tabs = $('emp-job-filter-tabs'); if (!tabs) return;
      var own = getOwnJobs();
      tabs.querySelectorAll('[data-job-filter]').forEach(function (b) {
        var base = b.dataset.label || (b.dataset.label = b.textContent.trim());
        b.innerHTML = E(base) + ' <span class="pill-count">' + own.filter(function (j) { return jobMatchesFilter(j, b.dataset.jobFilter); }).length + '</span>';
      });
    }

    function renderFullJobsList() {
      if (!fullJobsListEl) return;
      renderJobPills();
      var own = getOwnJobs().slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id; });
      var apps = getOwnApps();
      var q = (jobFilterSearch ? jobFilterSearch.value : '').trim().toLowerCase();

      var filtered = own.filter(function (j) {
        return jobMatchesFilter(j, activeJobFilter) && (!q || j.title.toLowerCase().indexOf(q) !== -1);
      });

      if (!own.length) {
        fullJobsListEl.innerHTML = HG.empty('briefcase', 'Bạn chưa đăng tin tuyển dụng nào', 'Tạo tin đầu tiên để tiếp cận sinh viên phù hợp. Bạn có thể lưu nháp và hoàn thiện sau.', '<button type="button" class="primary-btn small" data-goto-tab="3">Đăng tin mới</button>');
        return;
      }
      if (!filtered.length) {
        fullJobsListEl.innerHTML = HG.empty('search', 'Không tìm thấy tin phù hợp', 'Thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.');
        return;
      }

      fullJobsListEl.innerHTML = filtered.map(function (j) {
        var n = apps.filter(function (a) { return a.job_id === j.id; }).length;
        var cat = byId(job_categories, j.category_id);
        var st = JOB_STATUS[j.status] || ['Đã đăng', 'accepted'];
        var note = (j.status === 'rejected' || j.status === 'locked') && j.rejected_reason ? '<small class="reason-line">Lý do: ' + E(j.rejected_reason) + '</small>' : '';
        var dl = j.end_date ? '<small>Hạn nộp: ' + HG.fmtDate(j.end_date) + '</small>' : '';
        var acts = '';
        if (j.status === 'approved') acts += '<a class="cv-action-btn" href="job-detail.html?id=' + j.id + '" title="Xem tin công khai">' + I('eye', 14) + '</a>';
        acts += '<button type="button" class="cv-action-btn" data-edit-job="' + j.id + '" title="' + (j.status === 'expired' ? 'Gia hạn / sửa tin' : 'Chỉnh sửa') + '">' + I('settings', 14) + '</button>';
        if (j.status === 'draft' || j.status === 'rejected') acts += '<button type="button" class="cv-action-btn" style="color:#2ba788;" data-submit-job="' + j.id + '" title="Gửi kiểm duyệt">' + I('arrow', 14) + '</button>';
        acts += '<button type="button" class="cv-action-btn danger" data-del-own-job="' + j.id + '" title="Xóa tin">' + I('trash', 14) + '</button>';

        return '<div class="table-row">' +
          '<span><b>' + E(j.title || '(Chưa có tiêu đề)') + '</b><small>Tạo ngày: ' + HG.fmtDate(j.created_at) + '</small>' + dl + note + '</span>' +
          '<span>' + E(cat ? cat.name : (j.job_type ? HG.typeLabel(j.job_type) : '—')) + '</span>' +
          '<span>' + E(j.salary_min || j.salary_max || j.salary_text ? HG.jobSalary(j) : '—') + '</span>' +
          '<span><b>' + n + '</b> đơn</span>' +
          '<span><i class="status ' + st[1] + '">' + st[0] + '</i></span>' +
          '<span class="table-actions">' + acts + '</span>' +
        '</div>';
      }).join('');
    }
    renderFullJobsList();

    var jobFilterTabs = $('emp-job-filter-tabs');
    if (jobFilterTabs) {
      jobFilterTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-job-filter]');
        if (b) {
          jobFilterTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); });
          b.classList.add('active');
          activeJobFilter = b.dataset.jobFilter;
          renderFullJobsList();
        }
      });
    }
    if (jobFilterSearch) jobFilterSearch.addEventListener('input', renderFullJobsList);
    if (fullJobsListEl) {
      fullJobsListEl.addEventListener('click', function (e) {
        var ed = e.target.closest('[data-edit-job]');
        if (ed) { if (HG.openJobForm) HG.openJobForm(Number(ed.dataset.editJob)); return; }

        var sb = e.target.closest('[data-submit-job]');
        if (sb) {
          var sj = JOBS.filter(function (x) { return x.id === Number(sb.dataset.submitJob); })[0]; if (!sj) return;
          var miss = !sj.category_id || !sj.job_type || !sj.description || !sj.requirements || !sj.end_date || !(sj.location_text);
          if (miss) { showToast('Tin chưa đủ thông tin. Hãy bấm sửa và hoàn thiện trước khi gửi duyệt.', 'error'); return; }
          HG.busy(sb, function () {
            HG.updateJob(sj.id, { status: 'pending', rejected_reason: null });
            notifyAdmins('Tin "' + sj.title + '" của ' + emp.company_name + ' đang chờ kiểm duyệt.');
            renderEmployerOverview(); renderFullJobsList(); showToast('Đã gửi tin đi kiểm duyệt.');
          }, 700);
          return;
        }

        var delBtn = e.target.closest('[data-del-own-job]');
        if (delBtn) {
          var jid = Number(delBtn.dataset.delOwnJob);
          HG.confirm({
            title: 'Xóa tin tuyển dụng?',
            message: 'Tin tuyển dụng sẽ bị gỡ bỏ khỏi hệ thống và không thể khôi phục.',
            confirmText: 'Xóa tin',
            cancelText: 'Hủy',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            HG.busy(delBtn, function () {
              if (!HG.deleteJob(jid)) { showToast('Không xóa được tin, vui lòng thử lại.', 'error'); return; }
              renderEmployerOverview(); renderFullJobsList();
              showToast('Đã xóa tin tuyển dụng thành công.');
            }, 600);
          });
        }
      });
    }
    function notifyAdmins(text) {
      users.filter(function (u) { return u.role === 'admin' && u.status === 'active'; }).forEach(function (u) { HG.notify(u.id, text, { link: 'admin.html?tab=5', kind: 'job' }); });
    }

    /* TAB 3: ĐĂNG TIN TUYỂN DỤNG – validate + xem trước trực tiếp + upload ảnh */
    var form = $('post-form');
    if (form && emp) {
      var G = function (id) { return $(id); };
      var MAX_IMG = 3 * 1024 * 1024, imgData = '';
      var RULES = {
        'pf-title':    { err: 'err-title',    check: function (v) { return !v.trim() ? 'Vui lòng nhập tên công việc.' : v.trim().length < 8 ? 'Tên công việc cần ít nhất 8 ký tự.' : v.length > 100 ? 'Tên công việc tối đa 100 ký tự.' : ''; } },
        'pf-cat':      { err: 'err-cat',      check: function (v) { return v ? '' : 'Vui lòng chọn danh mục.'; } },
        'pf-type':     { err: 'err-type',     check: function (v) { return v ? '' : 'Vui lòng chọn hình thức làm việc.'; } },
        'pf-desc':     { err: 'err-desc',     check: function (v) { return !v.trim() ? 'Vui lòng nhập mô tả công việc.' : v.trim().length < 30 ? 'Mô tả cần ít nhất 30 ký tự (hiện ' + v.trim().length + ').' : ''; } },
        'pf-reqs':     { err: 'err-reqs',     check: function (v) { return !v.trim() ? 'Vui lòng nhập yêu cầu ứng viên.' : v.trim().length < 15 ? 'Yêu cầu cần ít nhất 15 ký tự.' : ''; } },
        'pf-salary':   { err: 'err-salary',   check: function (v) {
            if (!v.trim()) return 'Vui lòng nhập mức lương.';
            if (/thỏa thuận|thoả thuận/i.test(v)) return '';
            var r = HG.parseSalary(v);
            if (!r) return 'Mức lương chưa hợp lệ (ví dụ: 30–40K/giờ hoặc 4–5 triệu/tháng).';
            return r.min <= 0 ? 'Mức lương phải lớn hơn 0.' : r.min > r.max ? '' : (r.max < 1000 ? 'Mức lương quá thấp, hãy kiểm tra lại đơn vị.' : '');
        } },
        'pf-area':     { err: 'err-area',     check: function (v) { return v ? '' : 'Vui lòng chọn khu vực làm việc.'; } },
        'pf-slots':    { err: null,           check: function (v) { return !v || (+v >= 1 && +v <= 999 && /^\d+$/.test(v)) ? '' : 'Số lượng phải là số nguyên từ 1 đến 999.'; } },
        'pf-deadline': { err: 'err-deadline', check: function (v) {
            if (!v) return 'Vui lòng chọn hạn ứng tuyển.';
            var t = new Date(); t.setHours(0, 0, 0, 0);
            return new Date(v + 'T00:00:00') < t ? 'Hạn ứng tuyển không được ở quá khứ.' : '';
        } }
      };
      var todayISO = (function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
      G('pf-deadline').min = todayISO;
      G('pf-cat').innerHTML = '<option value="">-- Chọn danh mục --</option>' + job_categories.map(function (c) { return '<option value="' + c.id + '">' + E(c.name) + '</option>'; }).join('');
      G('pf-address').value = emp.company_address || '';

      function setErr(id, msg) {
        var r = RULES[id], el = G(id), box = r.err ? G(r.err) : null;
        if (!box && el) {                       // ô không có sẵn khung lỗi -> tạo thêm
          box = el.parentNode.querySelector('.field-err');
          if (!box) { box = document.createElement('small'); box.className = 'field-err'; el.parentNode.appendChild(box); }
        }
        if (box) box.textContent = msg;
        if (el) { el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
      }
      function validateField(id) { var msg = RULES[id].check(G(id).value); setErr(id, msg); return !msg; }
      function validateAll() {
        var firstBad = null;
        Object.keys(RULES).forEach(function (id) { if (!validateField(id) && !firstBad) firstBad = id; });
        if (!validateImage(true) && !firstBad) firstBad = 'img-drop-label';
        return firstBad;
      }
      var touched = {};
      Object.keys(RULES).forEach(function (id) {
        var el = G(id);
        el.addEventListener('blur', function () { touched[id] = true; validateField(id); });
        el.addEventListener('input', function () { if (touched[id]) validateField(id); });
        el.addEventListener('change', function () { if (touched[id]) validateField(id); });
      });

      /* ---- Xem trước trực tiếp ---- */
      var CAT_COLORS = ['#665CF6', '#FF8EC7', '#4F7DFF', '#A78BFA', '#22B8A7', '#3156C8'];
      function catName() { var c = job_categories.filter(function (x) { return x.id === Number(G('pf-cat').value); })[0]; return c ? c.name : ''; }
      function areaText() { var a = G('pf-area').value, ad = G('pf-address').value.trim(); return a ? (ad ? ad + ', ' + a : a) : ''; }
      function renderPreview() {
        var T = function (id, v, ph) { G(id).textContent = v && v.trim() ? v : ph; };
        T('preview-title', G('pf-title').value, 'Tên công việc');
        T('preview-cat', catName(), 'Danh mục');
        T('preview-type-tag', G('pf-type').value, 'Hình thức');
        T('preview-location', areaText(), 'Địa điểm');
        T('preview-shift', G('pf-shift').value, 'Ca làm việc');
        var sal = G('pf-salary').value.trim(), pr = HG.parseSalary(sal);
        G('preview-salary').textContent = !sal ? 'Mức lương' : (pr && !/thỏa thuận/i.test(sal) ? HG.formatSalaryRange(pr.min, pr.max) : sal);
        var dl = G('pf-deadline').value, days = dl ? Math.ceil((new Date(dl + 'T23:59:59') - new Date()) / 86400000) : null;
        G('preview-deadline').textContent = dl ? 'Hạn: ' + HG.fmtDate(dl) + (days >= 0 ? ' (còn ' + days + ' ngày)' : '') : '';
        G('preview-company').textContent = emp.company_name;
        G('preview-logo').textContent = emp.company_name.charAt(0);
        G('preview-logo').style.background = CAT_COLORS[(emp.id - 1) % CAT_COLORS.length];
        G('preview-img-area').hidden = !imgData;
        if (imgData) G('preview-img').src = imgData;
      }
      ['pf-title', 'pf-cat', 'pf-type', 'pf-salary', 'pf-area', 'pf-address', 'pf-shift', 'pf-deadline'].forEach(function (id) {
        G(id).addEventListener('input', renderPreview); G(id).addEventListener('change', renderPreview);
      });

      /* ---- Upload ảnh: kéo thả / chọn file, kiểm tra, nén nhỏ để lưu localStorage ---- */
      var imgInput = G('pf-img-input'), drop = G('img-drop-label'), chosenRow = G('img-chosen-row');
      function validateImage(silent) { var m = G('err-img').textContent; return !m; }
      function imgError(msg) { G('err-img').textContent = msg || ''; drop.classList.toggle('invalid', !!msg); }
      function clearImage() {
        imgData = ''; imgInput.value = ''; chosenRow.hidden = true; chosenRow.style.display = 'none'; imgError(''); renderPreview();
      }
      function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
      function handleFile(file) {
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) { imgError('Chỉ chấp nhận ảnh PNG, JPG, WEBP hoặc GIF.'); HG.toast('Tệp không phải là ảnh hợp lệ.', 'error'); imgInput.value = ''; return; }
        if (file.size > MAX_IMG) { imgError('Ảnh quá lớn (' + fmtSize(file.size) + '). Tối đa 3MB.'); HG.toast('Ảnh vượt quá 3MB, vui lòng chọn ảnh khác.', 'error'); imgInput.value = ''; return; }
        var reader = new FileReader();
        reader.onerror = function () { imgError('Không đọc được tệp ảnh, hãy thử lại.'); };
        reader.onload = function () {
          var im = new Image();
          im.onload = function () {
            var max = 960, k = Math.min(1, max / Math.max(im.width, im.height));
            var c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            imgData = c.toDataURL('image/jpeg', 0.8);
            G('img-thumb').src = imgData; G('img-fname').textContent = file.name; G('img-fsize').textContent = fmtSize(file.size);
            chosenRow.hidden = false; chosenRow.style.display = 'flex'; imgError(''); renderPreview();
            HG.toast('Đã thêm ảnh banner.', 'success');
          };
          im.onerror = function () { imgError('Tệp ảnh bị lỗi hoặc không đọc được.'); };
          im.src = reader.result;
        };
        reader.readAsDataURL(file);
      }
      imgInput.addEventListener('change', function () { handleFile(imgInput.files[0]); });
      G('img-remove-btn').addEventListener('click', function () { clearImage(); HG.toast('Đã xóa ảnh banner.', 'info'); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('dragover'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('dragover'); }); });
      drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer && e.dataTransfer.files[0]); });

      /* ---- Chế độ sửa tin + lưu nháp + gửi duyệt ---- */
      var editId = null;
      var submitBtn = G('post-submit-btn'), draftBtn = G('post-draft-btn');
      var TYPE_BACK = { 'part-time': 'Part-time', 'full-time': 'Toàn thời gian', 'internship': 'Thực tập' };
      var TYPE_MAP = { 'Part-time': 'part-time', 'Toàn thời gian': 'full-time', 'Thực tập': 'internship', 'Remote': 'part-time' };
      function setEditMode(j) {
        editId = j ? j.id : null;
        var h1 = document.querySelector('[data-view="3"] h1'); if (h1) h1.textContent = j ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng tin tuyển dụng';
        var kick = document.querySelector('[data-view="3"] .dash-welcome span'); if (kick) kick.textContent = j ? 'CẬP NHẬT TIN #' + j.id : 'TẠO CƠ HỘI MỚI';
        submitBtn.firstChild.textContent = j ? (j.status === 'draft' ? 'Gửi kiểm duyệt ' : 'Lưu & gửi duyệt lại ') : 'Đăng tuyển ngay ';
        draftBtn.hidden = !!(j && j.status !== 'draft' && j.status !== 'rejected');
      }
      function fillSelect(sel, val) {
        if (!val) { sel.value = ''; return; }
        var has = [].some.call(sel.options, function (o) { return o.value === val; });
        if (!has) { var o = document.createElement('option'); o.value = o.textContent = val; sel.appendChild(o); }
        sel.value = val;
      }
      HG.openJobForm = function (id) {
        var j = JOBS.filter(function (x) { return x.id === id; })[0]; if (!j) return;
        form.reset(); touched = {}; Object.keys(RULES).forEach(function (k) { setErr(k, ''); }); imgError('');
        G('pf-title').value = j.title || ''; G('pf-cat').value = j.category_id || '';
        G('pf-type').value = TYPE_BACK[j.job_type] || ''; G('pf-desc').value = j.description || ''; G('pf-reqs').value = j.requirements || '';
        G('pf-salary').value = j.salary_text || (j.salary_min ? HG.formatSalaryRange(j.salary_min, j.salary_max) : '');
        var loc = j.location_text || HG.locationName(j.location_id) || '', area = '', addr = loc;
        [].forEach.call(G('pf-area').options, function (o) { if (o.value && loc.indexOf(o.value) !== -1) { area = o.value; addr = loc.replace(o.value, '').replace(/[,\s]+$/, '').replace(/^[,\s]+/, ''); } });
        if (!area && loc) { var parts = loc.split(','); area = parts[parts.length - 1].trim(); addr = parts.slice(0, -1).join(',').trim(); fillSelect(G('pf-area'), area); }
        G('pf-area').value = area; G('pf-address').value = addr || emp.company_address || '';
        fillSelect(G('pf-shift'), j.work_time && j.work_time !== 'Thỏa thuận' ? j.work_time : '');
        G('pf-slots').value = j.quantity || ''; G('pf-deadline').value = j.end_date || '';
        imgData = j.image_url || ''; if (imgData) { G('img-thumb').src = imgData; G('img-fname').textContent = 'Ảnh hiện tại'; G('img-fsize').textContent = ''; chosenRow.hidden = false; chosenRow.style.display = 'flex'; } else { chosenRow.hidden = true; chosenRow.style.display = 'none'; }
        form.hidden = false; var succ = $('post-success'); if (succ) succ.hidden = true;
        var layout = document.querySelector('.post-form-layout'); if (layout) layout.classList.remove('done');
        setEditMode(j); renderPreview();
        var tabBtn = document.querySelector('[data-tab="3"]'); if (tabBtn) tabBtn.click();
        if (j.status === 'expired') showToast('Hãy chọn hạn ứng tuyển mới để gia hạn tin này.', 'info');
        else if (j.status === 'rejected' && j.rejected_reason) showToast('Tin từng bị từ chối: ' + j.rejected_reason, 'info');
      };

      function collect(status) {
        var sal = G('pf-salary').value.trim(), pr = !sal || /thỏa thuận|thoả thuận/i.test(sal) ? null : HG.parseSalary(sal);
        return {
          employer_id: emp.id, category_id: Number(G('pf-cat').value) || null, location_id: null,
          location_text: areaText(), title: G('pf-title').value.trim(), description: G('pf-desc').value.trim(), requirements: G('pf-reqs').value.trim(),
          salary_min: pr ? pr.min : 0, salary_max: pr ? pr.max : 0, salary_text: pr ? HG.formatSalaryRange(pr.min, pr.max) : (sal ? 'Thỏa thuận' : ''),
          job_type: TYPE_MAP[G('pf-type').value] || '', work_time: G('pf-shift').value || 'Thỏa thuận', quantity: Number(G('pf-slots').value) || 1,
          end_date: G('pf-deadline').value, image_url: imgData, status: status, rejected_reason: null
        };
      }
      function persist(fields) {
        if (editId) return HG.updateJob(editId, fields);
        var nextId = Math.max.apply(null, JOBS.map(function (j) { return j.id; }).concat([0])) + 1;
        return HG.addJob(Object.assign({ id: nextId, approved_by: null, approved_at: null, experience_level: 'Không yêu cầu', benefits: 'Đầy đủ đãi ngộ', start_date: '', created_at: HG.now(), updated_at: HG.now() }, fields));
      }
      function afterSave(status, title) {
        renderEmployerOverview(); renderFullJobsList();
        var wasEdit = !!editId; editId = null; setEditMode(null);
        if (status === 'draft') {
          showToast('Đã lưu bản nháp "' + title + '".');
          form.reset(); touched = {}; clearImage(); G('pf-address').value = emp.company_address || ''; renderPreview();
          var t2 = document.querySelector('[data-tab="2"]'); if (t2) t2.click();
          return;
        }
        form.hidden = true;
        var layout = document.querySelector('.post-form-layout'); if (layout) layout.classList.add('done');
        var succ = $('post-success'); if (succ) { succ.hidden = false; succ.querySelector('h2').textContent = wasEdit ? 'Đã cập nhật tin!' : 'Đăng tin thành công!'; }
        showToast(wasEdit ? 'Đã lưu thay đổi. Tin được gửi kiểm duyệt lại.' : 'Đăng tin thành công! Tin đang chờ kiểm duyệt.');
        notifyAdmins('Tin "' + title + '" của ' + emp.company_name + ' đang chờ kiểm duyệt.');
      }

      /* Gửi kiểm duyệt (validate đầy đủ) */
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        Object.keys(RULES).forEach(function (id) { touched[id] = true; });
        var bad = validateAll();
        if (bad) {
          var el = G(bad); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (el && el.focus && bad !== 'img-drop-label') el.focus();
          showToast('Vui lòng kiểm tra lại các trường được đánh dấu.', 'error');
          return;
        }
        HG.busy(submitBtn, function () {
          var f = collect('pending');
          if (persist(f) === false) { showToast('Không lưu được tin (bộ nhớ trình duyệt đầy). Hãy dùng ảnh nhỏ hơn hoặc bỏ ảnh.', 'error'); return; }
          afterSave('pending', f.title);
        }, 800);
      });

      /* Lưu nháp: chỉ cần tiêu đề; các ô đã nhập phải đúng định dạng */
      draftBtn.addEventListener('click', function () {
        touched['pf-title'] = true;
        var t = G('pf-title').value.trim();
        if (t.length < 8) { setErr('pf-title', t ? 'Tên công việc cần ít nhất 8 ký tự để lưu nháp.' : 'Hãy nhập tên công việc để lưu nháp.'); G('pf-title').focus(); showToast('Cần có tên công việc (≥ 8 ký tự) để lưu nháp.', 'error'); return; }
        var badField = null;
        ['pf-salary', 'pf-slots'].forEach(function (id) { if (G(id).value.trim() && !validateField(id) && !badField) badField = id; });
        if (G('pf-deadline').value && !validateField('pf-deadline') && !badField) badField = 'pf-deadline';
        if (badField) { G(badField).focus(); showToast('Một số ô đã nhập chưa hợp lệ, hãy sửa trước khi lưu nháp.', 'error'); return; }
        HG.busy(draftBtn, function () {
          var f = collect('draft');
          if (persist(f) === false) { showToast('Không lưu được bản nháp (bộ nhớ đầy).', 'error'); return; }
          afterSave('draft', f.title);
        }, 600);
      });

      var cancelBtn = form.querySelector('.form-actions [data-goto-tab="2"]');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { editId = null; setEditMode(null); form.reset(); touched = {}; clearImage(); G('pf-address').value = emp.company_address || ''; renderPreview(); });

      var postAnotherBtn = $('post-another-btn');
      if (postAnotherBtn) {
        postAnotherBtn.addEventListener('click', function () {
          editId = null; setEditMode(null);
          form.reset(); touched = {}; clearImage();
          Object.keys(RULES).forEach(function (id) { setErr(id, ''); });
          G('pf-address').value = emp.company_address || '';
          form.hidden = false; renderPreview();
          var layout = document.querySelector('.post-form-layout'); if (layout) layout.classList.remove('done');
          var succ = $('post-success'); if (succ) succ.hidden = true;
        });
      }
      setEditMode(null);
      renderPreview();
    }

    /* TAB 4: QUẢN LÝ ỨNG VIÊN – Kanban / Danh sách, popup nhập lý do, cập nhật tức thời */
    var candFullEl = $('employer-candidates-full');
    var activeCandFilter = 'all', candView = 'kanban', candJob = 'all';
    var KB_COLS = [
      { key: 'submitted', title: 'Mới nộp', sid: 1 }, { key: 'reviewing', title: 'Đã tiếp nhận', sid: 2 }, { key: 'interview', title: 'Phỏng vấn', sid: 3 },
      { key: 'accepted', title: 'Trúng tuyển', sid: 4 }, { key: 'rejected', title: 'Từ chối', sid: 5 }
    ];
    var CAND_LABEL = { submitted: ['Mới nộp', 'pending'], reviewing: ['Đã tiếp nhận', 'reviewing'], interview: ['Phỏng vấn', 'interview'], accepted: ['Trúng tuyển', 'accepted'], rejected: ['Từ chối', 'rejected'], withdrawn: ['Ứng viên đã hủy', 'rejected'] };
    var NEXT = { submitted: ['reviewing', 'interview', 'accepted', 'rejected'], reviewing: ['interview', 'accepted', 'rejected'], interview: ['accepted', 'rejected'], accepted: [], rejected: [], withdrawn: [] };
    var SID = { reviewing: 2, interview: 3, accepted: 4, rejected: 5 };

    function candInfo(a) {
      var sp = byId(student_profiles, a.student_id) || { user_id: 0, university: '', major: '' };
      var u = byId(users, sp.user_id) || { full_name: 'Ứng viên', email: '', phone: '' };
      return { sp: sp, u: u, j: jobOf(a), st: statusName(a.status_id) };
    }
    function candJobsSelectHtml() {
      return '<option value="all">Tất cả vị trí</option>' + getOwnJobs().filter(function (j) { return j.status !== 'draft'; }).map(function (j) { return '<option value="' + j.id + '"' + (String(candJob) === String(j.id) ? ' selected' : '') + '>' + E(j.title) + '</option>'; }).join('');
    }
    function candActionBtns(a, st) {
      var next = NEXT[st] || [], out = '';
      out += '<button type="button" class="cv-action-btn" data-view-cand="' + a.id + '">' + I('eye', 14) + ' Xem CV</button>';
      if (next.indexOf('reviewing') !== -1) out += '<button type="button" class="cv-action-btn" data-cand-act="reviewing" data-id="' + a.id + '">' + I('check', 14) + ' Duyệt</button>';
      if (next.indexOf('interview') !== -1) out += '<button type="button" class="cv-action-btn" data-cand-act="interview" data-id="' + a.id + '">' + I('calendar', 14) + ' Phỏng vấn</button>';
      if (next.indexOf('accepted') !== -1) out += '<button type="button" class="cv-action-btn ok" data-cand-act="accepted" data-id="' + a.id + '">' + I('check', 14) + ' Nhận</button>';
      if (next.indexOf('rejected') !== -1) out += '<button type="button" class="cv-action-btn danger" data-cand-act="rejected" data-id="' + a.id + '">' + I('x', 14) + ' Từ chối</button>';
      return out;
    }

    function renderCandPills() {
      var tabs = $('cand-filter-tabs'); if (!tabs) return;
      var apps = candApps();
      tabs.querySelectorAll('[data-cand-filter]').forEach(function (b) {
        var k = b.dataset.candFilter, base = b.dataset.label || (b.dataset.label = b.textContent.trim());
        b.innerHTML = E(base) + ' <span class="pill-count">' + (k === 'all' ? apps.length : apps.filter(function (a) { return statusName(a.status_id) === k; }).length) + '</span>';
      });
      tabs.hidden = candView === 'kanban';
    }
    function candApps() { return getOwnApps().filter(function (a) { return candJob === 'all' || String(a.job_id) === String(candJob); }); }

    function renderEmployerCandidates() {
      if (!candFullEl) return;
      renderCandPills();
      var all = candApps(), toolbar = $('cand-toolbar');
      if (toolbar) {
        toolbar.querySelectorAll('[data-cv]').forEach(function (b) { b.classList.toggle('active', b.dataset.cv === candView); });
        var sel = $('cand-job-select'); if (sel) sel.innerHTML = candJobsSelectHtml();
      }
      if (!getOwnApps().length) {
        candFullEl.innerHTML = HG.empty('users', 'Chưa có ứng viên nào', 'Khi sinh viên ứng tuyển vào tin của bạn, hồ sơ sẽ hiển thị tại đây để bạn xử lý.', '<button type="button" class="primary-btn small" data-goto-tab="3">Đăng tin tuyển dụng</button>');
        return;
      }
      if (candView === 'kanban') {
        candFullEl.innerHTML = '<div class="kanban">' + KB_COLS.map(function (col) {
          var list = all.filter(function (a) { return statusName(a.status_id) === col.key; });
          return '<div class="kb-col ' + col.key + '" data-col="' + col.key + '"><div class="kb-head"><strong>' + col.title + '</strong><span>' + list.length + '</span></div><div class="kb-body">' +
            (list.map(function (a) {
              var c = candInfo(a), draggable = (NEXT[c.st] || []).length > 0;
              return '<div class="kb-card" data-aid="' + a.id + '"' + (draggable ? ' draggable="true"' : '') + '>' +
                '<div class="kb-who"><span class="cand-avatar-img sm">' + initials(c.u.full_name) + '</span><div><b>' + E(c.u.full_name) + '</b><small>' + E(c.sp.university || 'Sinh viên') + '</small></div></div>' +
                '<div class="kb-job">' + E(c.j.title) + '</div><small class="kb-date">Nộp ' + HG.fmtDate(a.applied_at) + '</small>' +
                (c.st === 'interview' && a.interview_at ? '<small class="kb-meta">' + I('calendar', 12) + ' ' + E(String(a.interview_at).replace('T', ' ')) + '</small>' : '') +
                (c.st === 'rejected' && a.status_reason ? '<small class="kb-meta bad">Lý do: ' + E(a.status_reason) + '</small>' : '') +
                '<div class="kb-actions">' + candActionBtns(a, c.st) + '</div></div>';
            }).join('') || '<div class="kb-empty">Chưa có hồ sơ</div>') + '</div></div>';
        }).join('') + '</div>';
        return;
      }
      var filtered = all.filter(function (a) { return activeCandFilter === 'all' || statusName(a.status_id) === activeCandFilter; });
      if (!filtered.length) { candFullEl.innerHTML = HG.empty('users', 'Không có ứng viên ở trạng thái này', 'Chọn tab khác để xem các hồ sơ còn lại.'); return; }
      candFullEl.innerHTML = filtered.map(function (a) {
        var c = candInfo(a), st = CAND_LABEL[c.st] || CAND_LABEL.submitted;
        return '<div class="candidate-card-rich"><div class="cand-avatar-wrap"><span class="cand-avatar-img">' + initials(c.u.full_name) + '</span><div>' +
          '<h3 style="font-size: var(--fs-body); margin-bottom: 2px;">' + E(c.u.full_name) + '</h3>' +
          '<p style="color: #6a748c; font-size: var(--fs-xs); margin: 0;">Vị trí ứng tuyển: <strong>' + E(c.j.title) + '</strong> · ' + E(c.sp.university || 'Sinh viên') + '</p>' +
          '<small style="color: #929bae; font-size: 11px;">Nộp lúc: ' + HG.fmtDate(a.applied_at) + ' · Email: ' + E(c.u.email) + ' · SĐT: ' + E(c.u.phone) + '</small>' +
          (c.st === 'rejected' && a.status_reason ? '<small class="reason-line" style="display:block">Lý do: ' + E(a.status_reason) + '</small>' : '') + '</div></div>' +
          '<div class="cand-actions-wrap"><span class="status ' + st[1] + '">' + st[0] + '</span>' + candActionBtns(a, c.st) + '</div></div>';
      }).join('');
    }
    renderEmployerCandidates();

    /* Popup nhập lý do / lịch phỏng vấn */
    function askStatus(kind, a) {
      var c = candInfo(a);
      var cfg = {
        reviewing: { title: 'Duyệt hồ sơ', btn: 'Duyệt hồ sơ', field: false, hint: 'Hồ sơ sẽ chuyển sang "Đã tiếp nhận" và sinh viên được thông báo.' },
        interview: { title: 'Mời phỏng vấn', btn: 'Gửi lời mời', date: true, hint: 'Chọn thời gian phỏng vấn, sinh viên sẽ nhận thông báo ngay.' },
        accepted: { title: 'Xác nhận trúng tuyển', btn: 'Xác nhận nhận việc', field: false, hint: 'Sinh viên sẽ được thông báo đã trúng tuyển.' },
        rejected: { title: 'Từ chối hồ sơ', btn: 'Từ chối', reason: true, danger: true, hint: 'Lý do sẽ được gửi tới sinh viên.' }
      }[kind];
      return new Promise(function (resolve) {
        var done = false;
        HG.modal.open({
          className: 'modal-reason', dismissible: true, labelledBy: 'reason-title',
          html: '<h2 id="reason-title">' + cfg.title + '</h2><p style="margin-bottom:14px"><strong>' + E(c.u.full_name) + '</strong> · ' + E(c.j.title) + '</p>' +
            '<form data-form novalidate>' +
            (cfg.date ? '<label>Thời gian phỏng vấn <span class="req-star">*</span><input type="datetime-local" name="when"></label>' : '') +
            (cfg.reason ? '<label>Lý do từ chối <span class="req-star">*</span><textarea name="reason" rows="4" maxlength="300" placeholder="Ví dụ: Lịch rảnh của bạn chưa phù hợp với ca làm của vị trí này."></textarea></label><div class="quick-reasons">' +
              ['Chưa phù hợp yêu cầu vị trí', 'Lịch rảnh không khớp ca làm', 'Đã tuyển đủ số lượng'].map(function (r) { return '<button type="button" data-qr="' + E(r) + '">' + E(r) + '</button>'; }).join('') + '</div>' : '') +
            (!cfg.date && !cfg.reason ? '<label>Ghi chú gửi ứng viên (không bắt buộc)<textarea name="note" rows="3" maxlength="300"></textarea></label>' : '') +
            '<p class="form-error" role="alert"></p><p class="hint-line">' + cfg.hint + '</p>' +
            '<div class="modal-actions"><button type="button" class="secondary-btn" data-cancel>Hủy</button><button type="submit" class="primary-btn' + (cfg.danger ? ' danger' : '') + '">' + cfg.btn + '</button></div></form>',
          onMount: function (api) {
            var f = api.box.querySelector('form'), err = api.box.querySelector('.form-error');
            if (cfg.date) { var d = new Date(Date.now() + 2 * 86400000); d.setHours(9, 0, 0, 0); var p = function (n) { return ('0' + n).slice(-2); }; f.when.value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T09:00'; f.when.min = new Date().toISOString().slice(0, 16); }
            api.box.querySelector('[data-cancel]').addEventListener('click', function () { api.close(false); });
            api.box.addEventListener('click', function (e) { var q = e.target.closest('[data-qr]'); if (q && f.reason) { f.reason.value = q.dataset.qr; f.reason.focus(); } });
            f.addEventListener('submit', function (e) {
              e.preventDefault(); err.textContent = '';
              var meta = {};
              if (cfg.reason) { var r = f.reason.value.trim(); if (r.length < 10) { err.textContent = 'Vui lòng nhập lý do từ chối (ít nhất 10 ký tự).'; f.reason.focus(); return; } meta.reason = r; }
              if (cfg.date) { if (!f.when.value) { err.textContent = 'Vui lòng chọn thời gian phỏng vấn.'; return; } if (new Date(f.when.value) < new Date()) { err.textContent = 'Thời gian phỏng vấn phải ở tương lai.'; return; } meta.interview_at = f.when.value; }
              if (f.note && f.note.value.trim()) meta.reason = f.note.value.trim();
              var btn = f.querySelector('[type=submit]');
              HG.busy(btn, function () { done = true; api.close(true); resolve(meta); }, 650);
            });
          },
          onClose: function () { if (!done) resolve(null); }
        });
      });
    }

    function changeCandStatus(aid, kind) {
      var a = HG.applications().filter(function (x) { return x.id === aid; })[0]; if (!a) return;
      var cur = statusName(a.status_id);
      if ((NEXT[cur] || []).indexOf(kind) === -1) { showToast('Hồ sơ này không thể chuyển sang trạng thái đó.', 'error'); renderEmployerCandidates(); return; }
      askStatus(kind, a).then(function (meta) {
        if (!meta) return;
        if (!HG.setAppStatus(aid, SID[kind], meta)) { showToast('Không cập nhật được trạng thái, vui lòng thử lại.', 'error'); return; }
        renderEmployerOverview(); renderEmployerCandidates();
        showToast({ reviewing: 'Đã duyệt hồ sơ ứng viên.', interview: 'Đã gửi lời mời phỏng vấn tới sinh viên!', accepted: 'Ứng viên đã trúng tuyển!', rejected: 'Đã từ chối hồ sơ và gửi lý do cho sinh viên.' }[kind]);
      });
    }

    function openCandidateModal(aid) {
      var a = HG.applications().filter(function (x) { return x.id === aid; })[0]; if (!a) return;
      var c = candInfo(a), st = CAND_LABEL[c.st] || CAND_LABEL.submitted;
      HG.modal.open({
        className: 'modal-candidate-detail',
        html: '<div style="padding: 10px;"><div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;"><span class="cand-avatar-img" style="width:56px; height:56px; font-size:20px;">' + initials(c.u.full_name) + '</span><div>' +
          '<h2 style="font-size: var(--fs-h4); margin:0 0 4px;">' + E(c.u.full_name) + '</h2><p style="color:#717b94; font-size:var(--fs-xs); margin:0;">Ứng tuyển: <strong>' + E(c.j.title) + '</strong></p></div></div>' +
          '<div style="background:#f8f9fe; border:1px solid #e2e6f4; border-radius:14px; padding:18px; margin-bottom:18px; font-size:var(--fs-body-sm); line-height:1.7;">' +
          '<div><strong>Trường đại học:</strong> ' + E(c.sp.university || 'Chưa cập nhật') + '</div><div><strong>Chuyên ngành:</strong> ' + E(c.sp.major || 'Chưa cập nhật') + '</div>' +
          '<div><strong>Email liên hệ:</strong> ' + E(c.u.email) + '</div><div><strong>Số điện thoại:</strong> ' + E(c.u.phone) + '</div><div><strong>Ngày nộp hồ sơ:</strong> ' + HG.fmtDate(a.applied_at) + '</div>' +
          '<div style="margin-top:10px;"><strong>Lời nhắn từ sinh viên:</strong><br><em style="color:#505c78;">"' + E(a.cover_letter || 'Sinh viên không để lại lời nhắn.') + '"</em></div></div>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;"><span>Trạng thái: <i class="status ' + st[1] + '">' + st[0] + '</i></span>' +
          '<div style="display:flex; gap:8px; flex-wrap:wrap;">' + candActionBtns(a, c.st).replace(/<button type="button" class="cv-action-btn" data-view-cand[^>]*>.*?<\/button>/, '') + '<button type="button" class="secondary-btn small" data-close>Đóng</button></div></div></div>',
        onMount: function (api) {
          api.box.addEventListener('click', function (e) { var b = e.target.closest('[data-cand-act]'); if (b) { api.close(); changeCandStatus(Number(b.dataset.id), b.dataset.candAct); } });
        }
      });
    }

    var candToolbar = $('cand-toolbar');
    if (candToolbar) {
      candToolbar.addEventListener('click', function (e) { var b = e.target.closest('[data-cv]'); if (b) { candView = b.dataset.cv; renderEmployerCandidates(); } });
      candToolbar.addEventListener('change', function (e) { if (e.target.id === 'cand-job-select') { candJob = e.target.value; renderEmployerCandidates(); } });
    }
    var candFilterTabs = $('cand-filter-tabs');
    if (candFilterTabs) {
      candFilterTabs.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cand-filter]');
        if (b) {
          candFilterTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); });
          b.classList.add('active'); activeCandFilter = b.dataset.candFilter; renderEmployerCandidates();
        }
      });
    }
    if (candFullEl) {
      candFullEl.addEventListener('click', function (e) {
        var v = e.target.closest('[data-view-cand]'); if (v) { openCandidateModal(Number(v.dataset.viewCand)); return; }
        var act = e.target.closest('[data-cand-act]'); if (act) changeCandStatus(Number(act.dataset.id), act.dataset.candAct);
      });
      /* Kéo thả thẻ giữa các cột Kanban */
      var dragId = null;
      candFullEl.addEventListener('dragstart', function (e) { var c = e.target.closest('.kb-card'); if (c) { dragId = Number(c.dataset.aid); c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (x) {} } });
      candFullEl.addEventListener('dragend', function (e) { var c = e.target.closest('.kb-card'); if (c) c.classList.remove('dragging'); candFullEl.querySelectorAll('.kb-col.over').forEach(function (x) { x.classList.remove('over'); }); });
      candFullEl.addEventListener('dragover', function (e) { var col = e.target.closest('.kb-col'); if (col && dragId) { e.preventDefault(); col.classList.add('over'); } });
      candFullEl.addEventListener('dragleave', function (e) { var col = e.target.closest('.kb-col'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
      candFullEl.addEventListener('drop', function (e) {
        var col = e.target.closest('.kb-col'); if (!col || !dragId) return; e.preventDefault(); col.classList.remove('over');
        var id = dragId; dragId = null;
        var a = HG.applications().filter(function (x) { return x.id === id; })[0]; if (!a) return;
        var to = col.dataset.col, cur = statusName(a.status_id);
        if (to === cur) return;
        if ((NEXT[cur] || []).indexOf(to) === -1) { showToast('Không thể chuyển hồ sơ từ "' + CAND_LABEL[cur][0] + '" sang "' + CAND_LABEL[to][0] + '".', 'error'); return; }
        changeCandStatus(id, to);
      });
    }
    /* Hồ sơ mới / ứng viên rút đơn: cập nhật ngay */
    function refreshCands() { renderEmployerOverview(); renderFullJobsList(); renderEmployerCandidates(); }
    window.addEventListener('storage', function (e) { if (e.key === 'hg_app_patches' || e.key === 'hg_apps') refreshCands(); });
    document.addEventListener('hg:notify', refreshCands);
    document.addEventListener('hg:synced', refreshCands);

    /* TAB 5: CÀI ĐẶT */
    var empPw = $('emp-pw-form'), empPref = $('emp-pref-form');
    if (empPw) {
      empPw.addEventListener('submit', function(e) {
        e.preventDefault();
        var ins = empPw.querySelectorAll('input[type=password]');
        [].forEach.call(ins, function (i) { i.classList.remove('invalid'); });
        var r = HG.changePassword(ins[0].value, ins[1].value, ins[2].value);
        if (r.error) { ins[r.field].classList.add('invalid'); ins[r.field].focus(); showToast(r.error, 'error'); return; }
        showToast('Đã đổi mật khẩu thành công! Lần đăng nhập sau hãy dùng mật khẩu mới.');
        empPw.reset();
      });
    }
    if (empPref) {
      empPref.addEventListener('submit', function(e) {
        e.preventDefault();
        showToast('Đã lưu tùy chọn thông báo tuyển dụng!');
      });
    }
  }

  /* =========================================================
     3. QUẢN TRỊ VIÊN (ADMIN)
     ========================================================= */
  if (role === 'admin') {
    var count = function (r) { return users.filter(function (u) { return u.role === r; }).length; };
    var updateAdminStats = function() {
      setStat('users', users.length, 'Toàn hệ thống');
      setStat('students', count('student'), 'Tài khoản sinh viên');
      setStat('employers', count('employer'), 'Tài khoản nhà tuyển dụng');
      setStat('jobs', JOBS.length, 'Tổng số tin');
      var repStat = $('stat-report-count');
      if (repStat) repStat.textContent = reports.filter(function(r){ return r.status === 'pending'; }).length;
      var done = JOBS.filter(function (j) { return j.status === 'approved' || j.status === 'rejected' || j.status === 'locked' || j.status === 'expired'; });
      var rate = $('stat-approve-rate'); if (rate) rate.textContent = done.length ? Math.round(JOBS.filter(function (j) { return j.status === 'approved' || j.status === 'expired'; }).length / done.length * 100) + '%' : '—';
      var appsEl = $('stat-apps-total'); if (appsEl) appsEl.textContent = HG.applications().length;
      var tc = topCategory(); var hot = $('stat-hot-cat'); if (hot) { hot.textContent = tc ? tc.name : '—'; var hs = $('stat-hot-sub'); if (hs) hs.textContent = tc ? tc.n + ' tin (' + Math.round(tc.n / Math.max(1, JOBS.length) * 100) + '%)' : 'Chưa có dữ liệu'; }
      drawAdminCharts();
    };

    function topCategory() {
      var cnt = {}; JOBS.forEach(function (j) { cnt[j.category_id] = (cnt[j.category_id] || 0) + 1; });
      var best = null; Object.keys(cnt).forEach(function (k) { var c = byId(job_categories, Number(k)); if (c && (!best || cnt[k] > best.n)) best = { name: c.name, n: cnt[k] }; });
      return best;
    }
    /* Biểu đồ thật: số người dùng (SV / NTD) tích lũy 6 tháng + tin theo ngành nghề */
    function drawAdminCharts() {
      var bars = document.querySelector('.admin-chart .bar-set');
      if (bars) {
        var now2 = new Date(), months = [];
        for (var i = 5; i >= 0; i--) { var d = new Date(now2.getFullYear(), now2.getMonth() - i + 1, 1); months.push({ label: 'T' + (new Date(d.getFullYear(), d.getMonth() - 1, 1).getMonth() + 1), end: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01' }); }
        var series = months.map(function (m) {
          var f = function (r) { return users.filter(function (u) { return u.role === r || (u.orig_role === r); }).filter(function (u) { return (u.created_at || '').slice(0, 10) < m.end; }).length; };
          return { label: m.label, s: f('student'), e: f('employer') };
        });
        var max = Math.max.apply(null, series.map(function (x) { return Math.max(x.s, x.e); }).concat([1]));
        bars.innerHTML = series.map(function (x) {
          return '<span title="' + x.label + ': ' + x.s + ' sinh viên, ' + x.e + ' nhà tuyển dụng"><i style="height:' + Math.max(4, x.s / max * 100) + '%"></i><b style="height:' + Math.max(4, x.e / max * 100) + '%"></b><em class="bar-val">' + x.s + '/' + x.e + '</em><u class="bar-lab">' + x.label + '</u></span>';
        }).join('');
      }
      var cc = $('admin-cat-chart');
      if (cc) {
        var rows = job_categories.map(function (c) { return { name: c.name, n: JOBS.filter(function (j) { return j.category_id === c.id && j.status !== 'draft'; }).length }; }).sort(function (a, b) { return b.n - a.n; });
        var mx = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
        cc.innerHTML = rows.length ? rows.map(function (r) { return '<div class="hbar"><span>' + E(r.name) + '</span><div><i style="width:' + (r.n / mx * 100) + '%"></i></div><b>' + r.n + '</b></div>'; }).join('') : HG.empty('chart', 'Chưa có danh mục nào');
      }
    }
    updateAdminStats();

    /* Báo cáo gần đây ở Tab 0 */
    var secAct = $('admin-activity');
    if (secAct) {
      secAct.querySelectorAll('div:not(.panel-title)').forEach(function(el){ el.remove(); });
      var RTYPE = { job: 'tin tuyển dụng', employer: 'nhà tuyển dụng', student: 'sinh viên' };
      after('admin-activity', reports.map(function (r) {
        return '<div><span>' + I('shield') + '</span><p><strong>Báo cáo ' + (RTYPE[r.report_type] || r.report_type) + ' #' + r.target_id + '</strong><small>' +
          E(r.reason) + ' · ' + (r.status === 'resolved' ? 'Đã xử lý' : 'Chờ xử lý') + '</small></p></div>';
      }).join(''));
    }

    /* TAB 0 & 5: KIỂM DUYỆT TIN ĐĂNG */
    var mod = $('moderation-rows'), pending = $('pending-count');
    var fullModEl = $('admin-full-mod-rows');
    var activeModFilter = 'pending';
    var MOD = { pending: ['Chờ duyệt', 'pending'], approved: ['Đã duyệt', 'accepted'], rejected: ['Từ chối', 'rejected'], locked: ['Đã khóa', 'rejected'], expired: ['Hết hạn', 'expired'], draft: ['Nháp', 'draft'] };
    var modJobs = function () { return JOBS.filter(function (j) { return j.status !== 'draft'; }); };   /* nháp chưa gửi duyệt -> admin không thấy */

    /* Nút thao tác theo trạng thái: chờ duyệt -> Duyệt / Từ chối; đã duyệt -> Khóa; từ chối/khóa -> Duyệt lại */
    function modButtons(j, withText) {
      var t = function (x) { return withText ? ' ' + x : ''; };
      if (j.status === 'pending') return '<button class="approve" data-act="approved" data-id="' + j.id + '" title="Phê duyệt">' + I('check', 16) + t('Duyệt') + '</button>' +
        '<button class="cv-action-btn danger" data-act="rejected" data-id="' + j.id + '" title="Từ chối (nhập lý do)">' + I('x', 16) + t('Từ chối') + '</button>';
      if (j.status === 'approved') return '<button class="cv-action-btn danger" data-act="locked" data-id="' + j.id + '" title="Khóa tin (nhập lý do)">' + I('shield', 16) + t('Khóa') + '</button>';
      if (j.status === 'rejected' || j.status === 'locked') return '<button class="approve" data-act="approved" data-id="' + j.id + '" title="Duyệt lại">' + I('check', 16) + t('Duyệt lại') + '</button>';
      return '<span style="color:#9aa2b2">—</span>';
    }

    var drawModeration = function () {
      var order = { pending: 0, approved: 1, rejected: 2, locked: 3, expired: 4 };
      var sorted = modJobs().sort(function (a, b) { return (order[a.status] == null ? 9 : order[a.status]) - (order[b.status] == null ? 9 : order[b.status]) || b.id - a.id; });

      if (mod) {
        mod.innerHTML = sorted.length ? sorted.slice(0, 5).map(function (j) {
          var c = companyOf(j), cat = byId(job_categories, j.category_id), st = MOD[j.status] || ['Chờ duyệt', 'pending'];
          return '<div class="table-row"><span class="company-cell"><i class="company-logo" style="background:' + HG.employerColor(c.id) + '">' + E(c.company_name.charAt(0)) + '</i>' +
            '<span><b>' + E(j.title) + '</b><small>' + E(c.company_name) + '</small></span></span>' +
            '<span>' + HG.fmtDate(j.created_at) + '</span><span>' + E(cat ? cat.name : '') + '</span>' +
            '<span><i class="status ' + st[1] + '">' + st[0] + '</i></span>' +
            '<span class="table-actions">' + modButtons(j, false) + '</span></div>';
        }).join('') : HG.empty('shield', 'Chưa có tin nào cần kiểm duyệt', 'Khi nhà tuyển dụng gửi tin, chúng sẽ xuất hiện tại đây.');
      }

      var pendCount = JOBS.filter(function (j) { return j.status === 'pending'; }).length;
      if (pending) pending.textContent = pendCount + ' tin đang chờ';

      if (fullModEl) {
        var filteredMod = sorted.filter(function (j) {
          return activeModFilter === 'all' || j.status === activeModFilter || (activeModFilter === 'rejected' && j.status === 'locked');
        });
        if (!filteredMod.length) {
          fullModEl.innerHTML = HG.empty('shield', activeModFilter === 'pending' ? 'Không còn tin nào chờ duyệt' : 'Không có tin nào trong mục này', activeModFilter === 'pending' ? 'Tuyệt vời! Bạn đã xử lý hết các tin đang chờ.' : 'Chọn tab khác để xem các tin còn lại.');
        } else {
          fullModEl.innerHTML = filteredMod.map(function (j) {
            var c = companyOf(j), cat = byId(job_categories, j.category_id), st = MOD[j.status] || ['Chờ duyệt', 'pending'];
            var reason = (j.status === 'rejected' || j.status === 'locked') && j.rejected_reason ? '<small class="reason-line">Lý do: ' + E(j.rejected_reason) + '</small>' : '';
            return '<div class="table-row"><span class="company-cell"><i class="company-logo" style="background:' + HG.employerColor(c.id) + '">' + E(c.company_name.charAt(0)) + '</i>' +
              '<span><b>' + E(j.title) + '</b><small>' + E(c.company_name) + '</small>' + reason + '</span></span>' +
              '<span>' + HG.fmtDate(j.created_at) + '</span><span>' + E(cat ? cat.name : '') + '</span>' +
              '<span>' + E(HG.jobSalary(j)) + '</span>' +
              '<span><i class="status ' + st[1] + '">' + st[0] + '</i></span>' +
              '<span class="table-actions">' + modButtons(j, true) + '</span></div>';
          }).join('');
        }
      }
    };

    /* Duyệt / Từ chối / Khóa: từ chối & khóa bắt buộc nhập lý do */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var jid = Number(b.dataset.id), act = b.dataset.act, job = byId(JOBS, jid);
      if (!job) return;
      var finish = function (reason) {
        HG.busy(b, function () {
          if (!HG.setJobStatus(jid, act, reason)) { showToast('Không cập nhật được tin, vui lòng thử lại.', 'error'); return; }
          drawModeration(); renderAdminAllJobs(); updateAdminStats();
          showToast({ approved: 'Đã phê duyệt tin "' + job.title + '".', rejected: 'Đã từ chối tin và gửi lý do cho nhà tuyển dụng.', locked: 'Đã khóa tin "' + job.title + '".' }[act]);
        }, 650);
      };
      if (act === 'approved') { finish(); return; }
      HG.askReason({
        title: act === 'locked' ? 'Khóa tin tuyển dụng' : 'Từ chối tin tuyển dụng',
        subtitle: '<strong>' + E(job.title) + '</strong> · ' + E(companyOf(job).company_name),
        label: act === 'locked' ? 'Lý do khóa tin' : 'Lý do từ chối', placeholder: 'Nêu rõ lý do để nhà tuyển dụng chỉnh sửa lại tin…',
        quick: act === 'locked' ? ['Có báo cáo vi phạm từ người dùng', 'Thông tin tuyển dụng không chính xác', 'Nghi ngờ lừa đảo / thu phí ứng viên'] : ['Thông tin mô tả chưa rõ ràng', 'Mức lương không hợp lý / thiếu thông tin', 'Nội dung vi phạm quy định đăng tin'],
        confirmText: act === 'locked' ? 'Khóa tin' : 'Từ chối tin', danger: true
      }).then(function (reason) { if (reason) finish(reason); });
    });

    var modFilterTabs = $('admin-mod-filter-tabs');
    if (modFilterTabs) {
      modFilterTabs.addEventListener('click', function(e) {
        var b = e.target.closest('[data-mod-filter]');
        if (b) {
          modFilterTabs.querySelectorAll('.dash-pill').forEach(function(p){ p.classList.remove('active'); });
          b.classList.add('active');
          activeModFilter = b.dataset.modFilter;
          drawModeration();
        }
      });
    }
    drawModeration();

    /* TAB 1: QUẢN LÝ SINH VIÊN */
    var stuTableEl = $('admin-students-table');
    var stuSearch = $('admin-student-search');

    function renderAdminStudents() {
      if (!stuTableEl) return;
      var q = (stuSearch ? stuSearch.value : '').trim().toLowerCase();
      var stus = users.filter(function(u) { return u.role === 'student'; });

      var filtered = stus.filter(function(u) {
        var p = student_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        return !q || u.full_name.toLowerCase().indexOf(q) !== -1 ||
          u.email.toLowerCase().indexOf(q) !== -1 ||
          (p.university || '').toLowerCase().indexOf(q) !== -1;
      });

      if (!filtered.length) {
        stuTableEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #889;">Không tìm thấy sinh viên nào.</div>';
        return;
      }

      stuTableEl.innerHTML = filtered.map(function(u) {
        var p = student_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        var isActive = u.status === 'active';
        return '<div class="table-row">' +
          '<span><b>' + E(u.full_name) + '</b><small>Mã SV: #' + u.id + '</small></span>' +
          '<span>' + E(u.email) + '<br><small>' + E(u.phone) + '</small></span>' +
          '<span>' + E(p.university || 'Chưa cập nhật') + '<br><small>' + E(p.major || 'Chưa cập nhật') + '</small></span>' +
          '<span>' + HG.fmtDate(u.created_at) + '</span>' +
          '<span><i class="' + (isActive ? 'admin-badge-active' : 'admin-badge-locked') + '">' + (isActive ? 'Hoạt động' : 'Đang khóa') + '</i></span>' +
          '<span class="table-actions">' +
            '<button type="button" class="cv-action-btn' + (isActive ? ' danger' : '') + '" data-toggle-user="' + u.id + '">' +
              (isActive ? 'Khóa' : 'Mở khóa') +
            '</button>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminStudents();
    if (stuSearch) stuSearch.addEventListener('input', renderAdminStudents);

    /* TAB 2: QUẢN LÝ NHÀ TUYỂN DỤNG */
    var empTableEl = $('admin-employers-table');
    var empSearch = $('admin-employer-search');

    function renderAdminEmployers() {
      if (!empTableEl) return;
      var q = (empSearch ? empSearch.value : '').trim().toLowerCase();
      var emps = users.filter(function(u) { return u.role === 'employer'; });

      var filtered = emps.filter(function(u) {
        var ep = employer_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        return !q || (ep.company_name || '').toLowerCase().indexOf(q) !== -1 ||
          u.full_name.toLowerCase().indexOf(q) !== -1;
      });

      if (!filtered.length) {
        empTableEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #889;">Không tìm thấy nhà tuyển dụng nào.</div>';
        return;
      }

      empTableEl.innerHTML = filtered.map(function(u) {
        var ep = employer_profiles.filter(function(x){ return x.user_id === u.id; })[0] || {};
        var jCount = JOBS.filter(function(j){ return j.employer_id === ep.id; }).length;
        var isVer = ep.verified;
        return '<div class="table-row">' +
          '<span class="company-cell"><i class="company-logo" style="background:#5B7CFA">' + E((ep.company_name || 'C').charAt(0)) + '</i>' +
            '<span><b>' + E(ep.company_name || 'Doanh nghiệp') + '</b><small>' + E(ep.company_address || 'Hà Nội') + '</small></span></span>' +
          '<span>' + E(ep.representative_name || u.full_name) + '</span>' +
          '<span>' + E(ep.industry || 'Bán lẻ') + '<br><small>' + E(u.email) + '</small></span>' +
          '<span><b>' + jCount + '</b> tin</span>' +
          '<span><i class="' + (isVer ? 'admin-badge-active' : 'admin-badge-locked') + '">' + (u.status !== 'active' ? 'Đang khóa' : isVer ? 'Đã xác minh' : 'Chưa xác minh') + '</i></span>' +
          '<span class="table-actions">' +
            '<button type="button" class="cv-action-btn" data-verify-emp="' + ep.id + '">' + (isVer ? 'Hủy duyệt' : 'Xác minh') + '</button>' +
            '<button type="button" class="cv-action-btn' + (u.status === 'active' ? ' danger' : '') + '" data-toggle-user="' + u.id + '">' + (u.status === 'active' ? 'Khóa' : 'Mở khóa') + '</button>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminEmployers();
    if (empSearch) empSearch.addEventListener('input', renderAdminEmployers);

    /* Event delegation for admin tables */
    document.addEventListener('click', function (e) {
      var uBtn = e.target.closest('[data-toggle-user]');
      if (uBtn) {
        var uid = Number(uBtn.dataset.toggleUser);
        var targetUser = byId(users, uid);
        if (!targetUser) return;
        if (targetUser.id === HG.ROOT_ADMIN_ID) { showToast('Không thể khóa tài khoản Admin gốc.', 'error'); return; }
        var lock = targetUser.status === 'active';
        HG.confirm({
          title: lock ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?',
          message: lock ? 'Tài khoản "' + targetUser.full_name + '" sẽ không thể đăng nhập cho đến khi được mở khóa.' : 'Tài khoản "' + targetUser.full_name + '" sẽ có thể đăng nhập trở lại.',
          confirmText: lock ? 'Khóa tài khoản' : 'Mở khóa', cancelText: 'Hủy', danger: lock
        }).then(function (ok) {
          if (!ok) return;
          HG.busy(uBtn, function () {
            HG.setUserStatus(uid, lock ? 'blocked' : 'active');
            renderAdminStudents(); renderAdminEmployers(); updateAdminStats();
            showToast(lock ? 'Đã khóa tài khoản ' + targetUser.full_name + '.' : 'Đã mở khóa tài khoản ' + targetUser.full_name + '.');
          }, 600);
        });
        return;
      }

      var vBtn = e.target.closest('[data-verify-emp]');
      if (vBtn) {
        var epid = Number(vBtn.dataset.verifyEmp);
        var targetEmp = byId(employer_profiles, epid);
        if (targetEmp) {
          HG.busy(vBtn, function () {
            HG.setEmpVerified(epid, !targetEmp.verified);
            renderAdminEmployers();
            showToast(targetEmp.verified ? 'Đã xác minh doanh nghiệp ' + targetEmp.company_name + '.' : 'Đã hủy xác minh doanh nghiệp.');
            HG.notify(targetEmp.user_id, targetEmp.verified ? 'Doanh nghiệp của bạn đã được xác minh.' : 'Xác minh doanh nghiệp của bạn đã bị hủy.', { link: 'employer.html?tab=1', kind: 'info' });
          }, 600);
        }
        return;
      }
    });

    /* TAB 3: QUẢN LÝ VIỆC LÀM */
    var ajTableEl = $('admin-all-jobs-table');
    var ajSearch = $('admin-job-search');
    var activeAjFilter = 'all';

    function renderAdminAllJobs() {
      if (!ajTableEl) return;
      var q = (ajSearch ? ajSearch.value : '').trim().toLowerCase();
      var filtered = modJobs().filter(function(j) {
        var c = companyOf(j);
        var matchStatus = activeAjFilter === 'all' || j.status === activeAjFilter || (activeAjFilter === 'rejected' && j.status === 'locked');
        var matchQuery = !q || j.title.toLowerCase().indexOf(q) !== -1 || c.company_name.toLowerCase().indexOf(q) !== -1;
        return matchStatus && matchQuery;
      });

      if (!filtered.length) {
        ajTableEl.innerHTML = HG.empty('briefcase', 'Không tìm thấy tin tuyển dụng nào', 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.');
        return;
      }

      ajTableEl.innerHTML = filtered.map(function(j) {
        var c = companyOf(j), cat = byId(job_categories, j.category_id), st = MOD[j.status] || ['Chờ duyệt', 'pending'];
        return '<div class="table-row">' +
          '<span><b>' + E(j.title) + '</b><small>Mã tin: #' + j.id + ' · ' + HG.typeLabel(j.job_type) + '</small></span>' +
          '<span>' + E(c.company_name) + '</span>' +
          '<span>' + E(cat ? cat.name : '') + '</span>' +
          '<span>' + E(HG.jobSalary(j)) + '</span>' +
          '<span><i class="status ' + st[1] + '">' + st[0] + '</i></span>' +
          '<span class="table-actions">' +
            (j.status === 'approved' ? '<a class="cv-action-btn" href="job-detail.html?id=' + j.id + '" title="Xem">' + I('eye', 14) + '</a>' : '') +
            (j.status === 'approved' ? '<button type="button" class="cv-action-btn danger" data-act="locked" data-id="' + j.id + '" title="Khóa tin">' + I('shield', 14) + '</button>' : '') +
            ((j.status === 'locked' || j.status === 'rejected') ? '<button type="button" class="cv-action-btn" data-act="approved" data-id="' + j.id + '" title="Duyệt lại">' + I('check', 14) + '</button>' : '') +
            '<button type="button" class="cv-action-btn danger" data-del-admin-job="' + j.id + '" title="Xóa">' + I('trash', 14) + '</button>' +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminAllJobs();

    if (ajSearch) ajSearch.addEventListener('input', renderAdminAllJobs);
    window.addEventListener('storage', function (e) { if (/^hg_(new_jobs|job_status|job_deleted|user_status|categories|role_overrides)$/.test(e.key || '')) location.reload(); });
    var ajFilterTabs = $('admin-jobs-filter-tabs');
    if (ajFilterTabs) {
      ajFilterTabs.addEventListener('click', function(e) {
        var b = e.target.closest('[data-aj-filter]');
        if (b) {
          ajFilterTabs.querySelectorAll('.dash-pill').forEach(function(p){ p.classList.remove('active'); });
          b.classList.add('active');
          activeAjFilter = b.dataset.ajFilter;
          renderAdminAllJobs();
        }
      });
    }

    if (ajTableEl) {
      ajTableEl.addEventListener('click', function(e) {
        var delBtn = e.target.closest('[data-del-admin-job]');
        if (delBtn) {
          var jid = Number(delBtn.dataset.delAdminJob);
          HG.confirm({
            title: 'Xóa bài đăng tuyển dụng?',
            message: 'Bài đăng #' + jid + ' sẽ bị xóa khỏi toàn hệ thống.',
            confirmText: 'Xác nhận xóa',
            cancelText: 'Hủy bỏ',
            danger: true
          }).then(function(ok) {
            if (!ok) return;
            var dj = byId(JOBS, jid), ep = dj && byId(employer_profiles, dj.employer_id);
            HG.busy(delBtn, function () {
              if (!HG.deleteJob(jid)) { showToast('Không xóa được bài đăng.', 'error'); return; }
              if (ep) HG.notify(ep.user_id, 'Tin "' + dj.title + '" đã bị quản trị viên xóa khỏi hệ thống.', { link: 'employer.html?tab=2', kind: 'job' });
              renderAdminAllJobs(); drawModeration(); updateAdminStats();
              showToast('Đã xóa bài đăng #' + jid);
            }, 600);
          });
        }
      });
    }

    /* TAB 4: BÁO CÁO VI PHẠM */
    var repTableEl = $('admin-reports-table');
    function renderAdminReports() {
      if (!repTableEl) return;
      var RTYPE = { job: 'Tin tuyển dụng', employer: 'Doanh nghiệp', student: 'Sinh viên' };
      if (!reports.length) { repTableEl.innerHTML = HG.empty('shield', 'Chưa có báo cáo vi phạm nào', 'Các phản ánh từ người dùng sẽ hiển thị tại đây.'); return; }
      repTableEl.innerHTML = reports.map(function(r) {
        var isRes = r.status === 'resolved';
        return '<div class="table-row">' +
          '<span><b>' + (RTYPE[r.report_type] || r.report_type) + '</b><small>Mã #' + r.target_id + '</small></span>' +
          '<span>' + E(r.reason) + '</span>' +
          '<span>Đối tượng #' + r.target_id + '</span>' +
          '<span>' + HG.fmtDate(r.created_at) + '</span>' +
          '<span><i class="' + (isRes ? 'admin-badge-active' : 'admin-badge-locked') + '">' + (isRes ? 'Đã giải quyết' : 'Chờ xử lý') + '</i></span>' +
          '<span class="table-actions">' +
            (!isRes ? '<button type="button" class="cv-action-btn" data-resolve-rep="' + r.id + '">' + I('check', 14) + ' Xử lý</button>' : '<span style="color:#2ba788; font-size:12px;">Xong</span>') +
          '</span>' +
        '</div>';
      }).join('');
    }
    renderAdminReports();

    if (repTableEl) {
      repTableEl.addEventListener('click', function(e) {
        var rBtn = e.target.closest('[data-resolve-rep]');
        if (rBtn) {
          var rid = Number(rBtn.dataset.resolveRep);
          var targetRep = byId(reports, rid);
          if (targetRep) {
            HG.busy(rBtn, function () {
              HG.setReportStatus(rid, { status: 'resolved', admin_note: 'Quản trị viên đã xử lý phản ánh.' });
              renderAdminReports(); updateAdminStats();
              showToast('Đã xử lý xong báo cáo #' + rid);
            }, 600);
          }
        }
      });
    }

    document.addEventListener('hg:synced', function () {
      updateAdminStats();
      drawModeration();
      renderAdminStudents();
      renderAdminEmployers();
      renderAdminAllJobs();
      renderAdminReports();
    });
  }
})();
