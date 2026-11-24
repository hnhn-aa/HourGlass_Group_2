/* ==========================================================================
   api.js – Module gọi REST API dùng chung (Fetch Wrapper) cho dự án HourGlass
   --------------------------------------------------------------------------
   Nhiệm vụ [ST4-01]: Cấu hình module kết nối API (api.js)
   1. Base URL lấy từ js/config.js (window.HG_CONFIG): tự chọn local (http://127.0.0.1:8000)
      hoặc production (PRODUCTION_API_BASE) theo tên miền đang chạy; có thể ghi đè bằng ?api=<url>.
   2. Tự động đính kèm JWT Token vào Header: Authorization: Bearer <token>.
   3. Xử lý lỗi chung tập trung (Global Error Interceptor):
      - Lỗi 401 (Unauthorized): Tự động thử làm mới token qua /users/refresh;
        nếu token hết hạn hoàn toàn -> xóa phiên đăng nhập và đẩy về auth.html.
      - Lỗi 400 / 403 / 404 / 409 / 422 / 500: Tự động trích xuất thông báo lỗi
        tiếng Việt từ Backend và hiển thị Toast lỗi trực quan trên giao diện.
   4. Cung cấp đầy đủ các phương thức chuẩn: get, post, put, patch, delete, upload
      cùng toàn bộ hàm nghiệp vụ cho Frontend HourGlass.
   ========================================================================== */
(function (window, document) {
  'use strict';

  /* ── 1. CẤU HÌNH BASE URL & KHO LƯU TRỮ TOKEN ────────────────────────── */
  var DEFAULT_BASE_URL = 'http://127.0.0.1:8000';   /* chỉ dùng khi trang chưa nạp js/config.js */
  var ACCESS_TOKEN_KEY = 'hg_access_token';
  var REFRESH_TOKEN_KEY = 'hg_refresh_token';
  var SESSION_USER_KEY = 'hg_session';

  function getBaseUrl() {
    if (window.HG_CONFIG && typeof window.HG_CONFIG.getApiBase === 'function') return window.HG_CONFIG.getApiBase();
    try {
      return (localStorage.getItem('hg_api_base') || DEFAULT_BASE_URL).replace(/\/+$/, '');
    } catch (e) {
      return DEFAULT_BASE_URL;
    }
  }

  function setBaseUrl(url) {
    if (window.HG_CONFIG && typeof window.HG_CONFIG.setApiBase === 'function') { window.HG_CONFIG.setApiBase(url || ''); return; }
    try {
      if (url) {
        localStorage.setItem('hg_api_base', String(url).replace(/\/+$/, ''));
      } else {
        localStorage.removeItem('hg_api_base');
      }
    } catch (e) {}
  }

  /* ── 2. QUẢN LÝ JWT TOKEN TRONG LOCALSTORAGE ─────────────────────────── */
  function getToken() {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function getRefreshToken() {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setTokens(accessToken, refreshToken) {
    try {
      if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch (e) {}
  }

  function clearTokens() {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch (e) {}
  }

  /* ── 3. HIỂN THỊ TOAST THÔNG BÁO LỖI CHUNG ───────────────────────────── */
  function showToast(message, type) {
    type = type || 'error';
    if (!message) return;

    /* Ưu tiên dùng hệ thống Toast có sẵn của HourGlass (common.js) */
    if (window.HG && typeof window.HG.toast === 'function') {
      window.HG.toast(message, type);
      return;
    }

    /* Fallback tự tạo DOM Toast nếu trang chưa nạp common.js */
    if (!document || !document.body) return;
    var box = document.getElementById('hg-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'hg-toasts';
      box.className = 'hg-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    var item = document.createElement('div');
    item.className = 'hg-toast ' + type;
    item.textContent = message;
    box.appendChild(item);
    setTimeout(function () {
      item.classList.add('out');
      setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 250);
    }, 3200);
  }

  /* ── 4. XỬ LÝ LỖI 401 -> TỰ ĐỘNG ĐẨY VỀ TRANG ĐĂNG NHẬP (auth.html) ── */
  function handleUnauthorized(customMessage) {
    var msg = customMessage || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    var hadAuth = false;
    var lastRole = 'student';

    try {
      hadAuth = !!(getToken() || localStorage.getItem(SESSION_USER_KEY));
      if (window.HG && typeof window.HG.user === 'function') {
        var currentUser = window.HG.user();
        if (currentUser && currentUser.role) {
          lastRole = currentUser.role === 'recruiter' ? 'employer' : currentUser.role;
        }
      }
      localStorage.removeItem(SESSION_USER_KEY);
    } catch (e) {}

    clearTokens();

    if (!window.location) return;
    var currentPage = (window.location.pathname.split('/').pop() || 'index.html') + (window.location.search || '');

    /* Nếu đang ở trang auth.html thì chỉ hiện toast lỗi, tránh redirect vòng lặp */
    if (currentPage.indexOf('auth.html') === 0) {
      showToast(msg, 'error');
      return;
    }

    var isProtectedDashboard = /^(student|employer|admin)\.html/.test(currentPage);
    if (hadAuth || isProtectedDashboard) {
      if (window.HG && typeof window.HG.flash === 'function') {
        window.HG.flash(msg, 'error');
      } else {
        showToast(msg, 'error');
      }

      if (window.HG && typeof window.HG.goAuth === 'function') {
        window.HG.goAuth({
          mode: 'signin',
          role: lastRole,
          next: currentPage,
          notice: msg
        });
      } else {
        window.location.href =
          'auth.html?mode=signin&role=' +
          encodeURIComponent(lastRole) +
          '&next=' +
          encodeURIComponent(currentPage) +
          '&notice=' +
          encodeURIComponent(msg);
      }
    }
  }

  /* ── 5. TIỆN ÍCH XÂY DỰNG QUERY STRING & TRÍCH XUẤT THÔNG BÁO LỖI ──── */
  function buildQueryString(params) {
    if (!params || typeof params !== 'object') return '';
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var val = params[key];
      if (val !== undefined && val !== null && val !== '') {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function extractErrorMessage(data, status) {
    if (data) {
      if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
      if (Array.isArray(data.errors) && data.errors.length) return data.errors.join('; ');
      if (Array.isArray(data.detail) && data.detail.length) {
        return data.detail
          .map(function (item) {
            return item.msg || JSON.stringify(item);
          })
          .join('; ');
      }
    }
    var fallbackMap = {
      400: 'Yêu cầu không hợp lệ, vui lòng kiểm tra lại dữ liệu.',
      401: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      403: 'Bạn không có quyền thực hiện thao tác này.',
      404: 'Không tìm thấy dữ liệu hoặc đường dẫn yêu cầu.',
      409: 'Dữ liệu bị trùng lặp hoặc xung đột.',
      422: 'Dữ liệu đầu vào chưa đúng định dạng quy định.',
      500: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.'
    };
    return fallbackMap[status] || ('Lỗi kết nối máy chủ (HTTP ' + status + ').');
  }

  /* ── 5b. GIỚI HẠN THỜI GIAN & CHUẨN HÓA LỖI MẠNG ─────────────────────
     - Mọi request có timeout (mặc định 15 giây, upload file 60 giây; truyền options.timeout để đổi)
       -> không còn spinner "Đang tải…" quay mãi khi Backend bị treo.
     - Lỗi mạng / timeout / chưa cấu hình Backend đều trả về Error có status = 0 và network = true,
       để nơi gọi phân biệt với lỗi nghiệp vụ (status 4xx/5xx) theo cùng một quy ước. */
  var DEFAULT_TIMEOUT_MS = 15000;
  var UPLOAD_TIMEOUT_MS = 60000;

  function networkError(kind, timeoutMs) {
    var base = getBaseUrl() || '(chưa cấu hình)';
    var msg = {
      timeout: 'Máy chủ phản hồi quá lâu (hơn ' + Math.round((timeoutMs || DEFAULT_TIMEOUT_MS) / 1000) + ' giây). Vui lòng thử lại sau.',
      unconfigured: 'Chưa cấu hình địa chỉ Backend cho bản deploy (PRODUCTION_API_BASE trong js/config.js).',
      offline: 'Thiết bị đang ngoại tuyến. Hãy kiểm tra kết nối Internet.',
      network: 'Không kết nối được máy chủ API (' + base + '). Hãy bật backend rồi thử lại.'
    }[kind] || 'Không kết nối được máy chủ API.';
    var err = new Error(msg);
    err.status = 0;
    err.network = true;
    err.kind = kind;
    return err;
  }

  function fetchWithTimeout(url, config, timeoutMs) {
    if (typeof fetch !== 'function') return Promise.reject(networkError('network'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null, timedOut = false;
    if (ctrl && timeoutMs > 0) {
      timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, timeoutMs);
      config = Object.assign({}, config, { signal: ctrl.signal });
    }
    return fetch(url, config).then(
      function (res) { if (timer) clearTimeout(timer); return res; },
      function () {
        if (timer) clearTimeout(timer);
        if (timedOut) throw networkError('timeout', timeoutMs);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw networkError('offline');
        throw networkError('network');
      }
    );
  }

  /* ── 6. HÀM GỌI API TRUNG TÂM (CORE FETCH INTERCEPTOR) ──────────────── */
  function request(method, endpoint, body, options) {
    options = options || {};
    var isFullUrl = /^https?:\/\//i.test(endpoint);
    /* Bản deploy chưa khai báo URL Backend: không bắn request chắc chắn thất bại (tránh lỗi DNS/CORS đỏ console) */
    if (!isFullUrl && window.HG_CONFIG && window.HG_CONFIG.configured === false) {
      return Promise.reject(networkError('unconfigured'));
    }
    var url = (isFullUrl ? endpoint : getBaseUrl() + endpoint) + buildQueryString(options.params);
    var isUpload = typeof FormData !== 'undefined' && body instanceof FormData;
    var timeoutMs = options.timeout != null ? Number(options.timeout) : (isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

    /* Tự động đính kèm JWT Token vào Header Authorization */
    var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    var token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var fetchConfig = {
      method: String(method || 'GET').toUpperCase(),
      headers: headers
    };

    if (body !== undefined && body !== null) {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        /* Khi gửi FormData (upload file CV), trình duyệt tự gán multipart boundary */
        delete headers['Content-Type'];
        fetchConfig.body = body;
      } else {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        fetchConfig.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }

    return fetchWithTimeout(url, fetchConfig, timeoutMs).then(function (response) {
      var isAuthEndpoint =
        endpoint === '/users/login' ||
        endpoint === '/api/auth/login' ||
        endpoint === '/users/refresh';

      /* Xử lý lỗi 401: thử refresh token 1 lần, nếu thất bại -> về trang đăng nhập */
      if (response.status === 401 && !isAuthEndpoint) {
        if (!options._retried && getRefreshToken()) {
          return fetchWithTimeout(getBaseUrl() + '/users/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ refresh_token: getRefreshToken() })
          }, DEFAULT_TIMEOUT_MS)
            .then(function (refreshRes) {
              if (!refreshRes.ok) {
                handleUnauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
                var expErr = new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
                expErr.status = 401;
                throw expErr;
              }
              return refreshRes.json();
            })
            .then(function (tokenData) {
              if (!tokenData || !tokenData.access_token) {
                handleUnauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
                var badErr = new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
                badErr.status = 401;
                throw badErr;
              }
              setTokens(tokenData.access_token, tokenData.refresh_token);
              return request(method, endpoint, body, Object.assign({}, options, { _retried: true }));
            });
        }

        return response.text().then(function (rawText) {
          var errPayload = {};
          try {
            errPayload = rawText ? JSON.parse(rawText) : {};
          } catch (e) {}
          var msg401 = extractErrorMessage(errPayload, 401);
          handleUnauthorized(msg401);
          var err401 = new Error(msg401);
          err401.status = 401;
          err401.data = errPayload;
          throw err401;
        });
      }

      /* Đọc JSON trả về và kiểm tra các mã lỗi HTTP khác */
      return response.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          data = { detail: text };
        }

        if (!response.ok) {
          var errMsg = extractErrorMessage(data, response.status);
          /* Hiển thị Toast lỗi tự động trừ khi caller truyền silentError: true */
          if (!options.silentError && (response.status === 403 || options.showToastOnError !== false)) {
            showToast(errMsg, 'error');
          }
          var apiError = new Error(errMsg);
          apiError.status = response.status;
          apiError.data = data;
          throw apiError;
        }

        return data;
      });
    });
  }

  /* ── 7. ĐỐI TƯỢNG API DÙNG CHUNG (EXPORT RA WINDOW.api & WINDOW.HGApi) ─ */
  var api = {
    /* Cấu hình & Quản lý Token */
    getBaseUrl: getBaseUrl,
    setBaseUrl: setBaseUrl,
    getToken: getToken,
    getRefreshToken: getRefreshToken,
    setTokens: setTokens,
    clearTokens: clearTokens,
    showToast: showToast,
    handleSessionExpired: handleUnauthorized,
    handleUnauthorized: handleUnauthorized,
    request: request,
    isNetworkError: function (err) { return !!(err && (err.network || !err.status)); },

    /* Các phương thức HTTP chuẩn */
    get: function (endpoint, params, options) {
      return request('GET', endpoint, null, Object.assign({}, options, { params: params }));
    },
    post: function (endpoint, body, params, options) {
      return request('POST', endpoint, body, Object.assign({}, options, { params: params }));
    },
    put: function (endpoint, body, params, options) {
      return request('PUT', endpoint, body, Object.assign({}, options, { params: params }));
    },
    patch: function (endpoint, body, params, options) {
      return request('PATCH', endpoint, body, Object.assign({}, options, { params: params }));
    },
    del: function (endpoint, params, options) {
      return request('DELETE', endpoint, null, Object.assign({}, options, { params: params }));
    },
    delete: function (endpoint, params, options) {
      return request('DELETE', endpoint, null, Object.assign({}, options, { params: params }));
    },
    upload: function (endpoint, formData, options) {
      return request('POST', endpoint, formData, options);
    },

    /* ── Nhóm 1: Hệ thống & Đồng bộ dữ liệu (Bootstrap) ── */
    bootstrap: function () {
      /* 60 giây: đủ cho lần "đánh thức" Backend trên các host miễn phí (Render/Railway ngủ sau thời gian rảnh) */
      return api.get('/api/bootstrap', null, { silentError: true, timeout: 60000 });
    },
    health: function () {
      return api.get('/health', null, { silentError: true });
    },

    /* ── Nhóm 2: Xác thực & Quản lý Tài khoản ── */
    login: function (email, password) {
      return api.post('/api/auth/login', { email: email, password: password }).then(function (res) {
        if (res && res.access_token) {
          setTokens(res.access_token, res.refresh_token);
        }
        return res;
      });
    },
    register: function (payload) {
      return api.post('/api/users', payload).then(function (res) {
        return api
          .login(payload.email, payload.password)
          .then(function (loginRes) {
            return { user: (loginRes && loginRes.user) || res.user, tokens: loginRes };
          })
          .catch(function () {
            return { user: res.user };
          });
      });
    },
    me: function () {
      return api.get('/users/me');
    },
    changePassword: function (userId, currentPassword, newPassword) {
      return api.post('/api/users/' + userId + '/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
    },
    setUserStatus: function (userId, status) {
      return api.patch('/api/users/' + userId + '/status', { status: status });
    },
    setUserRole: function (userId, role) {
      return api.patch('/api/users/' + userId + '/role', { role: role });
    },

    /* ── Nhóm 3: Hồ sơ Sinh viên & Nhà tuyển dụng ── */
    getStudents: function () {
      return api.get('/api/students');
    },
    updateStudentProfile: function (studentId, payload) {
      return api.put('/api/students/' + studentId, payload);
    },
    getRecruiters: function () {
      return api.get('/api/recruiters');
    },
    updateEmployerProfile: function (recruiterId, payload) {
      return api.put('/api/recruiters/' + recruiterId, payload);
    },
    verifyEmployer: function (recruiterId, verified) {
      return api.patch('/api/recruiters/' + recruiterId + '/verify', { verified: !!verified });
    },

    /* ── Nhóm 4: Danh mục, Địa điểm & Tin tuyển dụng ── */
    getCategories: function () {
      return api.get('/api/categories', null, { silentError: true });
    },
    createCategory: function (name, description) {
      return api.post('/api/categories', { name: name, description: description || '' });
    },
    updateCategory: function (categoryId, name, description) {
      return api.patch('/api/categories/' + categoryId, { name: name, description: description || '' });
    },
    deleteCategory: function (categoryId) {
      return api.del('/api/categories/' + categoryId);
    },
    getLocations: function () {
      return api.get('/api/locations', null, { silentError: true });
    },
    getJobs: function (params) {
      return api.get('/api/jobs', params, { silentError: true });
    },
    getJobDetail: function (jobId) {
      return api.get('/api/jobs/' + jobId, null, { silentError: true });
    },
    createJob: function (payload) {
      return api.post('/api/jobs', payload);
    },
    uploadJobImage: function (file) {
      var fd = new FormData();
      fd.append('file', file);
      return api.upload('/api/jobs/upload-image', fd, { silentError: true });   /* nơi gọi tự hiển thị lỗi */
    },
    updateJob: function (jobId, payload) {
      return api.patch('/api/jobs/' + jobId, payload);
    },
    reviewJob: function (jobId, status, approvedBy, rejectedReason) {
      return api.patch('/api/admin/jobs/' + jobId + '/review', {
        status: status,
        approved_by: approvedBy || 1,
        rejected_reason: rejectedReason || null
      });
    },
    deleteJob: function (jobId, reason, hardDelete) {
      return api.del('/api/jobs/' + jobId, {
        reason: reason || 'Đã xóa tin tuyển dụng',
        hard_delete: hardDelete !== false
      });
    },
    toggleSaveJob: function (studentId, jobId) {
      return api.post('/api/job-saves/toggle', {
        student_id: studentId,
        job_id: jobId
      });
    },

    /* ── Nhóm 5: Quản lý CV & Đơn ứng tuyển ── */
    getCvs: function (studentId) {
      return api.get('/api/cvs', studentId ? { student_id: studentId } : null);
    },
    uploadCv: function (studentId, file, fileName) {
      var fd = new FormData();
      fd.append('student_id', String(studentId));
      if (file) fd.append('cv_file', file);
      if (fileName) fd.append('file_name', fileName);
      return api.upload('/api/cvs', fd, { silentError: true });   /* nơi gọi tự hiển thị lỗi */
    },
    setDefaultCv: function (cvId) {
      return api.patch('/api/cvs/' + cvId + '/default', {});
    },
    deleteCv: function (cvId) {
      return api.del('/api/cvs/' + cvId);
    },
    getApplications: function (params) {
      return api.get('/api/applications', params);
    },
    applyJob: function (payload) {
      return api.post('/api/applications/json', payload);
    },
    applyJobMultipart: function (formData) {
      return api.upload('/api/applications', formData);
    },
    updateApplicationStatus: function (appId, statusName, note, changedBy) {
      return api.patch('/api/applications/' + appId + '/status', {
        status: statusName,
        note: note || null,
        changed_by: changedBy || null
      });
    },

    /* ── Nhóm 6: Đánh giá, Báo cáo vi phạm & Lịch làm việc ── */
    createReview: function (payload) {
      return api.post('/api/reviews', payload);
    },
    getUserReputation: function (userId) {
      return api.get('/api/users/' + userId + '/reputation');
    },
    getReviews: function (params) {
      return api.get('/api/reviews', params);
    },
    getUserReviews: function (userId, params) {
      return api.get('/api/users/' + userId + '/reviews', params);
    },
    createReport: function (payload) {
      return api.post('/api/reports', payload);
    },
    getMyReports: function (userId) {
      return api.get('/api/users/' + userId + '/reports');
    },
    getReports: function (params) {
      return api.get('/api/admin/reports', params);
    },
    resolveReport: function (reportId, status, adminNote, removeJob) {
      return api.patch('/api/admin/reports/' + reportId, {
        status: status || 'resolved',
        admin_note: adminNote || 'Quản trị viên đã xử lý phản ánh.',
        remove_job: !!removeJob
      });
    },
    getStatistics: function () {
      return api.get('/api/admin/statistics');
    },
    getEmployerStatistics: function (recruiterId) {
      return api.get('/api/employer/' + recruiterId + '/statistics');
    },
    getAvailabilities: function (studentId) {
      return api.get('/api/availabilities', studentId ? { student_id: studentId } : null);
    },
    createAvailability: function (payload) {
      return api.post('/api/availabilities', payload);
    },
    getSchedules: function (studentId) {
      return api.get('/api/schedules', studentId ? { student_id: studentId } : null);
    },
    createSchedule: function (payload) {
      return api.post('/api/schedules', payload);
    }
  };

  /* Gắn vào global window để mọi file JS trong dự án gọi qua window.api hoặc window.HGApi */
  window.api = api;
  window.HGApi = api;
})(window, document);
