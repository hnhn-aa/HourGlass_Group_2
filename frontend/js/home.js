/* Trang chủ: danh mục (đếm theo dữ liệu thật từ Backend API) + việc làm nổi bật + tuyển gấp + quick filters */
(function () {
  'use strict';
  var all = window.HG_JOBS || [], icons = ['briefcase', 'sparkle', 'chart', 'settings', 'file', 'calendar'];
  var activeFilter = 'all';
  var HOME_CATS = [
    { name: 'Phục vụ', label: 'Phục vụ & F&B' },
    { name: 'Bán hàng', label: 'Bán lẻ & Thu ngân' },
    { name: 'Marketing', label: 'Marketing & Media' },
    { name: 'Công nghệ thông tin', label: 'Công nghệ thông tin' },
    { name: 'Thiết kế', label: 'Thiết kế & Sáng tạo' },
    { name: 'Gia sư', label: 'Gia sư & Giáo dục' }
  ];

  var cats = document.getElementById('home-cats');
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }
  function renderCats() {
    if (!cats) return;
    cats.innerHTML = HOME_CATS.map(function (c, i) {
      var n = all.filter(function (j) {
        return (j.tags[0] === c.name) || (j.title + ' ' + (j.desc || '')).toLowerCase().indexOf(c.name.toLowerCase()) !== -1;
      }).length;
      var countLabel = tr('common.jobs_count', n + ' việc làm', { count: n });
      var catLabel = HG.trVal ? HG.trVal('cat', c.label) : c.label;
      return '<a class="category-card" href="jobs.html?cat=' + encodeURIComponent(c.name) + '"><span class="cat-icon c' + (i % 6) + '">' + HG.icon(icons[i % 6]) + '</span>' +
        '<span><strong>' + HG.esc(catLabel) + '</strong><small>' + HG.esc(countLabel) + '</small></span>' + HG.icon('chevron', 18) + '</a>';
    }).join('');
  }
  renderCats();

  /* ---- Tuyển gấp: các tin sắp hết hạn nhất, đếm ngược theo từng giây ---- */
  var urgentEl = document.getElementById('urgent-jobs');
  var p2 = function (n) { return ('0' + n).slice(-2); };

  function tick() {
    if (!urgentEl) return;
    var t = Date.now();
    urgentEl.querySelectorAll('[data-deadline]').forEach(function (el) {
      var d = Number(el.dataset.deadline); if (!d) return;
      var left = d - t;
      if (left <= 0) { el.textContent = tr('home.urgent_expired', 'Đã hết hạn'); el.className = 'countdown-badge countdown-red'; return; }
      var days = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000), sec = Math.floor(left % 60000 / 1000);
      var timeStr = p2(h) + ':' + p2(m) + ':' + p2(sec);
      el.textContent = days
        ? tr('home.urgent_left_days', 'Còn ' + days + ' ngày ' + timeStr, { days: days, time: timeStr })
        : tr('home.urgent_left_time', 'Còn ' + timeStr, { time: timeStr });
      el.className = 'countdown-badge ' + (days <= 2 ? 'countdown-red' : days <= 7 ? 'countdown-orange' : 'countdown-blue');
    });
  }

  function renderUrgent() {
    if (!urgentEl) return;
    var now = Date.now();
    var deadlineOf = function (j) { return j.raw && j.raw.end_date ? new Date(j.raw.end_date + 'T23:59:59').getTime() : null; };
    var urgent = all.filter(function (j) { var d = deadlineOf(j); return d && d > now; })
      .sort(function (a, b) { return deadlineOf(a) - deadlineOf(b); }).slice(0, 4);
    if (!urgent.length) urgent = all.slice(0, 4);

    urgentEl.innerHTML = urgent.map(function (j) {
      var d = deadlineOf(j);
      var imgUrl = j.image_url ? (HG.resolveImageUrl ? HG.resolveImageUrl(j.image_url) : j.image_url) : '';
      /* Luôn có khung ảnh 16:9 (ảnh thật hoặc ảnh minh họa mặc định) để các thẻ cao bằng nhau */
      var thumbHtml = '<div class="urgent-card-thumb">' + (imgUrl
        ? '<img src="' + HG.esc(imgUrl) + '" alt="' + HG.esc(j.title) + '" class="urgent-thumb-img" loading="lazy" decoding="async" onerror="' + HG.IMG_ONERROR + '">' + HG.imgFallback(j.color, j.logo, '', true)
        : HG.imgFallback(j.color, j.logo)) + '</div>';
      var locTxt = HG.trVal ? HG.trVal('area', j.location) : j.location;
      return '<div class="urgent-card has-thumb" data-href="job-detail.html?id=' + j.id + '">' +
        thumbHtml +
        '<div class="urgent-card-top">' + HG.avatar(j.company, j.logo_url, { type: 'company', className: 'company-logo' }) +
        '<span class="countdown-badge countdown-blue" data-deadline="' + (d || '') + '">' + (d ? '' : tr('home.urgent_hiring', 'Đang tuyển')) + '</span></div>' +
        '<h3 title="' + HG.esc(j.title) + '">' + HG.esc(j.title) + '</h3><p class="company-name">' + HG.esc(j.company) + '</p>' +
        '<div class="urgent-meta"><span>' + HG.icon('pin', 14) + HG.esc(locTxt) + '</span><span>' + HG.icon('briefcase', 14) + HG.esc(j.salary) + '</span></div>' +
        '<button type="button" class="primary-btn small" data-modal="apply" data-job-id="' + j.id + '" data-i18n="common.apply_now">' + tr('common.apply_now', 'Ứng tuyển ngay') + '</button></div>';
    }).join('');
    tick();
  }

  if (urgentEl) {
    renderUrgent();
    setInterval(tick, 1000);
    urgentEl.addEventListener('click', function (e) {
      var card = e.target.closest('.urgent-card[data-href]');
      if (card && !e.target.closest('button')) location.href = card.dataset.href;
    });
  }

  /* ---- Việc làm nổi bật với quick-filter tabs ---- */
  var grid = document.getElementById('home-jobs');
  var qfButtons = document.querySelectorAll('#home-quick-filters .hqf-btn');

  var QF = {
    morning: function (j) { return /sáng/i.test(j.raw.work_time || ''); },
    afternoon: function (j) { return /chiều/i.test(j.raw.work_time || ''); },
    evening: function (j) { return /tối|đêm|(1[7-9]|2[0-3]):\d\d/i.test(j.raw.work_time || ''); },
    remote: function (j) { return /remote|từ xa/i.test(j.location + ' ' + j.type + ' ' + (j.raw.work_time || '')); },
    hcm: function (j) { return /hồ chí minh|hcm/i.test(j.location); },
    hn: function (j) { return /hà nội/i.test(j.location); }
  };
  function renderHomeJobs(filter) {
    if (!grid) return;
    activeFilter = filter || activeFilter || 'all';
    var list = activeFilter && QF[activeFilter] ? all.filter(QF[activeFilter]) : all;
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3 data-i18n="home.empty_title">' + HG.esc(tr('home.empty_title', 'Chưa có việc làm phù hợp')) + '</h3><p data-i18n-html="home.empty_desc_html">' + tr('home.empty_desc_html', 'Thử chọn bộ lọc khác hoặc <a href="jobs.html">xem tất cả việc làm</a>.') + '</p></div>';
      return;
    }
    HG.renderJobs(grid, list.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 6));
  }

  renderHomeJobs('all');

  if (qfButtons.length) {
    qfButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        qfButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderHomeJobs(btn.dataset.hqf);
      });
    });
  }

  /* ---- Danh mục lấy từ bảng job_categories của Backend (qua adapter.js /api/bootstrap) ---- */
  function syncHomeCats() {
    if (!HG.apiLive || typeof job_categories === 'undefined' || !Array.isArray(job_categories)) return;
    var named = job_categories.filter(function (c) { return c && c.name; });
    if (named.length) HOME_CATS = named.slice(0, 6).map(function (c) { return { name: c.name, label: c.name }; });
  }

  /* ---- Tự động cập nhật khi adapter.js đồng bộ xong với Backend ----
     Chỉ dùng MỘT nguồn dữ liệu (window.HG_JOBS do adapter.js dựng từ /api/bootstrap) để danh sách
     không bị ghi đè lẫn nhau và luôn áp dụng cùng quy tắc (ẩn tin hết hạn, tin chưa duyệt...). */
  document.addEventListener('hg:synced', function () {
    all = window.HG_JOBS || [];
    syncHomeCats();
    renderCats();
    renderUrgent();
    renderHomeJobs(activeFilter);
  });
  window.addEventListener('languageChanged', function () {
    renderCats();
    renderUrgent();
    renderHomeJobs(activeFilter);
  });

  /* ---- Xử lý chuyển hướng tìm kiếm từ Trang chủ sang jobs.html?q=...&location=... ---- */
  var searchForm = document.querySelector('form.search-bar');
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var qInput = searchForm.querySelector('input[name="q"]');
      var areaSelect = searchForm.querySelector('select[name="area"], select[name="location"]');
      var qVal = qInput ? qInput.value.trim() : '';
      var areaVal = areaSelect ? areaSelect.value.trim() : '';

      var params = new URLSearchParams();
      if (qVal) params.set('q', qVal);
      if (areaVal) params.set('location', areaVal);

      location.href = 'jobs.html' + (params.toString() ? '?' + params.toString() : '');
    });
  }

  var heroQ = document.querySelector('input[name="q"]');
  if (heroQ) {
    heroQ.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchForm && searchForm.requestSubmit) {
          searchForm.requestSubmit();
        } else if (searchForm) {
          searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }
    });
    HG.attachSuggest(heroQ, function () {
      if (searchForm && searchForm.requestSubmit) {
        searchForm.requestSubmit();
      } else if (searchForm) {
        searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  }
})();
