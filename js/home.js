/* Trang chủ: danh mục (đếm theo dữ liệu thật) + việc làm nổi bật + tuyển gấp + quick filters */
(function () {
  'use strict';
  var all = window.HG_JOBS || [], icons = ['briefcase', 'sparkle', 'chart', 'settings', 'file', 'calendar'];
  var HOME_CATS = [
    { name: 'Phục vụ', label: 'Phục vụ & F&B' },
    { name: 'Bán hàng', label: 'Bán lẻ & Thu ngân' },
    { name: 'Marketing', label: 'Marketing & Media' },
    { name: 'Công nghệ thông tin', label: 'Công nghệ thông tin' },
    { name: 'Thiết kế', label: 'Thiết kế & Sáng tạo' },
    { name: 'Gia sư', label: 'Gia sư & Giáo dục' }
  ];
  var cats = document.getElementById('home-cats');
  if (cats) {
    cats.innerHTML = HOME_CATS.map(function (c, i) {
      var n = all.filter(function (j) {
        return (j.tags[0] === c.name) || (j.title + ' ' + (j.desc||'')).toLowerCase().indexOf(c.name.toLowerCase()) !== -1;
      }).length;
      return '<a class="category-card" href="jobs.html?cat=' + encodeURIComponent(c.name) + '"><span class="cat-icon c' + (i % 6) + '">' + HG.icon(icons[i % 6]) + '</span>' +
        '<span><strong>' + HG.esc(c.label) + '</strong><small>' + n + ' việc làm</small></span>' + HG.icon('chevron', 18) + '</a>';
    }).join('');
  }

  /* ---- Tuyển gấp: các tin sắp hết hạn nhất, đếm ngược theo từng giây ---- */
  var urgentEl = document.getElementById('urgent-jobs');
  if (urgentEl) {
    var now = Date.now();
    var deadlineOf = function (j) { return j.raw && j.raw.end_date ? new Date(j.raw.end_date + 'T23:59:59').getTime() : null; };
    var urgent = all.filter(function (j) { var d = deadlineOf(j); return d && d > now; })
      .sort(function (a, b) { return deadlineOf(a) - deadlineOf(b); }).slice(0, 4);
    if (!urgent.length) urgent = all.slice(0, 4);

    urgentEl.innerHTML = urgent.map(function (j) {
      var d = deadlineOf(j);
      return '<div class="urgent-card" data-href="job-detail.html?id=' + j.id + '">' +
        '<div class="urgent-card-top"><span class="company-logo" style="background:' + j.color + '">' + HG.esc(j.logo) + '</span>' +
        '<span class="countdown-badge countdown-blue" data-deadline="' + (d || '') + '">' + (d ? '' : 'Đang tuyển') + '</span></div>' +
        '<h3>' + HG.esc(j.title) + '</h3><p class="company-name">' + HG.esc(j.company) + '</p>' +
        '<div class="urgent-meta"><span>' + HG.icon('pin', 14) + HG.esc(j.location) + '</span><span>' + HG.icon('briefcase', 14) + HG.esc(j.salary) + '</span></div>' +
        '<button type="button" class="primary-btn small" data-modal="apply" data-job-id="' + j.id + '">Ứng tuyển ngay</button></div>';
    }).join('');

    var p2 = function (n) { return ('0' + n).slice(-2); };
    function tick() {
      var t = Date.now();
      urgentEl.querySelectorAll('[data-deadline]').forEach(function (el) {
        var d = Number(el.dataset.deadline); if (!d) return;
        var left = d - t;
        if (left <= 0) { el.textContent = 'Đã hết hạn'; el.className = 'countdown-badge countdown-red'; return; }
        var days = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000), sec = Math.floor(left % 60000 / 1000);
        el.textContent = 'Còn ' + (days ? days + ' ngày ' : '') + p2(h) + ':' + p2(m) + ':' + p2(sec);
        el.className = 'countdown-badge ' + (days <= 2 ? 'countdown-red' : days <= 7 ? 'countdown-orange' : 'countdown-blue');
      });
    }
    tick(); setInterval(tick, 1000);

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
    var list = filter && QF[filter] ? all.filter(QF[filter]) : all;
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Chưa có việc làm phù hợp</h3><p>Thử chọn bộ lọc khác hoặc <a href="jobs.html">xem tất cả việc làm</a>.</p></div>';
      return;
    }
    HG.renderJobs(grid, list.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 6));
  }

  renderHomeJobs('all');

  if (qfButtons.length) {
    qfButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        qfButtons.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderHomeJobs(btn.dataset.hqf);
      });
    });
  }

  /* ---- Ô tìm kiếm thông minh: gợi ý theo tên việc / ngành / công ty ---- */
  var heroQ = document.querySelector('input[name="q"]');
  if (heroQ) HG.attachSuggest(heroQ, function () { if (heroQ.form && heroQ.form.requestSubmit) heroQ.form.requestSubmit(); });
})();
