/* =========================================================
   api-client.js – Tầng kết nối REST API tới Backend FastAPI
   - Tự động đính kèm header Authorization: Bearer <token> từ localStorage
   - Tự động làm mới access_token qua /users/refresh khi hết hạn (401)
   - Hỗ trợ đầy đủ các nhóm API: Auth, Users, Profiles, Jobs, Applications,
     CVs, Reviews, Reports, Schedules, Availabilities, Admin & Bootstrap
   ========================================================= */
(function () {
  'use strict';

  var DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
  var TOKEN_KEY = 'hg_access_token';
  var REFRESH_KEY = 'hg_refresh_token';

  function getBaseUrl() {
    try {
      return (localStorage.getItem('hg_api_base') || DEFAULT_BASE_URL).replace(/\/+$/, '');
    } catch (e) {
      return DEFAULT_BASE_URL;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function getRefreshToken() {
    try {
      return localStorage.getItem(REFRESH_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setTokens(accessToken, refreshToken) {
    try {
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    } catch (e) {}
  }

  function clearTokens() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch (e) {}
  }

  function handleSessionExpired(message) {
    var msg = message || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
    var hadSession = false;
    var lastRole = 'student';
    try {
      hadSession = !!(getToken() || localStorage.getItem('hg_session'));
      if (window.HG && typeof window.HG.user === 'function') {
        var cur = window.HG.user();
        if (cur && cur.role) lastRole = cur.role === 'recruiter' ? 'employer' : cur.role;
      }
      localStorage.removeItem('hg_session');
    } catch (e) {}
    clearTokens();

    if (typeof window === 'undefined' || !window.location) return;
    var page = (window.location.pathname.split('/').pop() || 'index.html') + (window.location.search || '');
    if (page.indexOf('auth.html') === 0) return;

    var isProtectedPage = /^(student|employer|admin)\.html/.test(page);
    if (hadSession || isProtectedPage) {
      if (window.HG && typeof window.HG.flash === 'function') {
        window.HG.flash(msg, 'error');
      }
      if (window.HG && typeof window.HG.goAuth === 'function') {
        window.HG.goAuth({
          mode: 'signin',
          role: lastRole,
          next: page,
          notice: msg
        });
      } else {
        window.location.href = 'auth.html?mode=signin&role=' + encodeURIComponent(lastRole) + '&next=' + encodeURIComponent(page) + '&notice=' + encodeURIComponent(msg);
      }
    }
  }

  function buildQuery(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v !== undefined && v !== null && v !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    var url = (path.indexOf('http') === 0 ? path : getBaseUrl() + path) + buildQuery(opts.params);
    var headers = Object.assign({}, opts.headers || {});
    var token = getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var fetchOpts = {
      method: method.toUpperCase(),
      headers: headers
    };

    if (body !== undefined && body !== null) {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        fetchOpts.body = body;
      } else {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        fetchOpts.body = JSON.stringify(body);
      }
    }

    return fetch(url, fetchOpts).then(function (res) {
      var isAuthLogin = path === '/users/login' || path === '/api/auth/login' || path === '/users/refresh';
      if (res.status === 401 && !isAuthLogin) {
        if (!opts._retried && getRefreshToken()) {
          return fetch(getBaseUrl() + '/users/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: getRefreshToken() })
          })
            .then(function (rRes) {
              if (!rRes.ok) {
                handleSessionExpired('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
                var expErr = new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
                expErr.status = 401;
                throw expErr;
              }
              return rRes.json();
            })
            .then(function (tokens) {
              setTokens(tokens.access_token, tokens.refresh_token);
              return request(method, path, body, Object.assign({}, opts, { _retried: true }));
            });
        }
        return res.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (e) {}
          var msg = (data && (data.detail || data.message)) || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
          handleSessionExpired(msg);
          var err401 = new Error(msg);
          err401.status = 401;
          err401.data = data;
          throw err401;
        });
      }

      return res.text().then(function (text) {
        var data = null;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          data = { detail: text };
        }
        if (!res.ok) {
          var errMsg = (data && (data.detail || data.message)) || ('HTTP ' + res.status);
          if (res.status === 403 && !isAuthLogin && window.HG && typeof window.HG.toast === 'function') {
            window.HG.toast(errMsg, 'error');
          }
          var err = new Error(errMsg);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  var HGApi = {
    getBaseUrl: getBaseUrl,
    getToken: getToken,
    setTokens: setTokens,
    clearTokens: clearTokens,
    handleSessionExpired: handleSessionExpired,
    request: request,

    get: function (path, params) {
      return request('GET', path, null, { params: params });
    },
    post: function (path, body, params) {
      return request('POST', path, body, { params: params });
    },
    put: function (path, body, params) {
      return request('PUT', path, body, { params: params });
    },
    patch: function (path, body, params) {
      return request('PATCH', path, body, { params: params });
    },
    del: function (path, params) {
      return request('DELETE', path, null, { params: params });
    },
    upload: function (path, formData) {
      return request('POST', path, formData);
    },

    /* ── 1. Hệ thống & Đồng bộ dữ liệu ────────────────────── */
    bootstrap: function () {
      return HGApi.get('/api/bootstrap');
    },
    health: function () {
      return HGApi.get('/health');
    },

    /* ── 2. Xác thực & Tài khoản ──────────────────────────── */
    login: function (email, password) {
      return HGApi.post('/api/auth/login', { email: email, password: password }).then(function (res) {
        if (res && res.access_token) {
          setTokens(res.access_token, res.refresh_token);
        }
        return res;
      });
    },
    register: function (payload) {
      return HGApi.post('/api/users', payload).then(function (res) {
        return HGApi.login(payload.email, payload.password)
          .then(function (loginRes) {
            return { user: (loginRes && loginRes.user) || res.user, tokens: loginRes };
          })
          .catch(function () {
            return { user: res.user };
          });
      });
    },
    me: function () {
      return HGApi.get('/users/me');
    },
    changePassword: function (userId, currentPassword, newPassword) {
      return HGApi.post('/api/users/' + userId + '/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
    },
    setUserStatus: function (userId, status) {
      return HGApi.patch('/api/users/' + userId + '/status', { status: status });
    },
    setUserRole: function (userId, role) {
      return HGApi.patch('/api/users/' + userId + '/role', { role: role });
    },

    /* ── 3. Hồ sơ Sinh viên & Nhà tuyển dụng ─────────────── */
    getStudents: function () {
      return HGApi.get('/api/students');
    },
    updateStudentProfile: function (studentId, payload) {
      return HGApi.put('/api/students/' + studentId, payload);
    },
    getRecruiters: function () {
      return HGApi.get('/api/recruiters');
    },
    updateEmployerProfile: function (recruiterId, payload) {
      return HGApi.put('/api/recruiters/' + recruiterId, payload);
    },
    verifyEmployer: function (recruiterId, verified) {
      return HGApi.patch('/api/recruiters/' + recruiterId + '/verify', { verified: !!verified });
    },

    /* ── 4. Danh mục, Địa điểm & Tin tuyển dụng ──────────── */
    getCategories: function () {
      return HGApi.get('/api/categories');
    },
    createCategory: function (name, description) {
      return HGApi.post('/api/categories', { name: name, description: description || '' });
    },
    updateCategory: function (categoryId, name, description) {
      return HGApi.patch('/api/categories/' + categoryId, { name: name, description: description || '' });
    },
    deleteCategory: function (categoryId) {
      return HGApi.del('/api/categories/' + categoryId);
    },
    getLocations: function () {
      return HGApi.get('/api/locations');
    },
    getJobs: function (params) {
      return HGApi.get('/api/jobs', params);
    },
    getJobDetail: function (jobId) {
      return HGApi.get('/api/jobs/' + jobId);
    },
    createJob: function (payload) {
      return HGApi.post('/api/jobs', payload);
    },
    updateJob: function (jobId, payload) {
      return HGApi.patch('/api/jobs/' + jobId, payload);
    },
    reviewJob: function (jobId, status, approvedBy, rejectedReason) {
      return HGApi.patch('/api/admin/jobs/' + jobId + '/review', {
        status: status,
        approved_by: approvedBy || 1,
        rejected_reason: rejectedReason || null
      });
    },
    deleteJob: function (jobId, reason, hardDelete) {
      return HGApi.del('/api/jobs/' + jobId, {
        reason: reason || 'Đã xóa tin tuyển dụng',
        hard_delete: hardDelete !== false
      });
    },
    toggleSaveJob: function (studentId, jobId) {
      return HGApi.post('/api/job-saves/toggle', {
        student_id: studentId,
        job_id: jobId
      });
    },

    /* ── 5. CV & Đơn ứng tuyển ────────────────────────────── */
    getCvs: function (studentId) {
      return HGApi.get('/api/cvs', studentId ? { student_id: studentId } : null);
    },
    uploadCv: function (studentId, file, fileName) {
      var fd = new FormData();
      fd.append('student_id', String(studentId));
      if (file) fd.append('cv_file', file);
      if (fileName) fd.append('file_name', fileName);
      return HGApi.upload('/api/cvs', fd);
    },
    setDefaultCv: function (cvId) {
      return HGApi.patch('/api/cvs/' + cvId + '/default', {});
    },
    deleteCv: function (cvId) {
      return HGApi.del('/api/cvs/' + cvId);
    },
    getApplications: function (params) {
      return HGApi.get('/api/applications', params);
    },
    applyJob: function (payload) {
      return HGApi.post('/api/applications/json', payload);
    },
    applyJobMultipart: function (formData) {
      return HGApi.upload('/api/applications', formData);
    },
    updateApplicationStatus: function (appId, statusName, note, changedBy) {
      return HGApi.patch('/api/applications/' + appId + '/status', {
        status: statusName,
        note: note || null,
        changed_by: changedBy || null
      });
    },

    /* ── 6. Đánh giá uy tín, Báo cáo & Lịch ───────────────── */
    createReview: function (payload) {
      return HGApi.post('/api/reviews', payload);
    },
    getUserReputation: function (userId) {
      return HGApi.get('/api/users/' + userId + '/reputation');
    },
    createReport: function (payload) {
      return HGApi.post('/api/reports', payload);
    },
    getReports: function (params) {
      return HGApi.get('/api/admin/reports', params);
    },
    resolveReport: function (reportId, status, adminNote, removeJob) {
      return HGApi.patch('/api/admin/reports/' + reportId, {
        status: status || 'resolved',
        admin_note: adminNote || 'Quản trị viên đã xử lý phản ánh.',
        remove_job: !!removeJob
      });
    },
    getStatistics: function () {
      return HGApi.get('/api/admin/statistics');
    },
    getAvailabilities: function (studentId) {
      return HGApi.get('/api/availabilities', studentId ? { student_id: studentId } : null);
    },
    createAvailability: function (payload) {
      return HGApi.post('/api/availabilities', payload);
    },
    getSchedules: function (studentId) {
      return HGApi.get('/api/schedules', studentId ? { student_id: studentId } : null);
    },
    createSchedule: function (payload) {
      return HGApi.post('/api/schedules', payload);
    }
  };

  window.HGApi = HGApi;
})();
