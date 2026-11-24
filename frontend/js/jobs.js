/* Trang tìm việc: lọc theo từ khóa, khu vực, danh mục, hình thức, remote, lương tối thiểu, ca làm, sắp xếp, phân trang (đồng bộ Backend API) */
(function () {
  'use strict';
  var all = window.HG_JOBS || [];
  var SHIFT_RE = { morning: /sáng/i, afternoon: /chiều/i, evening: /tối|đêm|(1[7-9]|2[0-3]):\d\d/i, flexible: /linh hoạt|thỏa thuận/i, remote: /remote|từ xa/i };
  function matchShift(j, key) {
    var txt = (j.raw ? (j.raw.work_time || '') : '') + ' ' + j.location + ' ' + j.type;
    return (SHIFT_RE[key] || /./).test(txt);
  }
  var list = document.getElementById('job-list');
  var term = document.getElementById('term');
  var area = document.getElementById('area');
  var remote = document.getElementById('remote');
  var searchBtn = document.getElementById('search-btn');
  var salaryRange = document.getElementById('salary-range');
  var salaryVal = document.getElementById('salary-val');
  var sortSelect = document.getElementById('sort-select');
  var count = document.getElementById('result-count');
  var empty = document.getElementById('empty-state');
  var paginationRow = document.getElementById('pagination-row');
  var clearBtn = document.getElementById('clear-filters');
  var checks = [].slice.call(document.querySelectorAll('.filters input[data-filter]'));

  var sidebar = document.getElementById('filters-sidebar');
  var backdrop = document.getElementById('filters-backdrop');
  var openFilterBtn = document.getElementById('open-filter-mobile');
  var closeFilterBtn = document.getElementById('filter-close');

  function toggleFilterDrawer(open) {
    if (sidebar) sidebar.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
  }
  if (openFilterBtn) openFilterBtn.addEventListener('click', function () { toggleFilterDrawer(true); });
  if (closeFilterBtn) closeFilterBtn.addEventListener('click', function () { toggleFilterDrawer(false); });
  if (backdrop) backdrop.addEventListener('click', function () { toggleFilterDrawer(false); });

  var params = new URLSearchParams(location.search);
  var qParam = (params.get('q') || params.get('query') || '').trim();
  var locParam = (params.get('location') || params.get('area') || '').trim();
  var sortParam = params.get('sort') || '';
  var catParam = params.get('cat') || '';
  var shiftParam = params.get('shift') || '';

  if (qParam && term) {
    term.value = qParam;
  }

  if (locParam) {
    if (area) {
      var foundOption = false;
      for (var oi = 0; oi < area.options.length; oi++) {
        var optVal = area.options[oi].value;
        if (optVal && (optVal.toLowerCase() === locParam.toLowerCase() || (HG.matchText && HG.matchText(optVal, locParam)) || (HG.matchText && HG.matchText(locParam, optVal)))) {
          area.selectedIndex = oi;
          foundOption = true;
          break;
        }
      }
      if (!foundOption && locParam.toLowerCase() === 'remote' && remote) {
        remote.checked = true;
      }
    }
    checks.forEach(function (c) {
      if (c.dataset.filter === 'area' && (c.value.toLowerCase() === locParam.toLowerCase() || (HG.matchText && HG.matchText(c.value, locParam)))) {
        c.checked = true;
      }
    });
    if (/remote|từ xa/i.test(locParam) && remote) {
      remote.checked = true;
    }
  }

  if (sortParam && sortSelect) sortSelect.value = sortParam;

  if (catParam) {
    checks.forEach(function (c) {
      if (c.dataset.filter === 'cat' && (c.value.toLowerCase().indexOf(catParam.toLowerCase()) !== -1 || (HG.matchText && HG.matchText(c.value, catParam)))) {
        c.checked = true;
      }
    });
  }

  var shiftFilter = 'all';
  var qTabs = document.querySelectorAll('#jobs-quick-tabs .jqt-btn');

  if (shiftParam) {
    shiftFilter = shiftParam;
    qTabs.forEach(function (b) {
      b.classList.toggle('active', (b.dataset.shift || '') === shiftParam);
    });
    checks.forEach(function (c) {
      if (c.dataset.filter === 'shift' && c.value === shiftParam) {
        c.checked = true;
      }
    });
  }

  function updateSalaryLabel() {
    if (!salaryRange || !salaryVal) return;
    salaryVal.textContent = typeof window.t === 'function'
      ? window.t('jobs.salary_from', { val: salaryRange.value })
      : ('Từ ' + salaryRange.value + 'K/giờ');
  }
  if (salaryRange && salaryVal) {
    updateSalaryLabel();
    salaryRange.addEventListener('input', function () {
      updateSalaryLabel();
      currentPage = 1; render();
    });
  }

  function picked(key) {
    return checks.filter(function (c) { return c.dataset.filter === key && c.checked; }).map(function (c) { return c.value; });
  }

  function updateCounts() {
    checks.forEach(function (c) {
      var k = c.dataset.filter, v = c.value;
      var n = all.filter(function (j) {
        if (k === 'cat') return j.tags.indexOf(v) !== -1 || (HG.matchText && HG.matchText(j.tags.join(' '), v));
        if (k === 'type') return j.type === v;
        if (k === 'area') return (HG.matchText && HG.matchText(j.location, v)) || j.location.toLowerCase().indexOf(v.toLowerCase()) !== -1;
        return matchShift(j, v);
      }).length;
      var countEl = c.parentNode.querySelector('[data-count]');
      if (countEl) countEl.textContent = n;
    });
  }
  updateCounts();

  qTabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      qTabs.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      shiftFilter = btn.dataset.shift || 'all';
      currentPage = 1;
      render();
    });
  });

  var PAGE_SIZE = 6;
  var currentPage = 1;

  function getFiltered() {
    var t = (term ? term.value : '').trim();
    var a = (area ? area.value : '').trim();
    var cats = picked('cat');
    var types = picked('type');
    var areas = picked('area');
    var shifts = picked('shift');
    var minWage = salaryRange ? Number(salaryRange.value) * 1000 : 0;
    var sort = sortSelect ? sortSelect.value : 'newest';
    var match = HG.matchText || function (s, query) {
      return String(s || '').toLowerCase().indexOf(String(query || '').toLowerCase()) !== -1;
    };

    var filtered = all.filter(function (j) {
      // 1. Tìm kiếm từ khóa đa trường: tiêu đề, công ty, kỹ năng, tag, mô tả (hỗ trợ có dấu / không dấu)
      var matchKw = !t ||
        match(j.title, t) ||
        match(j.company, t) ||
        match(j.tags.join(' '), t) ||
        match(j.desc || '', t) ||
        (j.raw && match(j.raw.skills || '', t));

      // 2. Khu vực từ dropdown
      var matchAreaSelect = true;
      if (a) {
        if (a.toLowerCase() === 'remote') {
          matchAreaSelect = /xa|remote/i.test(j.location + ' ' + j.type + ' ' + (j.raw ? j.raw.work_time : ''));
        } else {
          matchAreaSelect = match(j.location, a);
        }
      }

      // 3. Khu vực từ checkbox sidebar
      var matchAreaBox = !areas.length || areas.some(function (v) {
        return match(j.location, v);
      });

      // 4. Remote checkbox
      var matchRemote = !remote || !remote.checked || /xa|remote/i.test(j.location + ' ' + (j.raw ? j.raw.work_time : ''));

      // 5. Danh mục checkbox
      var matchCat = !cats.length || cats.some(function (c) {
        return j.tags.indexOf(c) !== -1 || match(j.tags.join(' '), c) || (j.raw && j.raw.category && match(j.raw.category.name, c));
      });

      // 6. Hình thức làm việc
      var matchType = !types.length || types.indexOf(j.type) !== -1;

      // 7. Lương tối thiểu
      var matchWage = true;
      if (minWage > 20000 && j.raw && (j.raw.salary_max || j.raw.salary_min)) {
        var wageRef = j.raw.salary_max || j.raw.salary_min;
        matchWage = wageRef >= 1e6 || wageRef >= minWage;
      }

      // 8. Ca làm việc: kết hợp đồng thời thanh chọn ca nhanh VÀ checkbox ca làm việc
      var okShiftTab = shiftFilter === 'all' || matchShift(j, shiftFilter);
      var okShiftBox = !shifts.length || shifts.some(function (k) { return matchShift(j, k); });
      var matchShiftAll = okShiftTab && okShiftBox;

      return matchKw && matchAreaSelect && matchAreaBox && matchRemote && matchCat && matchType && matchWage && matchShiftAll;
    });

    var hourly = function (j) {
      var v = j.raw ? (j.raw.salary_max || j.raw.salary_min || 0) : 0;
      return v >= 1e6 ? v / 176 : v;
    };
    if (sort === 'salary') {
      filtered.sort(function (x, y) { return hourly(y) - hourly(x); });
    } else if (sort === 'urgent') {
      var dl = function (j) { return j.raw && j.raw.end_date ? new Date(j.raw.end_date).getTime() : Infinity; };
      filtered.sort(function (x, y) { return dl(x) - dl(y); });
    } else if (sort === 'title') {
      filtered.sort(function (x, y) { return x.title.localeCompare(y.title, 'vi'); });
    } else {
      filtered.sort(function (x, y) { return String(y.raw.created_at || '').localeCompare(String(x.raw.created_at || '')) || y.id - x.id; });
    }

    return filtered;
  }

  function renderPagination(total) {
    if (!paginationRow) return;
    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { paginationRow.innerHTML = ''; return; }
    var html = '';
    var prevTxt = typeof window.t === 'function' ? window.t('jobs.page_prev') : '← Trước';
    var nextTxt = typeof window.t === 'function' ? window.t('jobs.page_next') : 'Tiếp →';
    if (currentPage > 1) html += '<button class="page-btn" data-page="' + (currentPage - 1) + '">' + HG.esc(prevTxt) + '</button>';
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
        html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      } else if (Math.abs(i - currentPage) === 3) {
        html += '<span class="page-ellipsis">…</span>';
      }
    }
    if (currentPage < totalPages) html += '<button class="page-btn" data-page="' + (currentPage + 1) + '">' + HG.esc(nextTxt) + '</button>';
    paginationRow.innerHTML = html;
  }

  function render() {
    var filtered = getFiltered();
    var totalCount = filtered.length;
    var totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    var start = (currentPage - 1) * PAGE_SIZE;
    var toShow = filtered.slice(start, start + PAGE_SIZE);

    /* Render thẻ công việc với ảnh bìa 16:9 & fallback thông minh */
    if (typeof HG.renderJobs === 'function') {
      HG.renderJobs(list, toShow);
    } else if (typeof HG.jobCard === 'function') {
      list.innerHTML = toShow.map(HG.jobCard).join('');
    }
    if (count) {
      count.textContent = typeof window.t === 'function'
        ? window.t('common.matched_jobs_count', { count: totalCount })
        : (totalCount + ' việc làm phù hợp');
    }
    if (empty) empty.hidden = totalCount !== 0;
    renderPagination(totalCount);
  }

  if (paginationRow) {
    paginationRow.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-page]');
      if (btn) {
        currentPage = Number(btn.dataset.page);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  if (term) term.addEventListener('input', function () { currentPage = 1; render(); });
  if (searchBtn) searchBtn.addEventListener('click', function () { currentPage = 1; render(); });
  if (area) area.addEventListener('change', function () { currentPage = 1; render(); });
  if (remote) remote.addEventListener('change', function () { currentPage = 1; render(); });
  if (sortSelect) sortSelect.addEventListener('change', function () { currentPage = 1; render(); });

  checks.forEach(function (c) {
    c.addEventListener('change', function () { currentPage = 1; render(); });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (term) term.value = '';
      if (area) area.value = '';
      if (remote) remote.checked = false;
      if (salaryRange) {
        salaryRange.value = 20;
        updateSalaryLabel();
      }
      if (sortSelect) sortSelect.value = 'newest';
      checks.forEach(function (c) { c.checked = false; });
      shiftFilter = 'all';
      qTabs.forEach(function (b) { b.classList.toggle('active', b.dataset.shift === 'all'); });
      currentPage = 1;
      render();
    });
  }

  /* Tự động cập nhật danh sách khi adapter.js đồng bộ hoặc gọi trực tiếp qua api.js */
  document.addEventListener('hg:synced', function () {
    all = window.HG_JOBS || [];
    updateCounts();
    render();
  });
  window.addEventListener('languageChanged', function () {
    updateSalaryLabel();
    render();
  });

  /* Dữ liệu việc làm chỉ lấy từ một nguồn: window.HG_JOBS do adapter.js dựng từ /api/bootstrap
     (đã lọc tin hết hạn / chưa duyệt). Không gọi thêm /api/jobs để tránh 2 nguồn ghi đè lẫn nhau. */
  render();

  if (term) HG.attachSuggest(term, function () { currentPage = 1; render(); });
})();
