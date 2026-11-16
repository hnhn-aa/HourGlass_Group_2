/* Sinh viên – Lịch làm việc & Lịch rảnh (đồng bộ với Backend API qua adapter.js):
   xem Tháng / Tuần / Danh sách, lùi xem tối đa 3 tháng, chọn khoảng ngày (Date Range Picker),
   4 trạng thái ca (Đã nhận lịch, Đang chờ duyệt, Đã hủy, Hoàn thành), lịch sử lịch rảnh 1–3 tháng. */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user();
  var host = document.getElementById('sched-panel');
  if (!host || !me || me.role !== 'student') return;

  var E = HG.esc, I = HG.icon, sid = HG.studentId(me) || 1;
  var KEY = 'hg_shifts_' + sid, HKEY = 'hg_avail_hist_' + sid;
  var MAX_BACK_MONTHS = 3, DAY = 86400000;
  var pad = function (n) { return ('0' + n).slice(-2); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var addMonths = function (d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
  var startOfDay = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  var today = startOfDay(new Date());
  var minBack = function (n) { return startOfDay(addMonths(today, -n)); };
  var maxFuture = startOfDay(addMonths(today, 3));

  var STATUS = {
    accepted:  { label: 'Đã nhận lịch',   cls: 'accepted' },
    pending:   { label: 'Đang chờ duyệt', cls: 'pending' },
    cancelled: { label: 'Đã hủy',         cls: 'cancelled' },
    completed: { label: 'Hoàn thành',     cls: 'completed' }
  };

  /* ---------- Dữ liệu ca làm ---------- */
  function seed() {
    var out = [], id = 1;
    function add(offset, from, to, title, company, jobId, status, note) {
      var d = addDays(today, offset);
      out.push({ id: id++, date: iso(d), from: from, to: to, title: title, company: company, job_id: jobId, status: status, note: note || '' });
    }
    [[-84, 'completed'], [-77, 'completed'], [-70, 'completed'], [-63, 'completed'], [-49, 'completed'], [-42, 'completed'], [-35, 'cancelled'],
     [-28, 'completed'], [-21, 'completed'], [-14, 'completed'], [-12, 'cancelled'], [-7, 'completed'], [-3, 'completed']].forEach(function (x, i) {
      var hl = i % 3 !== 2;
      add(x[0], hl ? '17:00' : '08:00', hl ? '22:00' : '12:00', hl ? 'Ca làm việc tại Highlands Coffee' : 'Ca làm việc tại FPT Shop', hl ? 'Highlands Coffee' : 'FPT Shop', hl ? 1 : 3, x[1],
        x[1] === 'cancelled' ? 'Sinh viên báo bận lịch thi.' : '');
    });
    schedules.filter(function (s) { return s.student_id === sid && s.start_datetime; }).forEach(function (s) {
      out.push({ id: id++, date: s.start_datetime.slice(0, 10), from: s.start_datetime.slice(11, 16), to: (s.end_datetime || '').slice(11, 16), title: s.title, company: '', job_id: s.job_id, status: 'accepted', note: s.note || '' });
    });
    add(2, '17:00', '22:00', 'Ca làm việc tại Highlands Coffee', 'Highlands Coffee', 1, 'accepted');
    add(5, '08:00', '12:00', 'Ca làm việc tại FPT Shop', 'FPT Shop', 3, 'pending', 'Chờ nhà tuyển dụng xác nhận.');
    add(7, '17:00', '22:00', 'Ca làm việc tại Highlands Coffee', 'Highlands Coffee', 1, 'pending', 'Chờ nhà tuyển dụng xác nhận.');
    add(9, '13:00', '17:00', 'Ca làm việc tại FPT Shop', 'FPT Shop', 3, 'accepted');
    return out;
  }
  var shifts = HG.read(KEY, null);
  if (!shifts) { shifts = seed(); HG.write(KEY, shifts); }
  var cutoff = iso(minBack(MAX_BACK_MONTHS));
  var kept = shifts.filter(function (s) { return s.date >= cutoff; });
  if (kept.length !== shifts.length) { shifts = kept; HG.write(KEY, shifts); }
  function save() { HG.write(KEY, shifts); }

  var st = {
    view: 'month', back: 1,
    from: minBack(1), to: addDays(today, 30),
    cursor: new Date(today), selected: iso(today), hidden: {}
  };
  var clampDate = function (d, lo, hi) { return d < lo ? lo : d > hi ? hi : d; };
  function window_() { return { lo: st.from, hi: st.to }; }

  host.innerHTML =
    '<div class="panel-title sched-title"><div><h3>Lịch làm việc</h3>' +
    '<p class="sched-sub">Theo dõi ca làm, trạng thái duyệt và lịch sử làm việc của bạn.</p></div>' +
    '<div class="seg-toggle" id="sched-view" role="tablist">' +
      '<button type="button" data-v="month" class="active">Tháng</button><button type="button" data-v="week">Tuần</button><button type="button" data-v="list">Danh sách</button></div></div>' +
    '<div class="sched-controls">' +
      '<div class="sched-range-presets" id="sched-presets"><span>Xem lùi:</span>' +
        '<button type="button" data-b="1" class="active">1 tháng</button><button type="button" data-b="2">2 tháng</button><button type="button" data-b="3">3 tháng</button></div>' +
      '<div class="sched-range-picker"><label>Từ ngày<input type="date" id="sched-from"></label><label>Đến ngày<input type="date" id="sched-to"></label>' +
        '<button type="button" class="secondary-btn small" id="sched-apply">Áp dụng</button></div>' +
    '</div>' +
    '<div class="sched-legend" id="sched-legend"></div>' +
    '<div class="sched-nav"><button type="button" class="icon-btn" id="sched-prev" aria-label="Trước">' + I('chevron', 16) + '</button>' +
      '<strong id="sched-label"></strong><button type="button" class="icon-btn" id="sched-next" aria-label="Sau">' + I('chevron', 16) + '</button>' +
      '<button type="button" class="secondary-btn small" id="sched-today">Hôm nay</button></div>' +
    '<div id="sched-body"></div><div id="sched-day"></div>' +
    '<div class="sched-note" role="note">' + I('alert', 16) +
    '<span>Hệ thống chỉ lưu trữ và hiển thị lịch sử lịch làm việc/thời gian rảnh trong vòng 1–3 tháng gần nhất. Vui lòng liên hệ bộ phận hỗ trợ nếu cần tra cứu dữ liệu cũ hơn.</span></div>';

  var $ = function (id) { return document.getElementById(id); };
  var fromIn = $('sched-from'), toIn = $('sched-to');

  function syncInputs() {
    fromIn.min = iso(minBack(MAX_BACK_MONTHS)); fromIn.max = iso(maxFuture);
    toIn.min = iso(minBack(MAX_BACK_MONTHS)); toIn.max = iso(maxFuture);
    fromIn.value = iso(st.from); toIn.value = iso(st.to);
    $('sched-presets').querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', +b.dataset.b === st.back && iso(st.from) === iso(minBack(st.back))); });
  }

  function visibleShifts() {
    return shifts.filter(function (s) { return !st.hidden[s.status]; })
      .sort(function (a, b) { return (a.date + a.from).localeCompare(b.date + b.from); });
  }
  function inWindow(dStr) { var d = parse(dStr); return d >= st.from && d <= st.to; }

  function renderLegend() {
    var inRange = shifts.filter(function (s) { return inWindow(s.date); });
    $('sched-legend').innerHTML = Object.keys(STATUS).map(function (k) {
      var n = inRange.filter(function (s) { return s.status === k; }).length;
      return '<button type="button" class="legend-chip ' + STATUS[k].cls + (st.hidden[k] ? ' off' : '') + '" data-k="' + k + '" aria-pressed="' + !st.hidden[k] + '"><i></i>' + STATUS[k].label + ' <b>' + n + '</b></button>';
    }).join('');
  }

  var MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  var DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  var mondayOf = function (d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

  function chip(s, compact) {
    return '<div class="shift-chip ' + STATUS[s.status].cls + '" title="' + E(s.title + ' · ' + STATUS[s.status].label) + '">' +
      '<b>' + E(s.from) + '</b>' + (compact ? '' : ' ' + E(s.title.replace('Ca làm việc tại ', ''))) + '</div>';
  }

  function renderMonth() {
    var y = st.cursor.getFullYear(), m = st.cursor.getMonth();
    var first = new Date(y, m, 1), start = mondayOf(first), vis = visibleShifts();
    var html = '<div class="cal-month"><div class="cal-dow">' + DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="cal-cells">';
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), ds = iso(d), out = d.getMonth() !== m, off = d < st.from || d > st.to;
      var list = off ? [] : vis.filter(function (s) { return s.date === ds; });
      html += '<button type="button" class="cal-cell' + (out ? ' other' : '') + (off ? ' disabled' : '') + (ds === iso(today) ? ' today' : '') + (ds === st.selected ? ' selected' : '') + '" data-d="' + ds + '"' + (off ? ' disabled' : '') + '>' +
        '<span class="num">' + d.getDate() + '</span><span class="chips">' + list.slice(0, 2).map(function (s) { return chip(s, false); }).join('') +
        (list.length > 2 ? '<em>+' + (list.length - 2) + '</em>' : '') + '</span><span class="dots">' + list.map(function (s) { return '<i class="' + STATUS[s.status].cls + '"></i>'; }).join('') + '</span></button>';
    }
    return html + '</div></div>';
  }

  function renderWeek() {
    var mon = mondayOf(st.cursor), vis = visibleShifts();
    return '<div class="cal-week">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = addDays(mon, i), ds = iso(d), off = d < st.from || d > st.to;
      var list = off ? [] : vis.filter(function (s) { return s.date === ds; });
      return '<div class="cal-wcol' + (ds === iso(today) ? ' today' : '') + (off ? ' disabled' : '') + '" data-d="' + ds + '"><div class="wh"><strong>' + DOW[i] + '</strong><span>' + d.getDate() + '/' + (d.getMonth() + 1) + '</span></div>' +
        (list.map(function (s) { return '<div class="shift-card ' + STATUS[s.status].cls + '"><b>' + E(s.from) + '–' + E(s.to) + '</b><span>' + E(s.title.replace('Ca làm việc tại ', '')) + '</span><em>' + STATUS[s.status].label + '</em></div>'; }).join('') ||
          '<div class="wempty">' + (off ? '—' : 'Trống') + '</div>') + '</div>';
    }).join('') + '</div>';
  }

  var WD = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  function shiftRow(s) {
    var future = parse(s.date) >= today && (s.status === 'accepted' || s.status === 'pending');
    return '<div class="shift-row ' + STATUS[s.status].cls + '"><div class="sr-time"><b>' + E(s.from) + ' – ' + E(s.to) + '</b><small>' + HG.fmtDate(s.date) + '</small></div>' +
      '<div class="sr-main"><strong>' + E(s.title) + '</strong>' + (s.note ? '<small>' + E(s.note) + '</small>' : '') + '</div>' +
      '<span class="status-pill ' + STATUS[s.status].cls + '">' + STATUS[s.status].label + '</span>' +
      (future ? '<button type="button" class="cv-action-btn danger" data-cancel="' + s.id + '">Hủy ca</button>' : '') + '</div>';
  }
  function dayList(ds) {
    var list = visibleShifts().filter(function (s) { return s.date === ds; });
    var d = parse(ds);
    return '<div class="sched-day-panel"><h4>' + WD[d.getDay()] + ', ' + HG.fmtDate(ds) + '</h4>' +
      (list.length ? list.map(shiftRow).join('') : '<p class="sched-none">Không có ca làm việc nào trong ngày này.</p>') + '</div>';
  }
  function renderList() {
    var list = visibleShifts().filter(function (s) { return inWindow(s.date); }).reverse();
    if (!list.length) return HG.empty('calendar', 'Không có ca làm việc trong khoảng này', 'Thử mở rộng khoảng ngày hoặc bật lại các trạng thái đang bị ẩn.', '<a class="primary-btn small" href="jobs.html">Tìm thêm việc làm</a>');
    var html = '', last = '';
    list.forEach(function (s) {
      if (s.date !== last) { last = s.date; html += '<h4 class="sched-group">' + WD[parse(s.date).getDay()] + ', ' + HG.fmtDate(s.date) + '</h4>'; }
      html += shiftRow(s);
    });
    return '<div class="sched-list">' + html + '</div>';
  }

  function render() {
    var lo = window_().lo, hi = window_().hi;
    st.cursor = clampDate(st.cursor, lo, hi);
    var label, prevOk, nextOk;
    if (st.view === 'month') {
      label = MONTHS[st.cursor.getMonth()] + ' ' + st.cursor.getFullYear();
      prevOk = new Date(st.cursor.getFullYear(), st.cursor.getMonth(), 0) >= lo; nextOk = new Date(st.cursor.getFullYear(), st.cursor.getMonth() + 1, 1) <= hi;
    } else if (st.view === 'week') {
      var mon = mondayOf(st.cursor); label = mon.getDate() + '/' + (mon.getMonth() + 1) + ' – ' + addDays(mon, 6).getDate() + '/' + (addDays(mon, 6).getMonth() + 1) + '/' + addDays(mon, 6).getFullYear();
      prevOk = addDays(mon, -1) >= lo; nextOk = addDays(mon, 7) <= hi;
    } else { label = HG.fmtDate(iso(lo)) + ' → ' + HG.fmtDate(iso(hi)); prevOk = nextOk = false; }
    $('sched-label').textContent = label;
    $('sched-prev').disabled = !prevOk; $('sched-next').disabled = !nextOk;
    $('sched-prev').parentNode.classList.toggle('nonav', st.view === 'list');
    $('sched-body').innerHTML = st.view === 'month' ? renderMonth() : st.view === 'week' ? renderWeek() : renderList();
    $('sched-day').innerHTML = st.view === 'month' ? dayList(st.selected) : '';
    $('sched-view').querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b.dataset.v === st.view); });
    renderLegend(); syncInputs();
  }

  $('sched-view').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) { st.view = b.dataset.v; render(); } });
  $('sched-prev').addEventListener('click', function () { st.cursor = st.view === 'month' ? new Date(st.cursor.getFullYear(), st.cursor.getMonth() - 1, 1) : addDays(st.cursor, -7); render(); });
  $('sched-next').addEventListener('click', function () { st.cursor = st.view === 'month' ? new Date(st.cursor.getFullYear(), st.cursor.getMonth() + 1, 1) : addDays(st.cursor, 7); render(); });
  $('sched-today').addEventListener('click', function () { st.cursor = new Date(today); st.selected = iso(today); render(); });

  $('sched-presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-b]'); if (!b) return;
    st.back = +b.dataset.b; st.from = minBack(st.back); st.to = addDays(today, 30); render();
    HG.toast('Đang xem lịch trong ' + st.back + ' tháng gần nhất.', 'info');
  });
  $('sched-apply').addEventListener('click', function () {
    var f = fromIn.value, t = toIn.value;
    if (!f || !t) { HG.toast('Vui lòng chọn đủ "Từ ngày" và "Đến ngày".', 'error'); return; }
    var fd = parse(f), td = parse(t);
    if (fd > td) { HG.toast('"Từ ngày" phải trước hoặc bằng "Đến ngày".', 'error'); return; }
    if (fd < minBack(MAX_BACK_MONTHS)) { HG.toast('Chỉ xem được lịch trong ' + MAX_BACK_MONTHS + ' tháng gần nhất (từ ' + HG.fmtDate(iso(minBack(MAX_BACK_MONTHS))) + '). Liên hệ hỗ trợ nếu cần dữ liệu cũ hơn.', 'error'); fromIn.value = iso(minBack(MAX_BACK_MONTHS)); return; }
    if (td > maxFuture) { HG.toast('Chỉ xem được lịch đến ' + HG.fmtDate(iso(maxFuture)) + '.', 'error'); toIn.value = iso(maxFuture); return; }
    if ((td - fd) / DAY > 93) { HG.toast('Khoảng ngày tối đa là 3 tháng.', 'error'); return; }
    HG.busy($('sched-apply'), function () { st.from = fd; st.to = td; st.cursor = clampDate(st.cursor, fd, td); render(); HG.toast('Đã áp dụng khoảng ngày ' + HG.fmtDate(f) + ' → ' + HG.fmtDate(t) + '.'); }, 450);
  });
  $('sched-legend').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { st.hidden[b.dataset.k] = !st.hidden[b.dataset.k]; render(); } });

  host.addEventListener('click', function (e) {
    var cell = e.target.closest('.cal-cell[data-d]');
    if (cell && !cell.disabled) { st.selected = cell.dataset.d; render(); return; }
    var c = e.target.closest('[data-cancel]');
    if (c) {
      var s = shifts.filter(function (x) { return x.id === +c.dataset.cancel; })[0]; if (!s) return;
      HG.confirm({ title: 'Hủy ca làm việc?', message: 'Bạn muốn hủy ca "' + s.title + '" ngày ' + HG.fmtDate(s.date) + ' (' + s.from + '–' + s.to + ')? Nhà tuyển dụng sẽ được thông báo.', confirmText: 'Hủy ca', cancelText: 'Giữ lại', danger: true })
        .then(function (ok) {
          if (!ok) return;
          HG.busy(c, function () {
            s.status = 'cancelled'; s.note = 'Bạn đã hủy ca này.'; save();
            var j = jobs.find(function (x) { return x.id === s.job_id; }), ep = j && employer_profiles.find(function (x) { return x.id === j.employer_id; });
            if (ep) HG.notify(ep.user_id, me.full_name + ' đã hủy ca làm ngày ' + HG.fmtDate(s.date) + ' (' + s.from + '–' + s.to + ').', { link: 'employer.html?tab=4', kind: 'shift' });
            render(); HG.toast('Đã hủy ca làm việc.');
          }, 700);
        });
    }
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { shifts = HG.read(KEY, shifts); render(); } });

  /* ---------- Lịch sử lịch rảnh (tối đa 3 tháng) ---------- */
  var SHIFT_KEYS = [['morning', 'Sáng'], ['afternoon', 'Chiều'], ['evening', 'Tối']];
  var histHost = document.getElementById('avail-history');
  function currentAvail() {
    var a = { morning: [], afternoon: [], evening: [] };
    SHIFT_KEYS.forEach(function (k) { for (var i = 0; i < 7; i++) { var cb = document.querySelector('input.avail-check-box[data-shift="' + k[0] + '"][data-day="' + i + '"]'); a[k[0]].push(cb ? cb.checked : false); } });
    return a;
  }
  var countSlots = function (a) { return SHIFT_KEYS.reduce(function (n, k) { return n + (a[k[0]] || []).filter(Boolean).length; }, 0); };
  var hist = HG.read(HKEY, null);
  if (!hist) {
    var base = HG.read('hg_avail_' + sid, { morning: [false, true, false, true, false, true, false], afternoon: [false, false, true, false, true, false, false], evening: [true, true, true, true, true, false, false] });
    hist = [{ ts: Date.now() - 41 * DAY, avail: { morning: [false, false, false, false, false, true, true], afternoon: [false, false, true, false, false, false, false], evening: [true, true, false, true, false, false, false] } },
            { ts: Date.now() - 15 * DAY, avail: base }];
    HG.write(HKEY, hist);
  }
  hist = hist.filter(function (h) { return h.ts >= minBack(MAX_BACK_MONTHS).getTime(); });
  function renderHist() {
    if (!histHost) return;
    var list = hist.slice().sort(function (a, b) { return b.ts - a.ts; });
    histHost.innerHTML = '<div class="panel-title"><div><h3>Lịch sử cập nhật lịch rảnh</h3><p class="sched-sub">Các phiên bản lịch rảnh bạn đã lưu trong 3 tháng gần nhất.</p></div></div>' +
      (list.length ? '<div class="hist-list">' + list.map(function (h, i) {
        var d = new Date(h.ts);
        return '<div class="hist-row"><div><b>' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>' +
          '<small>' + countSlots(h.avail) + ' ca rảnh mỗi tuần' + (i === 0 ? ' · gần nhất' : '') + '</small></div>' +
          '<button type="button" class="cv-action-btn" data-restore="' + h.ts + '">Khôi phục</button></div>';
      }).join('') + '</div>' : HG.empty('calendar', 'Chưa có lịch sử cập nhật', 'Mỗi lần bạn bấm "Lưu ca rảnh", một phiên bản sẽ được lưu tại đây.')) +
      '<div class="sched-note" role="note">' + I('alert', 16) + '<span>Hệ thống chỉ lưu trữ và hiển thị lịch sử lịch làm việc/thời gian rảnh trong vòng 1–3 tháng gần nhất. Vui lòng liên hệ bộ phận hỗ trợ nếu cần tra cứu dữ liệu cũ hơn.</span></div>';
  }
  var saveBtn = document.getElementById('save-avail-btn');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    hist.push({ ts: Date.now(), avail: currentAvail() }); hist = hist.slice(-30); HG.write(HKEY, hist); renderHist();
  });
  if (histHost) histHost.addEventListener('click', function (e) {
    var r = e.target.closest('[data-restore]'); if (!r) return;
    var h = hist.filter(function (x) { return x.ts === +r.dataset.restore; })[0]; if (!h) return;
    HG.busy(r, function () {
      SHIFT_KEYS.forEach(function (k) { for (var i = 0; i < 7; i++) { var cb = document.querySelector('input.avail-check-box[data-shift="' + k[0] + '"][data-day="' + i + '"]'); if (cb) cb.checked = !!(h.avail[k[0]] || [])[i]; } });
      HG.toast('Đã khôi phục lịch rảnh. Nhấn "Lưu ca rảnh" để áp dụng.', 'info');
    }, 500);
  });

  document.addEventListener('hg:synced', function () {
    render();
  });

  renderHist();
  render();
})();
