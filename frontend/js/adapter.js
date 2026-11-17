/* =========================================================
   adapter.js – Lớp chuyển đổi dữ liệu (Data Mapper) kết nối
   trực tiếp giữa Frontend (mock-data schema) và Backend FastAPI.
   ========================================================= */
(function () {
  'use strict';
  var HG = window.HG;
  var COLORS = ['#665CF6', '#FF8EC7', '#4F7DFF', '#A78BFA', '#22B8A7', '#3156C8'];
  var TYPES = { 'part-time': 'Part-time', 'full-time': 'Toàn thời gian', 'internship': 'Thực tập' };
  var CACHE_KEY = 'hg_api_bootstrap_cache';

  HG.now = function () {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  HG.typeLabel = function (t) { return TYPES[t] || t; };
  HG.employerColor = function (id) { return COLORS[((id || 1) - 1) % COLORS.length]; };

  function replaceArray(target, source) {
    if (!Array.isArray(target) || !Array.isArray(source)) return;
    target.length = 0;
    source.forEach(function (item) { target.push(item); });
  }

  /* ── Data Mapper: chuẩn hóa dữ liệu từ Backend API về đúng schema của Frontend ── */
  function applyLocalOverlays() {
    /* 1. Tài khoản mới & mật khẩu đổi tại local */
    var pwo = HG.read('hg_pw_overrides', {});
    var roleOv = HG.read('hg_role_overrides', {});
    var us = HG.read('hg_user_status', {});
    users.forEach(function (u) {
      if (u.role === 'recruiter') u.role = 'employer';
      if (u.status === 'locked') u.status = 'blocked';
      if (pwo[u.id]) u.password = pwo[u.id];
      if (!u.password) u.password = '123456';
      if (roleOv[u.id]) {
        u.orig_role = roleOv[u.id].orig;
        u.role = roleOv[u.id].role;
        u.granted_by = roleOv[u.id].by;
      }
      if (us[u.id]) u.status = us[u.id];
    });

    /* 2. Hồ sơ doanh nghiệp & sinh viên */
    var ev = HG.read('hg_emp_verified', {});
    employer_profiles.forEach(function (ep) {
      if (ev[ep.id] != null) ep.verified = ev[ep.id];
      var savedEp = HG.read('hg_emp_profile_' + ep.user_id, null);
      if (savedEp) Object.assign(ep, savedEp);
    });
    student_profiles.forEach(function (sp) {
      var savedSp = HG.read('hg_profile_' + sp.user_id, null);
      if (savedSp) Object.assign(sp, savedSp);
    });

    /* 3. Tin tuyển dụng: ghép tin mới, overrides và kiểm tra hết hạn */
    var existingIds = {};
    jobs.forEach(function (j) {
      if (!j.employer_id && j.recruiter_id) j.employer_id = j.recruiter_id;
      j.salary_min = Number(j.salary_min || 0);
      j.salary_max = Number(j.salary_max || 0);
      existingIds[j.id] = true;
    });
    HG.read('hg_new_jobs', []).forEach(function (j) {
      if (!existingIds[j.id]) {
        jobs.push(j);
        existingIds[j.id] = true;
      }
    });
    var overrides = HG.read('hg_job_status', {});
    jobs.forEach(function (j) {
      if (overrides[j.id]) Object.assign(j, overrides[j.id]);
    });
    var deleted = HG.read('hg_job_deleted', []);
    for (var di = jobs.length - 1; di >= 0; di--) {
      if (deleted.indexOf(jobs[di].id) !== -1) jobs.splice(di, 1);
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    jobs.forEach(function (j) {
      if (j.status === 'approved' && j.end_date && new Date(j.end_date + 'T23:59:59') < today) {
        j.status = 'expired';
      }
    });

    /* 4. Báo cáo vi phạm */
    var rs = HG.read('hg_report_status', {});
    reports.forEach(function (r) {
      if (rs[r.id]) Object.assign(r, rs[r.id]);
    });

    /* 5. Cập nhật danh sách thẻ việc làm công khai window.HG_JOBS (giữ nguyên tham chiếu mảng) */
    var mappedJobs = jobs
      .filter(function (j) { return j.status === 'approved'; })
      .map(HG.toJob);
    if (Array.isArray(window.HG_JOBS)) {
      replaceArray(window.HG_JOBS, mappedJobs);
    } else {
      window.HG_JOBS = mappedJobs;
    }
  }

  function applyBootstrapPayload(data) {
    if (!data || !data.users) return;
    if (Array.isArray(data.users) && data.users.length) replaceArray(users, data.users);
    if (Array.isArray(data.student_profiles) && data.student_profiles.length) replaceArray(student_profiles, data.student_profiles);
    if (Array.isArray(data.employer_profiles) && data.employer_profiles.length) replaceArray(employer_profiles, data.employer_profiles);
    if (Array.isArray(data.admin_profiles) && data.admin_profiles.length) replaceArray(admin_profiles, data.admin_profiles);
    if (Array.isArray(data.job_categories) && data.job_categories.length) {
      var catStore = HG.read('hg_categories', null);
      replaceArray(job_categories, catStore && catStore.length ? catStore : data.job_categories);
    }
    if (Array.isArray(data.job_locations) && data.job_locations.length) replaceArray(job_locations, data.job_locations);
    if (Array.isArray(data.jobs) && data.jobs.length) replaceArray(jobs, data.jobs);
    if (Array.isArray(data.job_saves)) replaceArray(job_saves, data.job_saves);
    if (Array.isArray(data.application_statuses) && data.application_statuses.length) replaceArray(application_statuses, data.application_statuses);
    if (Array.isArray(data.cvs)) replaceArray(cvs, data.cvs);
    if (Array.isArray(data.applications)) replaceArray(applications, data.applications);
    if (Array.isArray(data.availabilities)) replaceArray(availabilities, data.availabilities);
    if (Array.isArray(data.schedules)) replaceArray(schedules, data.schedules);
    if (Array.isArray(data.reports)) replaceArray(reports, data.reports);
    applyLocalOverlays();
  }

  /* ── Định dạng Địa điểm & Mức lương cho Thẻ việc làm ── */
  HG.locationName = function (id) {
    var parts = [], l = job_locations.find(function (x) { return x.id === id; });
    while (l) {
      parts.push(l.name);
      l = l.parent_id ? job_locations.find(function (x) { return x.id === l.parent_id; }) : null;
    }
    return parts.join(', ') || 'Hà Nội';
  };

  function salary(j) {
    if (j.salary_text) return j.salary_text;
    var a = Number(j.salary_min || 0), b = Number(j.salary_max || a);
    if (!a && !b) return 'Thỏa thuận';
    return b >= 1e6 ? a / 1e6 + '–' + b / 1e6 + ' triệu' : a / 1e3 + '–' + b / 1e3 + 'K/giờ';
  }

  HG.toJob = function (j) {
    if (!j) j = jobs[0] || { id: 1, title: 'Việc làm', employer_id: 1, category_id: 1, location_id: 1, job_type: 'part-time', salary_min: 25000, salary_max: 30000, description: '' };
    var empId = j.employer_id || j.recruiter_id || 1;
    var e = employer_profiles.find(function (x) { return x.id === empId || x.user_id === empId; }) || { id: 1, company_name: 'Doanh nghiệp' };
    var c = job_categories.find(function (x) { return x.id === j.category_id; });
    return {
      id: j.id,
      title: j.title,
      company: e.company_name,
      location: j.location_text || HG.locationName(j.location_id),
      salary: salary(j),
      type: HG.typeLabel(j.job_type),
      logo: (e.company_name || 'C').charAt(0),
      color: COLORS[((e.id || empId) - 1) % COLORS.length],
      tags: [c ? c.name : 'Khác', HG.typeLabel(j.job_type)],
      desc: j.description,
      raw: j
    };
  };

  HG.jobSalary = function (j) {
    return j.salary_text || HG.formatSalaryRange(j.salary_min, j.salary_max);
  };

  /* ── Khởi tạo ngay lập tức từ bộ nhớ đệm Backend (nếu có) ── */
  var cachedBootstrap = HG.read(CACHE_KEY, null);
  if (cachedBootstrap && cachedBootstrap.users) {
    applyBootstrapPayload(cachedBootstrap);
  } else {
    applyLocalOverlays();
  }

  /* ── Đồng bộ trực tiếp với Backend FastAPI ── */
  HG.syncFromBackend = function () {
    if (!window.HGApi) return Promise.resolve(null);
    return window.HGApi.bootstrap()
      .then(function (data) {
        if (data && data.users) {
          HG.write(CACHE_KEY, data);
          applyBootstrapPayload(data);
          var catInput = document.getElementById('cat-search-input');
          if (catInput) {
            catInput.dispatchEvent(new Event('input'));
          }
          document.dispatchEvent(new CustomEvent('hg:synced', { detail: data }));
        }
        return data;
      })
      .catch(function () {
        return null;
      });
  };

  /* ── Các hàm thao tác dữ liệu có đồng bộ REST API tới Backend ── */
  function resolveLocationId(locationText) {
    var txt = String(locationText || '').toLowerCase();
    var found = job_locations.find(function (loc) {
      return txt.indexOf(loc.name.toLowerCase()) !== -1;
    });
    return found ? found.id : (job_locations[0] ? job_locations[0].id : 1);
  }

  HG.addJob = function (j) {
    if (window.HGValidate) {
      var titleErr = window.HGValidate.check(j && j.title, 'required|min:5', { label: 'tiêu đề công việc' });
      if (titleErr) {
        if (HG.toast) HG.toast(titleErr, 'error');
        return false;
      }
      var descErr = window.HGValidate.check(j && j.description, 'required|min:10', { label: 'mô tả công việc' });
      if (descErr) {
        if (HG.toast) HG.toast(descErr, 'error');
        return false;
      }
    }

    var l = HG.read('hg_new_jobs', []);
    l.push(j);
    if (HG.write('hg_new_jobs', l) === false) return false;
    jobs.push(j);
    window.HG_JOBS = jobs.filter(function (x) { return x.status === 'approved'; }).map(HG.toJob);

    var ep = employer_profiles.find(function (x) { return x.id === j.employer_id; });
    if (ep && HG.notify) {
      var empMsg = j.status === 'draft'
        ? 'Đã lưu nháp tin tuyển dụng "' + j.title + '".'
        : 'Đã tạo tin tuyển dụng "' + j.title + '" và gửi chờ kiểm duyệt.';
      HG.notify(ep.user_id, empMsg, { link: 'employer.html?tab=2', kind: 'job' });
    }
    if (j.status !== 'draft' && HG.notify) {
      HG.notify(6, 'Tin tuyển dụng mới "' + j.title + '" vừa được gửi chờ duyệt.', { link: 'admin.html?tab=1', kind: 'job' });
    }

    if (window.HGApi && j.status !== 'draft') {
      var payload = {
        recruiter_id: j.employer_id || 1,
        category_id: j.category_id || 1,
        location_id: j.location_id || resolveLocationId(j.location_text),
        title: j.title,
        description: j.description && j.description.length >= 10 ? j.description : (j.description || '') + ' - Tuyển dụng sinh viên part-time.',
        requirements: j.requirements || '',
        salary_min: Number(j.salary_min || 0),
        salary_max: Number(j.salary_max || j.salary_min || 0),
        job_type: j.job_type || 'part-time',
        work_time: j.work_time || 'Linh hoạt',
        quantity: Number(j.quantity || 1),
        experience_level: j.experience_level || 'Không yêu cầu',
        benefits: j.benefits || 'Đầy đủ đãi ngộ',
        end_date: j.end_date || null,
        status: j.status === 'approved' ? 'approved' : 'pending'
      };
      window.HGApi.createJob(payload)
        .then(function (res) {
          if (res && res.job && res.job.id) {
            j.id = res.job.id;
            HG.write('hg_new_jobs', l);
            HG.syncFromBackend();
          }
        })
        .catch(function (err) {
          if (err && err.status && err.status >= 400 && HG.toast) {
            HG.toast(err.message || 'Không thể lưu tin tuyển dụng lên máy chủ.', 'error');
          }
        });
    }
    return true;
  };

  HG.updateJob = function (id, patch) {
    var j = jobs.find(function (x) { return x.id === id; });
    if (!j) return false;
    patch = Object.assign({}, patch, { updated_at: HG.now() });
    var overrides = HG.read('hg_job_status', {});
    overrides[id] = Object.assign(overrides[id] || {}, patch);
    if (HG.write('hg_job_status', overrides) === false) return false;
    Object.assign(j, patch);
    window.HG_JOBS = jobs.filter(function (x) { return x.status === 'approved'; }).map(HG.toJob);

    if (window.HGApi) {
      var apiPatch = {};
      ['category_id', 'location_id', 'title', 'description', 'requirements', 'salary_min', 'salary_max', 'job_type', 'work_time', 'quantity', 'experience_level', 'benefits', 'end_date'].forEach(function (k) {
        if (patch[k] !== undefined && patch[k] !== null && patch[k] !== '') {
          apiPatch[k] = patch[k];
        }
      });
      if (Object.keys(apiPatch).length) {
        window.HGApi.updateJob(id, apiPatch).catch(function () {});
      }
    }
    return true;
  };

  HG.setJobStatus = function (id, status, reason) {
    var ok = HG.updateJob(id, {
      status: status,
      approved_by: status === 'approved' ? (HG.user() ? HG.user().id : 6) : null,
      approved_at: status === 'approved' ? HG.now() : null,
      rejected_reason: (status === 'rejected' || status === 'locked') ? (reason || 'Không đáp ứng tiêu chí đăng tin.') : null
    });
    var j = jobs.find(function (x) { return x.id === id; });
    var ep = j && employer_profiles.find(function (x) { return x.id === j.employer_id; });
    if (ok && ep && HG.notify) {
      var msg = {
        approved: 'Tin "' + j.title + '" đã được duyệt và hiển thị công khai.',
        rejected: 'Tin "' + j.title + '" bị từ chối. Lý do: ' + (reason || 'Không đáp ứng tiêu chí đăng tin.'),
        locked: 'Tin "' + j.title + '" đã bị khóa. Lý do: ' + (reason || '—')
      }[status];
      if (msg) HG.notify(ep.user_id, msg, { link: 'employer.html?tab=2', kind: 'job' });
    }
    if (ok && window.HGApi) {
      var apiStatus = status === 'locked' ? 'closed' : (status === 'approved' ? 'approved' : 'rejected');
      window.HGApi.reviewJob(id, apiStatus, 1, reason || null).catch(function () {});
    }
    return ok;
  };

  HG.deleteJob = function (id) {
    var i = jobs.findIndex(function (x) { return x.id === id; });
    if (i === -1) return false;
    var del = HG.read('hg_job_deleted', []);
    if (del.indexOf(id) === -1) del.push(id);
    if (HG.write('hg_job_deleted', del) === false) return false;
    jobs.splice(i, 1);
    window.HG_JOBS = jobs.filter(function (x) { return x.status === 'approved'; }).map(HG.toJob);
    if (window.HGApi) {
      window.HGApi.deleteJob(id, 'Xóa tin tuyển dụng', true).catch(function () {});
    }
    return true;
  };

  /* ── Nâng cấp các hàm Auth, Lưu việc, Ứng tuyển & Admin trong HG để gọi API thật ── */
  var origLogin = HG.login;
  HG.login = function (email, password, role) {
    var res = origLogin(email, password, role);
    if (!res.error && window.HGApi) {
      window.HGApi.login(email, password).catch(function () {});
    }
    return res;
  };

  var origRegister = HG.register;
  HG.register = function (d) {
    var res = origRegister(d);
    if (!res.error && window.HGApi) {
      window.HGApi.register({
        full_name: d.full_name,
        email: d.email,
        password: d.password,
        phone: d.phone,
        role: d.role,
        university: d.university || null,
        company_name: d.company_name || null
      })
        .then(function () { HG.syncFromBackend(); })
        .catch(function () {});
    }
    return res;
  };

  var origLogout = HG.logout;
  HG.logout = function () {
    if (window.HGApi) window.HGApi.clearTokens();
    return origLogout();
  };

  var origToggleSaved = HG.toggleSaved;
  HG.toggleSaved = function (jobId) {
    var nowSaved = origToggleSaved(jobId);
    var u = HG.user(), sid = u && u.role === 'student' ? HG.studentId(u) : null;
    if (sid && window.HGApi) {
      window.HGApi.toggleSaveJob(sid, jobId).catch(function () {});
    }
    return nowSaved;
  };

  var origApply = HG.apply;
  HG.apply = function (jobId, cvId, cover) {
    var res = origApply(jobId, cvId, cover);
    if (res && res.ok) {
      var u = HG.user(), sid = u ? HG.studentId(u) : 1;
      var jobObj = jobs.find(function (x) { return x.id === jobId; });
      if (u && jobObj && HG.notify) {
        HG.notify(u.id, 'Bạn đã gửi hồ sơ ứng tuyển vị trí "' + jobObj.title + '" thành công.', { link: 'student.html?tab=0', kind: 'app' });
      }
      if (window.HGApi) {
        window.HGApi.applyJob({
          student_id: sid || 1,
          job_id: jobId,
          cv_id: cvId || null,
          cv_url: cvId ? null : '/uploads/sample_cv_tai.pdf',
          cover_letter: cover || ''
        })
          .then(function () { HG.syncFromBackend(); })
          .catch(function (err) {
            if (err && err.status && err.status >= 400 && HG.toast) {
              HG.toast(err.message || 'Không thể gửi đơn ứng tuyển lên máy chủ.', 'error');
            }
          });
      }
    }
    return res;
  };

  var STATUS_ID_TO_NAME = {
    1: 'submitted',
    2: 'reviewing',
    3: 'interview',
    4: 'accepted',
    5: 'rejected',
    6: 'withdrawn'
  };
  var origSetAppStatus = HG.setAppStatus;
  HG.setAppStatus = function (appId, statusId, meta) {
    var ok = origSetAppStatus(appId, statusId, meta);
    if (ok && window.HGApi && STATUS_ID_TO_NAME[statusId]) {
      var u = HG.user();
      var note = (meta && (meta.reason || meta.interview_at)) || ('Cập nhật trạng thái: ' + STATUS_ID_TO_NAME[statusId]);
      window.HGApi.updateApplicationStatus(appId, STATUS_ID_TO_NAME[statusId], note, u ? u.id : null).catch(function () {});
    }
    return ok;
  };

  var origSetUserStatus = HG.setUserStatus;
  HG.setUserStatus = function (uid, status) {
    var ok = origSetUserStatus(uid, status);
    if (ok && window.HGApi) {
      window.HGApi.setUserStatus(uid, status === 'blocked' ? 'locked' : 'active').catch(function () {});
    }
    return ok;
  };

  var origSetRole = HG.setRole;
  HG.setRole = function (uid, role) {
    var ok = origSetRole(uid, role);
    if (ok && window.HGApi) {
      var target = users.find(function (x) { return x.id === uid; });
      window.HGApi.setUserRole(uid, target ? target.role : role).catch(function () {});
    }
    return ok;
  };

  var origSetEmpVerified = HG.setEmpVerified;
  HG.setEmpVerified = function (epid, verified) {
    var ok = origSetEmpVerified(epid, verified);
    if (ok && window.HGApi) {
      window.HGApi.verifyEmployer(epid, verified).catch(function () {});
    }
    return ok;
  };

  var origSetReportStatus = HG.setReportStatus;
  HG.setReportStatus = function (reportId, patch) {
    var ok = origSetReportStatus(reportId, patch);
    if (ok && window.HGApi && patch && patch.status) {
      window.HGApi.resolveReport(reportId, patch.status, patch.admin_note || 'Quản trị viên đã xử lý phản ánh.', false).catch(function () {});
    }
    return ok;
  };

  /* Kích hoạt đồng bộ dữ liệu thật từ Backend ngay khi nạp trang */
  HG.syncFromBackend();
})();
