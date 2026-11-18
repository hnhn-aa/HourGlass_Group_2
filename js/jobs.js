/* Trang tìm việc: lọc theo từ khóa, khu vực, danh mục, hình thức, remote, lương tối thiểu, ca làm, sắp xếp, phân trang */
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
  (function () {            /* danh mục lấy theo Admin (thêm/sửa/xóa) thay vì danh sách cố định */
    var g = [].filter.call(document.querySelectorAll('.filter-group'), function (x) { var h = x.querySelector('h4'); return h && h.textContent.trim() === 'Danh mục'; })[0]; if (!g) return;
    g.innerHTML = '<h4>Danh mục</h4>' + job_categories.map(function (c) { return '<label class="check-row"><input type="checkbox" data-filter="cat" value="' + HG.esc(c.name) + '"><span></span> ' + HG.esc(c.name) + '<small data-count></small></label>'; }).join('');
  })();
  var checks = [].slice.call(document.querySelectorAll('.filters input[data-filter]'));

  /* Mobile filter drawer */
  var sidebar = document.getElementById('filters-sidebar');
  var backdrop = document.getElementById('filters-backdrop');
  var openFilterBtn = document.getElementById('open-filter-mobile');
  var closeFilterBtn = document.getElementById('filter-close');

  function toggleFilterDrawer(open) {
    if (sidebar) sidebar.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
  }
  if (openFilterBtn) openFilterBtn.addEventListener('click', function() { toggleFilterDrawer(true); });
  if (closeFilterBtn) closeFilterBtn.addEventListener('click', function() { toggleFilterDrawer(false); });
  if (backdrop) backdrop.addEventListener('click', function() { toggleFilterDrawer(false); });

  /* Đọc tham số từ URL */
  var params = new URLSearchParams(location.search);
  if (params.get('q') && term) term.value = params.get('q');
  if (params.get('area') && area) area.value = params.get('area');
  if (params.get('sort') && sortSelect) sortSelect.value = params.get('sort');

  var catParam = params.get('cat');
  checks.forEach(function (c) {
    if (c.dataset.filter === 'cat' && catParam && c.value.toLowerCase().indexOf(catParam.toLowerCase()) !== -1) {
      c.checked = true;
    }
  });

  /* Mức lương */
  if (salaryRange && salaryVal) {
    salaryRange.addEventListener('input', function() {
      salaryVal.textContent = 'Từ ' + salaryRange.value + 'K/giờ';
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
        if (k === 'cat') return j.tags[0] === v;
        if (k === 'type') return j.type === v;
        if (k === 'area') return j.location.toLowerCase().indexOf(v.toLowerCase()) !== -1;
        return matchShift(j, v);
      }).length;
      var countEl = c.parentNode.querySelector('[data-count]');
      if (countEl) countEl.textContent = n;
    });
  }
  updateCounts();

  /* Quick filter tabs by shift */
  var shiftFilter = 'all';
  var qTabs = document.querySelectorAll('#jobs-quick-tabs .jqt-btn');
  qTabs.forEach(function(btn) {
    btn.addEventListener('click', function() {
      qTabs.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      shiftFilter = btn.dataset.shift || 'all';
      currentPage = 1;
      render();
    });
  });

  var PAGE_SIZE = 6;
  var currentPage = 1;

  function getFiltered() {
    var t = (term ? term.value : '').trim().toLowerCase();
    var a = (area ? area.value : '').trim().toLowerCase();
    var cats = picked('cat');
    var types = picked('type');
    var minWage = salaryRange ? Number(salaryRange.value) * 1000 : 0;
    var sort = sortSelect ? sortSelect.value : 'newest';

    var filtered = all.filter(function (j) {
      var matchKw = !t || (j.title + ' ' + j.company + ' ' + j.tags.join(' ')).toLowerCase().indexOf(t) !== -1;
      var matchArea = !a || j.location.toLowerCase().indexOf(a) !== -1;
      var matchRemote = !remote || !remote.checked || /xa|remote/i.test(j.location + ' ' + (j.raw ? j.raw.work_time : ''));
      var matchCat = !cats.length || cats.indexOf(j.tags[0]) !== -1;
      var matchType = !types.length || types.indexOf(j.type) !== -1;

      var matchWage = true;
      if (minWage > 20000 && j.raw && j.raw.salary_max) {
        matchWage = j.raw.salary_max >= 1e6 || j.raw.salary_max >= minWage;   // lương tháng (triệu) luôn đạt ngưỡng theo giờ
      }

      var shifts = picked('shift'), areas = picked('area');
      var okShiftTab = shiftFilter === 'all' || matchShift(j, shiftFilter);
      var okShiftBox = !shifts.length || shifts.some(function (k) { return matchShift(j, k); });
      var okAreaBox = !areas.length || areas.some(function (v) { return j.location.toLowerCase().indexOf(v.toLowerCase()) !== -1; });
      var matchShift2 = okShiftTab && okShiftBox && okAreaBox;

      return matchKw && matchArea && matchRemote && matchCat && matchType && matchWage && matchShift2;
    });

    var hourly = function (j) {                       // quy đổi về lương/giờ để so sánh công bằng
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
    if (currentPage > 1) html += '<button class="page-btn" data-page="' + (currentPage - 1) + '">&larr; Trước</button>';
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
        html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      } else if (Math.abs(i - currentPage) === 3) {
        html += '<span class="page-ellipsis">…</span>';
      }
    }
    if (currentPage < totalPages) html += '<button class="page-btn" data-page="' + (currentPage + 1) + '">Tiếp &rarr;</button>';
    paginationRow.innerHTML = html;
  }

  function render() {
    var filtered = getFiltered();
    var totalCount = filtered.length;
    var totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    var start = (currentPage - 1) * PAGE_SIZE;
    var toShow = filtered.slice(start, start + PAGE_SIZE);

    HG.renderJobs(list, toShow);
    if (count) count.textContent = totalCount + ' việc làm phù hợp';
    if (empty) empty.hidden = totalCount !== 0;
    renderPagination(totalCount);
  }

  /* Pagination clicks */
  if (paginationRow) {
    paginationRow.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-page]');
      if (btn) {
        currentPage = Number(btn.dataset.page);
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  if (term) term.addEventListener('input', function() { currentPage = 1; render(); });
  if (searchBtn) searchBtn.addEventListener('click', function() { currentPage = 1; render(); });
  if (area) area.addEventListener('change', function() { currentPage = 1; render(); });
  if (remote) remote.addEventListener('change', function() { currentPage = 1; render(); });
  if (sortSelect) sortSelect.addEventListener('change', function() { currentPage = 1; render(); });

  checks.forEach(function (c) {
    c.addEventListener('change', function() { currentPage = 1; render(); });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (term) term.value = '';
      if (area) area.value = '';
      if (remote) remote.checked = false;
      if (salaryRange) {
        salaryRange.value = 20;
        if (salaryVal) salaryVal.textContent = 'Từ 20K/giờ';
      }
      if (sortSelect) sortSelect.value = 'newest';
      checks.forEach(function (c) { c.checked = false; });
      shiftFilter = 'all';
      qTabs.forEach(function(b) { b.classList.toggle('active', b.dataset.shift === 'all'); });
      currentPage = 1;
      render();
    });
  }

  render();

  if (term) HG.attachSuggest(term, function () { currentPage = 1; render(); });
})();
