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

  /* ── Chuẩn hóa tiếng Việt & So khớp văn bản thông minh (không dấu/có dấu, case-insensitive) ── */
  HG.removeVietnameseTones = function (str) {
    if (!str) return '';
    str = String(str);
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
    str = str.replace(/Đ/g, 'D');
    str = str.replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '');
    str = str.replace(/[\u02C6\u0306\u031B]/g, '');
    return str;
  };

  HG.matchText = function (source, query) {
    if (!query) return true;
    if (!source) return false;
    var s = String(source).toLowerCase();
    var q = String(query).trim().toLowerCase();
    if (s.indexOf(q) !== -1) return true;
    var sNorm = HG.removeVietnameseTones(s);
    var qNorm = HG.removeVietnameseTones(q);
    return sNorm.indexOf(qNorm) !== -1;
  };

  function replaceArray(target, source) {
    if (!Array.isArray(target) || !Array.isArray(source)) return;
    target.length = 0;
    source.forEach(function (item) { target.push(item); });
  }

  /* ── Đánh giá uy tín (reviews): dữ liệu thật từ /api/bootstrap, không có mock ── */
  var reviewsStore = [];
  HG.reviews = function () { return reviewsStore; };

  /* [ST4-04] Dọn dữ liệu giả cũ: hồ sơ & trạng thái khiếu nại trước đây lưu ở localStorage
     (hg_profile_*, hg_emp_profile_*, hg_cvs_*, hg_report_status). Nay chỉ còn nguồn dữ liệu duy nhất là Backend. */
  (function purgeLegacyMockKeys() {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('hg_profile_') === 0 || k.indexOf('hg_emp_profile_') === 0 || k.indexOf('hg_cvs_') === 0 || k === 'hg_report_status')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}
  })();

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

    /* 2. Hồ sơ doanh nghiệp & sinh viên: lấy trực tiếp từ Backend (không còn ghi đè từ localStorage) */
    var ev = HG.read('hg_emp_verified', {});
    employer_profiles.forEach(function (ep) {
      if (ev[ep.id] != null) ep.verified = ev[ep.id];
    });

    /* 3. Tin tuyển dụng: ghép tin mới, overrides và kiểm tra hết hạn */
    var existingIds = {};
    jobs.forEach(function (j) {
      if (!j.employer_id && j.recruiter_id) j.employer_id = j.recruiter_id;
      j.salary_min = Number(j.salary_min || 0);
      j.salary_max = Number(j.salary_max || 0);
      /* Chuẩn hóa image_url: đảm bảo luôn là URL đầy đủ hoặc null */
      if (j.image_url && j.image_url.indexOf('data:') === 0) j.image_url = null;
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

    /* 5. Cập nhật danh sách thẻ việc làm công khai window.HG_JOBS (giữ nguyên tham chiếu mảng) */
    refreshPublicJobs();
  }

  /* Dựng lại window.HG_JOBS (thẻ việc làm công khai) – luôn giữ nguyên tham chiếu mảng để
     các trang đang giữ biến trỏ tới HG_JOBS (home/jobs/detail) không bị lệch dữ liệu */
  function refreshPublicJobs() {
    var mappedJobs = jobs
      .filter(function (j) { return j && j.status === 'approved'; })
      .map(HG.toJob);
    if (Array.isArray(window.HG_JOBS)) {
      replaceArray(window.HG_JOBS, mappedJobs);
    } else {
      window.HG_JOBS = mappedJobs;
    }
  }

  /* Payload hợp lệ = object có mảng users (Backend luôn trả về bảng users) */
  function isBootstrapPayload(data) {
    return !!data && typeof data === 'object' && Array.isArray(data.users);
  }

  /* Dữ liệu từ Backend là nguồn DUY NHẤT: bảng nào Backend trả về (kể cả mảng rỗng) đều thay
     hoàn toàn dữ liệu mẫu trong mock-data.js – tránh hiện việc làm/khiếu nại giả khi DB đang trống.
     Riêng application_statuses là bảng tham chiếu cố định: chỉ thay khi Backend có dữ liệu. */
  function applyBootstrapPayload(data) {
    if (!isBootstrapPayload(data)) return;
    var TABLES = {
      users: users, student_profiles: student_profiles, employer_profiles: employer_profiles,
      admin_profiles: admin_profiles, job_categories: job_categories, job_locations: job_locations,
      jobs: jobs, job_saves: job_saves, cvs: cvs, applications: applications,
      application_status_logs: application_status_logs,
      availabilities: availabilities, schedules: schedules, reports: reports, reviews: reviewsStore
    };
    Object.keys(TABLES).forEach(function (k) {
      if (Array.isArray(data[k])) replaceArray(TABLES[k], data[k].filter(function (row) { return row && typeof row === 'object'; }));
    });
    if (Array.isArray(data.application_statuses) && data.application_statuses.length) replaceArray(application_statuses, data.application_statuses);
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

  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }

  function salary(j) {
    if (j.salary_text) return HG.translateSalaryText ? HG.translateSalaryText(j.salary_text) : j.salary_text;
    var a = Number(j.salary_min || 0), b = Number(j.salary_max || a);
    if (!a && !b) return tr('common.Negotiable', 'Thỏa thuận');
    var m = b >= 1e6;
    var u = m ? 1e6 : 1e3;
    var suffix = m ? tr('common.unit_m_short', ' triệu') : tr('common.unit_k_hour', 'K/giờ');
    var f = function (v) { return +(v / u).toFixed(2); };
    return (a === b ? f(a) : f(a) + '–' + f(b)) + suffix;
  }

  /* ── URL file upload (ảnh tin tuyển dụng, CV) ──
     Backend lưu file trong backend/uploads và phục vụ tại <API_BASE>/uploads/...
     - DB nên lưu đường dẫn tương đối "/uploads/..." để không phụ thuộc host/port.
     - Khi hiển thị, luôn ghép với Base URL hiện tại của API (localStorage hg_api_base). */
  var LOCAL_API_HOST = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?(?=\/)/i;
  function apiBaseUrl() {
    return window.HGApi && typeof window.HGApi.getBaseUrl === 'function' ? window.HGApi.getBaseUrl() : 'http://127.0.0.1:8000';
  }
  /* Chuẩn hóa về dạng lưu DB: URL tuyệt đối của chính backend cục bộ -> "/uploads/..." */
  HG.toStoredUploadUrl = function (url) {
    if (!url || typeof url !== 'string') return null;
    var u = url.trim();
    if (!u || u.indexOf('data:') === 0 || u.indexOf('blob:') === 0) return null;
    if (u.indexOf('uploads/') === 0) return '/' + u;
    var base = apiBaseUrl();
    if (u.indexOf(base + '/uploads/') === 0) return u.slice(base.length);
    var m = u.match(LOCAL_API_HOST);
    if (m) {
      var path = u.slice(m[0].length);
      if (path.indexOf('/uploads/') === 0) return path;
    }
    return u;
  };
  /* Chuyển URL lưu trong DB thành URL hiển thị được trên trình duyệt ('' nếu không hợp lệ) */
  HG.resolveUploadUrl = function (url) {
    if (!url || typeof url !== 'string') return '';
    var u = url.trim();
    if (!u) return '';
    if (u.indexOf('data:image/') === 0 || u.indexOf('blob:') === 0) return u;
    var stored = HG.toStoredUploadUrl(u);
    if (stored && stored.indexOf('/uploads/') === 0) return apiBaseUrl() + stored;
    if (/^https?:\/\//i.test(u)) return u;
    return '';   /* giá trị rác (vd: "string" từ Swagger) -> không hiển thị ảnh hỏng */
  };
  HG.resolveImageUrl = HG.resolveUploadUrl;
  HG.resolveFileUrl = HG.resolveUploadUrl;

  HG.toJob = function (j) {
    if (!j) j = jobs[0] || { id: 1, title: 'Việc làm', employer_id: 1, category_id: 1, location_id: 1, job_type: 'part-time', salary_min: 25000, salary_max: 30000, description: '' };
    var empId = j.employer_id || j.recruiter_id || 1;
    var e = employer_profiles.find(function (x) { return x.id === empId || x.user_id === empId; }) || { id: 1, company_name: 'Doanh nghiệp' };
    var c = job_categories.find(function (x) { return x.id === j.category_id; });
    var imgUrl = HG.resolveImageUrl(j.image_url);
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
      image_url: imgUrl,
      logo_url: e.logo_url || '',
      raw: j
    };
  };

  HG.jobSalary = function (j) {
    if (j && j.salary_text) return HG.translateSalaryText ? HG.translateSalaryText(j.salary_text) : j.salary_text;
    return HG.formatSalaryRange(j ? j.salary_min : 0, j ? j.salary_max : 0);
  };

  /* Khi người dùng chuyển đổi ngôn ngữ VI <-> EN, dựng lại mức lương hiển thị trong window.HG_JOBS */
  window.addEventListener('languageChanged', function () {
    refreshPublicJobs();
  });

  /* [ST4-04] Khiếu nại chỉ lấy từ Backend: bỏ 2 bản ghi mẫu khai báo trong mock-data.js */
  replaceArray(reports, []);

  /* ── Khởi tạo ngay lập tức từ bộ nhớ đệm Backend (nếu có) ──
     HG.dataSource cho biết dữ liệu đang hiển thị lấy từ đâu:
       'api'   – vừa đồng bộ thành công với Backend
       'cache' – bản sao lần đồng bộ gần nhất (Backend chưa trả lời / đang tắt)
       'mock'  – dữ liệu mẫu trong mock-data.js (chưa từng kết nối được Backend) */
  var cachedBootstrap = HG.read(CACHE_KEY, null);
  if (isBootstrapPayload(cachedBootstrap)) {
    applyBootstrapPayload(cachedBootstrap);
    HG.dataSource = 'cache';
  } else {
    if (cachedBootstrap) { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }
    applyLocalOverlays();
    HG.dataSource = 'mock';
  }
  HG.syncState = 'pending';   /* 'pending' | 'live' | 'offline' */

  /* =========================================================
     HẠ TẦNG GỌI API THẬT
     - Mọi thao tác ghi (nộp CV, đăng/sửa tin, duyệt hồ sơ, duyệt tin, quản trị)
       đều gọi REST API Backend; dữ liệu hiển thị luôn lấy lại từ /api/bootstrap.
     - Localstorage chỉ còn là lớp "lạc quan" tạm thời (optimistic) và bản nháp tin.
       Khi API trả lỗi nghiệp vụ (4xx/5xx) giao diện được hoàn tác về dữ liệu thật.
     ========================================================= */
  var DRAFT_BASE = 900000; /* id cục bộ của tin nháp (backend không có trạng thái draft) */
  var OVERLAY_KEYS = [
    'hg_new_jobs', 'hg_job_status', 'hg_job_deleted', 'hg_apps', 'hg_app_patches',
    'hg_emp_verified', 'hg_user_status', 'hg_role_overrides', 'hg_categories'
  ];
  var inflight = 0;
  HG.apiLive = false;
  HG.pendingRequests = function () { return inflight; };

  function track(p) {
    inflight++;
    return p.then(function (r) { inflight--; return r; }, function (e) { inflight--; throw e; });
  }

  function isDraftId(id) { return Number(id) >= DRAFT_BASE; }

  function nextDraftId() {
    var m = DRAFT_BASE;
    jobs.forEach(function (j) { if (j.id >= m) m = j.id + 1; });
    return m;
  }

  /* Xóa lớp dữ liệu cục bộ đã được Backend xác nhận; chỉ giữ lại tin nháp */
  function clearOverlays() {
    var drafts = HG.read('hg_new_jobs', []).filter(function (j) { return isDraftId(j.id) && j.status === 'draft'; });
    var jobOv = HG.read('hg_job_status', {}), keepOv = {};
    drafts.forEach(function (d) { if (jobOv[d.id]) keepOv[d.id] = jobOv[d.id]; });
    OVERLAY_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    if (drafts.length) { HG.write('hg_new_jobs', drafts); HG.write('hg_job_status', keepOv); }
  }
  HG.clearOverlays = clearOverlays;

  /* ── Đồng bộ trực tiếp với Backend FastAPI ── */
  /* Không kết nối được Backend: báo 1 lần/phiên để người dùng biết dữ liệu đang xem có thể chưa mới */
  function markOffline(reason) {
    HG.syncState = 'offline';
    if (HG.apiLive) return;   /* đã từng đồng bộ thành công trong phiên này: giữ dữ liệu hiện tại */
    document.dispatchEvent(new CustomEvent('hg:offline', { detail: { source: HG.dataSource, reason: reason || '' } }));
    var flagKey = 'hg_offline_notice_' + HG.dataSource;
    var shown = false;
    try { shown = sessionStorage.getItem(flagKey) === '1'; sessionStorage.setItem(flagKey, '1'); } catch (e) {}
    if (window.console) console.warn('[HourGlass] Không kết nối được Backend (' + apiBaseUrl() + ') – đang dùng ' + (HG.dataSource === 'cache' ? 'dữ liệu đồng bộ lần trước.' : 'dữ liệu mẫu (mock-data.js).'));
    if (!shown && HG.toast && /\.html$|\/$/.test(location.pathname) && !/auth\.html$/.test(location.pathname)) {
      setTimeout(function () {
        HG.toast(HG.dataSource === 'cache'
          ? tr('common.offline_cache_toast', 'Mất kết nối máy chủ – đang hiển thị dữ liệu đồng bộ gần nhất.')
          : tr('common.offline_mock_toast', 'Chưa kết nối được máy chủ – đang hiển thị dữ liệu mẫu.'), 'info');
      }, 600);
    }
  }

  var firstSync = null;
  HG.syncFromBackend = function () {
    if (!window.HGApi) { markOffline('no-api-module'); return Promise.resolve(null); }
    return window.HGApi.bootstrap()
      .then(function (data) {
        if (!isBootstrapPayload(data)) { markOffline('invalid-payload'); return null; }
        HG.apiLive = true;
        HG.syncState = 'live';
        HG.dataSource = 'api';
        if (inflight === 0) clearOverlays();
        HG.write(CACHE_KEY, data);
        applyBootstrapPayload(data);
        var catInput = document.getElementById('cat-search-input');
        if (catInput) {
          catInput.dispatchEvent(new Event('input'));
        }
        document.dispatchEvent(new CustomEvent('hg:synced', { detail: data }));
        return data;
      })
      .catch(function (err) {
        markOffline(err && err.message);
        return null;
      });
  };
  /* Promise hoàn tất sau lần đồng bộ ĐẦU TIÊN (thành công hay thất bại) – dùng khi trang cần biết
     dữ liệu hiện tại đã "chốt" hay chưa (vd. báo "Không tìm thấy tin" thay vì hiện nhầm tin khác). */
  HG.ready = function () { return firstSync || Promise.resolve(null); };

  /* Chạy một request ghi: thành công -> đồng bộ lại; lỗi nghiệp vụ -> hoàn tác giao diện */
  HG.remote = function (promise) {
    return track(promise)
      .then(function (r) {
        return HG.syncFromBackend().then(function () { return r; });
      })
      .catch(function (err) {
        if (err && err.status) {
          clearOverlays();
          return HG.syncFromBackend().then(function () { return null; });
        }
        return null; /* mất kết nối: giữ thay đổi cục bộ, sẽ đồng bộ lại khi API hoạt động */
      });
  };

  /* ── KPI thật từ API ── */
  HG.loadEmployerKpi = function (employerProfileId) {
    if (!window.HGApi || !employerProfileId) return Promise.resolve(null);
    return window.HGApi.get('/api/employer/' + employerProfileId + '/statistics', null, { silentError: true })
      .then(function (r) { return (r && r.statistics) || null; })
      .catch(function () { return null; });
  };
  HG.loadAdminKpi = function () {
    if (!window.HGApi) return Promise.resolve(null);
    return window.HGApi.get('/api/admin/statistics', null, { silentError: true })
      .then(function (r) { return (r && r.statistics) || null; })
      .catch(function () { return null; });
  };

  /* ── Tin tuyển dụng ── */
  function resolveLocationId(locationText) {
    var txt = String(locationText || '').toLowerCase();
    var found = job_locations.find(function (loc) {
      return txt.indexOf(loc.name.toLowerCase()) !== -1;
    });
    return found ? found.id : (job_locations[0] ? job_locations[0].id : 1);
  }

  function adminProfileId() {
    var u = HG.user();
    var ap = u && admin_profiles.find(function (x) { return x.user_id === u.id; });
    return ap ? ap.id : 1;
  }

  function buildJobPayload(j, forUpdate) {
    var desc = j.description || '';
    if (desc.length < 10) desc += ' - Tuyển dụng sinh viên part-time.';
    var p = {
      category_id: j.category_id || 1,
      location_id: j.location_id || resolveLocationId(j.location_text),
      title: j.title,
      description: desc,
      requirements: j.requirements || '',
      salary_min: Number(j.salary_min || 0),
      salary_max: Number(j.salary_max || j.salary_min || 0),
      job_type: j.job_type || 'part-time',
      work_time: j.work_time || 'Linh hoạt',
      quantity: Number(j.quantity || 1),
      experience_level: j.experience_level || 'Không yêu cầu',
      benefits: j.benefits || 'Đầy đủ đãi ngộ',
      end_date: j.end_date || null,
      image_url: HG.toStoredUploadUrl(j.image_url)   /* lưu "/uploads/jobs/..." thay vì URL tuyệt đối */
    };
    if (forUpdate) {
      p.status = 'pending'; /* sửa tin => gửi kiểm duyệt lại */
      Object.keys(p).forEach(function (k) { if (p[k] === null || p[k] === '') delete p[k]; });
    } else {
      p.recruiter_id = j.employer_id || j.recruiter_id;
      p.status = 'pending';
    }
    return p;
  }

  /* Ghi cục bộ thuần túy (chỉ dùng cho tin nháp) */
  HG.addJob = function (j) {
    if (window.HGValidate) {
      var titleErr = window.HGValidate.check(j && j.title, 'required|min:5', { label: 'tiêu đề công việc' });
      if (titleErr) {
        if (HG.toast) HG.toast(titleErr, 'error');
        return false;
      }
    }
    var l = HG.read('hg_new_jobs', []);
    l.push(j);
    if (HG.write('hg_new_jobs', l) === false) return false;
    jobs.push(j);
    refreshPublicJobs();
    var ep = employer_profiles.find(function (x) { return x.id === j.employer_id; });
    if (ep && HG.notify && j.status === 'draft') {
      HG.notify(ep.user_id, 'Đã lưu nháp tin tuyển dụng "' + j.title + '".', { link: 'employer.html?tab=2', kind: 'job' });
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
    refreshPublicJobs();
    return true;
  };

  /* Tạo / sửa tin: lưu nháp ở trình duyệt, gửi duyệt thì gọi API thật.
     Trả về Promise<{ ok:true, job } | { error: 'thông báo' }> */
  HG.saveJob = function (fields, editId) {
    var existing = editId ? jobs.find(function (x) { return x.id === editId; }) : null;
    var existingIsDraft = !!existing && isDraftId(existing.id);

    if (fields.status === 'draft') {
      if (editId) return Promise.resolve({ ok: HG.updateJob(editId, fields) });
      var base = {
        id: nextDraftId(), approved_by: null, approved_at: null, experience_level: 'Không yêu cầu',
        benefits: 'Đầy đủ đãi ngộ', start_date: '', created_at: HG.now(), updated_at: HG.now()
      };
      return Promise.resolve({ ok: HG.addJob(Object.assign(base, fields)) });
    }
    if (!window.HGApi) return Promise.resolve({ error: 'Chưa nạp được module API.' });

    var merged = Object.assign({}, existing || {}, fields);
    if (!merged.employer_id && !merged.recruiter_id) {
      return Promise.resolve({ error: 'Tài khoản chưa có hồ sơ doanh nghiệp trên hệ thống – không thể đăng tin. Hãy liên hệ quản trị viên.' });
    }
    var isUpdate = !!editId && !existingIsDraft;
    var payload = buildJobPayload(merged, isUpdate);
    var req = isUpdate
      ? window.HGApi.request('PATCH', '/api/jobs/' + editId, payload, { silentError: true })
      : window.HGApi.request('POST', '/api/jobs', payload, { silentError: true });

    return track(req)
      .then(function (res) {
        if (existingIsDraft) {
          var drafts = HG.read('hg_new_jobs', []).filter(function (x) { return x.id !== editId; });
          HG.write('hg_new_jobs', drafts);
          var ov = HG.read('hg_job_status', {}); delete ov[editId]; HG.write('hg_job_status', ov);
          var di = jobs.findIndex(function (x) { return x.id === editId; });
          if (di !== -1) jobs.splice(di, 1);
        }
        var ep = employer_profiles.find(function (x) { return x.id === merged.employer_id; });
        if (HG.notify) {
          if (ep) HG.notify(ep.user_id, 'Tin "' + merged.title + '" đã được gửi chờ kiểm duyệt.', { link: 'employer.html?tab=2', kind: 'job' });
          HG.notify(6, 'Tin tuyển dụng "' + merged.title + '" vừa được gửi chờ duyệt.', { link: 'admin.html?tab=5', kind: 'job' });
        }
        return HG.syncFromBackend().then(function () { return { ok: true, job: res && res.job }; });
      })
      .catch(function (err) {
        if (err && err.status) return { error: err.message || 'Máy chủ từ chối lưu tin tuyển dụng.' };
        return { error: (err && err.network && err.message) || 'Không kết nối được máy chủ API (' + apiBaseUrl() + '). Hãy bật backend rồi thử lại.' };
      });
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
      HG.remote(window.HGApi.reviewJob(id, apiStatus, adminProfileId(), reason || null));
    }
    return ok;
  };

  /* Gửi duyệt tin nháp / tin bị từ chối (Promise) */
  HG.submitJobForReview = function (id) {
    var j = jobs.find(function (x) { return x.id === id; });
    if (!j) return Promise.resolve({ error: 'Không tìm thấy tin tuyển dụng.' });
    return HG.saveJob(Object.assign({}, j, { status: 'pending', rejected_reason: null }), id);
  };

  HG.deleteJob = function (id) {
    var i = jobs.findIndex(function (x) { return x.id === id; });
    if (i === -1) return false;
    if (isDraftId(id)) {
      HG.write('hg_new_jobs', HG.read('hg_new_jobs', []).filter(function (x) { return x.id !== id; }));
      jobs.splice(i, 1);
      refreshPublicJobs();
      return true;
    }
    var del = HG.read('hg_job_deleted', []);
    if (del.indexOf(id) === -1) del.push(id);
    if (HG.write('hg_job_deleted', del) === false) return false;
    jobs.splice(i, 1);
    refreshPublicJobs();
    if (window.HGApi) {
      HG.remote(window.HGApi.deleteJob(id, 'Xóa tin tuyển dụng', true));
    }
    return true;
  };

  /* ── Upload ảnh công việc lên Backend – trả về Promise<string|null> (URL hoặc null) ── */
  HG.uploadJobImage = function (file) {
    if (!file || !window.HGApi) return Promise.resolve(null);
    return window.HGApi.uploadJobImage(file)
      .then(function (res) {
        if (res && (res.relative_url || res.image_url || res.url)) {
          return HG.toStoredUploadUrl(res.relative_url || res.image_url || res.url);
        }
        return null;
      })
      .catch(function () { return null; });
  };

  /* ── Auth ── */
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
      track(window.HGApi.toggleSaveJob(sid, jobId)).catch(function () {});
    }
    return nowSaved;
  };

  /* ── Nộp CV / ứng tuyển bằng API thật ──
     opts: { cvId, cover, file }  →  Promise<{ ok:true, application } | { error }> */
  HG.applyRemote = function (jobId, opts) {
    opts = opts || {};
    var u = HG.user();
    if (!u || u.role !== 'student') return Promise.resolve({ error: 'Cần đăng nhập tài khoản sinh viên.' });
    var sid = HG.studentId(u);
    if (!sid) return Promise.resolve({ error: 'Không tìm thấy hồ sơ sinh viên của tài khoản này.' });
    if (!window.HGApi) return Promise.resolve({ error: 'Chưa nạp được module API.' });
    if (!opts.file && !opts.cvId) return Promise.resolve({ error: 'Vui lòng chọn một CV hoặc tải lên file CV (.pdf, .doc, .docx).' });

    var req;
    if (opts.file) {
      var fd = new FormData();
      fd.append('job_id', String(jobId));
      fd.append('student_id', String(sid));
      fd.append('cv_file', opts.file);
      if (opts.cover) fd.append('cover_letter', opts.cover);
      req = window.HGApi.request('POST', '/api/applications', fd, { silentError: true });
    } else {
      req = window.HGApi.request('POST', '/api/applications/json', {
        student_id: sid, job_id: jobId, cv_id: opts.cvId, cover_letter: opts.cover || ''
      }, { silentError: true });
    }

    return track(req)
      .then(function (res) {
        var jobObj = jobs.find(function (x) { return x.id === jobId; });
        if (HG.notify && jobObj) {
          HG.notify(u.id, 'Bạn đã gửi hồ sơ ứng tuyển vị trí "' + jobObj.title + '" thành công.', { link: 'student.html?tab=4', kind: 'app' });
          var ep = employer_profiles.find(function (x) { return x.id === jobObj.employer_id; });
          if (ep) HG.notify(ep.user_id, u.full_name + ' vừa ứng tuyển vị trí "' + jobObj.title + '".', { link: 'employer.html?tab=4', kind: 'app' });
        }
        return HG.syncFromBackend().then(function () { return { ok: true, application: res && res.application }; });
      })
      .catch(function (err) {
        if (err && err.status) return { error: err.message || 'Máy chủ từ chối đơn ứng tuyển.' };
        return { error: (err && err.network && err.message) || 'Không kết nối được máy chủ API (' + apiBaseUrl() + '). Hãy bật backend rồi thử lại.' };
      });
  };

  /* Danh sách CV thật của sinh viên (Promise<array>) – dùng cho modal ứng tuyển */
  HG.fetchMyCvs = function () {
    var u = HG.user(), sid = u ? HG.studentId(u) : null;
    if (!sid || !window.HGApi) return Promise.resolve(null);
    return window.HGApi.get('/api/cvs', { student_id: sid }, { silentError: true })
      .then(function (r) { return (r && r.cvs) || []; })
      .catch(function () { return null; });
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
      HG.remote(window.HGApi.updateApplicationStatus(appId, STATUS_ID_TO_NAME[statusId], note, u ? u.id : null));
    }
    return ok;
  };

  var origSetUserStatus = HG.setUserStatus;
  HG.setUserStatus = function (uid, status) {
    var ok = origSetUserStatus(uid, status);
    if (ok && window.HGApi) {
      HG.remote(window.HGApi.setUserStatus(uid, status === 'blocked' ? 'locked' : 'active'));
    }
    return ok;
  };

  var origSetRole = HG.setRole;
  HG.setRole = function (uid, role) {
    var ok = origSetRole(uid, role);
    if (ok && window.HGApi) {
      var target = users.find(function (x) { return x.id === uid; });
      HG.remote(window.HGApi.setUserRole(uid, target ? target.role : role));
    }
    return ok;
  };

  var origSetEmpVerified = HG.setEmpVerified;
  HG.setEmpVerified = function (epid, verified) {
    var ok = origSetEmpVerified(epid, verified);
    if (ok && window.HGApi) {
      HG.remote(window.HGApi.verifyEmployer(epid, verified));
    }
    return ok;
  };

  /* =========================================================
     [ST4-04] HỒ SƠ CÁ NHÂN · ĐÁNH GIÁ · KHIẾU NẠI — 100% API thật
     - Không còn đọc/ghi mock-data hay localStorage cho 3 luồng này.
     - Mọi hàm trả về Promise<{ ok:true, ... } | { error:'thông báo', status }>
       để giao diện tự hiển thị lỗi rõ ràng (toast) và thông báo (chuông notify.js).
     ========================================================= */
  function apiBase() {
    return window.HGApi && typeof window.HGApi.getBaseUrl === 'function' ? window.HGApi.getBaseUrl() : 'http://127.0.0.1:8000';
  }
  /* Chuẩn hóa lỗi: lỗi nghiệp vụ (4xx/5xx) giữ nguyên thông báo tiếng Việt từ Backend */
  function fail(err, fallback) {
    if (err && err.status) return { error: err.message || fallback, status: err.status, data: err.data };
    /* Lỗi mạng đã được api.js chuẩn hóa (timeout / ngoại tuyến / chưa cấu hình): giữ nguyên thông báo cụ thể */
    if (err && err.network && err.message) return { error: err.message, status: 0, kind: err.kind };
    return { error: 'Không kết nối được máy chủ API (' + apiBase() + '). Hãy bật backend rồi thử lại.', status: 0 };
  }
  HG.apiFail = fail;

  function call(method, path, body, params) {
    if (!window.HGApi) return Promise.reject({ status: 0 });
    return track(window.HGApi.request(method, path, body, { params: params, silentError: true }));
  }

  function adminUserIds() {
    return users.filter(function (u) { return u.role === 'admin'; }).map(function (u) { return u.id; });
  }
  function profileLink(u) {
    return u && HG.dashUrl && HG.dashUrl[u.role] ? HG.dashUrl[u.role] + '?tab=1' : '';
  }

  /* ── Kỹ năng sinh viên: Backend lưu chuỗi JSON trong DB nhưng API trả/nhận MẢNG chuỗi.
     parseSkills chấp nhận cả mảng, chuỗi JSON hoặc chuỗi phân tách dấu phẩy;
     trả về null khi chưa từng lưu (khác với [] = đã xóa hết). ── */
  HG.parseSkills = function (value) {
    if (value === null || value === undefined) return null;
    var items = value;
    if (typeof value === 'string') {
      var t = value.trim();
      if (!t) return [];
      if (t.charAt(0) === '[') { try { items = JSON.parse(t); } catch (e) { items = t.replace(/^\[|\]$/g, '').split(','); } }
      else items = t.split(',');
    }
    if (!Array.isArray(items)) return [];
    var seen = {}, out = [];
    items.forEach(function (x) {
      if (typeof x !== 'string' && typeof x !== 'number') return;
      var s = String(x).replace(/\s+/g, ' ').trim(), k = s.toLowerCase();
      if (s && !seen[k]) { seen[k] = true; out.push(s); }
    });
    return out;
  };

  /* Chỉ cập nhật trường skills (PUT /api/students/{id} với { skills: [...] }) – không đụng các trường khác */
  HG.saveStudentSkills = function (studentId, skills) {
    if (!studentId) return Promise.resolve({ error: 'Không tìm thấy hồ sơ sinh viên của tài khoản này.' });
    return call('PUT', '/api/students/' + studentId, { skills: skills })
      .then(function (res) {
        var saved = HG.parseSkills(res && res.student && res.student.skills);
        var local = student_profiles.find(function (x) { return x.id === studentId; });
        if (local && saved) local.skills = saved;
        return { ok: true, skills: saved || skills };
      })
      .catch(function (err) { return fail(err, 'Máy chủ từ chối cập nhật kỹ năng.'); });
  };

  /* ── 1. Cập nhật hồ sơ cá nhân ── */
  HG.saveStudentProfile = function (studentId, payload) {
    if (!studentId) return Promise.resolve({ error: 'Không tìm thấy hồ sơ sinh viên của tài khoản này.' });
    return call('PUT', '/api/students/' + studentId, payload)
      .then(function (res) {
        var sp = res && res.student;
        var local = student_profiles.find(function (x) { return x.id === studentId; });
        if (local && sp) {
          ['university', 'major', 'bio', 'address', 'avatar_url'].forEach(function (k) {
            if (sp[k] !== undefined) local[k] = sp[k] == null ? '' : sp[k];
          });
          local.date_of_birth = sp.date_of_birth || '';
          if (sp.skills !== undefined) local.skills = HG.parseSkills(sp.skills);
        }
        var u = local && users.find(function (x) { return x.id === local.user_id; });
        if (u && sp) {
          if (sp.full_name) u.full_name = sp.full_name;
          if (sp.email) u.email = sp.email;
        }
        if (u && payload && payload.phone != null) u.phone = payload.phone;
        return HG.syncFromBackend().then(function () { return { ok: true, student: sp }; });
      })
      .catch(function (err) { return fail(err, 'Máy chủ từ chối cập nhật hồ sơ sinh viên.'); });
  };

  HG.saveEmployerProfile = function (employerProfileId, payload) {
    if (!employerProfileId) return Promise.resolve({ error: 'Không tìm thấy hồ sơ doanh nghiệp của tài khoản này.' });
    return call('PUT', '/api/recruiters/' + employerProfileId, payload)
      .then(function (res) {
        var rec = res && res.recruiter;
        var local = employer_profiles.find(function (x) { return x.id === employerProfileId; });
        if (local && rec) {
          ['company_name', 'representative_name', 'company_address', 'company_phone', 'industry', 'description', 'logo_url'].forEach(function (k) {
            if (rec[k] !== undefined) local[k] = rec[k] == null ? '' : rec[k];
          });
          local.verified = !!rec.verified;
        }
        var u = local && users.find(function (x) { return x.id === local.user_id; });
        if (u && payload && payload.email) u.email = String(payload.email).trim().toLowerCase();
        return HG.syncFromBackend().then(function () { return { ok: true, recruiter: rec }; });
      })
      .catch(function (err) { return fail(err, 'Máy chủ từ chối cập nhật hồ sơ doanh nghiệp.'); });
  };

  /* ── 2. Đánh giá uy tín (reviews) ── */
  HG.hasReviewed = function (targetUserId, jobId) {
    var me = HG.user(); if (!me) return false;
    return reviewsStore.some(function (r) {
      return r.reviewer_id === me.id && r.target_id === targetUserId && (!jobId || r.job_id === jobId);
    });
  };

  /* o: { target_id (users.id), job_id?, rating (1–5), comment? } */
  HG.submitReview = function (o) {
    o = o || {};
    var me = HG.user();
    if (!me) return Promise.resolve({ error: 'Vui lòng đăng nhập để gửi đánh giá.' });
    var rating = Number(o.rating);
    if (!(rating >= 1 && rating <= 5) || Math.round(rating) !== rating) return Promise.resolve({ error: 'Vui lòng chọn số sao từ 1 đến 5.', field: 'rating' });
    var comment = String(o.comment || '').trim();
    if (comment.length > 1000) return Promise.resolve({ error: 'Nhận xét tối đa 1000 ký tự.', field: 'comment' });
    if (!o.target_id) return Promise.resolve({ error: 'Không xác định được người được đánh giá.' });
    if (o.target_id === me.id) return Promise.resolve({ error: 'Không thể tự đánh giá uy tín của chính mình.' });

    return call('POST', '/api/reviews', {
      reviewer_id: me.id,
      target_id: o.target_id,
      job_id: o.job_id || null,
      rating: rating,
      comment: comment || null
    })
      .then(function (res) {
        var review = res && res.review;
        if (review) reviewsStore.push(review);
        var target = users.find(function (x) { return x.id === o.target_id; });
        if (HG.notify) {
          HG.notify(o.target_id, me.full_name + ' vừa đánh giá bạn ' + rating + '★' + (comment ? ': "' + comment.slice(0, 60) + (comment.length > 60 ? '…' : '') + '"' : '.'), { link: profileLink(target), kind: 'info' });
          HG.notify(me.id, 'Bạn đã gửi đánh giá ' + rating + '★ cho ' + (target ? target.full_name : 'người dùng #' + o.target_id) + '.', { link: profileLink(me), kind: 'info' });
        }
        return HG.syncFromBackend().then(function () { return { ok: true, review: review }; });
      })
      .catch(function (err) { return fail(err, 'Máy chủ từ chối gửi đánh giá.'); });
  };

  HG.fetchReputation = function (userId) {
    if (!userId) return Promise.resolve({ error: 'Thiếu mã người dùng.' });
    return call('GET', '/api/users/' + userId + '/reputation')
      .then(function (res) { return { ok: true, data: res }; })
      .catch(function (err) { return fail(err, 'Không tải được điểm uy tín.'); });
  };

  HG.fetchReviewsOf = function (userId, limit) {
    if (!userId) return Promise.resolve({ error: 'Thiếu mã người dùng.' });
    return call('GET', '/api/users/' + userId + '/reviews', null, { limit: limit || 20 })
      .then(function (res) { return { ok: true, total: (res && res.total) || 0, reviews: (res && res.reviews) || [] }; })
      .catch(function (err) { return fail(err, 'Không tải được danh sách đánh giá.'); });
  };

  /* ── 3. Khiếu nại (reports) ── */
  HG.REPORT_TYPE_LABEL = {
    get job() { return tr('rep.type.job', 'Tin tuyển dụng'); },
    get employer() { return tr('rep.type.employer', 'Doanh nghiệp'); },
    get user() { return tr('rep.type.user', 'Người dùng'); },
    get application() { return tr('rep.type.application', 'Đơn ứng tuyển'); },
    get other() { return tr('rep.type.other', 'Khác'); }
  };
  HG.REPORT_STATUS_LABEL = {
    get pending() { return [tr('adm.rst.pending', 'Chờ xử lý'), 'pending']; },
    get resolved() { return [tr('adm.rst.resolved', 'Đã giải quyết'), 'accepted']; },
    get rejected() { return [tr('adm.rst.rejected', 'Đã bác bỏ'), 'rejected']; }
  };

  HG.reportTargetLabel = function (r) {
    if (!r) return '';
    if (r.report_type === 'job') {
      var j = jobs.find(function (x) { return x.id === r.target_id; });
      return j ? j.title : tr('rep.target.job_fmt', 'Tin #' + r.target_id, { id: r.target_id });
    }
    if (r.report_type === 'employer') {
      var ep = employer_profiles.find(function (x) { return x.id === r.target_id; });
      return ep ? ep.company_name : tr('rep.target.emp_fmt', 'Doanh nghiệp #' + r.target_id, { id: r.target_id });
    }
    if (r.report_type === 'user') {
      var u = users.find(function (x) { return x.id === r.target_id; });
      return u ? u.full_name : tr('rep.target.user_fmt', 'Người dùng #' + r.target_id, { id: r.target_id });
    }
    if (r.report_type === 'application') return tr('rep.target.app_fmt', 'Đơn ứng tuyển #' + r.target_id, { id: r.target_id });
    return tr('rep.target.other_fmt', 'Đối tượng #' + r.target_id, { id: r.target_id });
  };

  /* o: { report_type: job|employer|user|application|other, target_id, reason } */
  HG.submitReport = function (o) {
    o = o || {};
    var me = HG.user();
    if (!me) return Promise.resolve({ error: 'Vui lòng đăng nhập để gửi khiếu nại.' });
    var reason = String(o.reason || '').trim();
    if (reason.length < 5) return Promise.resolve({ error: 'Lý do khiếu nại cần ít nhất 5 ký tự.', field: 'reason' });
    if (reason.length > 2000) return Promise.resolve({ error: 'Lý do khiếu nại tối đa 2000 ký tự.', field: 'reason' });
    if (!o.target_id) return Promise.resolve({ error: 'Không xác định được đối tượng bị khiếu nại.' });

    return call('POST', '/api/reports', {
      reporter_id: me.id,
      report_type: o.report_type || 'job',
      target_id: o.target_id,
      reason: reason
    })
      .then(function (res) {
        var rep = res && res.report;
        var label = (HG.REPORT_TYPE_LABEL[o.report_type] || 'Đối tượng') + ' "' + HG.reportTargetLabel({ report_type: o.report_type, target_id: o.target_id }) + '"';
        if (HG.notify) {
          HG.notify(me.id, 'Đã gửi khiếu nại về ' + label + '. Quản trị viên sẽ phản hồi sớm.', { link: profileLink(me), kind: 'info' });
          adminUserIds().forEach(function (aid) {
            if (aid !== me.id) HG.notify(aid, 'Khiếu nại mới từ ' + me.full_name + ' về ' + label + '.', { link: 'admin.html?tab=4', kind: 'info' });
          });
        }
        return HG.syncFromBackend().then(function () { return { ok: true, report: rep }; });
      })
      .catch(function (err) { return fail(err, 'Máy chủ từ chối gửi khiếu nại.'); });
  };

  HG.fetchMyReports = function () {
    var me = HG.user();
    if (!me) return Promise.resolve({ error: 'Vui lòng đăng nhập.' });
    return call('GET', '/api/users/' + me.id + '/reports')
      .then(function (res) { return { ok: true, reports: (res && res.reports) || [] }; })
      .catch(function (err) { return fail(err, 'Không tải được danh sách khiếu nại.'); });
  };

  /* Admin xử lý khiếu nại: status = 'resolved' | 'rejected' */
  HG.processReport = function (reportId, status, adminNote, removeJob) {
    if (status !== 'resolved' && status !== 'rejected') return Promise.resolve({ error: 'Trạng thái xử lý không hợp lệ.' });
    var note = String(adminNote || '').trim();
    if (note.length > 2000) return Promise.resolve({ error: 'Ghi chú xử lý tối đa 2000 ký tự.', field: 'note' });
    var before = reports.find(function (x) { return x.id === reportId; });

    return call('PATCH', '/api/admin/reports/' + reportId, {
      status: status,
      admin_note: note || (status === 'resolved' ? 'Quản trị viên đã xử lý phản ánh.' : 'Phản ánh không đủ căn cứ để xử lý.'),
      remove_job: !!removeJob && status === 'resolved'
    })
      .then(function (res) {
        var rep = (res && res.report) || before;
        if (HG.notify && rep) {
          var reporter = users.find(function (x) { return x.id === rep.reporter_id; });
          var label = (HG.REPORT_TYPE_LABEL[rep.report_type] || 'Đối tượng') + ' "' + HG.reportTargetLabel(rep) + '"';
          var verdict = status === 'resolved' ? 'đã được giải quyết' : 'đã bị bác bỏ';
          HG.notify(rep.reporter_id, 'Khiếu nại #' + rep.id + ' về ' + label + ' ' + verdict + '. ' + (rep.admin_note ? 'Ghi chú: ' + rep.admin_note : ''), { link: profileLink(reporter), kind: 'info' });
          if (res && res.job_removed && rep.report_type === 'job') {
            var j = jobs.find(function (x) { return x.id === rep.target_id; });
            var ep = j && employer_profiles.find(function (x) { return x.id === j.employer_id; });
            if (ep) HG.notify(ep.user_id, 'Tin "' + j.title + '" đã bị gỡ do vi phạm (khiếu nại #' + rep.id + ').', { link: 'employer.html?tab=2', kind: 'job' });
          }
        }
        return HG.syncFromBackend().then(function () { return { ok: true, report: rep, job_removed: !!(res && res.job_removed) }; });
      })
      .catch(function (err) { return fail(err, 'Máy chủ từ chối xử lý khiếu nại.'); });
  };

  /* Giữ tên cũ để tương thích: nay gọi API thật và trả về Promise thay vì ghi localStorage */
  HG.setReportStatus = function (reportId, patch) {
    patch = patch || {};
    return HG.processReport(reportId, patch.status, patch.admin_note, patch.remove_job);
  };
  /* =========================================================
     LỊCH RẢNH (availabilities) – đọc/ghi qua API thật
     Bảng "Ca rảnh" trên giao diện: 3 ca × 7 ngày (cột 0 = Thứ 2 … 6 = Chủ nhật)
     Backend: day_of_week 1 (Thứ 2) … 7 (Chủ nhật), start_time/end_time "HH:MM:SS"
     ========================================================= */
  var AVAIL_SLOTS = { morning: ['08:00', '12:00'], afternoon: ['13:00', '17:00'], evening: ['17:30', '22:00'] };
  HG.AVAIL_SLOTS = AVAIL_SLOTS;
  function emptyAvailGrid() {
    var g = {};
    Object.keys(AVAIL_SLOTS).forEach(function (k) { g[k] = [false, false, false, false, false, false, false]; });
    return g;
  }
  function slotOfTime(t) {
    var h = parseInt(String(t || '').slice(0, 2), 10);
    if (isNaN(h)) return null;
    return h < 12 ? 'morning' : (h < 17 ? 'afternoon' : 'evening');
  }
  function myAvailRows(sid) {
    if (typeof availabilities === 'undefined' || !Array.isArray(availabilities)) return [];
    return availabilities.filter(function (a) { return a && a.student_id === sid; });
  }

  /* Lưới ca rảnh hiện tại của sinh viên.
     - Có dữ liệu Backend (api/cache): dựng từ bảng availabilities (rỗng = chưa chọn ca nào)
     - Chưa từng kết nối Backend: dùng bản lưu tạm trong trình duyệt (hg_avail_<sid>) nếu có */
  HG.availabilityGrid = function (sid) {
    var grid = emptyAvailGrid();
    if (HG.dataSource === 'mock') {
      var local = HG.read('hg_avail_' + sid, null);
      if (local && typeof local === 'object') {
        Object.keys(grid).forEach(function (k) {
          if (Array.isArray(local[k])) for (var i = 0; i < 7; i++) grid[k][i] = !!local[k][i];
        });
      }
      return grid;
    }
    myAvailRows(sid).forEach(function (a) {
      var slot = slotOfTime(a.start_time), d = Number(a.day_of_week) - 1;
      if (slot && d >= 0 && d < 7 && a.is_available !== false) grid[slot][d] = true;
    });
    return grid;
  };

  /* Lưu lưới ca rảnh: chỉ gửi phần chênh lệch (POST ô mới tích, DELETE ô bỏ tích).
     Trả về Promise<{ ok:true } | { ok:true, offline:true } | { error }> */
  HG.saveAvailability = function (sid, grid) {
    if (!sid) return Promise.resolve({ error: 'Không tìm thấy hồ sơ sinh viên của tài khoản này.' });
    grid = grid || emptyAvailGrid();
    HG.write('hg_avail_' + sid, grid);   /* bản lưu tạm khi Backend chưa sẵn sàng */
    if (!window.HGApi) return Promise.resolve({ ok: true, offline: true });

    var want = {}, have = {}, toDelete = [], toCreate = [];
    Object.keys(AVAIL_SLOTS).forEach(function (k) {
      (grid[k] || []).forEach(function (on, i) { if (on && i < 7) want[k + '|' + (i + 1)] = true; });
    });
    myAvailRows(sid).forEach(function (a) {
      var key = slotOfTime(a.start_time) + '|' + Number(a.day_of_week);
      if (want[key] && !have[key] && a.is_available !== false) have[key] = true;
      else toDelete.push(a.id);   /* bỏ tích, bản ghi trùng hoặc khung giờ lạ */
    });
    Object.keys(want).forEach(function (key) {
      if (have[key]) return;
      var p = key.split('|'), slot = AVAIL_SLOTS[p[0]];
      toCreate.push({ student_id: sid, day_of_week: Number(p[1]), start_time: slot[0] + ':00', end_time: slot[1] + ':00', is_available: true });
    });
    if (!toDelete.length && !toCreate.length) return Promise.resolve({ ok: true, unchanged: true });

    var reqs = toDelete.map(function (id) { return call('DELETE', '/api/availabilities/' + id); })
      .concat(toCreate.map(function (body) { return call('POST', '/api/availabilities', body); }));
    return Promise.all(reqs.map(function (p) { return p.then(function () { return null; }, function (e) { return e || { status: 0 }; }); }))
      .then(function (errors) {
        var errs = errors.filter(Boolean);
        return HG.syncFromBackend().then(function () {
          if (!errs.length) return { ok: true };
          if (errs.every(function (e) { return !e.status; })) return { ok: true, offline: true };
          return fail(errs.filter(function (e) { return e.status; })[0], 'Máy chủ từ chối lưu lịch rảnh.');
        });
      });
  };

  /* =========================================================
     LỊCH LÀM VIỆC (schedules) – thêm / sửa / xóa qua API thật
     Backend trả 409 khi ca bị trùng giờ với ca khác của cùng sinh viên.
     o: { student_id, title, start_datetime 'YYYY-MM-DDTHH:MM:SS', end_datetime, note?, job_id? }
     ========================================================= */
  HG.saveSchedule = function (o, id) {
    o = o || {};
    if (!o.student_id && !id) return Promise.resolve({ error: 'Không tìm thấy hồ sơ sinh viên của tài khoản này.' });
    var body = { title: o.title, start_datetime: o.start_datetime, end_datetime: o.end_datetime, note: o.note || null, job_id: o.job_id || null };
    if (!id) body.student_id = o.student_id;
    return call(id ? 'PUT' : 'POST', id ? '/api/schedules/' + id : '/api/schedules', body)
      .then(function (res) {
        return HG.syncFromBackend().then(function () { return { ok: true, schedule: res && res.schedule }; });
      })
      .catch(function (err) { return fail(err, id ? 'Máy chủ từ chối cập nhật ca làm việc.' : 'Máy chủ từ chối thêm ca làm việc.'); });
  };
  HG.deleteSchedule = function (id) {
    if (!id) return Promise.resolve({ error: 'Thiếu mã ca làm việc.' });
    return call('DELETE', '/api/schedules/' + id)
      .then(function () { return HG.syncFromBackend().then(function () { return { ok: true }; }); })
      .catch(function (err) {
        if (err && err.status === 404) return HG.syncFromBackend().then(function () { return { ok: true, gone: true }; });   /* đã bị xóa ở nơi khác */
        return fail(err, 'Máy chủ từ chối xóa ca làm việc.');
      });
  };

  /* Kích hoạt đồng bộ dữ liệu thật từ Backend ngay khi nạp trang */
  firstSync = HG.syncFromBackend();
})();
