/* Sinh viên – Lịch làm việc & Lịch rảnh (đồng bộ với Backend API qua adapter.js):
   xem Tháng / Tuần / Danh sách, lùi xem tối đa 3 tháng, chọn khoảng ngày (Date Range Picker),
   4 trạng thái ca (Đã nhận lịch, Đang chờ duyệt, Đã hủy, Hoàn thành), lịch sử lịch rảnh 1–3 tháng. */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user();
  var host = document.getElementById('sched-panel');
  if (!host || !me || me.role !== 'student') return;

  var E = HG.esc, I = HG.icon, sid = HG.studentId(me) || 0;
  var HKEY = 'hg_avail_hist_' + sid;
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

  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }
  function statusInfo(k) {
    var map = {
      accepted:  { label: tr('sched.st.accepted', 'Đã nhận lịch'),   cls: 'accepted' },
      pending:   { label: tr('sched.st.pending', 'Đang chờ duyệt'), cls: 'pending' },
      cancelled: { label: tr('sched.st.cancelled', 'Đã hủy'),         cls: 'cancelled' },
      completed: { label: tr('sched.st.completed', 'Hoàn thành'),     cls: 'completed' }
    };
    return map[k] || map.accepted;
  }
  var STATUS = {
    accepted:  { get label() { return tr('sched.st.accepted', 'Đã nhận lịch'); },   cls: 'accepted' },
    pending:   { get label() { return tr('sched.st.pending', 'Đang chờ duyệt'); }, cls: 'pending' },
    cancelled: { get label() { return tr('sched.st.cancelled', 'Đã hủy'); },         cls: 'cancelled' },
    completed: { get label() { return tr('sched.st.completed', 'Hoàn thành'); },     cls: 'completed' }
  };

  /* ---------- Dữ liệu ca làm: lấy từ bảng schedules của Backend (qua adapter.js /api/bootstrap) ----------
     Thêm / sửa / xóa ca gọi thẳng API (POST / PUT / DELETE /api/schedules); Backend chặn ca trùng giờ (409).
     Backend chưa có cột trạng thái cho ca làm nên trạng thái được suy ra:
       - đã qua giờ kết thúc  -> Hoàn thành
       - chưa diễn ra         -> Đã nhận lịch
       - sinh viên bấm "Hủy ca" -> ca bị XÓA trên Backend (khung giờ trống lại, không còn tính trùng lịch);
         ảnh chụp ca được giữ tại trình duyệt (hg_shift_cancel_<sid>) để vẫn xem được trong mục "Đã hủy". */
  var CANCEL_KEY = 'hg_shift_cancel_' + sid;
  /* Dọn dữ liệu ca làm giả lập (Highlands Coffee / FPT Shop) từng được sinh sẵn ở phiên bản cũ */
  try { localStorage.removeItem('hg_shifts_' + sid); } catch (e) {}

  var cutoff = iso(minBack(MAX_BACK_MONTHS));
  function toStamp(v) { var t = Date.parse(String(v || '').replace(' ', 'T')); return isNaN(t) ? 0 : t; }
  function buildShifts() {
    if (!sid || typeof schedules === 'undefined' || !Array.isArray(schedules)) return [];
    var cancels = HG.read(CANCEL_KEY, {}) || {}, now = Date.now(), out = [], seen = {};
    schedules.forEach(function (s) {
      if (!s || s.student_id !== sid || !s.start_datetime) return;
      var start = String(s.start_datetime).replace('T', ' '), end = String(s.end_datetime || '').replace('T', ' ');
      var date = start.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < cutoff) return;
      var job = s.job_id && Array.isArray(jobs) ? jobs.find(function (j) { return j && j.id === s.job_id; }) : null;
      var ep = job && Array.isArray(employer_profiles) ? employer_profiles.find(function (e) { return e && e.id === (job.employer_id || job.recruiter_id); }) : null;
      var company = (ep && ep.company_name) || '';
      var cancel = cancels[s.id];
      var endTs = toStamp(end) || toStamp(start);
      seen[s.id] = true;
      out.push({
        id: s.id, date: date, from: start.slice(11, 16) || '--:--', to: end.slice(11, 16) || '--:--',
        start: start, end: end, rawTitle: s.title || '', rawNote: s.note || '',
        title: s.title || (company ? 'Ca làm việc tại ' + company : (job && job.title) || 'Ca làm việc'),
        company: company, job_id: s.job_id || null,
        status: cancel ? 'cancelled' : (endTs && endTs < now ? 'completed' : 'accepted'),
        note: cancel ? (cancel.note || 'Bạn đã hủy ca này.') : (s.note || '')
      });
    });
    /* Ca đã hủy (không còn trên Backend): hiển thị lại từ ảnh chụp đã lưu */
    Object.keys(cancels).forEach(function (k) {
      var c = cancels[k], snap = c && c.shift;
      if (!snap || seen[snap.id] || !snap.date || snap.date < cutoff) return;
      out.push(Object.assign({}, snap, { status: 'cancelled', note: c.note || 'Bạn đã hủy ca này.', snapshot: true }));
    });
    return out.sort(function (x, y) { return (x.date + x.from).localeCompare(y.date + y.from); });
  }
  var shifts = buildShifts();

  var st = {
    view: 'month', back: 1,
    from: minBack(1), to: addDays(today, 30),
    cursor: new Date(today), selected: iso(today), hidden: {}
  };
  var clampDate = function (d, lo, hi) { return d < lo ? lo : d > hi ? hi : d; };
  function window_() { return { lo: st.from, hi: st.to }; }

  host.innerHTML =
    '<div class="panel-title sched-title"><div><h3 data-i18n="sched.panel_title">' + E(tr('sched.panel_title', 'Lịch làm việc')) + '</h3>' +
    '<p class="sched-sub" data-i18n="sched.panel_sub">' + E(tr('sched.panel_sub', 'Theo dõi ca làm, trạng thái duyệt và lịch sử làm việc của bạn.')) + '</p></div>' +
    '<div class="sched-head-actions"><button type="button" class="primary-btn small" data-add-shift>' + I('plus', 16) + ' <span data-i18n="sched.add_shift">' + E(tr('sched.add_shift', 'Thêm ca')) + '</span></button>' +
    '<div class="seg-toggle" id="sched-view" role="tablist">' +
      '<button type="button" data-v="month" class="active" data-i18n="sched.view_month">' + E(tr('sched.view_month', 'Tháng')) + '</button><button type="button" data-v="week" data-i18n="sched.view_week">' + E(tr('sched.view_week', 'Tuần')) + '</button><button type="button" data-v="list" data-i18n="sched.view_list">' + E(tr('sched.view_list', 'Danh sách')) + '</button></div></div></div>' +
    '<div class="sched-controls">' +
      '<div class="sched-range-presets" id="sched-presets"><span data-i18n="sched.look_back">' + E(tr('sched.look_back', 'Xem lùi:')) + '</span>' +
        '<button type="button" data-b="1" class="active" data-i18n="sched.1m">' + E(tr('sched.1m', '1 tháng')) + '</button><button type="button" data-b="2" data-i18n="sched.2m">' + E(tr('sched.2m', '2 tháng')) + '</button><button type="button" data-b="3" data-i18n="sched.3m">' + E(tr('sched.3m', '3 tháng')) + '</button></div>' +
      '<div class="sched-range-picker"><label><span data-i18n="sched.from_date">' + E(tr('sched.from_date', 'Từ ngày')) + '</span><input type="date" id="sched-from"></label><label><span data-i18n="sched.to_date">' + E(tr('sched.to_date', 'Đến ngày')) + '</span><input type="date" id="sched-to"></label>' +
        '<button type="button" class="secondary-btn small" id="sched-apply" data-i18n="sched.apply_btn">' + E(tr('sched.apply_btn', 'Áp dụng')) + '</button></div>' +
    '</div>' +
    '<div class="sched-legend" id="sched-legend"></div>' +
    '<div class="sched-nav"><button type="button" class="icon-btn" id="sched-prev" aria-label="Trước">' + I('chevron', 16) + '</button>' +
      '<strong id="sched-label"></strong><button type="button" class="icon-btn" id="sched-next" aria-label="Sau">' + I('chevron', 16) + '</button>' +
      '<button type="button" class="secondary-btn small" id="sched-today" data-i18n="sched.today_btn">' + E(tr('sched.today_btn', 'Hôm nay')) + '</button></div>' +
    '<div id="sched-body"></div><div id="sched-day"></div>' +
    '<div class="sched-note" role="note">' + I('alert', 16) +
    '<span data-i18n="sched.note_retention">' + E(tr('sched.note_retention', 'Hệ thống chỉ lưu trữ và hiển thị lịch sử lịch làm việc/thời gian rảnh trong vòng 1–3 tháng gần nhất. Vui lòng liên hệ bộ phận hỗ trợ nếu cần tra cứu dữ liệu cũ hơn.')) + '</span></div>';

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

  function getMonths() {
    var en = window.HGI18n && window.HGI18n.getLang && window.HGI18n.getLang() === 'en';
    return en
      ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      : ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  }
  function getDow() {
    return [tr('day.mon', 'T2'), tr('day.tue', 'T3'), tr('day.wed', 'T4'), tr('day.thu', 'T5'), tr('day.fri', 'T6'), tr('day.sat', 'T7'), tr('day.sun', 'CN')];
  }
  function getWd() {
    var en = window.HGI18n && window.HGI18n.getLang && window.HGI18n.getLang() === 'en';
    return en
      ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      : ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  }
  var mondayOf = function (d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

  function chip(s, compact) {
    return '<div class="shift-chip ' + STATUS[s.status].cls + '" title="' + E(s.title + ' · ' + STATUS[s.status].label) + '">' +
      '<b>' + E(s.from) + '</b>' + (compact ? '' : ' ' + E(s.title.replace('Ca làm việc tại ', ''))) + '</div>';
  }

  function renderMonth() {
    var DOW = getDow();
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
    var DOW = getDow();
    var mon = mondayOf(st.cursor), vis = visibleShifts();
    return '<div class="cal-week">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = addDays(mon, i), ds = iso(d), off = d < st.from || d > st.to;
      var list = off ? [] : vis.filter(function (s) { return s.date === ds; });
      return '<div class="cal-wcol' + (ds === iso(today) ? ' today' : '') + (off ? ' disabled' : '') + '" data-d="' + ds + '"><div class="wh"><strong>' + DOW[i] + '</strong><span>' + d.getDate() + '/' + (d.getMonth() + 1) + '</span></div>' +
        (list.map(function (s) { return '<div class="shift-card ' + STATUS[s.status].cls + '"><b>' + E(s.from) + '–' + E(s.to) + '</b><span>' + E(s.title.replace('Ca làm việc tại ', '')) + '</span><em>' + STATUS[s.status].label + '</em></div>'; }).join('') ||
          '<div class="wempty">' + (off ? '—' : E(tr('sched.empty_slot', 'Trống'))) + '</div>') + '</div>';
    }).join('') + '</div>';
  }

  function shiftRow(s) {
    var future = parse(s.date) >= today && (s.status === 'accepted' || s.status === 'pending');
    var acts = '';
    if (s.status !== 'cancelled') {
      acts += '<button type="button" class="cv-action-btn" data-edit-shift="' + s.id + '" title="' + E(tr('sched.edit_btn', 'Sửa')) + '">' + I('settings', 14) + ' ' + E(tr('sched.edit_btn', 'Sửa')) + '</button>';
      /* Ca gắn với công việc & chưa diễn ra: "Hủy ca" (báo nhà tuyển dụng); còn lại: "Xóa" */
      acts += future && s.job_id
        ? '<button type="button" class="cv-action-btn danger" data-cancel="' + s.id + '">' + E(tr('sched.cancel_shift_btn', 'Hủy ca')) + '</button>'
        : '<button type="button" class="cv-action-btn danger" data-del-shift="' + s.id + '" title="Xóa">' + I('trash', 14) + '</button>';
    } else if (s.snapshot) {
      acts += '<button type="button" class="cv-action-btn" data-forget-shift="' + s.id + '" title="Xóa">' + I('x', 14) + '</button>';
    }
    return '<div class="shift-row ' + STATUS[s.status].cls + '"><div class="sr-time"><b>' + E(s.from) + ' – ' + E(s.to) + '</b><small>' + HG.fmtDate(s.date) + '</small></div>' +
      '<div class="sr-main"><strong>' + E(s.title) + '</strong>' + (s.note ? '<small>' + E(s.note) + '</small>' : '') + '</div>' +
      '<span class="status-pill ' + STATUS[s.status].cls + '">' + STATUS[s.status].label + '</span>' +
      (acts ? '<span class="sr-actions">' + acts + '</span>' : '') + '</div>';
  }
  function dayList(ds) {
    var WD = getWd();
    var list = visibleShifts().filter(function (s) { return s.date === ds; });
    var d = parse(ds);
    var canAdd = d >= minBack(MAX_BACK_MONTHS) && d <= maxFuture;
    return '<div class="sched-day-panel"><div class="sched-day-head"><h4>' + WD[d.getDay()] + ', ' + HG.fmtDate(ds) + '</h4>' +
      (canAdd ? '<button type="button" class="secondary-btn small" data-add-shift="' + ds + '">' + I('plus', 14) + ' ' + E(tr('sched.add_shift_this_day', 'Thêm ca ngày này')) + '</button>' : '') + '</div>' +
      (list.length ? list.map(shiftRow).join('') : '<p class="sched-none">' + E(tr('sched.no_shift_day', 'Không có ca làm việc nào trong ngày này.')) + '</p>') + '</div>';
  }
  function renderList() {
    var WD = getWd();
    var list = visibleShifts().filter(function (s) { return inWindow(s.date); }).reverse();
    if (!list.length) return HG.empty('calendar', tr('sched.no_shift_range_title', 'Không có ca làm việc trong khoảng này'), tr('sched.no_shift_range_desc', 'Thêm ca làm việc mới, mở rộng khoảng ngày hoặc bật lại các trạng thái đang bị ẩn.'), '<button type="button" class="primary-btn small" data-add-shift>' + E(tr('sched.add_shift', 'Thêm ca')) + '</button>');
    var html = '', last = '';
    list.forEach(function (s) {
      if (s.date !== last) { last = s.date; html += '<h4 class="sched-group">' + WD[parse(s.date).getDay()] + ', ' + HG.fmtDate(s.date) + '</h4>'; }
      html += shiftRow(s);
    });
    return '<div class="sched-list">' + html + '</div>';
  }

  function render() {
    var MONTHS = getMonths();
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
    HG.toast(tr('sched.toast_preset_months', 'Đang xem lịch trong ' + st.back + ' tháng gần nhất.', { n: st.back }), 'info');
  });
  $('sched-apply').addEventListener('click', function () {
    var f = fromIn.value, t = toIn.value;
    if (!f || !t) { HG.toast(tr('sched.err_pick_both_dates', 'Vui lòng chọn đủ "Từ ngày" và "Đến ngày".'), 'error'); return; }
    var fd = parse(f), td = parse(t);
    if (fd > td) { HG.toast(tr('sched.err_from_before_to', '"Từ ngày" phải trước hoặc bằng "Đến ngày".'), 'error'); return; }
    if (fd < minBack(MAX_BACK_MONTHS)) { HG.toast('Chỉ xem được lịch trong ' + MAX_BACK_MONTHS + ' tháng gần nhất (từ ' + HG.fmtDate(iso(minBack(MAX_BACK_MONTHS))) + ').', 'error'); fromIn.value = iso(minBack(MAX_BACK_MONTHS)); return; }
    if (td > maxFuture) { HG.toast('Chỉ xem được lịch đến ' + HG.fmtDate(iso(maxFuture)) + '.', 'error'); toIn.value = iso(maxFuture); return; }
    if ((td - fd) / DAY > 93) { HG.toast(tr('sched.err_max_range', 'Khoảng ngày tối đa là 3 tháng.'), 'error'); return; }
    HG.busy($('sched-apply'), function () { st.from = fd; st.to = td; st.cursor = clampDate(st.cursor, fd, td); render(); HG.toast(tr('sched.toast_range_applied', 'Đã áp dụng khoảng ngày ' + HG.fmtDate(f) + ' → ' + HG.fmtDate(t) + '.', { from: HG.fmtDate(f), to: HG.fmtDate(t) })); }, 450);
  });
  $('sched-legend').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { st.hidden[b.dataset.k] = !st.hidden[b.dataset.k]; render(); } });

  /* ---------- Thêm / sửa ca làm việc (POST / PUT /api/schedules) ---------- */
  var toMin = function (hhmm) { var p = String(hhmm || '').split(':'); return +p[0] * 60 + +p[1]; };
  /* Ca trùng giờ trong cùng ngày (bỏ qua ca đã hủy và chính ca đang sửa). Nối tiếp nhau (08–12 & 12–17) không tính là trùng */
  function findClash(date, from, to, exceptId) {
    var a = toMin(from), b = toMin(to);
    return shifts.filter(function (x) {
      return x.status !== 'cancelled' && x.id !== exceptId && x.date === date && toMin(x.from) < b && toMin(x.to) > a;
    })[0] || null;
  }
  /* Công việc gắn với ca: các tin sinh viên đã ứng tuyển (ưu tiên đã trúng tuyển) */
  function myJobOptions(selectedId) {
    var apps = (HG.applications ? HG.applications() : []).filter(function (a) { return a && a.student_id === sid && a.status_id !== 5 && a.status_id !== 6; })
      .sort(function (a, b) { return (b.status_id === 4 ? 1 : 0) - (a.status_id === 4 ? 1 : 0); });
    var seen = {}, opts = '<option value="">' + E(tr('sched.no_job_linked', 'Không gắn công việc (lịch học, việc cá nhân…)')) + '</option>';
    apps.concat(selectedId ? [{ job_id: selectedId }] : []).forEach(function (a) {
      if (seen[a.job_id]) return; seen[a.job_id] = true;
      var j = jobs.find(function (x) { return x && x.id === a.job_id; }); if (!j) return;
      opts += '<option value="' + j.id + '"' + (j.id === selectedId ? ' selected' : '') + '>' + E(j.title) + (a.status_id === 4 ? ' · ' + E(tr('stu.st.accepted', 'đã trúng tuyển')) : '') + '</option>';
    });
    return opts;
  }
  function shiftForm(existing, presetDate) {
    if (!sid) { HG.toast('Không tìm thấy hồ sơ sinh viên của tài khoản này.', 'error'); return; }
    var editing = !!existing;
    var date = editing ? existing.date : (presetDate || iso(today));
    var titleKey = editing ? 'sched.modal_edit_title' : 'sched.modal_add_title';
    var subKey = editing ? 'sched.save_changes' : 'sched.add_shift';
    HG.modal.open({
      className: 'modal-reason', dismissible: true, labelledBy: 'shift-form-title',
      html: '<h2 id="shift-form-title" data-i18n="' + titleKey + '">' + E(tr(titleKey, editing ? 'Sửa ca làm việc' : 'Thêm ca làm việc')) + '</h2>' +
        '<form class="shift-form" novalidate>' +
        '<label><span data-i18n="sched.lbl_shift_name">' + E(tr('sched.lbl_shift_name', 'Tên ca')) + '</span> <span class="req-star">*</span><input name="title" maxlength="120" placeholder="' + E(tr('sched.ph_shift_name', 'Ví dụ: Ca tối tại quán cà phê')) + '" data-i18n-placeholder="sched.ph_shift_name" value="' + E(editing ? (existing.rawTitle || existing.title) : '') + '"></label>' +
        '<label><span data-i18n="sched.lbl_job">' + E(tr('sched.lbl_job', 'Công việc')) + '</span><select name="job">' + myJobOptions(editing ? existing.job_id : null) + '</select></label>' +
        '<div class="shift-form-row"><label><span data-i18n="sched.lbl_date">' + E(tr('sched.lbl_date', 'Ngày')) + '</span> <span class="req-star">*</span><input type="date" name="date" value="' + date + '" min="' + iso(minBack(MAX_BACK_MONTHS)) + '" max="' + iso(maxFuture) + '"></label>' +
        '<label><span data-i18n="sched.lbl_from">' + E(tr('sched.lbl_from', 'Từ')) + '</span> <span class="req-star">*</span><input type="time" name="from" value="' + (editing ? existing.from : '08:00') + '"></label>' +
        '<label><span data-i18n="sched.lbl_to">' + E(tr('sched.lbl_to', 'Đến')) + '</span> <span class="req-star">*</span><input type="time" name="to" value="' + (editing ? existing.to : '12:00') + '"></label></div>' +
        '<label><span data-i18n="sched.lbl_note">' + E(tr('sched.lbl_note', 'Ghi chú')) + '</span><textarea name="note" rows="2" maxlength="300" placeholder="' + E(tr('sched.ph_optional', 'Không bắt buộc')) + '" data-i18n-placeholder="sched.ph_optional">' + E(editing ? existing.rawNote || '' : '') + '</textarea></label>' +
        '<p class="form-error" role="alert"></p>' +
        '<div class="modal-actions"><button type="button" class="secondary-btn" data-close data-i18n="common.cancel">' + E(tr('common.cancel', 'Hủy')) + '</button><button type="submit" class="primary-btn" data-i18n="' + subKey + '">' + E(tr(subKey, editing ? 'Lưu thay đổi' : 'Thêm ca')) + '</button></div></form>',
      onMount: function (api) {
        var f = api.box.querySelector('form'), err = api.box.querySelector('.form-error');
        if (!editing) f.title.focus();
        var check = function () {
          err.textContent = '';
          var title = f.title.value.trim(), d = f.date.value, a = f.from.value, b = f.to.value;
          if (title.length < 2) return tr('sched.err_title_min', 'Vui lòng nhập tên ca (ít nhất 2 ký tự).');
          if (!d) return tr('sched.err_date_req', 'Vui lòng chọn ngày.');
          var dd = parse(d);
          if (dd < minBack(MAX_BACK_MONTHS) || dd > maxFuture) return 'Chỉ thêm được ca trong khoảng ' + HG.fmtDate(iso(minBack(MAX_BACK_MONTHS))) + ' – ' + HG.fmtDate(iso(maxFuture)) + '.';
          if (!a || !b) return tr('sched.err_time_req', 'Vui lòng chọn giờ bắt đầu và giờ kết thúc.');
          if (toMin(b) <= toMin(a)) return tr('sched.err_time_order', 'Giờ kết thúc phải sau giờ bắt đầu (ca qua đêm hãy tách thành 2 ca).');
          var clash = findClash(d, a, b, editing ? existing.id : null);
          if (clash) return tr('sched.err_clash', 'Trùng lịch với ca "' + clash.title + '" (' + clash.from + '–' + clash.to + ' ngày ' + HG.fmtDate(clash.date) + '). Vui lòng chọn khung giờ khác.', { title: clash.title, from: clash.from, to: clash.to, date: HG.fmtDate(clash.date) });
          return '';
        };
        ['from', 'to', 'date'].forEach(function (n) { f[n].addEventListener('change', function () { var m = check(); if (m && /Trùng lịch|Giờ kết thúc|Time conflict|End time/i.test(m)) err.textContent = m; }); });
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var msg = check(); if (msg) { err.textContent = msg; return; }
          var payload = {
            student_id: sid, title: f.title.value.trim(), job_id: Number(f.job.value) || null, note: f.note.value.trim() || null,
            start_datetime: f.date.value + 'T' + f.from.value + ':00', end_datetime: f.date.value + 'T' + f.to.value + ':00'
          };
          HG.busyAsync(f.querySelector('[type=submit]'), function () { return HG.saveSchedule(payload, editing ? existing.id : null); }).then(function (res) {
            if (res && res.busy) return;
            if (!res || !res.ok) { if (api.isOpen()) err.textContent = (res && res.error) || 'Không lưu được ca làm việc.'; HG.toast((res && res.error) || 'Không lưu được ca làm việc.', 'error'); return; }
            api.close(true);
            shifts = buildShifts();
            st.selected = f.date.value; st.cursor = parse(f.date.value);
            if (parse(f.date.value) < st.from || parse(f.date.value) > st.to) {   /* đưa ngày của ca vào khoảng đang xem */
              st.from = parse(f.date.value) < st.from ? startOfDay(parse(f.date.value)) : st.from;
              st.to = parse(f.date.value) > st.to ? parse(f.date.value) : st.to;
            }
            render();
            HG.toast(editing ? tr('sched.toast_shift_updated', 'Đã cập nhật ca làm việc.') : tr('sched.toast_shift_added', 'Đã thêm ca "' + payload.title + '" ngày ' + HG.fmtDate(f.date.value) + '.', { title: payload.title, date: HG.fmtDate(f.date.value) }));
          });
        });
      }
    });
  }

  host.addEventListener('click', function (e) {
    var addB = e.target.closest('[data-add-shift]');
    if (addB) { shiftForm(null, addB.dataset.addShift || (st.view === 'month' ? st.selected : '')); return; }
    var edB = e.target.closest('[data-edit-shift]');
    if (edB) { var es = shifts.filter(function (x) { return x.id === +edB.dataset.editShift && x.status !== 'cancelled'; })[0]; if (es) shiftForm(es); return; }
    var delB = e.target.closest('[data-del-shift]');
    if (delB) {
      var ds = shifts.filter(function (x) { return x.id === +delB.dataset.delShift; })[0]; if (!ds) return;
      HG.confirm({ title: tr('sched.del_shift_title', 'Xóa ca làm việc?'), message: tr('sched.del_shift_msg', 'Xóa ca "' + ds.title + '" ngày ' + HG.fmtDate(ds.date) + ' (' + ds.from + '–' + ds.to + ')? Thao tác này không thể hoàn tác.', { title: ds.title, date: HG.fmtDate(ds.date), from: ds.from, to: ds.to }), confirmText: tr('sched.del_shift_btn', 'Xóa ca'), cancelText: tr('sched.keep_shift_btn', 'Giữ lại'), danger: true, icon: 'trash' })
        .then(function (ok) {
          if (!ok) return;
          HG.busyAsync(delB, function () { return HG.deleteSchedule(ds.id); }).then(function (res) {
            if (res && res.busy) return;
            if (!res || !res.ok) { HG.toast((res && res.error) || 'Không xóa được ca làm việc.', 'error'); return; }
            shifts = buildShifts(); render(); HG.toast(tr('sched.toast_shift_deleted', 'Đã xóa ca làm việc.'));
          });
        });
      return;
    }
    var fgB = e.target.closest('[data-forget-shift]');
    if (fgB) {
      var cs = HG.read(CANCEL_KEY, {}) || {}; delete cs[fgB.dataset.forgetShift]; HG.write(CANCEL_KEY, cs);
      shifts = buildShifts(); render(); return;
    }
    var cell = e.target.closest('.cal-cell[data-d]');
    if (cell && !cell.disabled) { st.selected = cell.dataset.d; render(); return; }
    var c = e.target.closest('[data-cancel]');
    if (c) {
      var s = shifts.filter(function (x) { return x.id === +c.dataset.cancel; })[0]; if (!s) return;
      HG.confirm({ title: tr('sched.cancel_shift_title', 'Hủy ca làm việc?'), message: tr('sched.cancel_shift_msg', 'Bạn muốn hủy ca "' + s.title + '" ngày ' + HG.fmtDate(s.date) + ' (' + s.from + '–' + s.to + ')? Nhà tuyển dụng sẽ được thông báo.', { title: s.title, date: HG.fmtDate(s.date), from: s.from, to: s.to }), confirmText: tr('sched.cancel_shift_btn', 'Hủy ca'), cancelText: tr('sched.keep_shift_btn', 'Giữ lại'), danger: true })
        .then(function (ok) {
          if (!ok) return;
          HG.busyAsync(c, function () { return HG.deleteSchedule ? HG.deleteSchedule(s.id) : Promise.resolve({ ok: true }); }).then(function (res) {
            if (res && res.busy) return;
            if (!res || !res.ok) { HG.toast((res && res.error) || 'Không hủy được ca làm việc.', 'error'); return; }
            var cancels = HG.read(CANCEL_KEY, {}) || {};
            var snap = { id: s.id, date: s.date, from: s.from, to: s.to, start: s.start, end: s.end, title: s.title, company: s.company, job_id: s.job_id };
            cancels[s.id] = { note: tr('sched.toast_shift_cancelled', 'Bạn đã hủy ca này.'), at: Date.now(), shift: snap };
            HG.write(CANCEL_KEY, cancels);
            shifts = buildShifts();
            var j = jobs.find(function (x) { return x.id === s.job_id; }), ep = j && employer_profiles.find(function (x) { return x.id === j.employer_id; });
            if (ep) HG.notify(ep.user_id, me.full_name + ' đã hủy ca làm ngày ' + HG.fmtDate(s.date) + ' (' + s.from + '–' + s.to + ').', { link: 'employer.html?tab=4', kind: 'shift' });
            render(); HG.toast(tr('sched.toast_shift_cancelled', 'Đã hủy ca làm việc.'));
          });
        });
    }
  });
  window.addEventListener('storage', function (e) { if (e.key === CANCEL_KEY) { shifts = buildShifts(); render(); } });

  /* ---------- Lịch sử lịch rảnh (tối đa 3 tháng) ---------- */
  var SHIFT_KEYS = [['morning', 'Sáng'], ['afternoon', 'Chiều'], ['evening', 'Tối']];
  var histHost = document.getElementById('avail-history');
  function currentAvail() {
    var a = { morning: [], afternoon: [], evening: [] };
    SHIFT_KEYS.forEach(function (k) { for (var i = 0; i < 7; i++) { var cb = document.querySelector('input.avail-check-box[data-shift="' + k[0] + '"][data-day="' + i + '"]'); a[k[0]].push(cb ? cb.checked : false); } });
    return a;
  }
  var countSlots = function (a) { return SHIFT_KEYS.reduce(function (n, k) { return n + (a[k[0]] || []).filter(Boolean).length; }, 0); };
  /* Lịch sử chỉ gồm các lần sinh viên thực sự bấm "Lưu ca rảnh" (không sinh sẵn bản giả lập) */
  var hist = HG.read(HKEY, []);
  if (!Array.isArray(hist)) hist = [];
  hist = hist.filter(function (h) { return h && h.avail && h.ts >= minBack(MAX_BACK_MONTHS).getTime(); });
  function renderHist() {
    if (!histHost) return;
    var list = hist.slice().sort(function (a, b) { return b.ts - a.ts; });
    histHost.innerHTML = '<div class="panel-title"><div><h3 data-i18n="sched.hist_title">' + E(tr('sched.hist_title', 'Lịch sử cập nhật lịch rảnh')) + '</h3><p class="sched-sub" data-i18n="sched.hist_sub">' + E(tr('sched.hist_sub', 'Các phiên bản lịch rảnh bạn đã lưu trong 3 tháng gần nhất.')) + '</p></div></div>' +
      (list.length ? '<div class="hist-list">' + list.map(function (h, i) {
        var d = new Date(h.ts);
        var slotsTxt = tr('sched.hist_slots_week', countSlots(h.avail) + ' ca rảnh mỗi tuần', { count: countSlots(h.avail) });
        return '<div class="hist-row"><div><b>' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>' +
          '<small>' + E(slotsTxt) + (i === 0 ? E(tr('sched.hist_latest', ' · gần nhất')) : '') + '</small></div>' +
          '<button type="button" class="cv-action-btn" data-restore="' + h.ts + '">' + E(tr('sched.restore_btn', 'Khôi phục')) + '</button></div>';
      }).join('') + '</div>' : HG.empty('calendar', tr('sched.hist_empty_title', 'Chưa có lịch sử cập nhật'), tr('sched.hist_empty_desc', 'Mỗi lần bạn bấm "Lưu ca rảnh", một phiên bản sẽ được lưu tại đây.'))) +
      '<div class="sched-note" role="note">' + I('alert', 16) + '<span data-i18n="sched.note_retention">' + E(tr('sched.note_retention', 'Hệ thống chỉ lưu trữ và hiển thị lịch sử lịch làm việc/thời gian rảnh trong vòng 1–3 tháng gần nhất. Vui lòng liên hệ bộ phận hỗ trợ nếu cần tra cứu dữ liệu cũ hơn.')) + '</span></div>';
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
      HG.toast(tr('sched.toast_avail_restored', 'Đã khôi phục lịch rảnh. Nhấn "Lưu ca rảnh" để áp dụng.'), 'info');
    }, 500);
  });

  /* Backend đồng bộ xong -> dựng lại ca làm từ dữ liệu thật */
  document.addEventListener('hg:synced', function () {
    shifts = buildShifts();
    render();
  });
  window.addEventListener('languageChanged', function () {
    renderHist();
    render();
  });

  renderHist();
  render();
})();
